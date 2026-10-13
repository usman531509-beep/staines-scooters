import { Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";

/** The round Staines Scooters badge logo. */
export function LandingBrand({ footer = false }: { footer?: boolean }) {
  return (
    <Link
      to="/"
      className={`landing-brand${footer ? " landing-brand-footer" : ""}`}
      aria-label={`${BRAND.name} home`}
    >
      <img src="/images/brand/staines-logo.webp" alt={BRAND.name} width={640} height={640} decoding="async" />
      {footer && <small>SCOOTERS. MOTORCYCLES. PEOPLE.</small>}
    </Link>
  );
}

export type NavChild = { label: string; to: string; hash?: string; search?: { service: string } };
export type NavItem = { label: string; to: string; children?: NavChild[] };

/** Main site navigation; children are sections on that page (shown as a dropdown). */
export const landingNav: NavItem[] = [
  { label: "Home", to: "/" },
  {
    label: "Sales",
    to: "/sales",
    children: [
      { label: "Popular models", to: "/sales", hash: "models" },
      { label: "Scooter styles", to: "/sales", hash: "styles" },
      { label: "Buying with us", to: "/sales", hash: "buying" },
      { label: "Ask about stock", to: "/contact", search: { service: "Scooter Sales" } },
    ],
  },
  {
    label: "Repairs & Servicing",
    to: "/services",
    children: [
      { label: "Servicing", to: "/services", hash: "servicing" },
      { label: "Repairs", to: "/services", hash: "repairs" },
      { label: "Fault finding", to: "/services", hash: "fault-finding" },
      { label: "Key fobs", to: "/services", hash: "key-fobs" },
      { label: "Pre-MOT checks", to: "/services", hash: "pre-mot-checks" },
      { label: "Parts", to: "/services", hash: "parts" },
    ],
  },
  { label: "Rentals", to: "/rental" },
  { label: "Accident Claims", to: "/accident-claims" },
];
