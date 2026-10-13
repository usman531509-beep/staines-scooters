import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { X, User, Home, Wrench, Bike, Mail, Phone, MapPin, ArrowRight, Menu, ChevronDown, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth, signOut } from "@/lib/auth-client";
import logoText from "@/assets/logo.png";
import { BRAND } from "@/lib/brand";

import { LandingBrand, landingNav } from "./LandingBrand";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/services", label: "Services", icon: Wrench },
  { to: "/rental", label: "Rental", icon: Bike },
  { to: "/contact", label: "Contact", icon: Mail },
] as const;

// Pages that open with a hero photo; the navbar floats over it until scrolled.
const HERO_PAGES = ["/", "/sales", "/services", "/rental", "/accident-claims", "/contact"];

export function SiteHeader({ appearance = "default" }: { appearance?: "default" | "landing" }) {
  const [open, setOpen] = useState(false);
  const { user, isAdmin } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.navigate({ to: "/" });
  }

  const { pathname } = useLocation();
  const overlay = appearance === "landing" && HERO_PAGES.includes(pathname);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!overlay) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overlay]);

  // Signed-in staff keep the website navbar, with a link back to their portal.
  const portal = isAdmin ? "/admin" : "/staff/pos";

  if (appearance === "landing")
    return (
      <header className={`lnav${overlay ? " lnav-overlay" : ""}${scrolled || open ? " is-solid" : ""}`}>
        <div className="landing-container lnav-row">
          <LandingBrand />
          <nav className="lnav-links" aria-label="Main navigation">
            {landingNav.map((item) => (
              <div key={item.label} className={`lnav-item${item.children ? " lnav-has-menu" : ""}`}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.to === "/", includeSearch: false, includeHash: false }}
                  activeProps={{ className: "is-active", "aria-current": "page" }}
                >
                  {item.label}
                  {item.children && <ChevronDown aria-hidden="true" />}
                </Link>
                {item.children && (
                  <div className="lnav-menu">
                    {item.children.map((c) => (
                      <Link key={c.label} to={c.to} hash={c.hash} search={c.search ?? {}}>
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
          <div className="lnav-actions">
            {user ? (
              // Signed-in staff: account menu with their portal and sign out.
              <div className="lnav-item lnav-has-menu lnav-account">
                <button type="button" className="lnav-avatar" aria-label="Account menu" aria-haspopup="menu">
                  <span>{(user.email ?? "?").charAt(0).toUpperCase()}</span>
                  <ChevronDown aria-hidden="true" className="lnav-caret" />
                </button>
                <div className="lnav-menu lnav-menu-right" role="menu">
                  <div className="lnav-account-head">
                    <strong>{isAdmin ? "Admin" : "Staff"}</strong>
                    <small>{user.email}</small>
                  </div>
                  <Link to={portal} role="menuitem">
                    <LayoutDashboard aria-hidden="true" /> Dashboard
                  </Link>
                  <button type="button" role="menuitem" onClick={handleSignOut}>
                    <LogOut aria-hidden="true" /> Log out
                  </button>
                </div>
              </div>
            ) : (
              <Link to="/auth" className="lnav-login">
                <User aria-hidden="true" /> Login
              </Link>
            )}
            <Link to="/contact" search={{ service: "Servicing" }} className="lnav-book">
              <Wrench aria-hidden="true" /> Book a Service
            </Link>
            <button
              type="button"
              className="lnav-icon lnav-menu-button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-controls="lnav-mobile"
              aria-label={open ? "Close navigation" : "Open navigation"}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {open && (
          <nav id="lnav-mobile" className="lnav-mobile" aria-label="Mobile navigation">
            <div className="landing-container">
              {landingNav.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  activeOptions={{ exact: item.to === "/", includeSearch: false, includeHash: false }}
                  activeProps={{ className: "is-active", "aria-current": "page" }}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                  <ArrowRight aria-hidden="true" />
                </Link>
              ))}
              <div className="lnav-mobile-actions">
                <Link to={user ? portal : "/auth"} className="lnav-login" onClick={() => setOpen(false)}>
                  {user ? <LayoutDashboard aria-hidden="true" /> : <User aria-hidden="true" />} {user ? "Dashboard" : "Login"}
                </Link>
                <Link
                  to="/contact"
                  search={{ service: "Servicing" }}
                  className="lnav-book"
                  onClick={() => setOpen(false)}
                >
                  <Wrench aria-hidden="true" /> Book a Service
                </Link>
              </div>
            </div>
          </nav>
        )}
      </header>
    );

  return (
    <header className="sticky top-0 z-50 border-b-[3px] border-primary bg-background/95 shadow-sm backdrop-blur">
      {/* Utility strip */}
      <div className="bg-neutral-900 text-neutral-200">
        <div className="container-x flex h-8 items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] sm:text-[11px]">
          <a
            href={`tel:+${BRAND.phoneIntl}`}
            className="flex items-center gap-1.5 transition-colors hover:text-primary"
          >
            <Phone className="h-3 w-3 text-primary" />
            <span>{BRAND.phone}</span>
          </a>
          <div className="hidden items-center gap-1.5 text-neutral-400 sm:flex">
            <MapPin className="h-3 w-3 text-primary" />
            <span>
              {[BRAND.town, BRAND.postcode].filter(Boolean).join(" · ")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link to="/staff/pos" className="text-white transition-colors hover:text-primary">
                  Workshop
                </Link>
                <button
                  onClick={handleSignOut}
                  className="border-l border-neutral-700 pl-3 text-neutral-400 transition-colors hover:text-primary"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/auth" className="text-white transition-colors hover:text-primary">
                Login
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main row */}
      <div className="container-x flex h-20 items-center justify-between gap-2 sm:h-24 sm:gap-3">
        <Link to="/" className="flex items-center" onClick={() => setOpen(false)}>
          <img
            src={logoText}
            alt={`${BRAND.name} — Repair · Rental`}
            decoding="async"
            fetchPriority="high"
            className="h-14 w-auto object-contain sm:h-16 md:h-20"
          />
        </Link>

        <nav className="hidden items-center gap-0 lg:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              activeProps={{
                className:
                  "text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:bg-primary",
              }}
              inactiveProps={{
                className:
                  "text-ink-muted hover:text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:bg-transparent hover:after:bg-primary/40",
              }}
              className="relative px-3 py-6 text-xs font-semibold uppercase tracking-widest transition-colors"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={`tel:+${BRAND.phoneIntl}`}
            className="hidden items-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 md:inline-flex"
          >
            <Phone className="h-4 w-4" />
            <span className="whitespace-nowrap">{BRAND.phone}</span>
          </a>

          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <Link
                to="/staff/pos"
                className="inline-flex items-center gap-2 rounded-sm border-2 border-foreground bg-background px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors hover:border-primary hover:text-primary"
              >
                <User className="h-4 w-4" /> Workshop
              </Link>
            ) : (
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-sm border-2 border-foreground bg-background px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors hover:border-primary hover:text-primary"
              >
                <User className="h-4 w-4" /> Login
              </Link>
            )}
          </div>

          <button
            onClick={() => setOpen((v) => !v)}
            className="relative inline-flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-sm border-2 border-foreground bg-background transition-colors hover:border-primary lg:hidden"
            aria-label="Toggle menu"
          >
            {open ? (
              <X className="h-5 w-5" />
            ) : (
              <>
                <span className="h-0.5 w-5 bg-foreground" />
                <span className="h-0.5 w-5 bg-foreground" />
                <span className="h-0.5 w-3.5 self-center bg-primary" />
              </>
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-surface lg:hidden">
          <div className="container-x flex flex-col gap-1 py-4">
            {nav.map((n) => {
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  activeOptions={{ exact: n.to === "/" }}
                  activeProps={{ className: "text-primary border-l-primary" }}
                  inactiveProps={{ className: "text-foreground border-l-transparent" }}
                  className="flex items-center gap-3 border-l-[3px] px-3 py-3 text-sm font-semibold uppercase tracking-widest transition-colors"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  {n.label}
                </Link>
              );
            })}
            {user ? (
              <Link
                to="/staff/pos"
                onClick={() => setOpen(false)}
                className="mt-2 flex items-center gap-3 rounded-sm bg-primary px-3 py-3 text-sm font-semibold uppercase tracking-widest text-primary-foreground"
              >
                <User className="h-4 w-4" />
                Workshop
              </Link>
            ) : (
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="mt-2 flex items-center gap-3 rounded-sm bg-primary px-3 py-3 text-sm font-semibold uppercase tracking-widest text-primary-foreground"
              >
                <User className="h-4 w-4" />
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
