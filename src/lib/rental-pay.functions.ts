import { BRAND, siteLink } from "@/lib/brand";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";
import { isWeekDue, rentDueDate } from "@/lib/rental-due";
import { assertOnlinePaymentsEnabled } from "@/lib/online-payments";

const tokenInput = z.object({ token: z.string().trim().min(6).max(64) });

/** Public base URL used for the short pay links shown to staff. */
export const PAY_LINK_BASE = siteLink("/pay");

type DueWeek = { id: string; week_start: string; week_end: string; amount_pence: number; days_charged: number; due_date: string };

async function loadByToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rental } = await supabaseAdmin
    .from("rentals")
    .select(
      "id, admin_id, pay_token, status, billing_day, weekly_rate_pence, start_date, end_date, customer_id, rental_customer_id, stripe_customer_id, bike:rental_bikes(make, model, registration)",
    )
    .eq("pay_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (!rental) throw new Error(`This payment link is no longer valid. Please contact ${BRAND.name}.`);

  let name: string | null = null;
  if ((rental as any).rental_customer_id) {
    const { data: rc } = await supabaseAdmin
      .from("rental_customers").select("full_name").eq("id", (rental as any).rental_customer_id).maybeSingle();
    name = (rc as any)?.full_name ?? null;
  }
  if (!name && (rental as any).customer_id) {
    const { data: p } = await supabaseAdmin
      .from("profiles").select("full_name").eq("id", (rental as any).customer_id).maybeSingle();
    name = (p as any)?.full_name ?? null;
  }

  const billingDay = (rental as any).billing_day ?? 1;
  const { data: weeks } = await supabaseAdmin
    .from("rental_weeks")
    .select("id, week_start, week_end, amount_pence, days_charged, status, deleted_at")
    .eq("rental_id", (rental as any).id)
    .eq("status", "unpaid")
    .is("deleted_at", null)
    .order("week_start");

  const due: DueWeek[] = ((weeks ?? []) as any[])
    .filter((w) => isWeekDue(w.week_end, billingDay))
    .map((w) => ({
      id: w.id,
      week_start: w.week_start,
      week_end: w.week_end,
      amount_pence: w.amount_pence ?? 0,
      days_charged: w.days_charged ?? 7,
      due_date: rentDueDate(w.week_end, billingDay),
    }));

  const total = due.reduce((s, w) => s + w.amount_pence, 0);
  return { rental, name, due, total, billingDay };
}

/** Public: what this pay link owes (no sign-in required). */
export const getRentalPayLinkInfo = createServerFn({ method: "POST" })
  .inputValidator((d) => tokenInput.parse(d))
  .handler(async ({ data }) => {
    assertOnlinePaymentsEnabled();
    const { rental, name, due, total } = await loadByToken(data.token);
    const b: any = (rental as any).bike;
    return {
      customerName: name,
      bike: b ? `${b.make ?? ""} ${b.model ?? ""}`.replace(/\s+/g, " ").trim() : null,
      registration: b?.registration ?? null,
      weeklyRatePence: (rental as any).weekly_rate_pence ?? 0,
      status: (rental as any).status,
      weeks: due,
      totalPence: total,
    };
  });

