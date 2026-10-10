import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => ["owner", "admin", "staff"].includes(r.role));
  if (!ok) throw new Error("Forbidden");
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => ["owner", "admin"].includes(r.role));
  if (!ok) throw new Error("Forbidden");
}

const REASONS = ["lost", "damaged", "theft", "expired", "other"] as const;

export const listLostDamaged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        reason: z.enum(REASONS).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    let q = supabase
      .from("lost_damaged_items")
      .select("*, product:products(id,name,sku)")
      .is("deleted_at", null)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (data.fromDate) q = q.gte("occurred_on", data.fromDate);
    if (data.toDate) q = q.lte("occurred_on", data.toDate);
    if (data.reason) q = q.eq("reason", data.reason);
    const { data: rows, error } = await q;
    if (error) throw error;
    const totalPence = (rows ?? []).reduce((s: number, r: any) => s + (r.total_cost_pence ?? 0), 0);
    return { rows: rows ?? [], totalPence };
  });

export const createLostDamaged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        productId: z.string().uuid().nullable().optional(),
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitCostPence: z.number().int().min(0),
        reason: z.enum(REASONS),
        notes: z.string().optional(),
        occurredOn: z.string(), // YYYY-MM-DD
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: row, error } = await supabase
      .from("lost_damaged_items")
      .insert({
        product_id: data.productId ?? null,
        description: data.description,
        quantity: data.quantity,
        unit_cost_pence: data.unitCostPence,
        reason: data.reason,
        notes: data.notes ?? null,
        occurred_on: data.occurredOn,
        recorded_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteLostDamaged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    // Only the Master Admin (owner) may delete inventory shrinkage records.
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isOwner = (roles ?? []).some((r: any) => r.role === "owner");
    if (!isOwner) throw new Error("Only the Master Admin can delete lost & damaged entries.");
    const { error } = await supabase
      .from("lost_damaged_items")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
