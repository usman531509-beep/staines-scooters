import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, CheckCircle2, UserPlus } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { BRAND, siteLink } from "@/lib/brand";
import "@/styles/landing.css";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: `Register | ${BRAND.name}` },
      {
        name: "description",
        content: `Register with ${BRAND.name} in Staines — leave your name and number and we'll keep you on our customer list.`,
      },
      { property: "og:title", content: `Register — ${BRAND.name}` },
      { property: "og:url", content: siteLink("/register") },
    ],
    links: [{ rel: "canonical", href: siteLink("/register") }],
  }),
  component: Register,
});

/** Today's date as YYYY-MM-DD, so the date-of-birth picker can't go into the future. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

function Register() {
  const [state, setState] = useState<"form" | "done" | "already">("form");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSending(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      dateOfBirth: String(fd.get("dateOfBirth") ?? ""),
      vehicleReg: String(fd.get("vehicleReg") ?? ""),
      address: String(fd.get("address") ?? ""),
      website: String(fd.get("website") ?? ""),
    };
    try {
      const res = await fetch("/api/public/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Could not register");
      setName(payload.name.split(" ")[0] ?? "");
      setState(data.alreadyRegistered ? "already" : "done");
    } catch (e: any) {
      setErr(e?.message ?? "Could not register");
    } finally {
      setSending(false);
    }
  }

  return (
    <SiteLayout appearance="landing">
      <section className="landing-container ss-register" aria-labelledby="register-title">
        <div className="landing-form-card ss-register-card">
          {state === "form" ? (
            <>
              <span className="ss-register-icon">
                <UserPlus aria-hidden="true" />
              </span>
              <h1 id="register-title">Register with us</h1>
              <p className="ss-register-lead">
                Join our customer list in a few seconds. No password needed.
              </p>
              <form onSubmit={submit} className="landing-form">
                {/* Honeypot: hidden from people and assistive tech, filled in by spam bots. */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" hidden />
                <div className="landing-field-wide">
                  <label htmlFor="reg-name">
                    Full name<span> *</span>
                  </label>
                  <input id="reg-name" name="name" autoComplete="name" required minLength={2} />
                </div>
                <div className="landing-field-wide">
                  <label htmlFor="reg-phone">
                    Phone number<span> *</span>
                  </label>
                  <input id="reg-phone" name="phone" type="tel" autoComplete="tel" required minLength={7} />
                </div>
                <div className="landing-field-wide">
                  <label htmlFor="reg-email">Email address (optional)</label>
                  <input id="reg-email" name="email" type="email" autoComplete="email" />
                </div>
                <div className="landing-field-wide">
                  <label htmlFor="reg-dob">Date of birth</label>
                  <input id="reg-dob" name="dateOfBirth" type="date" autoComplete="bday" max={today()} />
                </div>
                <div className="landing-field-wide">
                  <label htmlFor="reg-vehicle">Vehicle registration number</label>
                  <input
                    id="reg-vehicle"
                    name="vehicleReg"
                    placeholder="e.g. AB12 CDE"
                    autoCapitalize="characters"
                    maxLength={12}
                    className="ss-input-reg"
                  />
                </div>
                <div className="landing-field-wide">
                  <label htmlFor="reg-address">Address</label>
                  <textarea id="reg-address" name="address" rows={3} autoComplete="street-address" maxLength={300} />
                </div>
                {err && (
                  <p className="landing-form-error" role="alert">
                    {err}
                  </p>
                )}
                <div className="landing-field-wide">
                  <button type="submit" disabled={sending} className="ss-btn-yellow ss-btn-block">
                    {sending ? "Registering…" : "Register"} <ArrowRight aria-hidden="true" />
                  </button>
                </div>
              </form>
              <p className="ss-register-foot">
                Staff? <Link to="/auth">Sign in here</Link>
              </p>
            </>
          ) : (
            <div className="landing-form-done" role="status">
              <CheckCircle2 aria-hidden="true" />
              <strong>
                {state === "done"
                  ? `You're registered${name ? `, ${name}` : ""}!`
                  : `You're already registered${name ? `, ${name}` : ""}.`}
              </strong>
              <p>
                {state === "done"
                  ? `Thanks for registering with ${BRAND.name}. You're now on our customer list.`
                  : "We already have your number on file — no need to register again."}
              </p>
              <Link to="/" className="ss-btn-dark ss-btn-sm">
                Back to home <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
