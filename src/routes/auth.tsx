import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Store,
  X,
  type LucideIcon,
} from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { LandingBrand } from "@/components/LandingBrand";
import { supabase } from "@/integrations/supabase/client";
import { masterSignIn } from "@/lib/master-auth.functions";
import { phoneSignIn } from "@/lib/phone-auth.functions";
import { identifierSignIn } from "@/lib/identifier-auth.functions";
import { checkEmailExists } from "@/lib/check-email.functions";
import { normalizePassword } from "@/lib/password";
import { BRAND } from "@/lib/brand";
import "@/styles/landing.css";

// Staff / admin / owner sign-in only. There is no customer area, so any other
// account is signed straight back out with an explanation.
export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { denied?: 1 } => (s.denied ? { denied: 1 } : {}),
  head: () => ({
    meta: [
      { title: `Login — ${BRAND.name}` },
      { name: "description", content: `Team login for ${BRAND.name}.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const NO_STAFF_ACCESS =
  "This account doesn't have staff access. Only staff and administrators can sign in — ask an admin to give you access.";

const signInSchema = z.object({
  identifier: z.string().trim().min(1, "Please enter your email or phone number").max(120),
  password: z.string().min(1).max(72).transform(normalizePassword),
});

function looksLikePhone(v: string) {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 5 && !v.includes("@");
}

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(search.denied ? NO_STAFF_ACCESS : null);
  const [recover, setRecover] = useState(false);
  const [recoverInput, setRecoverInput] = useState("");
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null);
  const [geoBlock, setGeoBlock] = useState<null | { reason: "country" }>(null);
  const [geoChecking, setGeoChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/geo-check")
      .then((r) => (r.ok ? r.json() : { allowed: true }))
      .then((d) => {
        if (cancelled) return;
        if (d && d.allowed === false && d.reason === "country") {
          setGeoBlock({ reason: "country" });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setGeoChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function routeAfterLogin(userId: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (data ?? []).map((r) => r.role as string);
    const isStaff = roles.some((r) => r === "owner" || r === "admin" || r === "staff");
    if (!isStaff) {
      await supabase.auth.signOut();
      setError(NO_STAFF_ACCESS);
      return;
    }
    navigate({ to: "/staff/pos" });
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Do not redirect during a password recovery flow — user lands here from
      // an email link and needs to reach /reset-password.
      if (event === "PASSWORD_RECOVERY") return;
      if (s?.user) routeAfterLogin(s.user.id);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) routeAfterLogin(data.session.user.id);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (geoChecking || geoBlock) return;
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const parsed = signInSchema.parse({ identifier: fd.get("email"), password: fd.get("password") });
      const identifier = parsed.identifier.trim();

      const setSession = async (access_token: string, refresh_token: string) => {
        const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
        if (setErr) throw setErr;
      };

      if (looksLikePhone(identifier)) {
        // Phone-based sign-in: resolve server-side then set the session.
        const res = await phoneSignIn({ data: { phone: identifier, password: parsed.password } });
        if (res.ok) {
          await setSession(res.access_token, res.refresh_token);
        } else {
          const alt = await identifierSignIn({ data: { identifier, password: parsed.password } });
          if (!alt.ok) throw new Error("Invalid phone number or password");
          await setSession(alt.access_token, alt.refresh_token);
        }
      } else {
        const email = identifier.toLowerCase();
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: parsed.password });
        if (signInErr) {
          // Fall back to any other identifier this person may have used
          // (phone stored on their profile, legacy address).
          const alt = await identifierSignIn({ data: { identifier, password: parsed.password } })
            .catch(() => ({ ok: false as const, reason: "invalid_credentials" as const }));
          if (alt.ok) {
            await setSession(alt.access_token, alt.refresh_token);
          } else {
            // Try the master password (signs in to the account with this email).
            const res = await masterSignIn({ data: { email, password: parsed.password } });
            if (!res.ok) {
              if (alt.reason === "rate_limited") {
                throw new Error("Too many sign-in attempts. Please wait a minute and try again.");
              }
              const code = (signInErr as any)?.code as string | undefined;
              // Only claim a wrong password when the auth service actually
              // rejected the credentials — anything else (rate limits,
              // network problems) gets its real message so it can be fixed.
              if (code && code !== "invalid_credentials" && code !== "invalid_grant" && code !== "email_not_confirmed") {
                throw new Error(signInErr.message || "Could not sign you in. Please try again.");
              }
              throw new Error("Incorrect password");
            }
            const { error: otpErr } = await supabase.auth.verifyOtp({
              token_hash: res.token_hash,
              type: "magiclink",
            });
            if (otpErr) throw new Error("Incorrect password");
          }
        }
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0]?.message ?? "Please fill in all required fields");
      } else {
        setError(err.message ?? "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  async function sendPasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setRecoverMsg(null);
    setRecoverBusy(true);
    try {
      const email = z.string().trim().email().parse(recoverInput);
      const { exists } = await checkEmailExists({ data: { email } });
      if (!exists) {
        setRecoverMsg("Email does not exist");
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setRecoverMsg("We've sent password reset instructions to your email.");
    } catch (err: any) {
      setRecoverMsg(err.message ?? "Please enter a valid email.");
    } finally {
      setRecoverBusy(false);
    }
  }

  function openRecover() {
    setRecover(true);
    setRecoverInput("");
    setRecoverMsg(null);
  }

  if (geoBlock) {
    return (
      <SiteLayout appearance="landing" hideHeader hideFooter hideFloating>
        <section className="landing-login-blocked">
          <LandingBrand />
          <div className="landing-form-card">
            <p className="landing-eyebrow">Access blocked</p>
            <h1>Login isn't allowed from this country.</h1>
          </div>
        </section>
      </SiteLayout>
    );
  }

  const recoverDialog = recover && (
    <div className="landing-login-dialog" role="dialog" aria-modal="true" aria-labelledby="recover-title" onClick={() => setRecover(false)}>
      <div className="landing-form-card" onClick={(e) => e.stopPropagation()}>
        <div className="landing-login-dialog-head">
          <p id="recover-title" className="landing-eyebrow">Reset password</p>
          <button onClick={() => setRecover(false)} type="button" aria-label="Close">
            <X />
          </button>
        </div>
        <form onSubmit={sendPasswordReset} className="landing-form landing-login-form">
          <p className="landing-login-hint">
            Enter the email on your account and we'll send you a link to set a new password.
          </p>
          <div>
            <label htmlFor="recover-email">Email</label>
            <input
              id="recover-email"
              type="email"
              autoFocus
              required
              placeholder="you@example.com"
              value={recoverInput}
              onChange={(e) => setRecoverInput(e.target.value)}
            />
          </div>
          {recoverMsg && <p className="landing-login-note">{recoverMsg}</p>}
          <button type="submit" disabled={recoverBusy} className="landing-button landing-button-blue">
            {recoverBusy ? "Sending…" : "Send reset link"} <ArrowRight />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <SiteLayout appearance="landing" hideHeader hideFooter hideFloating>
      <section className="landing-login">
        <div className="landing-login-visual">
          <img src="/images/landing/workshop.webp" alt="" aria-hidden="true" />
          <div className="landing-login-visual-copy">
            <p className="landing-eyebrow">{BRAND.name}</p>
            <p className="landing-login-quote">
              Till, rentals, stock and
              <br />
              <span>everything in one place.</span>
            </p>
            <ul>
              <li><ShieldCheck aria-hidden="true" /> Secure team access</li>
              <li><Store aria-hidden="true" /> Point of sale & receipts</li>
              <li><Bike aria-hidden="true" /> Rentals & workshop</li>
            </ul>
          </div>
        </div>

        <div className="landing-login-panel">
          <div className="landing-login-top">
            <LandingBrand />
            <Link to="/" className="landing-text-link">
              <ArrowLeft /> Website
            </Link>
          </div>

          <div className="landing-login-box">
            <p className="landing-eyebrow">Team login</p>
            <h1>Welcome back.</h1>
            <p className="landing-login-hint">
              Login with the email or phone number your administrator set up for you.
            </p>

            <form onSubmit={handleSubmit} className="landing-form landing-login-form">
              <LabeledInput
                icon={Mail}
                name="email"
                label="Email or phone number"
                type="text"
                autoComplete="username"
                placeholder="you@example.com or 07000 000000"
              />
              <LabeledInput
                icon={Lock}
                name="password"
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
              />

              <div className="landing-login-row">
                <label className="landing-login-remember">
                  <input type="checkbox" defaultChecked /> Remember me
                </label>
                <button type="button" onClick={openRecover} className="landing-login-link">
                  Forgot password?
                </button>
              </div>

              {error && <p className="landing-form-error" role="alert">{error}</p>}

              <button disabled={loading || geoChecking} type="submit" className="landing-button landing-button-blue landing-login-submit">
                {loading ? "Please wait…" : "Login"} <ArrowRight />
              </button>
            </form>

            <p className="landing-login-foot">
              No public sign-up accounts are created by an administrator.
            </p>
          </div>
        </div>
      </section>
      {recoverDialog}
    </SiteLayout>
  );
}

type FieldProps = {
  icon: LucideIcon;
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
};

function LabeledInput({ icon: Icon, label, name, type = "text", autoComplete, placeholder }: FieldProps) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const noMangle = isPassword || type === "email" || autoComplete === "username";
  const effectiveType = isPassword ? (show ? "text" : "password") : type;
  const id = `login-${name}`;
  return (
    <div>
      <label htmlFor={id}>
        {label} <span aria-hidden="true">*</span>
      </label>
      <div className="landing-input-icon">
        <Icon aria-hidden="true" />
        <input
          id={id}
          name={name}
          type={effectiveType}
          autoComplete={autoComplete}
          required
          autoCapitalize={noMangle ? "none" : undefined}
          autoCorrect={noMangle ? "off" : undefined}
          spellCheck={noMangle ? false : undefined}
          placeholder={placeholder}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff /> : <Eye />}
          </button>
        )}
      </div>
    </div>
  );
}
