// Server-only helpers for the Motorbike Financing module.
import { calculateFinance, gbp, type FinanceInput } from "@/lib/finance-calc";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function logFinanceTx(agreementId: string, kind: string, t: { amount?: number; principal?: number; interest?: number; method?: string; reference?: string | null; note?: string; by?: string | null; undoId?: string | null } = {}) {
  const sb = await db();
  await sb.from("finance_transactions").insert({
    agreement_id: agreementId, kind, amount_pence: t.amount ?? 0, principal_pence: t.principal ?? 0, interest_pence: t.interest ?? 0,
    method: t.method ?? null, reference: t.reference ?? null, note: t.note ?? null, created_by: t.by ?? null, undo_id: t.undoId ?? null,
  });
}

export function agreementToInput(a: any): FinanceInput {
  return {
    cashPricePence: a.cash_price_pence, accessoriesPence: a.accessories_pence, feesPence: a.fees_pence,
    depositPence: a.deposit_pence, partExPence: a.part_ex_pence, partExSettlementPence: a.part_ex_settlement_pence,
    method: a.method, ratePct: Number(a.rate_pct), frequency: a.frequency, termCount: a.term_count, firstPaymentDate: a.first_payment_date, finalPaymentPence: a.final_payment_pence ?? null,
  };
}

/** Replace the schedule with a freshly calculated one (only before any payment is made). */
export async function rebuildFinanceSchedule(agreementId: string) {
  const sb = await db();
  const { data: a } = await sb.from("finance_agreements").select("*").eq("id", agreementId).maybeSingle();
  if (!a) throw new Error("Agreement not found");
  const { count } = await sb.from("finance_instalments").select("id", { count: "exact", head: true }).eq("agreement_id", agreementId).eq("status", "paid");
  if ((count ?? 0) > 0) throw new Error("Payments have already been taken — the terms can no longer be changed.");
  const r = calculateFinance(agreementToInput(a));
  await sb.from("finance_instalments").delete().eq("agreement_id", agreementId);
  await sb.from("finance_instalments").insert(
    r.schedule.map((s) => ({
      agreement_id: agreementId, seq: s.seq, due_date: s.dueDate, opening_pence: s.openingPence, amount_pence: s.amountPence,
      interest_pence: s.interestPence, principal_pence: s.principalPence, closing_pence: s.closingPence,
    })),
  );
  await sb.from("finance_agreements").update({
    credit_pence: r.creditPence, interest_pence: r.interestPence, total_payable_pence: r.totalPayablePence,
    instalment_pence: r.instalmentPence, apr_pct: r.aprPct, updated_at: new Date().toISOString(),
  }).eq("id", agreementId);
  return r;
}

export async function refreshFinanceStatus(agreementId: string) {
  const sb = await db();
  const { data: a } = await sb.from("finance_agreements").select("status").eq("id", agreementId).maybeSingle();
  if (!a || !["active", "signed", "defaulted"].includes(a.status)) return;
  const { count } = await sb.from("finance_instalments").select("id", { count: "exact", head: true }).eq("agreement_id", agreementId).eq("status", "due");
  if ((count ?? 0) === 0) {
    await sb.from("finance_agreements").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", agreementId);
    await logFinanceTx(agreementId, "completed", { note: "All instalments paid — agreement completed" });
  }
}

export async function settleFinanceInstalments(ids: string[], info: { method: string; paymentIntent?: string | null; by?: string | null; undoId?: string | null }) {
  if (!ids.length) return;
  const sb = await db();
  const { data: rows } = await sb.from("finance_instalments").select("*").in("id", ids);
  const agreements = new Set<string>();
  for (const r of (rows ?? []) as any[]) {
    agreements.add(r.agreement_id);
    if (r.status === "paid") continue;
    await sb.from("finance_instalments").update({
      status: "paid", paid_pence: r.amount_pence, paid_at: new Date().toISOString(), method: info.method,
      stripe_payment_intent: info.paymentIntent ?? null, last_charge_error: null,
    }).eq("id", r.id);
    await logFinanceTx(r.agreement_id, "instalment_payment", {
      amount: r.amount_pence, principal: r.principal_pence, interest: r.interest_pence, method: info.method,
      reference: info.paymentIntent ?? null, note: `Instalment #${r.seq}`, by: info.by, undoId: info.undoId,
    });
  }
  for (const a of agreements) await refreshFinanceStatus(a);
}

