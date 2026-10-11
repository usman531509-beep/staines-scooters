import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AccountShellLayout } from "@/components/AccountShell";

// Only staff / admin / owner accounts have a signed-in area. Remember which
// user was last confirmed so the role lookup runs once per sign-in, not on
// every navigation.
let confirmedStaffId: string | null = null;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    let user = sessionData.session?.user ?? null;
    if (!user) {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/auth" });
      user = data.user;
    }
    if (confirmedStaffId !== user.id) {
      const { data: roles, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      // A failed lookup (e.g. offline) must not sign staff out; pages still
      // enforce their own role checks server-side.
      if (!error) {
        const isStaff = (roles ?? []).some((r) => r.role === "owner" || r.role === "admin" || r.role === "staff");
        if (!isStaff) {
          await supabase.auth.signOut();
          throw redirect({ to: "/auth", search: { denied: 1 } });
        }
        confirmedStaffId = user.id;
      }
    }
    return { user };
  },
  // One shell for every signed-in page, so navigating swaps only the content.
  component: () => (
    <AccountShellLayout>
      <Outlet />
    </AccountShellLayout>
  ),
});
