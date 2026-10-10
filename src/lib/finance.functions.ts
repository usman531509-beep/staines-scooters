import { siteLink } from "@/lib/brand";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertFinance, assertFinanceEnabled, financeEnabled, type FinancePerm } from "@/lib/finance-perms";
import { assertOnlinePaymentsEnabled } from "@/lib/online-payments";

const envSchema = z.enum(["sandbox", "live"]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function roles(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: any) => r.role);
}
async function assertStaff(supabase: any, userId: string, adminOnly: boolean | FinancePerm = false, perm?: FinancePerm) {
  if (typeof adminOnly === "string") return assertFinance(supabase, userId, adminOnly);
  return assertFinance(supabase, userId, perm, adminOnly);
}
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
function sortInst(rows: any[]) {
  for (const a of rows) {
    a.instalments = (a.finance_instalments ?? []).sort((x: any, y: any) => x.seq - y.seq);
    delete a.finance_instalments;
  }
  return rows;
}

/** Admin: all agreements and settings for the finance dashboard. */
export const getFinanceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data, error } = await supabase
      .from("finance_agreements")
      .select("*, finance_instalments(*)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: settings } = await supabase.from("finance_settings").select("*").eq("id", 1).maybeSingle();
    const isAdmin = (await roles(supabase, userId)).some((r) => r === "owner" || r === "admin");
    return { agreements: sortInst(data ?? []), settings, isAdmin };
  });

export const getFinanceTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ agreementId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: rows } = await supabase.from("finance_transactions").select("*").eq("agreement_id", data.agreementId).order("created_at", { ascending: false });
    return { rows: rows ?? [] };
  });

const pence = z.number().int().min(0).max(100000000);
const agreementInput = z.object({
  id: z.string().uuid().optional().nullable(),
  customer: z.object({
    full_name: z.string().trim().min(1).max(120), email: z.string().trim().max(200).optional().nullable(),
    phone: z.string().trim().max(40).optional().nullable(), address: z.string().trim().max(400).optional().nullable(),
    date_of_birth: z.string().max(10).optional().nullable(),
  }),
  vehicle: z.object({
    make: z.string().max(60).optional().nullable(), model: z.string().max(80).optional().nullable(), reg: z.string().max(15).optional().nullable(),
    vin: z.string().max(30).optional().nullable(), year: z.string().max(4).optional().nullable(), mileage: z.string().max(10).optional().nullable(),
    condition: z.string().max(40).optional().nullable(), accessories: z.string().max(300).optional().nullable(),
  }),
  cashPricePence: pence, accessoriesPence: pence, feesPence: pence, depositPence: pence, partExPence: pence, partExSettlementPence: pence,
  method: z.enum(["reducing", "flat", "zero"]), ratePct: z.number().min(0).max(100),
  frequency: z.enum(["weekly", "monthly"]), termCount: z.number().int().min(1).max(260), firstPaymentDate: date,
  finalPaymentPence: pence.optional().nullable(),
  affordability: z.object({ incomePence: pence.optional(), outgoingsPence: pence.optional(), employment: z.string().max(60).optional().nullable(), notes: z.string().max(500).optional().nullable() }).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

/** Create or update a quote/approved agreement; terms are recalculated on the server. */
export const saveFinanceAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => agreementInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId, "applications");
    const sb = await admin();
    const row = {
      customer_snapshot: data.customer, vehicle: data.vehicle,
      cash_price_pence: data.cashPricePence, accessories_pence: data.accessoriesPence, fees_pence: data.feesPence,
      deposit_pence: data.depositPence, part_ex_pence: data.partExPence, part_ex_settlement_pence: data.partExSettlementPence,
      method: data.method, rate_pct: data.method === "zero" ? 0 : data.ratePct, frequency: data.frequency, term_count: data.termCount,
      first_payment_date: data.firstPaymentDate, final_payment_pence: data.finalPaymentPence || null, affordability: data.affordability ?? {}, notes: data.notes ?? null,
      updated_at: new Date().toISOString(),
    };
    let id = data.id ?? null;
    let undoId: string | undefined;
    if (id) {
      const { snapshotFinance } = await import("@/lib/finance.server");
      undoId = await snapshotFinance(id, "Edit agreement", userId);
      const { data: cur } = await sb.from("finance_agreements").select("status").eq("id", id).maybeSingle();
      if (!cur) throw new Error("Agreement not found");
      if (!["quote", "approved", "declined"].includes(cur.status)) {
        // Signed/active: only the notes can change.
        await sb.from("finance_agreements").update({ notes: row.notes, updated_at: row.updated_at }).eq("id", id);
        return { id };
      }
      await sb.from("finance_agreements").update(row).eq("id", id);
    } else {
      const { data: ins, error } = await sb.from("finance_agreements").insert({ ...row, created_by: userId }).select("id").single();
      if (error) throw new Error(error.message);
      id = ins.id;
    }
    const { rebuildFinanceSchedule, logFinanceTx, snapshotFinance } = await import("@/lib/finance.server");
    const r = await rebuildFinanceSchedule(id!);
    if (!undoId) undoId = await snapshotFinance(id!, "Quote created", userId);
    await logFinanceTx(id!, data.id ? "terms_updated" : "quote_created", { amount: r.creditPence, interest: r.interestPence, note: `Credit ${r.creditPence}p, APR ${r.aprPct}%`, by: userId, undoId });
    return { id };
  });

