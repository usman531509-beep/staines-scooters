import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isExpenseDeleteBlocked, EXPENSE_DELETE_BLOCKED_MESSAGE } from "@/lib/expense-delete-guard";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Entity types that support soft-delete / restore.
export const RECYCLE_TYPES = [
  "products",
  "categories",
  "expenses",
  "refunds",
  "sales",
  "claims",
  "rentals",
  "rental_bikes",
  "rental_pcns",
] as const;
export type RecycleType = (typeof RECYCLE_TYPES)[number];

const TABLE_FOR: Record<RecycleType, string> = {
  products: "products",
  categories: "categories",
  expenses: "expenses",
  refunds: "refunds",
  sales: "sales",
  claims: "claims",
  rentals: "rentals",
  rental_bikes: "rental_bikes",
  rental_pcns: "rental_pcns",
};

// Extra columns to select per type for a useful label in the bin UI.
const SELECT_FOR: Record<RecycleType, string> = {
  products: "id, name, sku, retail_price_pence, deleted_at",
  categories: "id, name, deleted_at",
  expenses: "id, category, vendor, description, amount_pence, tax_pence, payment_method, expense_date, notes, recurrence, is_template, template_id, created_at, created_by, deleted_at, deleted_by",
  refunds: "id, refund_number, amount_pence, created_at, deleted_at",
  sales: "id, receipt_no, amount_pence, created_at, deleted_at",
  claims: "id, customer_full_name, claim_reference, vehicle_reg, accident_date, deleted_at",
  rentals: "id, customer_id, start_date, weekly_rate_pence, status, deleted_at",
  rental_bikes: "id, make, model, registration, deleted_at",
  rental_pcns: "id, reference, issued_on, amount_pence, deleted_at",
};

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => ["owner", "admin", "staff"].includes(r.role));
  if (!ok) throw new Error("Forbidden");
}

const PERMISSION_FOR: Record<RecycleType, string> = {
  products: "products",
  categories: "categories",
  expenses: "expenses",
  refunds: "refunds",
  sales: "sales",
  claims: "__admin_only__",
  rentals: "__admin_only__",
  rental_bikes: "__admin_only__",
  rental_pcns: "__admin_only__",
};

async function assertRecycleAccess(supabase: any, userId: string, type: RecycleType) {
  const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (roleError) throw roleError;
  const roles = (roleRows ?? []).map((r: any) => r.role);
  if (roles.includes("owner") || roles.includes("admin")) return;
  if (type === "claims") throw new Error("Forbidden");
  if (!roles.includes("staff")) throw new Error("Forbidden");

  const perm = PERMISSION_FOR[type];
  const { data: permissions, error: permError } = await supabase
    .from("staff_permissions")
    .select(perm)
    .eq("user_id", userId)
    .maybeSingle();
  if (permError) throw permError;
  if (!permissions?.[perm]) throw new Error("Forbidden");
}

const typeSchema = z.enum(RECYCLE_TYPES);

export const listRecycled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ type: typeSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context as any;
    if (data.type === "expenses" && isExpenseDeleteBlocked(claims?.email)) {
      throw new Error(EXPENSE_DELETE_BLOCKED_MESSAGE);
    }
    await assertRecycleAccess(supabase, userId, data.type);
    const { data: rows, error } = await supabase
      .from(TABLE_FOR[data.type])
      .select(SELECT_FOR[data.type])
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    const list = (rows ?? []) as any[];

    // Attach the name of whoever deleted each row so the bin can show "Deleted by …".
    const actorIds = Array.from(
      new Set(list.map((r) => r.deleted_by).filter((v: any) => typeof v === "string" && v)),
    );
    if (actorIds.length) {
      const { data: people } = await supabase.from("profiles").select("id, full_name, email").in("id", actorIds);
      const nameFor = new Map<string, string>();
      (people ?? []).forEach((p: any) => {
        const name = (p.full_name || p.email || "").toString().trim();
        if (name) nameFor.set(p.id, name);
      });
      list.forEach((r) => {
        const full = r.deleted_by ? nameFor.get(r.deleted_by) : undefined;
        r.deleted_by_name = full ? full.split(/\s+/)[0] : null;
        r.deleted_by_full_name = full ?? null;
      });
    }
    return list;
  });

const ACTIVITY_MODULE: Partial<Record<RecycleType, "sales" | "expenses">> = { sales: "sales", expenses: "expenses", refunds: "sales" };

async function logRecycleActivity(supabase: any, userId: string, type: RecycleType, id: string, kind: "restored" | "purged") {
  const mod = ACTIVITY_MODULE[type];
  if (!mod) return;
  const { logActivity } = await import("@/lib/activity-log");
  const action = type === "expenses" ? (kind === "restored" ? "expense_restored" : "expense_purged") : kind === "restored" ? "sale_restored" : "sale_purged";
  let label: string | null = id.slice(0, 8);
  if (type === "sales") {
    const { data: row } = await supabase.from("sales").select("receipt_no").eq("id", id).maybeSingle();
    if (row?.receipt_no) label = String(row.receipt_no);
  } else if (type === "expenses") {
    const { data: row } = await supabase.from("expenses").select("description, vendor, category").eq("id", id).maybeSingle();
    label = row?.description || row?.vendor || row?.category || label;
  }
  await logActivity(supabase, { actorId: userId, module: mod, action: action as any, label, entityId: id, details: { type } });
}

export const restoreRecycled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ type: typeSchema, id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertRecycleAccess(supabase, userId, data.type);
    const patch: any = { deleted_at: null, deleted_by: null };
    // Re-activate where applicable so restored items reappear in normal lists.
    if (data.type === "products") patch.is_active = true;
    const { error } = await supabase.from(TABLE_FOR[data.type]).update(patch).eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "recycle_restore",
      entity_type: data.type,
      entity_id: data.id,
    });
    await logRecycleActivity(supabase, userId, data.type, data.id, "restored");
    return { ok: true };
  });

export const purgeRecycled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ type: typeSchema, id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertRecycleAccess(supabase, userId, data.type);

    // Admins/owners may hard-delete anything from any recycle bin.
    // (Historic FKs use ON DELETE CASCADE / SET NULL so receipts stay consistent.)
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    const isAdminOrOwner = roles.includes("owner") || roles.includes("admin");

    if (!isAdminOrOwner) {
      const HISTORICAL: RecycleType[] = ["sales", "refunds"];
      if (HISTORICAL.includes(data.type)) {
        throw new Error("Only an admin can permanently delete this type of record.");
      }
      if (data.type === "products") {
        const { count } = await supabase
          .from("sale_items")
          .select("id", { count: "exact", head: true })
          .eq("product_id", data.id);
        if ((count ?? 0) > 0) {
          throw new Error("Product appears on past sales — only an admin can permanently delete it.");
        }
      }
    }

    await logRecycleActivity(supabase, userId, data.type, data.id, "purged");
    const { error } = await supabase.from(TABLE_FOR[data.type]).delete().eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "recycle_purge",
      entity_type: data.type,
      entity_id: data.id,
    });
    return { ok: true };
  });

export const recycleCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const results = await Promise.all(
      RECYCLE_TYPES.map(async (t) => {
        const { count } = await supabase
          .from(TABLE_FOR[t])
          .select("id", { count: "exact", head: true })
          .not("deleted_at", "is", null);
        return [t, count ?? 0] as const;
      }),
    );
    return Object.fromEntries(results) as Record<RecycleType, number>;
  });
