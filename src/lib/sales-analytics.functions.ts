import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => ["owner", "admin", "staff"].includes(r.role));
  if (!ok) throw new Error("Forbidden");
}

type Period = { from?: string; to?: string };

async function loadPeriod(supabase: any, p: Period) {
  let q = supabase
    .from("sales")
    .select("id, amount_pence, refunded, created_at")
    .is("deleted_at", null)
    .eq("is_credit_only", false);
  if (p.from) q = q.gte("created_at", new Date(`${p.from}T00:00:00.000Z`).toISOString());
  if (p.to) q = q.lte("created_at", new Date(`${p.to}T23:59:59.999Z`).toISOString());
  const { data: sales, error } = await q.limit(20000);
  if (error) throw error;

  const live = (sales ?? []).filter((s: any) => !s.refunded);
  const ids = live.map((s: any) => s.id);
  const totalAmountPence = live.reduce((a: number, s: any) => a + (s.amount_pence ?? 0), 0);

  const products = new Map<string, { name: string; qty: number; revenuePence: number }>();
  let unitsSold = 0;
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300);
    if (!chunk.length) break;
    const { data: items, error: iErr } = await supabase
      .from("sale_items")
      .select("name, qty, line_total_pence, unit_price_pence")
      .in("sale_id", chunk);
    if (iErr) throw iErr;
    for (const it of items ?? []) {
      const name = String(it.name ?? "Unnamed").trim() || "Unnamed";
      const key = name.toLowerCase();
      const qty = Number(it.qty) || 0;
      const rev = it.line_total_pence ?? (it.unit_price_pence ?? 0) * (qty || 1);
      const prev = products.get(key) ?? { name, qty: 0, revenuePence: 0 };
      prev.qty += qty;
      prev.revenuePence += rev ?? 0;
      products.set(key, prev);
      unitsSold += qty;
    }
  }

  return {
    salesCount: live.length,
    totalAmountPence,
    unitsSold,
    products: [...products.values()].sort((a, b) => b.qty - a.qty),
  };
}

/** Product-level sales breakdown for a period, with an optional comparison period. */
export const getSalesAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        compareFrom: z.string().optional(),
        compareTo: z.string().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);

    const current = await loadPeriod(supabase, { from: data.from, to: data.to });
    const previous =
      data.compareFrom || data.compareTo
        ? await loadPeriod(supabase, { from: data.compareFrom, to: data.compareTo })
        : null;

    return {
      range: { from: data.from ?? null, to: data.to ?? null },
      compareRange: previous ? { from: data.compareFrom ?? null, to: data.compareTo ?? null } : null,
      current,
      previous,
    };
  });
