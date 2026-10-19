/**
 * Customer credit ("pay later"). A credit sale books the full total as revenue
 * with payment_method "credit"; sales.credit_amount_pence is what the customer
 * owes in total and every payment towards it (including anything paid at the
 * till) is a row in credit_payments. sales.credit_paid_pence / credit_status are
 * a cache of that ledger, refreshed here after each change.
 *
 * Cash payments also go into the open till as a cash-in movement, so the
 * drawer's expected cash still adds up.
 */

export type CreditPayMethod = "cash" | "card" | "bank_transfer";

export function creditStatus(owedPence: number, paidPence: number): "unpaid" | "partial" | "paid" {
  if (paidPence >= owedPence) return "paid";
  return paidPence > 0 ? "partial" : "unpaid";
}

/** Re-sum a sale's succeeded credit payments into its cached paid/status columns. */
export async function refreshSaleCredit(supabase: any, saleId: string) {
  const [{ data: sale, error: sErr }, { data: pays, error: pErr }] = await Promise.all([
    supabase.from("sales").select("credit_amount_pence").eq("id", saleId).maybeSingle(),
    supabase.from("credit_payments").select("amount_pence").eq("sale_id", saleId).eq("status", "succeeded"),
  ]);
  if (sErr) throw sErr;
  if (pErr) throw pErr;
  const owed = sale?.credit_amount_pence ?? 0;
  const paid = (pays ?? []).reduce((a: number, p: any) => a + (p.amount_pence ?? 0), 0);
  const { error } = await supabase
    .from("sales")
    .update({ credit_paid_pence: paid, credit_status: owed > 0 ? creditStatus(owed, paid) : null })
    .eq("id", saleId);
  if (error) throw error;
  return { owed, paid, outstanding: Math.max(0, owed - paid) };
}

/** Record one payment towards a credit sale (and its cash in the open till). */
export async function addCreditPayment(
  supabase: any,
  p: {
    saleId: string;
    receiptNo?: number | string | null;
    amountPence: number;
    method: CreditPayMethod;
    userId: string;
    note?: string | null;
  },
) {
  const { error } = await supabase.from("credit_payments").insert({
    sale_id: p.saleId,
    amount_pence: p.amountPence,
    method: p.method,
    status: "succeeded",
    recorded_by: p.userId,
    note: p.note ?? null,
  });
  if (error) throw error;

  if (p.method === "cash") {
    const { data: till } = await supabase
      .from("till_sessions")
      .select("id")
      .is("closed_at", null)
      .is("deleted_at", null)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (till?.id) {
      await supabase.from("till_cash_movements").insert({
        till_session_id: till.id,
        kind: "cash_in",
        amount_pence: p.amountPence,
        reason: `Credit payment${p.receiptNo ? ` · receipt #${p.receiptNo}` : ""}`,
        created_by: p.userId,
      });
    }
  }
  return refreshSaleCredit(supabase, p.saleId);
}
