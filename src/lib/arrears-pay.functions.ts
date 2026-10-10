import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOnlinePaymentsEnabled } from "@/lib/online-payments";

const tokenInput = z.object({ token: z.string().trim().min(6).max(64) });

/** Public: what this repayment-plan link owes (no sign-in required). */
export const getArrearsPayLinkInfo = createServerFn({ method: "POST" })
  .inputValidator((d) => tokenInput.parse(d))
  .handler(async ({ data }) => {
    assertOnlinePaymentsEnabled();
    const { loadPlanByToken } = await import("@/lib/arrears-pay.server");
    const info = await loadPlanByToken(data.token);
    const plan: any = info.plan;
    return {
      customerName: info.name,
      title: plan.title as string,
      totalPence: plan.total_pence as number,
      paidPence: info.paidPence,
      remainingPence: info.remainingPence,
      duePence: info.duePence,
      dueInstallments: info.due,
      nextInstallment: info.unpaid[0] ?? null,
      cardBrand: plan.card_brand ?? null,
      cardLast4: plan.card_last4 ?? null,
    };
  });

/** Public: embedded checkout for exactly what is due on the plan. */
export const createArrearsPayLinkCheckout = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    tokenInput
      .extend({ environment: z.enum(["sandbox", "live"]), returnUrl: z.string().url(), payAll: z.boolean().optional() })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ clientSecret: string } | { error: string }> => {
    const { loadPlanByToken, ensurePlanCustomer } = await import("@/lib/arrears-pay.server");
    const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
    try {
      assertOnlinePaymentsEnabled();
      const info = await loadPlanByToken(data.token);
      const plan: any = info.plan;
      const items = data.payAll ? info.unpaid : info.due.length ? info.due : info.unpaid.slice(0, 1);
      const total = items.reduce((s, i) => s + (i.amount_pence ?? 0), 0);
      if (total <= 0) throw new Error("Nothing outstanding — thank you.");

      const stripe = createStripeClient(data.environment);
      const customerId = await ensurePlanCustomer(stripe, plan, info.name);
      const label = `Overdue rent repayment plan — payment${items.length > 1 ? "s" : ""} ${items
        .map((i) => `#${i.seq}`)
        .join(", ")}`;
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price_data: { currency: "gbp", product_data: { name: label }, unit_amount: total }, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        payment_method_types: ["card"],
        payment_intent_data: {
          description: info.name ? `${label} — ${info.name}` : label,
          setup_future_usage: "off_session" as const,
        },
        metadata: {
          rentalKind: "arrears_plan",
          arrearsPlanId: plan.id,
          installmentIds: items.map((i) => i.id).join(","),
          userId: plan.user_id ?? "",
          saveCard: "1",
        },
      });
      return { clientSecret: session.client_secret ?? "" };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

/** Staff/admin: the short pay link for a customer's repayment plan. */
export const getArrearsPayLinkForStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plan_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertOnlinePaymentsEnabled();
    const { supabase, userId } = context as any;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some((r: any) => ["owner", "admin", "staff"].includes(r.role))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { PLAN_PAY_LINK_BASE } = await import("@/lib/arrears-pay.server");
    const { data: plan } = await supabaseAdmin
      .from("rental_arrears_plans").select("id, pay_token").eq("id", data.plan_id).maybeSingle();
    if (!plan) throw new Error("Plan not found");
    let token = (plan as any).pay_token as string | null;
    if (!token) {
      token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      await supabaseAdmin.from("rental_arrears_plans").update({ pay_token: token }).eq("id", data.plan_id);
    }
    return { token, url: `${PLAN_PAY_LINK_BASE}/${token}` };
  });
