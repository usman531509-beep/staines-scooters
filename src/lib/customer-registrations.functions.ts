import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Details customers gave on the website's /register form (date of birth,
 * vehicle registration, address). Shown only on the admin Customers page;
 * the till's customer picker never loads them.
 */
export type CustomerRegistration = {
  pos_customer_id: string;
  date_of_birth: string | null;
  vehicle_reg: string | null;
  address: string | null;
  created_at: string;
};

export const listCustomerRegistrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ ids: z.array(z.string().uuid()).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some((r: any) => ["owner", "admin", "staff"].includes(String(r.role)))) throw new Error("Forbidden");
    if (data.ids.length === 0) return {} as Record<string, CustomerRegistration>;
    const { data: rows, error } = await supabase
      .from("customer_registrations")
      .select("pos_customer_id, date_of_birth, vehicle_reg, address, created_at")
      .in("pos_customer_id", data.ids)
      .order("created_at", { ascending: true });
    if (error) throw error;
    // Latest details per customer win, field by field.
    const byCustomer: Record<string, CustomerRegistration> = {};
    for (const r of (rows ?? []) as CustomerRegistration[]) {
      const prev = byCustomer[r.pos_customer_id];
      byCustomer[r.pos_customer_id] = {
        ...r,
        date_of_birth: r.date_of_birth ?? prev?.date_of_birth ?? null,
        vehicle_reg: r.vehicle_reg ?? prev?.vehicle_reg ?? null,
        address: r.address ?? prev?.address ?? null,
      };
    }
    return byCustomer;
  });
