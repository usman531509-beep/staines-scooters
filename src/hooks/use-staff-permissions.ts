import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyStaffPermissions, PERM_KEYS, type PermKey } from "@/lib/loyalty.functions";
import { useAuth } from "@/lib/auth-client";

export type StaffPerms = Record<PermKey, boolean>;

const ALL_FALSE = Object.fromEntries(PERM_KEYS.map((k) => [k, false])) as StaffPerms;
const ALL_TRUE = Object.fromEntries(PERM_KEYS.map((k) => [k, true])) as StaffPerms;

export function useMyStaffPermissions() {
  const { user, isStaff, isAdmin } = useAuth();
  const fn = useServerFn(getMyStaffPermissions);
  const { data, isLoading } = useQuery({
    queryKey: ["my-staff-perms", user?.id],
    queryFn: () => fn(),
    enabled: !!user && isStaff,
    staleTime: 60_000,
  });
  if (!isStaff) return { perms: ALL_FALSE, isAdmin: false, isLoading: false };
  if (isAdmin) return { perms: ALL_TRUE, isAdmin: true, isLoading: false };
  return {
    perms: (data?.perms as StaffPerms) ?? ALL_FALSE,
    isAdmin: !!data?.isAdmin,
    isLoading,
  };
}
