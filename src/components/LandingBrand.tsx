import { Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";

/** The Staines Scooter logo; the footer uses the white version on its dark background. */
export function LandingBrand({ footer = false }: { footer?: boolean }) {
  return (
    <Link
      to="/"
      className={`landing-brand${footer ? " landing-brand-footer" : ""}`}
      aria-label={`${BRAND.name} home`}
    >
      <img
        src={footer ? "/images/brand/staines-logo-white.png" : "/images/brand/staines-logo.png"}
        alt={BRAND.name}
        width={600}
        height={358}
        decoding="async"
      />
      {footer && <small>SCOOTERS. MOTORCYCLES. PEOPLE.</small>}
    </Link>
  );
}

export const landingNav = [
  { label: "Home", to: "/" },
  { label: "Sales", to: "/sales" },
  { label: "Repairs & Servicing", to: "/services" },
  { label: "Rentals", to: "/rental" },
  { label: "Accident Claims", to: "/accident-claims" },
] as const;