/** Move an agreement through its lifecycle. */
export const setFinanceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), action: z.enum(["approve", "decline", "send", "handover", "cancel", "delete", "withdraw"]), note: z.string().max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId, ["approve", "delete", "cancel"].includes(data.action) ? "approve" : "applications");
    if (data.action === "send") assertFinanceEnabled();
    const sb = await admin();
    const { data: a } = await sb.from("finance_agreements").select("*").eq("id", data.id).maybeSingle();
    if (!a) throw new Error("Agreement not found");
    const { logFinanceTx } = await import("@/lib/finance.server");
    const now = new Date().toISOString();
    const { snapshotFinance } = await import("@/lib/finance.server");
    const undoId = await snapshotFinance(a.id, `Status: ${data.action}`, userId);
    const set = async (patch: any) => sb.from("finance_agreements").update({ ...patch, updated_at: now }).eq("id", a.id);
    let signUrl: string | undefined;
    switch (data.action) {
      case "approve":
        if (!["quote", "declined"].includes(a.status)) throw new Error("Only quotes can be approved.");
        await set({ status: "approved" }); break;
      case "decline":
        await set({ status: "declined" }); break;
      case "send": {
        if (!["approved", "sent"].includes(a.status)) throw new Error("Approve the application before sending it for signature.");
        await set({ status: "sent" });
        signUrl = siteLink(`/fa/${a.sign_token}`);
        break;
      }
      case "handover":
        if (a.status !== "signed") throw new Error("The customer must sign before handover.");
        await set(a.company_signature_data ? { status: "active" } : { status: "active", company_signed_by: userId, company_signed_at: now }); break;
      case "withdraw":
        if (!["signed", "active"].includes(a.status)) throw new Error("Only signed agreements can be withdrawn.");
        await set({ status: "withdrawn" }); break;
      case "cancel":
        await set({ status: "cancelled" }); break;
      case "delete": {
        const { count } = await sb.from("finance_instalments").select("id", { count: "exact", head: true }).eq("agreement_id", a.id).eq("status", "paid");
        if ((count ?? 0) > 0) throw new Error("Payments exist — cancel the agreement instead of deleting it.");
        await set({ deleted_at: now }); break;
      }
    }
    await logFinanceTx(a.id, `status_${data.action}`, { note: data.note ?? null as any, by: userId, undoId });
    return { ok: true, signUrl: signUrl ?? siteLink(`/fa/${a.sign_token}`) };
  });

