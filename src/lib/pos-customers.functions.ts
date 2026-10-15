import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Till customers: a plain contact record (name, phone, email) a sale can be
// attached to so it shows on the receipt. No sign-in, loyalty or balances.

export type PosCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  created_at: string;
  /** Null when the customer registered themselves on the website. */
  created_by: string | null;
};

const COLUMNS = "id, name, phone, email, created_at, created_by";

async function staffRoles(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => String(r.role));
  if (!roles.some((r: string) => ["owner", "admin", "staff"].includes(r))) throw new Error("Forbidden");
  return roles;
}

const customerInput = z.object({
  name: z.string().trim().min(1, "Enter the customer's name").max(120),
  phone: z.string().trim().min(5, "Enter the customer's phone number").max(30),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email address"),
});

export const listPosCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ search: z.string().max(120).optional(), limit: z.number().int().min(1).max(500).default(200) }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await staffRoles(supabase, userId);
    let q = supabase.from("pos_customers").select(COLUMNS).is("deleted_at", null).order("name").limit(data.limit);
    const term = (data.search ?? "").trim().replace(/[,()%]/g, " ").trim();
    if (term) {
      const like = `%${term}%`;
      q = q.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []) as PosCustomer[];
  });

export const savePosCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => customerInput.extend({ id: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await staffRoles(supabase, userId);
    const fields = { name: data.name, phone: data.phone, email: data.email };
    const { data: row, error } = data.id
      ? await supabase
          .from("pos_customers")
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq("id", data.id)
          .is("deleted_at", null)
          .select(COLUMNS)
          .single()
      : await supabase.from("pos_customers").insert({ ...fields, created_by: userId }).select(COLUMNS).single();
    if (error) throw error;
    return row as PosCustomer;
  });

/** Hides a customer from the list; past sales keep showing them on receipts. */
export const deletePosCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const roles = await staffRoles(supabase, userId);
    if (!roles.some((r) => r === "owner" || r === "admin")) throw new Error("Only admins can delete customers.");
    const { error } = await supabase
      .from("pos_customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
