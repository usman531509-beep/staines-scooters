import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  const ok = (data ?? []).some((r: any) => ["owner", "admin", "staff"].includes(r.role));
  if (!ok) throw new Error("Forbidden");
}

const CASH_IN_KINDS = ["cash_in", "float_in", "owner_cash_in", "add_cash", "pay_in"];
const CASH_OUT_KINDS = ["payout", "cash_out", "drop"];

async function readOpenSession(supabase: any) {
  const { data } = await supabase
    .from("till_sessions")
    .select("*")
    .is("closed_at", null)
    .is("deleted_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function sessionFigures(supabase: any, session: any) {
  if (!session) return { cashSalesPence: 0, addedPence: 0, paidOutPence: 0, inDrawerPence: 0 };
  const [{ data: sales }, { data: movs }] = await Promise.all([
    supabase
      .from("sales")
      .select("amount_pence, cash_part_pence, payment_method")
      .eq("till_session_id", session.id)
      .is("deleted_at", null)
      .eq("is_credit_only", false),
    supabase.from("till_cash_movements").select("kind, amount_pence").eq("till_session_id", session.id),
  ]);
  const cashSalesPence = (sales ?? []).reduce((a: number, s: any) => {
    if (s.payment_method === "cash") return a + (s.amount_pence ?? 0);
    if (s.payment_method === "split") return a + (s.cash_part_pence ?? 0);
    return a;
  }, 0);
  const addedPence = (movs ?? [])
    .filter((m: any) => CASH_IN_KINDS.includes(String(m.kind)))
    .reduce((a: number, m: any) => a + Math.abs(m.amount_pence ?? 0), 0);
  const paidOutPence = (movs ?? [])
    .filter((m: any) => CASH_OUT_KINDS.includes(String(m.kind)))
    .reduce((a: number, m: any) => a + Math.abs(m.amount_pence ?? 0), 0);
  return {
    cashSalesPence,
    addedPence,
    paidOutPence,
    inDrawerPence: (session.opening_float_pence ?? 0) + cashSalesPence + addedPence - paidOutPence,
  };
}

/** Current till state plus today's cash and card takings for the toolbar buttons. */
export const getTillOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const session = await readOpenSession(supabase);
    const figures = await sessionFigures(supabase, session);

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data: today } = await supabase
      .from("sales")
      .select("amount_pence, cash_part_pence, card_part_pence, payment_method")
      .gte("created_at", start.toISOString())
      .is("deleted_at", null)
      .eq("is_credit_only", false);

    let cashTodayPence = 0;
    let cardTodayPence = 0;
    for (const s of today ?? []) {
      const total = s.amount_pence ?? 0;
      if (s.payment_method === "cash") cashTodayPence += total;
      else if (s.payment_method === "card" || s.payment_method === "bank_transfer") cardTodayPence += total;
      else if (s.payment_method === "split") {
        cashTodayPence += s.cash_part_pence ?? 0;
        cardTodayPence += s.card_part_pence ?? 0;
      }
    }
    // Payments towards credit sales are takings on the day they're paid.
    const { data: creditPays } = await supabase
      .from("credit_payments")
      .select("amount_pence, method")
      .eq("status", "succeeded")
      .gte("created_at", start.toISOString());
    for (const p of creditPays ?? []) {
      if (p.method === "cash") cashTodayPence += p.amount_pence ?? 0;
      else cardTodayPence += p.amount_pence ?? 0;
    }
    return { session, ...figures, cashTodayPence, cardTodayPence };
  });

export const openTill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ openingFloatPence: z.number().int().min(0) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const existing = await readOpenSession(supabase);
    if (existing) return existing;
    const { data: row, error } = await supabase
      .from("till_sessions")
      .insert({ opened_by: userId, opening_float_pence: data.openingFloatPence })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const closeTill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ countedPence: z.number().int().min(0), notes: z.string().max(300).optional().nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const session = await readOpenSession(supabase);
    if (!session) throw new Error("The till is not open.");
    const figures = await sessionFigures(supabase, session);
    const expected = figures.inDrawerPence;
    const { error } = await supabase
      .from("till_sessions")
      .update({
        closed_at: new Date().toISOString(),
        closed_by: userId,
        closing_count_pence: data.countedPence,
        expected_close_pence: expected,
        variance_pence: data.countedPence - expected,
        notes: data.notes ?? null,
      })
      .eq("id", session.id);
    if (error) throw error;
    return { expectedPence: expected, variancePence: data.countedPence - expected };
  });

export const addTillCash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        amountPence: z.number().int().positive(),
        kind: z.enum(["cash_in", "payout"]).default("cash_in"),
        reason: z.string().max(200).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const session = await readOpenSession(supabase);
    if (!session) throw new Error("Open the till first.");
    const { error } = await supabase.from("till_cash_movements").insert({
      till_session_id: session.id,
      kind: data.kind,
      amount_pence: data.amountPence,
      reason: data.reason ?? (data.kind === "cash_in" ? "Cash added to till" : "Cash paid out"),
      created_by: userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const listClosedTills = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: sessions } = await supabase
      .from("till_sessions")
      .select("*")
      .not("closed_at", "is", null)
      .is("deleted_at", null)
      .order("closed_at", { ascending: false })
      .limit(500);
    const list = sessions ?? [];
    let movements: any[] = [];
    if (list.length) {
      const { data: movs } = await supabase
        .from("till_cash_movements")
        .select("till_session_id, kind, amount_pence")
        .in(
          "till_session_id",
          list.map((s: any) => s.id),
        );
      movements = movs ?? [];
    }
    return { sessions: list, movements };
  });

/** Sales, expenses and refunds for the report dialog (last 12 months). */
export const getTillReportData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const sinceIso = since.toISOString();
    const sinceDate = sinceIso.slice(0, 10);

    const [{ data: sales }, { data: expenses }, { data: refunds }] = await Promise.all([
      supabase
        .from("sales")
        .select(
          "id, receipt_no, description, amount_pence, subtotal_pence, discount_pence, tax_pence, payment_method, cash_tendered_pence, cash_part_pence, card_part_pence, refunded, created_at, items:sale_items(qty, cost_price_pence, product:products(cost_price_pence))",
        )
        .gte("created_at", sinceIso)
        .is("deleted_at", null)
        .eq("is_credit_only", false)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("expenses")
        .select("id, category, vendor, description, notes, amount_pence, expense_date, created_at")
        .gte("expense_date", sinceDate)
        .is("deleted_at", null)
        .order("expense_date", { ascending: false })
        .limit(2000),
      supabase.from("refunds").select("sale_id, amount_pence, created_at").limit(2000),
    ]);

    return {
      sales: (sales ?? []).map((s: any) => ({
        id: s.id,
        receipt_no: s.receipt_no,
        description: s.description,
        amount_pence: s.amount_pence ?? 0,
        tax_pence: s.tax_pence ?? 0,
        payment_method: s.payment_method,
        cash_tendered_pence: s.cash_tendered_pence,
        refunded: !!s.refunded,
        created_at: s.created_at,
        cogs_pence: (s.items ?? []).reduce(
          (a: number, it: any) =>
            a + Math.round(Number(it.qty ?? 0) * Number(it.cost_price_pence ?? it.product?.cost_price_pence ?? 0)),
          0,
        ),
      })),
      expenses: expenses ?? [],
      refunds: refunds ?? [],
    };
  });
