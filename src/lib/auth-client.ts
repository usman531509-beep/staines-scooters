import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AuthRole = "owner" | "admin" | "staff" | "customer";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesUserId, setRolesUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<AuthRole[]>([]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRoles([]);
      setRolesUserId(null);
      setRolesLoading(false);
      return;
    }
    setRoles([]);
    setRolesUserId(null);
    setRolesLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(
        ({ data }) => {
          if (cancelled) return;
          setRoles((data ?? []).map((r) => r.role as AuthRole));
          setRolesUserId(user.id);
          setRolesLoading(false);
        },
        () => {
          if (cancelled) return;
          setRoles([]);
          setRolesUserId(user.id);
          setRolesLoading(false);
        },
      );
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const hasRole = (r: AuthRole) => roles.includes(r);
  const isStaff = roles.some((r) => r === "owner" || r === "admin" || r === "staff");
  const isAdmin = roles.some((r) => r === "owner" || r === "admin");
  const isOwner = roles.includes("owner");
  const currentUserRolesLoading = !!user && (rolesLoading || rolesUserId !== user.id);

  return { session, user, loading, rolesLoading: currentUserRolesLoading, roles, hasRole, isStaff, isAdmin, isOwner };
}

export async function signOut() {
  await supabase.auth.signOut();
}
