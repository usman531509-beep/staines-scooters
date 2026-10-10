// Phase 2–4 finance operations: settlements, termination, notices, recoveries,
// accounts/reconciliation and finance staff permissions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertFinance, financeAccess, FINANCE_PERMS } from "@/lib/finance-perms";
import { earlySettlement, voluntaryTermination, isProtectedGoods, gbp } from "@/lib/finance-calc";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const pence = z.number().int().min(0).max(100000000);
const payMethod = z.enum(["cash", "card_machine", "bank_transfer"]);
const today = () => new Date().toISOString().slice(0, 10);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
async function load(agreementId: string) {
  const sb = await admin();
  const { data: a } = await sb.from("finance_agreements").select("*").eq("id", agreementId).maybeSingle();
  if (!a) throw new Error("Agreement not found");
  const { data: inst } = await sb.from("finance_instalments").select("*").eq("agreement_id", agreementId).order("seq");
  const { data: dep } = await sb.from("finance_transactions").select("amount_pence").eq("agreement_id", agreementId).eq("kind", "deposit");
  const rows = (inst ?? []) as any[];
  const due = rows.filter((r) => r.status === "due");
  const paid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.paid_pence, 0);
  const deposit = (dep ?? []).reduce((s: number, r: any) => s + r.amount_pence, 0);
  const { data: settings, error: settingsError } = await sb.from("finance_settings").select("interest_rebate_enabled").eq("id", 1).maybeSingle();
  if (settingsError) throw new Error(settingsError.message);
  return { sb, a, rows, due, paid, deposit, interestRebateEnabled: settings?.interest_rebate_enabled === true };
}
async function log(sb: any, agreementId: string, kind: string, t: { amount?: number; principal?: number; interest?: number; method?: string | null; reference?: string | null; note?: string | null; by?: string | null; undoId?: string | null }) {
  await sb.from("finance_transactions").insert({
    agreement_id: agreementId, kind, amount_pence: t.amount ?? 0, principal_pence: t.principal ?? 0, interest_pence: t.interest ?? 0,
    method: t.method ?? null, reference: t.reference ?? null, note: t.note ?? null, created_by: t.by ?? null, undo_id: t.undoId ?? null,
  });
}
function summary(x: Awaited<ReturnType<typeof load>>, requestDate = today()) {
  const q = earlySettlement(x.due.map((d) => ({ dueDate: d.due_date, pence: d.amount_pence })), Number(x.a.apr_pct), requestDate, x.interestRebateEnabled);
  const vt = voluntaryTermination(x.a.total_payable_pence, x.paid + x.deposit + (x.a.part_ex_pence ?? 0));
  const principalLeft = x.due.reduce((s, d) => s + d.principal_pence, 0);
  const overdue = x.due.filter((d) => d.due_date < today());
  return {
    settlement: q, interestRebateEnabled: x.interestRebateEnabled, termination: vt, principalLeft,
    protectedGoods: isProtectedGoods(x.a.total_payable_pence, x.paid + x.deposit + (x.a.part_ex_pence ?? 0)),
    overdueCount: overdue.length, overduePence: overdue.reduce((s, d) => s + d.amount_pence, 0),
    paidPence: x.paid, depositPence: x.deposit,
  };
}

/** Everything the admin agreement detail needs for Phase 2 actions. */
export const getFinanceAgreementPosition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ agreementId: z.string().uuid(), requestDate: date.optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const acc = await assertFinance(supabase, userId);
    const x = await load(data.agreementId);
    const { data: rec } = await x.sb.from("finance_recoveries").select("*").eq("agreement_id", data.agreementId).order("created_at", { ascending: false });
    return { ...summary(x, data.requestDate), recoveries: rec ?? [], perms: Object.fromEntries(FINANCE_PERMS.map(([k]) => [k, acc.can(k)])) };
  });

