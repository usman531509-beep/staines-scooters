import { FEATURES } from "@/lib/features";

// Finance-specific staff permissions. Owners/admins can do everything. Staff with no
// permissions row keep the default staff access; once an admin saves a row, only the
// ticked permissions apply.
export const FINANCE_PERMS = [
  ["applications", "Create & edit applications/quotes"],
  ["approve", "Approve, cancel & delete agreements"],
  ["payments", "Record cash / card-machine / bank payments"],
  ["charge_cards", "Take online card payments"],
  ["settlements", "Early settlements & voluntary termination"],
  ["arrears", "Issue arrears & default notices"],
  ["recoveries", "Returns & repossessions"],
  ["accounts", "View finance accounts & reconcile"],
] as const;
export type FinancePerm = (typeof FINANCE_PERMS)[number][0];

/** Finance is hidden while FEATURES.finance is off: no signing links or public agreement pages. */
export function financeEnabled() {
  return FEATURES.finance;
}
export function assertFinanceEnabled() {
  if (!FEATURES.finance) throw new Error("Motorbike finance is not available.");
}
const ADMIN_DEFAULT: FinancePerm[] = ["approve"];

export async function financeAccess(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles: string[] = (data ?? []).map((r: any) => r.role);
  const isAdmin = roles.some((r) => r === "owner" || r === "admin");
  const isStaff = isAdmin || roles.includes("staff");
  let perms: string[] | null = null;
  if (!isAdmin && isStaff) {
    const { data: p } = await supabase.from("finance_permissions").select("perms").eq("user_id", userId).maybeSingle();
    perms = p ? p.perms : null;
  }
  const can = (perm: FinancePerm) => {
    if (isAdmin) return true;
    if (!isStaff) return false;
    if (perms === null) return !ADMIN_DEFAULT.includes(perm);
    return perms.includes(perm);
  };
  return { isAdmin, isStaff, can };
}

export async function assertFinance(supabase: any, userId: string, perm?: FinancePerm, adminOnly = false) {
  const a = await financeAccess(supabase, userId);
  if (!a.isStaff || (adminOnly && !a.isAdmin) || (perm && !a.can(perm))) throw new Error("You don't have permission for this finance action.");
  return a;
}