/** Record a payment taken in the shop (cash / card machine / bank transfer) against the next instalments. */
export const recordFinancePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ agreementId: z.string().uuid(), instalmentIds: z.array(z.string().uuid()).min(1).max(260), method: z.enum(["cash", "card_machine", "bank_transfer"]), reference: z.string().max(80).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId, "payments");
    const sb = await admin();
    const { data: rows } = await sb.from("finance_instalments").select("id,agreement_id,status").in("id", data.instalmentIds);
    if ((rows ?? []).some((r: any) => r.agreement_id !== data.agreementId)) throw new Error("Instalment mismatch");
    const { settleFinanceInstalments, snapshotFinance } = await import("@/lib/finance.server");
    const undoId = await snapshotFinance(data.agreementId, `Record payment (${data.instalmentIds.length})`, userId);
    await settleFinanceInstalments(data.instalmentIds, { method: data.method, paymentIntent: data.reference ?? null, by: userId, undoId });
    return { ok: true };
  });

/** Record the deposit received. */
export const recordFinanceDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ agreementId: z.string().uuid(), method: z.enum(["cash", "card_machine", "bank_transfer"]), reference: z.string().max(80).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId, "payments");
    const sb = await admin();
    const { data: a } = await sb.from("finance_agreements").select("deposit_pence").eq("id", data.agreementId).maybeSingle();
    if (!a) throw new Error("Agreement not found");
    const { data: prev } = await sb.from("finance_transactions").select("id").eq("agreement_id", data.agreementId).eq("kind", "deposit").limit(1);
    if (prev?.length) throw new Error("Deposit already recorded.");
    const { logFinanceTx, snapshotFinance } = await import("@/lib/finance.server");
    const undoId = await snapshotFinance(data.agreementId, "Record deposit", userId);
    await logFinanceTx(data.agreementId, "deposit", { amount: a.deposit_pence, principal: a.deposit_pence, method: data.method, reference: data.reference ?? null, by: userId, undoId });
    return { ok: true };
  });

export const saveFinanceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    company_name: z.string().trim().min(1).max(120), company_number: z.string().max(20).nullable(),
    trading_address: z.string().max(300).nullable(), registered_address: z.string().max(300).nullable(), phone: z.string().max(40).nullable(),
    email: z.string().max(120).nullable(), default_rate_pct: z.number().min(0).max(100), default_method: z.enum(["reducing", "flat", "zero"]),
    reminder_days_before: z.number().int().min(0).max(30), extra_terms: z.string().max(10000).nullable(),
    interest_rebate_enabled: z.boolean().default(false),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId, true);
    const { error } = await supabase.from("finance_settings").update({ ...data, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public (token link): read an agreement to sign. Only safe agreement data is returned. */
export const getAgreementForSigning = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ token: z.string().regex(/^[a-f0-9]{20,64}$/) }).parse(i))
  .handler(async ({ data }) => {
    if (!financeEnabled()) return { agreement: null, settings: null };
    const sb = await admin();
    const { data: a } = await sb.from("finance_agreements").select("*, finance_instalments(*)").eq("sign_token", data.token).is("deleted_at", null).maybeSingle();
    if (!a || !["sent", "signed", "active", "completed"].includes(a.status)) return { agreement: null, settings: null };
    const { data: settings } = await sb.from("finance_settings").select("*").eq("id", 1).maybeSingle();
    const { sign_token, signed_ip, affordability, created_by, ...safe } = a;
    return { agreement: sortInst([safe])[0], settings };
  });

