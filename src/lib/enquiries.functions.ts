import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Contact-form enquiries from the public site, followed up by staff.

export type Enquiry = {
  id: string;
  name: string;
  email: string;
  phone: string;
  bike: string | null;
  reg: string | null;
  service: string | null;
  message: string | null;
  status: "new" | "done";
  handled_at: string | null;
  created_at: string;
};

async function staffRoles(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => String(r.role));
  if (!roles.some((r: string) => ["owner", "admin", "staff"].includes(r))) throw new Error("Forbidden");
  return roles;
}

export const listEnquiries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ status: z.enum(["new", "done", "all"]).default("new") }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await staffRoles(supabase, userId);
    let q = supabase
      .from("contact_enquiries")
      .select("id, name, email, phone, bike, reg, service, message, status, handled_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []) as Enquiry[];
  });

export const setEnquiryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["new", "done"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await staffRoles(supabase, userId);
    const done = data.status === "done";
    const { error } = await supabase
      .from("contact_enquiries")
      .update({ status: data.status, handled_by: done ? userId : null, handled_at: done ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteEnquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const roles = await staffRoles(supabase, userId);
    if (!roles.some((r) => r === "owner" || r === "admin")) throw new Error("Only admins can delete enquiries.");
    const { error } = await supabase.from("contact_enquiries").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
