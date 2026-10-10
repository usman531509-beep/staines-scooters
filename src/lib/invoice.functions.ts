import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => ["owner", "admin", "staff"].includes(r.role));
  if (!ok) throw new Error("Forbidden");
}

async function loadSale(supabase: any, saleId: string) {
  const [saleRes, itemsRes] = await Promise.all([
    supabase
      .from("sales")
      .select("*, pos_customer:pos_customers(name), profile:profiles(full_name, bike_reg), vehicle:vehicles(registration)")
      .eq("id", saleId)
      .maybeSingle(),
    supabase.from("sale_items").select("*").eq("sale_id", saleId).order("created_at"),
  ]);
  if (!saleRes.data) throw new Error("Sale not found");
  const sale = saleRes.data;
  const registration = sale.vehicle?.registration ?? sale.profile?.bike_reg ?? null;
  return { sale, items: itemsRes.data ?? [], registration };
}

/** Invoice fields for the printable invoice page. */
export const getInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ saleId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { sale, items, registration } = await loadSale(supabase, data.saleId);
    const { buildInvoiceData } = await import("@/lib/invoice.server");
    return { invoice: buildInvoiceData(sale, items, registration) };
  });
