// Server-only helpers for the agreed overdue-rent repayment plan:
// public pay-link lookup, settling installments and saving the card used.
import { BRAND, siteLink } from "@/lib/brand";
import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";

export const PLAN_PAY_LINK_BASE = siteLink("/plan");

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export type PlanInstallment = {
  id: string;
  seq: number;
  due_date: string;
  amount_pence: number;
  status: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Everything a pay link needs: the plan, who it belongs to and what is due. */
export async function loadPlanByToken(token: string) {
  const db = await admin();
  const { data: plan } = await db
    .from("rental_arrears_plans")
    .select("*")
    .eq("pay_token", token)
    .eq("active", true)
    .maybeSingle();
  if (!plan) throw new Error(`This payment link is no longer valid. Please contact ${BRAND.name}.`);

  const { data: rows } = await db
    .from("rental_arrears_installments")
    .select("id, seq, due_date, amount_pence, status")
    .eq("plan_id", (plan as any).id)
    .order("seq");
  const all = (rows ?? []) as PlanInstallment[];
  const unpaid = all.filter((i) => i.status !== "paid");
  const todayIso = isoDay(new Date());
  const due = unpaid.filter((i) => String(i.due_date) <= todayIso);
  const { data: p } = await db.from("profiles").select("full_name").eq("id", (plan as any).user_id).maybeSingle();
  const name: string | null = (p as any)?.full_name ?? null;

  const paidPence = all.filter((i) => i.status === "paid").reduce((s, i) => s + (i.amount_pence ?? 0), 0);
  return {
    plan,
    name,
    all,
    unpaid,
    due,
    duePence: due.reduce((s, i) => s + (i.amount_pence ?? 0), 0),
    remainingPence: unpaid.reduce((s, i) => s + (i.amount_pence ?? 0), 0),
    paidPence,
  };
}

/** Make sure the plan has a Stripe customer so cards can be saved against it. */
export async function ensurePlanCustomer(stripe: any, plan: any, name: string | null): Promise<string> {
  const db = await admin();
  let customerId = plan.stripe_customer_id as string | null;
  if (customerId) {
    try {
      const existing: any = await stripe.customers.retrieve(customerId);
      if (!existing || existing.deleted) customerId = null;
    } catch {
      customerId = null;
    }
  }
  if (!customerId) {
    const created = await stripe.customers.create({ ...(name && { name }), metadata: { arrearsPlanId: plan.id } });
    customerId = created.id;
    await db.from("rental_arrears_plans").update({ stripe_customer_id: customerId }).eq("id", plan.id);
  }
  return customerId!;
}

/** Store the card used on a completed checkout against the plan. */
export async function storePlanCard(session: any, env: StripeEnv, planId: string) {
  try {
    const stripe = createStripeClient(env);
    const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!piId) return;
    const pi: any = await stripe.paymentIntents.retrieve(piId);
    const pmId = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id;
    if (!pmId) return;
    const pm: any = await stripe.paymentMethods.retrieve(pmId);
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (customerId && pm.customer !== customerId) {
      try {
        await stripe.paymentMethods.attach(pmId, { customer: customerId });
      } catch {
        // already attached
      }
    }
    const card = pm.card ?? {};
    const db = await admin();
    await db
      .from("rental_arrears_plans")
      .update({
        ...(customerId && { stripe_customer_id: customerId }),
        default_payment_method_id: pmId,
        card_brand: card.brand ?? null,
        card_last4: card.last4 ?? null,
        card_exp_month: card.exp_month ?? null,
        card_exp_year: card.exp_year ?? null,
        card_updated_at: new Date().toISOString(),
      })
      .eq("id", planId);
  } catch (e) {
    console.error("storePlanCard failed", e);
  }
}

/** Mark installments paid. */
export async function settlePlanInstallments(
  planId: string,
  installmentIds: string[],
  ref: { sessionId?: string; paymentIntent?: string },
) {
  const db = await admin();
  const nowIso = new Date().toISOString();
  const { data: plan } = await db.from("rental_arrears_plans").select("*").eq("id", planId).maybeSingle();
  if (!plan) return;

  const { data: rows } = await db
    .from("rental_arrears_installments")
    .select("id, seq, due_date, amount_pence, status")
    .eq("plan_id", planId)
    .in("id", installmentIds);
  const settling = ((rows ?? []) as PlanInstallment[]).filter((i) => i.status !== "paid");
  if (!settling.length) return;

  await db
    .from("rental_arrears_installments")
    .update({
      status: "paid",
      paid_at: nowIso,
      method: "stripe",
      ...(ref.sessionId && { stripe_session_id: ref.sessionId }),
      ...(ref.paymentIntent && { stripe_payment_intent: ref.paymentIntent }),
    })
    .in(
      "id",
      settling.map((i) => i.id),
    );
}
