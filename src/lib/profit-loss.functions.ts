import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { profitWithStockCounts } from "./stock-accounting";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => ["owner", "admin"].includes(r.role));
  if (!ok) throw new Error("Forbidden");
}

/**
 * Profit & Loss for a date range.
 *
 *   Total Sales   = Σ sales.amount_pence          (in range, not soft-deleted)
 *   Refunds       = Σ refunds.amount_pence         (in range, not soft-deleted)
 *   Net Sales     = Total Sales − Refunds
 *
 *   COGS (goods)  = Σ sale_items.qty × cost_price_pence
 *                    (uses sale_items.cost_price_pence when set,
 *                     falls back to products.cost_price_pence)
 *   COGS (L&D)    = Σ lost_damaged_items.total_cost_pence  (in range)
 *   COGS          = Goods + L&D
 *
 *   Gross Profit  = Net Sales − COGS
 *   Expenses      = Σ expenses.amount_pence        (in range, not soft-deleted)
 *   Net Profit    = Gross Profit − Expenses
 *
 * All figures are in pence.
 */
export const getProfitLoss = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        fromDate: z.string(), // YYYY-MM-DD inclusive
        toDate: z.string(),   // YYYY-MM-DD inclusive
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const fromIso = new Date(`${data.fromDate}T00:00:00.000Z`).toISOString();
    const toIso = new Date(`${data.toDate}T23:59:59.999Z`).toISOString();

    // Sales in range — paged so large ranges (year / all time) aren't capped at 1000 rows
    const sales: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error: salesErr } = await supabase
        .from("sales")
        .select("id, amount_pence, created_at")
        .is("deleted_at", null)
        .eq("is_credit_only", false)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: true })
        .range(from, from + 999);
      if (salesErr) throw salesErr;
      sales.push(...(page ?? []));
      if (!page || page.length < 1000) break;
    }

    const saleIds = sales.map((s: any) => s.id);
    const totalSalesPence = sales.reduce((s: number, r: any) => s + (r.amount_pence ?? 0), 0);

    // Sale items → COGS (goods), chunked to keep request URLs short
    let cogsGoodsPence = 0;
    for (let i = 0; i < saleIds.length; i += 200) {
      const chunk = saleIds.slice(i, i + 200);
      for (let from = 0; ; from += 1000) {
        const { data: items, error: itemsErr } = await supabase
          .from("sale_items")
          .select("id, qty, cost_price_pence, product:products(cost_price_pence)")
          .in("sale_id", chunk)
          .order("id")
          .range(from, from + 999);
        if (itemsErr) throw itemsErr;
        for (const it of items ?? []) {
          const cost = it.cost_price_pence ?? it.product?.cost_price_pence ?? 0;
          cogsGoodsPence += Math.round((Number(it.qty) || 0) * cost);
        }
        if (!items || items.length < 1000) break;
      }
    }

    // Refunds
    const { data: refunds, error: refundsErr } = await supabase
      .from("refunds")
      .select("amount_pence")
      .is("deleted_at", null)
      .gte("created_at", fromIso)
      .lte("created_at", toIso);
    if (refundsErr) throw refundsErr;
    const refundsPence = (refunds ?? []).reduce((s: number, r: any) => s + (r.amount_pence ?? 0), 0);

    // Expenses (grouped by category)
    const { data: expenses, error: expErr } = await supabase
      .from("expenses")
      .select("category, amount_pence")
      .is("deleted_at", null)
      .gte("expense_date", data.fromDate)
      .lte("expense_date", data.toDate);
    if (expErr) throw expErr;
    const expensesByCategory: Record<string, number> = {};
    let expensesPence = 0;
    for (const e of expenses ?? []) {
      const cat = e.category || "Uncategorised";
      expensesByCategory[cat] = (expensesByCategory[cat] ?? 0) + (e.amount_pence ?? 0);
      expensesPence += e.amount_pence ?? 0;
    }

    // Lost & damaged
    const { data: ld, error: ldErr } = await supabase
      .from("lost_damaged_items")
      .select("total_cost_pence, reason")
      .is("deleted_at", null)
      .gte("occurred_on", data.fromDate)
      .lte("occurred_on", data.toDate);
    if (ldErr) throw ldErr;
    const lostDamagedByReason: Record<string, number> = {};
    let lostDamagedPence = 0;
    for (const r of ld ?? []) {
      lostDamagedByReason[r.reason] = (lostDamagedByReason[r.reason] ?? 0) + (r.total_cost_pence ?? 0);
      lostDamagedPence += r.total_cost_pence ?? 0;
    }

    const netSalesPence = totalSalesPence - refundsPence;
    const { data: stockAccounts, error: stockErr } = await supabase.rpc("stock_count_accounts", { _from: fromIso, _to: toIso });
    if (stockErr) throw stockErr;
    const stockCountProfitPence = Number(stockAccounts?.profitDeltaPence ?? 0);
    const { cogsPence, grossProfitPence, netProfitPence } = profitWithStockCounts(netSalesPence, cogsGoodsPence, lostDamagedPence, expensesPence, stockCountProfitPence);

    return {
      range: { from: data.fromDate, to: data.toDate },
      totalSalesPence,
      refundsPence,
      netSalesPence,
      cogsGoodsPence,
      lostDamagedPence,
      cogsPence,
      grossProfitPence,
      expensesPence,
      netProfitPence,
      expensesByCategory,
      lostDamagedByReason,
      salesCount: sales?.length ?? 0,
      stockCountProfitPence,
      stockInventoryAssetPence: Number(stockAccounts?.inventoryAssetPence ?? 0),
      stockCountCashPence: Number(stockAccounts?.cashDeltaPence ?? 0),
      stockCountLedger: (stockAccounts?.entries ?? []) as { id: string; created_at: string; product: string; inventoryDeltaPence: number; profitDeltaPence: number; kind: string }[],
    };
  });

