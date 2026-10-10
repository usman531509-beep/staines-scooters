import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

// ---------- environment ----------------------------------------------------
export function serverStripeEnv(): StripeEnv {
  const token = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
  return token?.startsWith("pk_live_") ? "live" : "sandbox";
}

// ---------- off-session card collection ------------------------------------
export type ChargeResult = { ok: true; paymentIntent: string } | { ok: false; error: string };

/**
 * Every card the customer has ever used or saved for this rental, most
 * recently saved first, with the rental's preferred card tried first.
 */
async function candidateCards(stripe: any, customerId: string, preferredId: string | null) {
  const ids: string[] = [];
  const cards: Record<string, any> = {};
  try {
    const list = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 20 });
    for (const pm of list.data ?? []) {
      cards[pm.id] = pm.card ?? null;
      ids.push(pm.id);
    }
  } catch (e) {
    console.error("candidateCards list failed", e);
  }
  if (preferredId) {
    const i = ids.indexOf(preferredId);
    if (i > 0) ids.splice(i, 1);
    if (i !== 0) ids.unshift(preferredId);
  }
  return { ids, cards };
}

/**
 * Charge a single unpaid rental week off-session. Every saved card is tried in
 * turn — if the first is declined the next one is attempted, and so on.
 */
export async function chargeRentalWeek(weekId: string, env: StripeEnv = serverStripeEnv()): Promise<ChargeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: wk } = await supabaseAdmin
    .from("rental_weeks")
    .select("*, rental:rentals(*)")
    .eq("id", weekId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!wk) return { ok: false, error: "Week not found" };
  if ((wk as any).status === "paid") return { ok: false, error: "Already paid" };
  const rental: any = (wk as any).rental;
  if (!rental?.stripe_customer_id) return { ok: false, error: "No card stored for this rental" };
  if (((wk as any).amount_pence ?? 0) <= 0) return { ok: false, error: "Nothing to charge" };

  const nowIso = new Date().toISOString();
  const amount = (wk as any).amount_pence as number;
  // Resolve the customer's name so Stripe's payment notification emails and
  // dashboard entries always identify who paid.
  let payerName: string | null = null;
  if (rental.customer_id) {
    const { data: prof } = await supabaseAdmin.from("profiles").select("full_name").eq("id", rental.customer_id).maybeSingle();
    payerName = (prof as any)?.full_name ?? null;
  }
  if (!payerName && rental.rental_customer_id) {
    const { data: rc } = await supabaseAdmin.from("rental_customers").select("full_name").eq("id", rental.rental_customer_id).maybeSingle();
    payerName = (rc as any)?.full_name ?? null;
  }
  const label = `Rental week ${(wk as any).week_start} → ${(wk as any).week_end}${payerName ? ` — ${payerName}` : ""}`;
  const stripe = createStripeClient(env);
  if (payerName) {
    try {
      const cust: any = await stripe.customers.retrieve(rental.stripe_customer_id);
      if (cust && !cust.deleted && cust.name !== payerName) {
        await stripe.customers.update(rental.stripe_customer_id, { name: payerName });
      }
    } catch {
      // non-fatal
    }
  }
  const { ids, cards } = await candidateCards(stripe, rental.stripe_customer_id, rental.default_payment_method_id ?? null);
  if (!ids.length) return { ok: false, error: "No card stored for this rental" };

  const errors: string[] = [];
  for (const pmId of ids) {
    try {
      const intent = await stripe.paymentIntents.create({
        amount,
        currency: "gbp",
        customer: rental.stripe_customer_id,
        payment_method: pmId,
        off_session: true,
        confirm: true,
        description: label,
        metadata: { rentalKind: "rental_weekly", rentalId: rental.id, weekId, userId: rental.customer_id ?? "", customerName: payerName ?? "" },
      });
      if (intent.status !== "succeeded") throw new Error(`Payment ${intent.status}`);

      const card: any = cards[pmId] ?? {};
      await supabaseAdmin
        .from("rental_weeks")
        .update({
          status: "paid",
          paid_at: nowIso,
          stripe_payment_intent: intent.id,
          last_charge_at: nowIso,
          last_charge_error: null,
          charge_attempts: ((wk as any).charge_attempts ?? 0) + 1,
        })
        .eq("id", weekId);
      await supabaseAdmin.from("rental_payments").insert({
        rental_id: rental.id,
        week_id: weekId,
        amount_pence: amount,
        kind: "weekly",
        method: "stripe",
        stripe_session_id: intent.id,
        paid_at: nowIso,
      });
      // Remember the card that worked so it is tried first next week.
      if (pmId !== rental.default_payment_method_id) {
        await supabaseAdmin
          .from("rentals")
          .update({
            default_payment_method_id: pmId,
            card_brand: card.brand ?? null,
            card_last4: card.last4 ?? null,
            card_exp_month: card.exp_month ?? null,
            card_exp_year: card.exp_year ?? null,
            card_updated_at: nowIso,
          })
          .eq("id", rental.id);
      }
      return { ok: true, paymentIntent: intent.id };
    } catch (e) {
      const msg = getStripeErrorMessage(e);
      const c: any = cards[pmId] ?? {};
      errors.push(`${(c.brand ?? "card")} ••••${c.last4 ?? "????"}: ${msg}`);
    }
  }

  const combined = errors.join(" | ") || "Payment failed";
  await supabaseAdmin
    .from("rental_weeks")
    .update({
      last_charge_error: combined,
      last_charge_at: nowIso,
      charge_attempts: ((wk as any).charge_attempts ?? 0) + 1,
    })
    .eq("id", weekId);
  return { ok: false, error: combined };
}
