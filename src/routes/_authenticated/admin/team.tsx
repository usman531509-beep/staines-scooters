import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AccountShell } from "@/components/AccountShell";
import {
  listTeamMembers,
  grantRole,
  adminCreateStaffUser,
  adminSetUserPassword,
} from "@/lib/loyalty.functions";

export const Route = createFileRoute("/_authenticated/admin/team")({
  head: () => ({ meta: [{ title: "Team & Roles — Admin" }] }),
  component: Team,
  errorComponent: ({ error }) => (
    <AccountShell title="Team">
      <p className="text-sm text-primary">{error.message}</p>
    </AccountShell>
  ),
  notFoundComponent: () => (
    <AccountShell title="Team">
      <p>Not found</p>
    </AccountShell>
  ),
});

function Team() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTeamMembers);
  const grantFn = useServerFn(grantRole);
  const createFn = useServerFn(adminCreateStaffUser);
  const setPwFn = useServerFn(adminSetUserPassword);

  const { data, isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => listFn(),
  });
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const grantMut = useMutation({
    mutationFn: (v: { userId: string; role: "staff" | "admin" | "owner"; revoke?: boolean }) =>
      grantFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-members"] }),
    onError: (e: any) => setErr(e.message ?? "Failed"),
  });

  // Create admin form (role fixed to admin — the only visible role)
  const [cEmail, setCEmail] = useState("");
  const [cPass, setCPass] = useState("");
  const [cName, setCName] = useState("");
  const createMut = useMutation({
    mutationFn: () =>
      createFn({ data: { email: cEmail.trim(), password: cPass, fullName: cName || undefined, role: "admin" } }),
    onSuccess: (res: any) => {
      setMsg(res.created ? `Created ${cEmail} as Admin.` : `Updated ${cEmail} — Admin role ensured, password reset.`);
      setCEmail(""); setCPass(""); setCName("");
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (e: any) => setErr(e.message ?? "Failed to create admin"),
  });

  // Reset password form
  const [rEmail, setREmail] = useState("");
  const [rPass, setRPass] = useState("");
  const resetMut = useMutation({
    mutationFn: () => setPwFn({ data: { email: rEmail.trim(), password: rPass } }),
    onSuccess: () => {
      setMsg(`Password reset for ${rEmail}.`);
      setREmail(""); setRPass("");
    },
    onError: (e: any) => setErr(e.message ?? "Failed to reset password"),
  });

  return (
    <AccountShell title="Team & Roles">
      <p className="mb-4 text-sm text-ink-muted">
        Every member here is an <strong>Admin</strong>. The <strong className="text-primary">Master Admin</strong> can add, remove or promote other admins.
      </p>

      {(err || msg) && (
        <div className="mb-4 grid gap-2">
          {err && <p className="rounded-sm border border-primary/40 bg-primary/5 px-3 py-2 text-sm text-primary">{err}</p>}
          {msg && <p className="rounded-sm border border-border bg-surface-elevated px-3 py-2 text-sm">{msg}</p>}
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={(e) => { e.preventDefault(); setErr(null); setMsg(null); createMut.mutate(); }}
          className="rounded-md border border-border bg-surface-elevated p-4"
        >
          <p className="eyebrow mb-3">Create Admin</p>
          <div className="grid gap-2">
            <input required type="email" placeholder="Email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} className="rounded-sm border border-border bg-input px-3 py-2 text-sm" />
            <input required type="text" placeholder="Password (min 8)" value={cPass} onChange={(e) => setCPass(e.target.value)} className="rounded-sm border border-border bg-input px-3 py-2 text-sm" />
            <input type="text" placeholder="Full name (optional)" value={cName} onChange={(e) => setCName(e.target.value)} className="rounded-sm border border-border bg-input px-3 py-2 text-sm" />
            <button disabled={createMut.isPending} className="rounded-sm bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50">
              {createMut.isPending ? "Working…" : "Create / update Admin"}
            </button>
          </div>
        </form>

        <form
          onSubmit={(e) => { e.preventDefault(); setErr(null); setMsg(null); resetMut.mutate(); }}
          className="rounded-md border border-border bg-surface-elevated p-4"
        >
          <p className="eyebrow mb-3">Reset an admin's password</p>
          <div className="grid gap-2">
            <input required type="email" placeholder="Account email" value={rEmail} onChange={(e) => setREmail(e.target.value)} className="rounded-sm border border-border bg-input px-3 py-2 text-sm" />
            <input required type="text" placeholder="New password (min 8)" value={rPass} onChange={(e) => setRPass(e.target.value)} className="rounded-sm border border-border bg-input px-3 py-2 text-sm" />
            <button disabled={resetMut.isPending} className="rounded-sm bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50">
              {resetMut.isPending ? "Resetting…" : "Reset password"}
            </button>
          </div>
        </form>
      </div>

      {isLoading && <p className="text-sm text-ink-muted">Loading team…</p>}
      <div className="grid gap-2">
        {(data ?? []).map((m: any) => {
          const isOwner = m.roles.includes("owner");
          return (
            <div key={m.user_id} className="rounded-md border border-border bg-surface-elevated p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <p className="font-semibold">{m.profile?.full_name ?? m.user_id}</p>
                  <p className="text-xs text-ink-muted">{m.profile?.email ?? "—"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isOwner ? (
                    <span className="inline-flex items-center gap-1 rounded-full border-2 border-primary bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                      ★ Master Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-foreground">
                      Admin
                    </span>
                  )}
                  {/* Owner-only controls (backend also enforces owner-only grantRole) */}
                  {isOwner ? (
                    <button
                      onClick={() => { if (confirm("Revoke Master Admin from this user? They stay an Admin.")) grantMut.mutate({ userId: m.user_id, role: "owner", revoke: true }); }}
                      className="rounded-sm border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs uppercase tracking-widest text-primary hover:border-primary"
                    >
                      Revoke Master
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => { if (confirm("Promote this Admin to Master Admin? They will be able to manage all other admins.")) grantMut.mutate({ userId: m.user_id, role: "owner" }); }}
                        className="rounded-sm border border-border px-3 py-1.5 text-xs uppercase tracking-widest hover:border-primary hover:text-primary"
                      >
                        Make Master
                      </button>
                      <button
                        onClick={() => { if (confirm("Remove Admin access from this user?")) grantMut.mutate({ userId: m.user_id, role: "admin", revoke: true }); }}
                        className="rounded-sm border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs uppercase tracking-widest text-primary hover:border-primary"
                      >
                        Remove Admin
                      </button>
                    </>
                  )}
                </div>
              </div>
              {isOwner && (
                <p className="mt-2 text-[11px] text-ink-muted">Full control over the business, team and destructive actions (delete expenses, delete lost &amp; damaged records).</p>
              )}
            </div>
          );
        })}
        {!isLoading && (data ?? []).length === 0 && (
          <p className="text-sm text-ink-muted">No admin accounts yet.</p>
        )}
      </div>
    </AccountShell>
  );
}