/** Save the agreement's state before an action so it can be undone. Returns the snapshot id. */
export async function snapshotFinance(agreementId: string, label: string, by?: string | null) {
  const sb = await db();
  const { data: a } = await sb.from("finance_agreements").select("*").eq("id", agreementId).maybeSingle();
  if (!a) return undefined;
  const { data: inst } = await sb.from("finance_instalments").select("*").eq("agreement_id", agreementId);
  const { data: rec } = await sb.from("finance_recoveries").select("*").eq("agreement_id", agreementId);
  const { data: ins } = await sb.from("finance_undo").insert({ agreement_id: agreementId, label, snapshot: { agreement: a, instalments: inst ?? [], recoveries: rec ?? [] }, created_by: by ?? null }).select("id").single();
  return ins?.id as string | undefined;
}

/** Undo snapshots for an agreement, newest first (includes already-undone ones so the audit trail can label them). */
export async function listFinanceUndo(agreementId: string) {
  const sb = await db();
  const { data } = await sb.from("finance_undo").select("id,label,created_at,undone_at").eq("agreement_id", agreementId).order("created_at", { ascending: false }).limit(50);
  return (data ?? []) as any[];
}

/** Undo a specific action (or the most recent one) — newest first, then the one before, and so on. */
export async function undoFinance(agreementId: string, by?: string | null, undoId?: string) {
  const sb = await db();
  let u: any = null;
  if (undoId) {
    const { data } = await sb.from("finance_undo").select("*").eq("id", undoId).eq("agreement_id", agreementId).is("undone_at", null).maybeSingle();
    u = data;
    if (!u) throw new Error("That action has already been undone or is not available.");
  } else {
    const open = (await listFinanceUndo(agreementId)).filter((r) => !r.undone_at);
    if (!open.length) throw new Error("Nothing to undo.");
    u = (await sb.from("finance_undo").select("*").eq("id", open[0].id).single()).data;
  }
  const snap = u.snapshot;
  const { id, ref_no, ...agreement } = snap.agreement;
  await sb.from("finance_agreements").update({ ...agreement, updated_at: new Date().toISOString() }).eq("id", agreementId);
  await sb.from("finance_instalments").delete().eq("agreement_id", agreementId);
  if (snap.instalments?.length) await sb.from("finance_instalments").insert(snap.instalments);
  await sb.from("finance_recoveries").delete().eq("agreement_id", agreementId);
  if (snap.recoveries?.length) await sb.from("finance_recoveries").insert(snap.recoveries);
  // The ledger is append-only: reverse every money movement made since the snapshot.
  const { data: txs } = await sb.from("finance_transactions").select("*").eq("agreement_id", agreementId).gte("created_at", u.created_at);
  for (const t of (txs ?? []) as any[]) {
    if (t.kind === "undo" || !(t.amount_pence || t.principal_pence || t.interest_pence)) continue;
    await logFinanceTx(agreementId, t.kind, { amount: -t.amount_pence, principal: -t.principal_pence, interest: -t.interest_pence, method: t.method ?? undefined, reference: t.reference, note: `Reversal (undo) of ${t.kind.replace(/_/g, " ")}`, by, undoId: u.id });
  }
  // Undoing "Quote created" removes the quote itself.
  if (u.label === "Quote created") await sb.from("finance_agreements").update({ deleted_at: new Date().toISOString() }).eq("id", agreementId);
  await logFinanceTx(agreementId, "undo", { note: `Undid: ${u.label}`, by, undoId: u.id });
  await sb.from("finance_undo").update({ undone_at: new Date().toISOString() }).eq("id", u.id);
  return { label: u.label as string };
}

export { gbp };
