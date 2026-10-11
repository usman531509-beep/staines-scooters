import { type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMyStaffPermissions } from "@/hooks/use-staff-permissions";
import { useAuth } from "@/lib/auth-client";
import { AccountShell } from "./AccountShell";
import type { PermKey } from "@/lib/loyalty.functions";

export function StaffGuard({ perm, children }: { perm: PermKey; children: ReactNode }) {
  const { isStaff, loading, rolesLoading } = useAuth();
  const { perms, isLoading } = useMyStaffPermissions();
  const navigate = useNavigate();

  if (loading || rolesLoading || isLoading) {
    return (
      <AccountShell title="Loading…">
        <p className="text-sm text-ink-muted">Checking access…</p>
      </AccountShell>
    );
  }
  if (!isStaff) {
    return (
      <AccountShell title="Access denied">
        <p className="text-sm text-primary">You do not have access to this area.</p>
      </AccountShell>
    );
  }
  if (!perms[perm]) {
    return (
      <AccountShell title="Access restricted">
        <p className="mb-4 text-sm">
          Your account doesn't have permission to open this area. Ask an admin or owner to enable it for you.
        </p>
        <button
          onClick={() => navigate({ to: "/staff/pos" })}
          className="rounded-sm bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground"
        >
          Back to POS
        </button>
      </AccountShell>
    );
  }
  return <>{children}</>;
}
