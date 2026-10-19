import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logActivity } from "@/lib/activity-log";
import { addCreditPayment } from "@/lib/credit-ledger";

// Customer credit ("pay later") — see credit-ledger.ts for how it is stored.

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => ["owner", "admin", "staff"].includes(r.role));
  if (!ok) throw new Error("Forbidden");
}

export type CreditSaleRow = {
  id: string;
  receipt_no: number | null;
  created_at: string;
  description: string | null;
  credit_amount_pence: number;
  credit_paid_pence: number;
  credit_status: "unpaid" | "partial" | "paid" | null;
};

export type CreditCustomer = {
  customer: { id: string; name: string; phone: string | null; email: string | null } | null;
  owedPence: number;
  paidPence: number;
  outstandingPence: number;
  sales: CreditSaleRow[];
};

const CREDIT_COLUMNS =
  "id, receipt_no, created_at, description, credit_amount_pence, credit_paid_pence, credit_status, pos_customer_id, pos_customer:pos_customers(id, name, phone, email)";

/** Credit sales grouped by customer: those still owing, or those fully paid. */
export const listCredit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ tab: z.enum(["unpaid", "paid"]).default("unpaid") }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    let q = supabase
      .from("sales")
      .select(CREDIT_COLUMNS)
      .is("deleted_at", null)
      .gt("credit_amount_pence", 0)
      .order("created_at", { ascending: false })
      .limit(1000);
    q = data.tab === "paid" ? q.eq("credit_status", "paid") : q.in("credit_status", ["unpaid", "partial"]);
    const { data: rows, error } = await q;
    if (error) throw error;

    const byCustomer = new Map<string, CreditCustomer>();
    for (const r of rows ?? []) {
      const key = r.pos_customer_id ?? `sale:${r.id}`;
      const entry =
        byCustomer.get(key) ??
        ({ customer: r.pos_customer ?? null, owedPence: 0, paidPence: 0, outstandingPence: 0, sales: [] } as CreditCustomer);
      entry.owedPence += r.credit_amount_pence ?? 0;
      entry.paidPence += r.credit_paid_pence ?? 0;
      entry.outstandingPence += Math.max(0, (r.credit_amount_pence ?? 0) - (r.credit_paid_pence ?? 0));
      entry.sales.push(r);
      byCustomer.set(key, entry);
    }
    const customers = Array.from(byCustomer.values()).sort((a, b) => b.outstandingPence - a.outstandingPence);
    return {
      customers,
      totalOutstandingPence: customers.reduce((a, c) => a + c.outstandingPence, 0),
    };
  });

/** One credit sale with its items and payment history. */
export const getCreditSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ saleId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const [saleRes, itemsRes, paysRes] = await Promise.all([
      supabase.from("sales").select(`${CREDIT_COLUMNS}, amount_pence`).eq("id", data.saleId).maybeSingle(),
      supabase.from("sale_items").select("name, qty, line_total_pence").eq("sale_id", data.saleId).order("created_at"),
      supabase
        .from("credit_payments")
        .select("id, amount_pence, method, note, created_at, recorded_by")
        .eq("sale_id", data.saleId)
        .eq("status", "succeeded")
        .order("created_at"),
    ]);
    if (saleRes.error) throw saleRes.error;
    if (!saleRes.data) throw new Error("Sale not found");
    return { sale: saleRes.data, items: itemsRes.data ?? [], payments: paysRes.data ?? [] };
  });

/** Staff record a payment towards a credit sale (capped at what's still owed). */
export const recordCreditPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        saleId: z.string().uuid(),
        amountPence: z.number().int().positive(),
        method: z.enum(["cash", "card", "bank_transfer"]),
        note: z.string().trim().max(300).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: sale, error } = await supabase
      .from("sales")
      .select("id, receipt_no, credit_amount_pence, credit_paid_pence, deleted_at")
      .eq("id", data.saleId)
      .maybeSingle();
    if (error) throw error;
    if (!sale || sale.deleted_at) throw new Error("Sale not found");
    const outstanding = Math.max(0, (sale.credit_amount_pence ?? 0) - (sale.credit_paid_pence ?? 0));
    if (outstanding <= 0) throw new Error("Nothing is owed on this sale.");
    if (data.amountPence > outstanding) {
      throw new Error(`Only £${(outstanding / 100).toFixed(2)} is owed on this sale.`);
    }
    const result = await addCreditPayment(supabase, {
      saleId: sale.id,
      receiptNo: sale.receipt_no,
      amountPence: data.amountPence,
      method: data.method,
      userId,
      note: data.note || null,
    });
    await logActivity(supabase, {
      actorId: userId,
      module: "sales",
      action: "credit_payment_added",
      label: String(sale.receipt_no ?? sale.id.slice(0, 8)),
      entityId: sale.id,
      details: { amountPence: data.amountPence, method: data.method, outstandingPence: result.outstanding },
    });
    return result;
  });

/** What one customer still owes (for the till warning). */
export const getCustomerCredit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ customerId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: rows, error } = await supabase
      .from("sales")
      .select("credit_amount_pence, credit_paid_pence")
      .eq("pos_customer_id", data.customerId)
      .is("deleted_at", null)
      .in("credit_status", ["unpaid", "partial"]);
    if (error) throw error;
    const outstandingPence = (rows ?? []).reduce(
      (a: number, r: any) => a + Math.max(0, (r.credit_amount_pence ?? 0) - (r.credit_paid_pence ?? 0)),
      0,
    );
    return { outstandingPence, openSales: rows?.length ?? 0 };
  });

/** Outstanding credit per customer id, for the Customers list. */
export const listCustomerBalances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: rows, error } = await supabase
      .from("sales")
      .select("pos_customer_id, credit_amount_pence, credit_paid_pence")
      .is("deleted_at", null)
      .not("pos_customer_id", "is", null)
      .in("credit_status", ["unpaid", "partial"]);
    if (error) throw error;
    const balances: Record<string, number> = {};
    for (const r of rows ?? []) {
      const owed = Math.max(0, (r.credit_amount_pence ?? 0) - (r.credit_paid_pence ?? 0));
      balances[r.pos_customer_id] = (balances[r.pos_customer_id] ?? 0) + owed;
    }
    return balances;
  });
