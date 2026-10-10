import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, CheckCircle2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { normalizePassword } from "@/lib/password";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: `Reset Password — ${BRAND.name}` },
      { name: "description", content: `Set a new password for your ${BRAND.name} account.` },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase reset link contains a recovery token in the URL hash; the client
    // parses it automatically and fires PASSWORD_RECOVERY / SIGNED_IN events.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 1) return setErr("Please enter a password.");
    if (password !== confirm) return setErr("Passwords do not match.");
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: normalizePassword(password) });
      if (error) {
        // Supabase rejects reusing the current password with code
        // "same_password". The user explicitly wants to allow this, so treat
        // it as a successful reset instead of surfacing the error.
        const code = (error as any).code ?? "";
        const msg = (error.message ?? "").toLowerCase();
        const isSamePassword =
          code === "same_password" ||
          msg.includes("should be different from the old password") ||
          msg.includes("new password should be different");
        if (!isSamePassword) throw error;
      }
      setDone(true);
      // /auth sends staff on to the till and signs anyone else out.
      setTimeout(() => navigate({ to: "/auth" }), 1500);
    } catch (e: any) {
      setErr(e.message ?? "Could not update password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SiteLayout>
      <section className="section-pad">
        <div className="container-x max-w-lg">
          <p className="eyebrow">Reset password</p>
          <h1 className="mt-3 font-display text-4xl uppercase">Set a new password</h1>

          {!ready && <p className="mt-6 text-sm text-ink-muted">Checking your link…</p>}

          {ready && !hasSession && (
            <div className="mt-6 rounded-md border border-primary/40 bg-primary/5 p-6 text-sm">
              <p className="font-semibold text-primary">This link isn't valid or has expired.</p>
              <p className="mt-2 text-ink-muted">
                Head back to <a href="/auth" className="text-primary underline">sign in</a> and use
                "Forgot password?" to request a fresh link.
              </p>
            </div>
          )}

          {ready && hasSession && !done && (
            <form onSubmit={handleSubmit} className="mt-6 grid gap-4 rounded-md border border-border bg-surface-elevated p-6">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">New password</span>
                <div className="flex items-center gap-2 rounded-sm border border-border bg-input px-3 focus-within:border-primary">
                  <Lock className="h-4 w-4 text-ink-muted" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={1}
                    className="flex-1 bg-transparent py-3 text-sm text-foreground focus:outline-none"
                  />
                </div>
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Confirm password</span>
                <div className="flex items-center gap-2 rounded-sm border border-border bg-input px-3 focus-within:border-primary">
                  <Lock className="h-4 w-4 text-ink-muted" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={1}
                    className="flex-1 bg-transparent py-3 text-sm text-foreground focus:outline-none"
                  />
                </div>
              </label>
              {err && <p className="rounded-sm border border-primary/40 bg-primary/5 px-3 py-2 text-sm text-primary">{err}</p>}
              <button
                type="submit"
                disabled={saving}
                className="mt-2 rounded-sm bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
              >
                {saving ? "Saving…" : "Update password"}
              </button>
            </form>
          )}

          {done && (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-md border border-primary/40 bg-primary/5 p-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <p className="font-display text-2xl uppercase">Password updated</p>
              <p className="text-sm text-ink-muted">Redirecting to your card…</p>
            </div>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