/** Issue a written settlement quote (logged to the audit trail). */
export const issueSettlementQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ agreementId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertFinance(supabase, userId, "settlements");
    const x = await load(data.agreementId);
    const s = summary(x).settlement;
    let undoId: string | undefined;
    { const { snapshotFinance } = await import("@/lib/finance.server"); undoId = await snapshotFinance(data.agreementId, "Settlement quote", userId); }
    await log(x.sb, x.a.id, "settlement_quote", { amount: s.figurePence, note: `Valid to ${s.settlementDate.split("-").reverse().join("/")} · rebate ${gbp(s.rebatePence)}`, by: userId, undoId });
    return s;
  });

/** Customer pays the settlement figure: remaining instalments close and the agreement is settled. */
export const recordEarlySettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ agreementId: z.string().uuid(), method: payMethod, reference: z.string().max(80).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertFinance(supabase, userId, "settlements");
    const x = await load(data.agreementId);
    let undoId: string | undefined;
    { const { snapshotFinance } = await import("@/lib/finance.server"); undoId = await snapshotFinance(data.agreementId, "Early settlement", userId); }
    if (x.a.status !== "active") throw new Error("Only active agreements can be settled.");
    const sm = summary(x);
    const now = new Date().toISOString();
    for (const d of x.due) await x.sb.from("finance_instalments").update({ status: "settled", paid_at: now, method: data.method }).eq("id", d.id);
    const interest = Math.max(0, sm.settlement.figurePence - sm.principalLeft);
    await log(x.sb, x.a.id, "early_settlement", { amount: sm.settlement.figurePence, principal: sm.settlement.figurePence - interest, interest, method: data.method, reference: data.reference ?? null, by: userId, undoId });
    if (sm.settlement.rebatePence) await log(x.sb, x.a.id, "settlement_rebate", { amount: sm.settlement.rebatePence, interest: sm.settlement.rebatePence, note: "Interest rebate (Early Settlement Regulations 2004)", by: userId, undoId });
    await x.sb.from("finance_agreements").update({ status: "settled", updated_at: now }).eq("id", x.a.id);
    return { ok: true, figurePence: sm.settlement.figurePence };
  });

/** Voluntary termination: collect any shortfall to the 50% point and close the agreement. */
export const recordVoluntaryTermination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ agreementId: z.string().uuid(), method: payMethod, collectedPence: pence, note: z.string().max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertFinance(supabase, userId, "settlements");
    const x = await load(data.agreementId);
    let undoId: string | undefined;
    { const { snapshotFinance } = await import("@/lib/finance.server"); undoId = await snapshotFinance(data.agreementId, "Voluntary termination", userId); }
    if (x.a.status !== "active") throw new Error("Only active agreements can be terminated.");
    const sm = summary(x);
    const now = new Date().toISOString();
    for (const d of x.due) await x.sb.from("finance_instalments").update({ status: "terminated" }).eq("id", d.id);
    await log(x.sb, x.a.id, "voluntary_termination", { amount: sm.termination.toPayPence, note: data.note ?? `Half total payable ${gbp(sm.termination.halfPence)} — vehicle to be returned`, by: userId, undoId });
    if (data.collectedPence) await log(x.sb, x.a.id, "termination_payment", { amount: data.collectedPence, principal: data.collectedPence, method: data.method, by: userId, undoId });
    await x.sb.from("finance_agreements").update({ status: "terminated", updated_at: now }).eq("id", x.a.id);
    return { ok: true };
  });

/** Log an arrears / default / termination notice (letter printed from the admin screen). */
export const issueFinanceNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ agreementId: z.string().uuid(), kind: z.enum(["arrears", "nosia", "default", "termination"]), remedyBy: date.optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertFinance(supabase, userId, "arrears");
    const x = await load(data.agreementId);
    let undoId: string | undefined;
    { const { snapshotFinance } = await import("@/lib/finance.server"); undoId = await snapshotFinance(data.agreementId, `Notice: ${data.kind}`, userId); }
    const sm = summary(x);
    await log(x.sb, x.a.id, `notice_${data.kind}`, { amount: sm.overduePence, note: `${sm.overdueCount} missed payment(s)${data.remedyBy ? ` · remedy by ${data.remedyBy.split("-").reverse().join("/")}` : ""}`, by: userId, undoId });
    if (data.kind === "default" && x.a.status === "active") await x.sb.from("finance_agreements").update({ status: "defaulted", updated_at: new Date().toISOString() }).eq("id", x.a.id);
    return { ok: true };
  });