/** Public: one embedded checkout for exactly what is due — nothing more. */
export const createRentalPayLinkCheckout = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    tokenInput.extend({ environment: z.enum(["sandbox", "live"]), returnUrl: z.string().url() }).parse(d),
  )
  .handler(async ({ data }): Promise<{ clientSecret: string } | { url: string } | { error: string }> => {
    try {
      assertOnlinePaymentsEnabled();
      const { rental, name, due, total } = await loadByToken(data.token);
      if (total <= 0) throw new Error("Nothing outstanding — thank you.");
      // Rentals belonging to admins with their own Stripe account are paid straight into that account.
      const { getConnectedAccountForAdmin, createConnectPlatformClient } = await import("@/lib/stripe-connect.server");
      const connectedId = await getConnectedAccountForAdmin((rental as any).admin_id);
      if (connectedId) {
        const label = `Rental rent (${due.length} week${due.length === 1 ? "" : "s"}: ${due[0].week_start} → ${due[due.length - 1].week_end})`;
        const back = new URL(data.returnUrl);
        back.searchParams.set("acct", connectedId);
        const sess = await createConnectPlatformClient().checkout.sessions.create({
          line_items: [{ price_data: { currency: "gbp", product_data: { name: label }, unit_amount: total }, quantity: 1 }],
          mode: "payment",
          payment_method_types: ["card"],
          success_url: `${back.toString()}&cs={CHECKOUT_SESSION_ID}`,
          cancel_url: data.returnUrl.replace("?paid=1", ""),
          payment_intent_data: { description: name ? `${label} — ${name}` : label },
          metadata: {
            rentalKind: "rental_weekly_bulk", rentalId: (rental as any).id,
            weekFrom: String(due[0].week_start), weekTo: String(due[due.length - 1].week_start), bulkTotal: String(total),
          },
        }, { stripeAccount: connectedId });
        return { url: sess.url ?? "" };
      }
      const stripe = createStripeClient(data.environment as StripeEnv);
      const rentalId = (rental as any).id as string;

      let customerId = (rental as any).stripe_customer_id as string | null;
      if (customerId) {
        try {
          const existing: any = await stripe.customers.retrieve(customerId);
          if (!existing || existing.deleted) customerId = null;
        } catch {
          customerId = null;
        }
      }
      if (!customerId) {
        const created = await stripe.customers.create({ ...(name && { name }), metadata: { rentalId } });
        customerId = created.id;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("rentals").update({ stripe_customer_id: customerId }).eq("id", rentalId);
      }

      const label = `Rental rent (${due.length} week${due.length === 1 ? "" : "s"}: ${due[0].week_start} → ${due[due.length - 1].week_end})`;
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price_data: { currency: "gbp", product_data: { name: label }, unit_amount: total }, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        // Card only — keeps Apple Pay / Google Pay wallets, hides Link ("Onelink").
        payment_method_types: ["card"],
        payment_intent_data: {
          description: name ? `${label} — ${name}` : label,
          setup_future_usage: "off_session" as const,
        },
        metadata: {
          userId: (rental as any).customer_id ?? "",
          rentalKind: "rental_weekly_bulk",
          rentalId,
          weekCount: String(due.length),
          weekFrom: String(due[0].week_start),
          weekTo: String(due[due.length - 1].week_start),
          bulkTotal: String(total),
          saveCard: "1",
        },
      });
      return { clientSecret: session.client_secret ?? "" };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

/** Staff: fetch (creating if needed) the short pay link for a rental. */
export const getRentalPayLinkForStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ rental_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertOnlinePaymentsEnabled();
    const { supabase, userId } = context as any;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some((r: any) => ["owner", "admin", "staff"].includes(r.role))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r } = await supabaseAdmin.from("rentals").select("id, pay_token").eq("id", data.rental_id).maybeSingle();
    if (!r) throw new Error("Rental not found");
    let token = (r as any).pay_token as string | null;
    if (!token) {
      token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      await supabaseAdmin.from("rentals").update({ pay_token: token }).eq("id", data.rental_id);
    }
    return { token, url: `${PAY_LINK_BASE}/${token}` };
  });

/** Staff/admin: take a rent payment in-store — one due week, or everything due. */
export const createStaffRentalCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        rental_id: z.string().uuid(),
        week_id: z.string().uuid().optional(),
        environment: z.enum(["sandbox", "live"]),
        returnUrl: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      assertOnlinePaymentsEnabled();
      const { supabase, userId } = context as any;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (!(roles ?? []).some((r: any) => ["owner", "admin", "staff"].includes(r.role))) throw new Error("Forbidden");

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rental } = await supabaseAdmin
        .from("rentals")
        .select("id, pay_token, billing_day, customer_id, rental_customer_id, stripe_customer_id")
        .eq("id", data.rental_id)
        .is("deleted_at", null)
        .maybeSingle();
      if (!rental) throw new Error("Rental not found");

      let token = (rental as any).pay_token as string | null;
      if (!token) {
        token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
        await supabaseAdmin.from("rentals").update({ pay_token: token }).eq("id", data.rental_id);
      }

      const { name, due } = await loadByToken(token);
      const weeks = data.week_id ? due.filter((w) => w.id === data.week_id) : due;
      if (!weeks.length) throw new Error("Nothing due to collect");
      const total = weeks.reduce((s, w) => s + w.amount_pence, 0);
      if (total <= 0) throw new Error("Nothing due to collect");

      const stripe = createStripeClient(data.environment as StripeEnv);
      const rentalId = (rental as any).id as string;

      let customerId = (rental as any).stripe_customer_id as string | null;
      if (customerId) {
        try {
          const existing: any = await stripe.customers.retrieve(customerId);
          if (!existing || existing.deleted) customerId = null;
        } catch {
          customerId = null;
        }
      }
      if (!customerId) {
        const created = await stripe.customers.create({ ...(name && { name }), metadata: { rentalId } });
        customerId = created.id;
        await supabaseAdmin.from("rentals").update({ stripe_customer_id: customerId }).eq("id", rentalId);
      }

      const label = `Rental rent (${weeks.length} week${weeks.length === 1 ? "" : "s"}: ${weeks[0].week_start} → ${weeks[weeks.length - 1].week_end})`;
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price_data: { currency: "gbp", product_data: { name: label }, unit_amount: total }, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        // Card only — keeps Apple Pay / Google Pay wallets, hides Link ("Onelink").
        payment_method_types: ["card"],
        payment_intent_data: {
          description: name ? `${label} — ${name}` : label,
          setup_future_usage: "off_session" as const,
        },
        metadata: {
          userId: (rental as any).customer_id ?? "",
          rentalKind: "rental_weekly_bulk",
          rentalId,
          weekCount: String(weeks.length),
          weekFrom: String(weeks[0].week_start),
          weekTo: String(weeks[weeks.length - 1].week_start),
          bulkTotal: String(total),
          saveCard: "1",
        },
      });
      return { clientSecret: session.client_secret ?? "" };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });
