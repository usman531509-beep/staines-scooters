import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isActivityBlocked, ACTIVITY_BLOCKED_MESSAGE } from "@/lib/activity-access";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => ["owner", "admin"].includes(r.role));
  if (!ok) throw new Error("Forbidden");
}

/** Activity feed for the sales and expenses modules (admins/owners only). */
export const listActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        module: z.enum(["all", "sales", "expenses"]).default("all"),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context as any;
    if (isActivityBlocked(claims?.email)) throw new Error(ACTIVITY_BLOCKED_MESSAGE);
    await assertAdmin(supabase, userId);

    let q = supabase
      .from("activity_log")
      .select("id, actor_id, module, action, label, entity_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.module !== "all") q = q.eq("module", data.module);
    const { data: rows, error } = await q;
    if (error) throw error;

    const actorIds = Array.from(new Set((rows ?? []).map((r: any) => r.actor_id).filter(Boolean)));
    const names = new Map<string, string>();
    if (actorIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds);
      for (const p of profiles ?? []) names.set(p.id, p.full_name || p.email || "Staff");
    }

    return (rows ?? []).map((r: any) => ({
      ...r,
      actor_name: r.actor_id ? (names.get(r.actor_id) ?? "Staff") : "System",
    }));
  });