const recoveryInput = z.object({
  id: z.string().uuid().optional().nullable(),
  agreementId: z.string().uuid(),
  kind: z.enum(["return", "voluntary_surrender", "repossession"]),
  status: z.enum(["recovered", "in_storage", "for_sale", "sold", "returned_to_customer"]),
  recoveredOn: date, mileage: z.string().max(12).optional().nullable(), condition: z.string().max(200).optional().nullable(),
  valuationPence: pence, costsPence: pence, salePence: pence, soldOn: date.optional().nullable(),
  courtOrderRef: z.string().max(80).optional().nullable(), notes: z.string().max(1000).optional().nullable(),
});

/** Record or update a vehicle return / repossession. Selling it posts proceeds, costs and any write-off. */
export const saveFinanceRecovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => recoveryInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertFinance(supabase, userId, "recoveries");
    const x = await load(data.agreementId);
    let undoId: string | undefined;
    { const { snapshotFinance } = await import("@/lib/finance.server"); undoId = await snapshotFinance(data.agreementId, "Vehicle recovery", userId); }
    const sm = summary(x);
    if (data.kind === "repossession" && sm.protectedGoods && !data.courtOrderRef)
      throw new Error("Over one third has been paid — these are protected goods. Enter the court order reference before repossessing.");
    const row = {
      agreement_id: data.agreementId, kind: data.kind, status: data.status, recovered_on: data.recoveredOn, mileage: data.mileage ?? null,
      condition: data.condition ?? null, valuation_pence: data.valuationPence, costs_pence: data.costsPence, sale_pence: data.salePence,
      sold_on: data.soldOn ?? null, court_order_ref: data.courtOrderRef ?? null, notes: data.notes ?? null, updated_at: new Date().toISOString(),
    };
    let prev: any = null;
    if (data.id) {
      prev = (await x.sb.from("finance_recoveries").select("*").eq("id", data.id).maybeSingle()).data;
      if (!prev || prev.agreement_id !== data.agreementId) throw new Error("Recovery not found");
      await x.sb.from("finance_recoveries").update(row).eq("id", data.id);
    } else {
      await x.sb.from("finance_recoveries").insert({ ...row, created_by: userId });
      await log(x.sb, x.a.id, `recovery_${data.kind}`, { note: `Vehicle recovered ${data.recoveredOn.split("-").reverse().join("/")}${data.courtOrderRef ? ` · court order ${data.courtOrderRef}` : ""}`, by: userId, undoId });
      if (["active", "defaulted", "terminated"].includes(x.a.status))
        await x.sb.from("finance_agreements").update({ status: "recovered", updated_at: new Date().toISOString() }).eq("id", x.a.id);
    }
    if (data.status === "sold" && prev?.status !== "sold") {
      const owed = x.due.reduce((s, d) => s + d.amount_pence, 0);
      for (const d of x.due) await x.sb.from("finance_instalments").update({ status: "recovered" }).eq("id", d.id);
      if (data.salePence) await log(x.sb, x.a.id, "recovery_sale", { amount: data.salePence, principal: data.salePence, method: "bank_transfer", by: userId, undoId });
      if (data.costsPence) await log(x.sb, x.a.id, "recovery_costs", { amount: data.costsPence, by: userId, undoId });
      const shortfall = owed + data.costsPence - data.salePence;
      if (shortfall > 0) await log(x.sb, x.a.id, "write_off", { amount: shortfall, principal: Math.min(shortfall, sm.principalLeft), note: "Shortfall after sale of recovered vehicle", by: userId, undoId });
      else if (shortfall < 0) await log(x.sb, x.a.id, "surplus_due_to_customer", { amount: -shortfall, note: "Sale surplus owed back to customer", by: userId, undoId });
      await x.sb.from("finance_agreements").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", x.a.id);
    }
    return { ok: true };
  });

/** Phase 3: all finance transactions/agreements for the accounts, ledger and reconciliation views. */
export const getFinanceAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ from: date, to: date }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertFinance(supabase, userId, "accounts");
    const sb = await admin();
    const end = `${data.to}T23:59:59.999Z`;
    const { data: tx } = await sb.from("finance_transactions").select("id,agreement_id,kind,amount_pence,principal_pence,interest_pence,method,reference,note,created_at")
      .gte("created_at", `${data.from}T00:00:00Z`).lte("created_at", end).order("created_at", { ascending: true }).limit(5000);
    const { data: ags } = await sb.from("finance_agreements").select("id,ref_no,status,credit_pence,cash_price_pence,customer_snapshot,company_signed_at,interest_pence").is("deleted_at", null);
    const { data: inst } = await sb.from("finance_instalments").select("agreement_id,status,amount_pence,principal_pence,interest_pence,due_date").eq("status", "due");
    const { data: recs } = await sb.from("finance_reconciliations").select("*").order("created_at", { ascending: false }).limit(100);
    return { tx: tx ?? [], agreements: ags ?? [], dueInstalments: inst ?? [], reconciliations: recs ?? [] };
  });

export const saveFinanceReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ from: date, to: date, method: z.string().max(30), expectedPence: z.number().int(), actualPence: z.number().int(), note: z.string().max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertFinance(supabase, userId, "accounts");
    const sb = await admin();
    await sb.from("finance_reconciliations").insert({ period_from: data.from, period_to: data.to, method: data.method, expected_pence: data.expectedPence, actual_pence: data.actualPence, note: data.note ?? null, created_by: userId });
    return { ok: true };
  });

/** Phase 4: finance staff permissions (owner/admin only). */
export const getFinancePermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertFinance(supabase, userId, undefined, true);
    const sb = await admin();
    const { data: r } = await sb.from("user_roles").select("user_id,role").in("role", ["staff", "admin", "owner"]);
    const ids: string[] = Array.from(new Set<string>((r ?? []).map((x: any) => String(x.user_id))));
    const { data: profs } = ids.length ? await sb.from("profiles").select("id,full_name,email").in("id", ids) : { data: [] };
    const { data: perms } = ids.length ? await sb.from("finance_permissions").select("user_id,perms").in("user_id", ids) : { data: [] };
    return {
      users: ids.map((id) => {
        const rs = (r ?? []).filter((x: any) => x.user_id === id).map((x: any) => x.role);
        const p = (profs ?? []).find((x: any) => x.id === id);
        const pr = (perms ?? []).find((x: any) => x.user_id === id);
        return { id, name: String(p?.full_name ?? ""), email: String(p?.email ?? ""), isAdmin: rs.includes("owner") || rs.includes("admin"), perms: (pr ? pr.perms : null) as string[] | null };
      }),
    };
  });

export const saveFinancePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid(), perms: z.array(z.enum(FINANCE_PERMS.map(([k]) => k) as [string, ...string[]])).max(20) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertFinance(supabase, userId, undefined, true);
    const sb = await admin();
    await sb.from("finance_permissions").upsert({ user_id: data.userId, perms: data.perms, updated_by: userId, updated_at: new Date().toISOString() });
    return { ok: true };
  });

/** Signed-in user's own finance permissions (drives which buttons show). */
export const getMyFinanceAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const a = await financeAccess(supabase, userId);
    return { isAdmin: a.isAdmin, perms: Object.fromEntries(FINANCE_PERMS.map(([k]) => [k, a.can(k)])) as Record<string, boolean> };
  });