/** Line-level rows behind each Profit & Loss summary card (admin only). */
export const getProfitLossDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ kind: z.enum(["sales", "cogs", "gross", "expenses", "net"]), fromDate: z.string(), toDate: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const fromIso = new Date(`${data.fromDate}T00:00:00.000Z`).toISOString();
    const toIso = new Date(`${data.toDate}T23:59:59.999Z`).toISOString();
    type Row = { id: string; date: string; type: string; description: string; detail: string; amountPence: number; extra: [string, string][] };
    const rows: Row[] = [];
    const want = (k: string) => data.kind === k || data.kind === "net" || (data.kind === "gross" && (k === "sales" || k === "cogs"));
    const gbp2 = (p: number) => `£${(p / 100).toFixed(2)}`;
    const time = (iso: string) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—");
    const ukDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

    const sales: any[] = [];
    if (want("sales") || want("cogs")) {
      for (let from = 0; ; from += 1000) {
        const { data: page, error } = await supabase.from("sales").select("*").is("deleted_at", null).eq("is_credit_only", false)
          .gte("created_at", fromIso).lte("created_at", toIso).order("created_at", { ascending: false }).range(from, from + 999);
        if (error) throw error;
        sales.push(...(page ?? []));
        if (!page || page.length < 1000) break;
      }
    }
    const saleById = new Map(sales.map((s) => [s.id, s]));
    const itemsBySale = new Map<string, any[]>();
    if (want("sales") || want("cogs")) {
      const ids = sales.map((s) => s.id);
      for (let i = 0; i < ids.length; i += 200) {
        for (let from = 0; ; from += 1000) {
          const { data: items, error } = await supabase.from("sale_items").select("*, product:products(name, cost_price_pence)").in("sale_id", ids.slice(i, i + 200)).order("id").range(from, from + 999);
          if (error) throw error;
          for (const it of items ?? []) {
            const list = itemsBySale.get(it.sale_id) ?? [];
            list.push(it);
            itemsBySale.set(it.sale_id, list);
            if (want("cogs")) {
              const cost = it.cost_price_pence ?? it.product?.cost_price_pence ?? 0;
              const sale = saleById.get(it.sale_id);
              const qty = Number(it.qty) || 0;
              rows.push({ id: `c-${it.id}`, date: sale?.created_at ?? "", type: "Cost of goods", description: it.product?.name ?? it.name ?? it.description ?? "Item", detail: `${qty} × £${(cost / 100).toFixed(2)}${sale?.receipt_number ? ` · Receipt ${sale.receipt_number}` : ""}`, amountPence: -Math.round(qty * cost), extra: [
                ["Product", it.product?.name ?? it.name ?? it.description ?? "Item"],
                ["Quantity", String(qty)],
                ["Unit cost", gbp2(cost)],
                ["Line cost", gbp2(Math.round(qty * cost))],
                ["Receipt", sale?.receipt_number ?? "—"],
                ["Sale time", sale?.created_at ? `${ukDay(sale.created_at)} ${time(sale.created_at)}` : "—"],
                ["Customer", sale?.customer_name ?? "Walk-in"],
              ] });
            }
          }
          if (!items || items.length < 1000) break;
        }
      }
    }
    if (want("sales")) {
      for (const s of sales) {
        const items = itemsBySale.get(s.id) ?? [];
        rows.push({ id: `s-${s.id}`, date: s.created_at, type: "Sale", description: s.receipt_number ? `Receipt ${s.receipt_number}` : (s.customer_name ?? "Sale"), detail: [s.customer_name, s.payment_method, s.registration ?? s.vehicle_reg].filter(Boolean).join(" · "), amountPence: s.amount_pence ?? 0, extra: [
          ["Time", time(s.created_at)],
          ["Receipt", s.receipt_number ?? "—"],
          ["Customer", s.customer_name ?? "Walk-in"],
          ["Payment method", s.payment_method ?? "—"],
          ["Registration", s.registration ?? s.vehicle_reg ?? "—"],
          ...items.map((it): [string, string] => ["Item", `${it.product?.name ?? it.name ?? it.description ?? "Item"} × ${Number(it.qty) || 0} @ ${gbp2(it.unit_price_pence ?? it.price_pence ?? 0)}`]),
          ["Total", gbp2(s.amount_pence ?? 0)],
        ] });
      }
      const { data: refunds, error } = await supabase.from("refunds").select("*").is("deleted_at", null).gte("created_at", fromIso).lte("created_at", toIso);
      if (error) throw error;
      for (const r of refunds ?? []) rows.push({ id: `r-${r.id}`, date: r.created_at, type: "Refund", description: r.reason ?? "Refund", detail: r.method ?? "", amountPence: -(r.amount_pence ?? 0), extra: [
        ["Time", time(r.created_at)],
        ["Reason", r.reason ?? "—"],
        ["Method", r.method ?? "—"],
        ["Amount", gbp2(r.amount_pence ?? 0)],
      ] });
    }
    if (want("cogs")) {
      const { data: ld, error } = await supabase.from("lost_damaged_items").select("*").is("deleted_at", null).gte("occurred_on", data.fromDate).lte("occurred_on", data.toDate);
      if (error) throw error;
      for (const r of ld ?? []) rows.push({ id: `l-${r.id}`, date: r.occurred_on, type: "Lost & damaged", description: r.product_name ?? r.name ?? r.reason ?? "Lost / damaged", detail: [r.reason, r.notes].filter(Boolean).join(" · "), amountPence: -(r.total_cost_pence ?? 0), extra: [
        ["Product", r.product_name ?? r.name ?? "—"],
        ["Reason", r.reason ?? "—"],
        ["Notes", r.notes ?? "—"],
        ["Total cost", gbp2(r.total_cost_pence ?? 0)],
      ] });
      const { data: acc, error: aErr } = await supabase.rpc("stock_count_accounts", { _from: fromIso, _to: toIso });
      if (aErr) throw aErr;
      for (const e of (acc?.entries ?? []) as any[]) rows.push({ id: `k-${e.id}`, date: e.created_at, type: "Stock count adjustment", description: e.product, detail: e.kind === "undo" ? "Reversal" : "Count correction", amountPence: Number(e.profitDeltaPence ?? 0), extra: [
        ["Product", e.product ?? "—"],
        ["Kind", e.kind === "undo" ? "Reversal of an earlier count" : "Count correction"],
        ["Profit effect", gbp2(Number(e.profitDeltaPence ?? 0))],
        ["Stock value effect", gbp2(Number(e.inventoryDeltaPence ?? 0))],
        ["Cash effect", gbp2(Number(e.cashDeltaPence ?? 0))],
      ] });
    }
    if (want("expenses")) {
      const { data: exp, error } = await supabase.from("expenses").select("*").is("deleted_at", null).gte("expense_date", data.fromDate).lte("expense_date", data.toDate);
      if (error) throw error;
      for (const e of exp ?? []) rows.push({ id: `e-${e.id}`, date: e.expense_date, type: "Expense", description: e.description ?? e.supplier ?? e.category ?? "Expense", detail: [e.category, e.supplier, e.payment_method].filter(Boolean).join(" · "), amountPence: -(e.amount_pence ?? 0), extra: [
        ["Description", e.description ?? "—"],
        ["Category", e.category ?? "—"],
        ["Supplier", e.supplier ?? "—"],
        ["Payment method", e.payment_method ?? "—"],
        ["Notes", e.notes ?? "—"],
        ["Amount", gbp2(e.amount_pence ?? 0)],
      ] });
    }
    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return { rows };
  });
