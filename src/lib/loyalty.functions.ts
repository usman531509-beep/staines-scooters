import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============ Helpers ============

async function assertRole(supabase: any, userId: string, roles: string[]) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  const has = (data ?? []).some((r: any) => roles.includes(r.role));
  if (!has) throw new Error("Forbidden");
}

// ============ Admin ============

export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertRole(supabase, userId, ["owner", "admin"]);
    const { data: negativeSales } = await supabase
      .from("sales")
      .select("amount_pence")
      .is("deleted_at", null)
      .lt("amount_pence", 0);
    const negativeSalesRows = (negativeSales ?? []) as Array<{ amount_pence: number }>;
    return {
      negativeSalesCount: negativeSalesRows.length,
      negativeSalesTotalPence: negativeSalesRows.reduce((s, r) => s + (r.amount_pence ?? 0), 0),
    };
  });

export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["owner", "admin", "staff"]),
        revoke: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertRole(supabase, userId, ["owner"]);
    if (data.revoke) {
      await supabase.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    } else {
      await supabase.from("user_roles").insert({ user_id: data.userId, role: data.role });
    }
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: data.revoke ? "revoke_role" : "grant_role",
      entity_type: "user",
      entity_id: data.userId,
      details: { role: data.role },
    });
    return { ok: true };
  });

// ============ PHASE 3: Reports (CSV) ============

function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map(r => keys.map(k => esc(r[k])).join(","))].join("\n");
}

export const getReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      kind: z.enum(["sales", "audit"]),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertRole(supabase, userId, ["owner", "admin"]);
    const table = data.kind === "sales" ? "sales" : "audit_log";
    let q = supabase.from(table).select("*").order("created_at", { ascending: false }).limit(5000);
    if (data.fromDate) q = q.gte("created_at", data.fromDate);
    if (data.toDate) q = q.lte("created_at", data.toDate);
    const { data: rows, error } = await q;
    if (error) throw error;
    return { csv: toCsv(rows ?? []), rowCount: (rows ?? []).length };
  });

// ============ Team & admin utilities ============

// List only staff / admin / owner members (used by /admin/team).
export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertRole(supabase, userId, ["owner", "admin"]);
    const { data: roleRows, error } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["owner", "admin", "staff"]);
    if (error) throw error;
    const rolesByUser = new Map<string, string[]>();
    for (const r of roleRows ?? []) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role);
      rolesByUser.set(r.user_id, list);
    }
    const ids = Array.from(rolesByUser.keys());
    if (!ids.length) return [];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, phone").in("id", ids);
    const profById = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return ids.map((uid) => ({
      user_id: uid,
      roles: rolesByUser.get(uid) ?? [],
      profile: profById.get(uid) ?? null,
    }));
  });

// Owner-only: create a staff/admin user (or reuse existing) and assign role.
export const adminCreateStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(120),
        password: z.string().min(8).max(72),
        fullName: z.string().trim().min(2).max(80).optional(),
        role: z.enum(["staff", "admin", "owner"]).default("staff"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertRole(supabase, userId, ["owner"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find existing user by email (paginate through admin list).
    let existingId: string | null = null;
    for (let page = 1; page <= 20 && !existingId; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const found = list.users.find((u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase());
      if (found) existingId = found.id;
      if (list.users.length < 200) break;
    }

    let newUserId = existingId;
    if (!existingId) {
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: data.fullName ? { full_name: data.fullName } : {},
      });
      if (cErr) throw cErr;
      newUserId = created.user!.id;
    } else {
      // Update password for existing account.
      await supabaseAdmin.auth.admin.updateUserById(existingId, {
        password: data.password,
        email_confirm: true,
      });
    }

    if (!newUserId) throw new Error("Failed to resolve user id");

    // Ensure role.
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: newUserId, role: data.role },
      { onConflict: "user_id,role" },
    );

    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: existingId ? "admin_update_staff" : "admin_create_staff",
      entity_type: "user",
      entity_id: newUserId,
      details: { email: data.email, role: data.role },
    });

    return { ok: true, userId: newUserId, created: !existingId };
  });

// Owner-only: set an arbitrary user's password (by email).
export const adminSetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().trim().email().max(120),
      password: z.string().min(8).max(72),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertRole(supabase, userId, ["owner"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let targetId: string | null = null;
    for (let page = 1; page <= 20 && !targetId; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const found = list.users.find((u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase());
      if (found) targetId = found.id;
      if (list.users.length < 200) break;
    }
    if (!targetId) throw new Error("No account found for that email");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(targetId, {
      password: data.password,
      email_confirm: true,
    });
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "admin_reset_password",
      entity_type: "user",
      entity_id: targetId,
      details: { email: data.email },
    });
    return { ok: true };
  });


// ============ Staff permissions ============

export const PERM_KEYS = ["pos","sales","products","categories","refunds","expenses","reports"] as const;
export type PermKey = typeof PERM_KEYS[number];

const permsSchema = z.object({
  pos: z.boolean(),
  sales: z.boolean(),
  products: z.boolean(),
  categories: z.boolean(),
  refunds: z.boolean(),
  expenses: z.boolean(),
  reports: z.boolean(),
});

export const getMyStaffPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    // owner/admin bypass — return all-true
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    const isAdmin = roles.includes("owner") || roles.includes("admin");
    if (isAdmin) {
      return { isAdmin: true, perms: Object.fromEntries(PERM_KEYS.map((k) => [k, true])) as Record<PermKey, boolean> };
    }
    const { data } = await supabase
      .from("staff_permissions")
      .select("pos,sales,products,categories,refunds,expenses,reports")
      .eq("user_id", userId)
      .maybeSingle();
    const perms = (data ?? { pos: true, sales: false, products: false, categories: false, refunds: false, expenses: false, reports: false });
    return { isAdmin: false, perms: perms as Record<PermKey, boolean> };
  });

export const listStaffPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertRole(supabase, userId, ["owner", "admin"]);
    const { data, error } = await supabase
      .from("staff_permissions")
      .select("user_id,pos,sales,products,categories,refunds,expenses,reports");
    if (error) throw error;
    return data ?? [];
  });

export const setStaffPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), perms: permsSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertRole(supabase, userId, ["owner", "admin"]);
    const { error } = await supabase
      .from("staff_permissions")
      .upsert({ user_id: data.userId, ...data.perms }, { onConflict: "user_id" });
    if (error) throw error;
    return { ok: true };
  });

// ============ System Cache: admin-only log purge ============
export const clearSystemCache = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertRole(supabase, userId, ["owner", "admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const results: Record<string, number> = {};
    async function purge(table: string, col: string) {
      const { count, error } = await (supabaseAdmin as any)
        .from(table)
        .delete({ count: "exact" })
        .lt(col, cutoff);
      if (error) throw new Error(`${table}: ${error.message}`);
      results[table] = count ?? 0;
    }
    await purge("audit_log", "created_at");
    await purge("email_send_log", "created_at");
    await purge("email_log", "created_at");
    
    // used unsubscribe tokens older than cutoff
    const { count: unsubCount, error: unsubErr } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .delete({ count: "exact" })
      .not("used_at", "is", null)
      .lt("used_at", cutoff);
    if (unsubErr) throw new Error(`email_unsubscribe_tokens: ${unsubErr.message}`);
    results["email_unsubscribe_tokens"] = unsubCount ?? 0;

    await supabaseAdmin.from("audit_log").insert({
      actor_id: userId,
      action: "clear_system_cache",
      entity_type: "system",
      entity_id: null,
      details: { purged: results, cutoff },
    });
    return { ok: true, purged: results, cutoff };
  });
