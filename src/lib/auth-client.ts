import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AuthRole = "owner" | "admin" | "staff" | "customer";

// Shared across every component in the browser, so moving between sections
// shows the signed-in user and their roles straight away instead of each page
// re-checking them (which briefly showed "no permission"). Only written from
// effects, so it never fills on the server.
let knownSession: Session | null | undefined;
const knownRoles = new Map<string, AuthRole[]>();

export function useAuth() {
  const [session, setSession] = useState<Session | null>(knownSession ?? null);
  const [user, setUser] = useState<User | null>(knownSession?.user ?? null);
  const [loading, setLoading] = useState(knownSession === undefined);
  const cachedRoles = knownSession?.user ? knownRoles.get(knownSession.user.id) : undefined;
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesUserId, setRolesUserId] = useState<string | null>(cachedRoles ? knownSession!.user.id : null);
  const [roles, setRoles] = useState<AuthRole[]>(cachedRoles ?? []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") knownRoles.clear();
      knownSession = s;
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      knownSession = data.session;
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
    const cached = knownRoles.get(user.id);
    if (cached) {
      // Known already: use it now and refresh quietly in the background.
      setRoles(cached);
      setRolesUserId(user.id);
      setRolesLoading(false);
    } else {
      setRoles([]);
      setRolesUserId(null);
      setRolesLoading(true);
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(
        ({ data }) => {
          if (cancelled) return;
          const next = (data ?? []).map((r) => r.role as AuthRole);
          knownRoles.set(user.id, next);
          setRoles((prev) => (prev.length === next.length && prev.every((r, i) => r === next[i]) ? prev : next));
          setRolesUserId(user.id);
          setRolesLoading(false);
        },
        () => {
          if (cancelled) return;
          if (cached) return; // offline: keep the roles we already know
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