export const signAgreement = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    token: z.string().regex(/^[a-f0-9]{20,64}$/), name: z.string().trim().min(3).max(120),
    signature: z.string().startsWith("data:image/png;base64,").max(400000), accept: z.literal(true),
  }).parse(i))
  .handler(async ({ data }) => {
    assertFinanceEnabled();
    const sb = await admin();
    const { data: a } = await sb.from("finance_agreements").select("id,status,customer_snapshot").eq("sign_token", data.token).is("deleted_at", null).maybeSingle();
    if (!a || a.status !== "sent") throw new Error("This agreement is not available for signing.");
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? null;
    const now = new Date();
    const deadline = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);
    const { snapshotFinance, logFinanceTx } = await import("@/lib/finance.server");
    const undoId = await snapshotFinance(a.id, "Customer signed");
    await sb.from("finance_agreements").update({
      status: "signed", signed_name: data.name, signed_at: now.toISOString(), signed_ip: ip, signature_data: data.signature,
      withdrawal_deadline: deadline, updated_at: now.toISOString(),
    }).eq("id", a.id);
    await logFinanceTx(a.id, "customer_signed", { note: `Signed by ${data.name}${ip ? ` from ${ip}` : ""}`, undoId });
    return { ok: true };
  });

/** Undo the most recent finance action (up to the last 3). */
export const listFinanceUndoFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ agreementId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { listFinanceUndo } = await import("@/lib/finance.server");
    return { rows: await listFinanceUndo(data.agreementId) };
  });

export const undoFinanceAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ agreementId: z.string().uuid(), undoId: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId, "payments");
    const { undoFinance } = await import("@/lib/finance.server");
    return undoFinance(data.agreementId, userId, data.undoId);
  });

/** Save the editable agreement draft used for every agreement. */
export const saveAgreementTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ template: z.string().max(100000).nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId, true);
    const sb = await admin();
    const { error } = await sb.from("finance_settings").update({ agreement_template: data.template, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Staff card checkout for one instalment or the full remaining balance (the card is not saved). */
export const createFinanceCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ agreementId: z.string().uuid(), instalmentId: z.string().uuid().optional(), all: z.boolean().optional(), environment: envSchema, returnUrl: z.string().url() }).parse(i))
  .handler(async ({ data, context }): Promise<{ clientSecret?: string; error?: string }> => {
    const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
    try {
      assertFinanceEnabled();
      assertOnlinePaymentsEnabled();
      const { supabase, userId } = context as any;
      await assertStaff(supabase, userId, "charge_cards");
      const sb = await admin();
      const { data: a } = await sb.from("finance_agreements").select("*").eq("id", data.agreementId).is("deleted_at", null).maybeSingle();
      if (!a) return { error: "Agreement not found" };
      if (!["active", "signed", "defaulted"].includes(a.status)) return { error: "This agreement is not open for payments." };
      let q = sb.from("finance_instalments").select("*").eq("agreement_id", a.id).eq("status", "due").order("seq");
      if (!data.all) q = data.instalmentId ? q.eq("id", data.instalmentId) : q.limit(1);
      const { data: due } = await q;
      const rows = (due ?? []) as any[];
      const amount = rows.reduce((t, r) => t + r.amount_pence, 0);
      if (!rows.length || amount <= 0) return { error: "Nothing left to pay." };
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.create({
        mode: "payment", ui_mode: "embedded_page", return_url: data.returnUrl,
        customer_email: a.customer_snapshot?.email || undefined,
        line_items: [{ price_data: { currency: "gbp", product_data: { name: `Finance agreement FA-${a.ref_no} — ${data.all ? "full remaining balance" : `payment ${rows.map((r) => r.seq).join(", ")}`}` }, unit_amount: amount }, quantity: 1 }],
        metadata: { financeAgreementId: a.id, financeInstalmentIds: data.all ? "" : rows.map((r) => r.id).join(","), financeAll: data.all ? "1" : "0" },
      } as any);
      return { clientSecret: (session as any).client_secret ?? "" };
    } catch (e: any) {
      return { error: e?.message ?? getStripeErrorMessage(e) };
    }
  });
