import { Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";

/** The Staines Scooter logo; `light` is the white version for dark backgrounds. */
export function LandingBrand({ light = false, className = "" }: { light?: boolean; className?: string }) {
  return (
    <Link to="/" className={`landing-brand ${className}`} aria-label={`${BRAND.name} home`}>
      <img
        src={light ? "/images/brand/staines-logo-light.webp" : "/images/brand/staines-logo.webp"}
        alt={BRAND.name}
        width={900}
        height={534}
        decoding="async"
      />
    </Link>
  );
}

export type NavChild = { label: string; to: string; hash?: string; search?: { service: string } };
export type NavItem = { label: string; to: string; hash?: string; children?: NavChild[] };

/** Main site navigation. */
export const landingNav: NavItem[] = [
  { label: "Home", to: "/" },
  { label: "Sales", to: "/sales" },
  { label: "Rent", to: "/rental" },
  { label: "Repairs & Service", to: "/services" },
  { label: "Accident Claims", to: "/accident-claims" },
  { label: "Contact", to: "/contact" },
];
