import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowRight, Check, type LucideIcon } from "lucide-react";

/** Icon + title + short text, used across the public pages. */
export function Feature({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="landing-feature">
      <span className="landing-feature-icon">
        <Icon aria-hidden="true" />
      </span>
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </div>
  );
}

/** Photo-backed page header for the inner public pages; the site header floats over it. */
export function PageHero({
  eyebrow,
  title,
  accent,
  description,
  image,
  imageAlt,
  imagePosition = "center",
  cutout = false,
  children,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  description: string;
  image: string;
  imageAlt: string;
  imagePosition?: string;
  /** The image is a transparent cut-out (e.g. a studio scooter), shown whole. */
  cutout?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="landing-subhero" aria-labelledby="page-title">
      <img
        className={`landing-subhero-image${cutout ? " landing-subhero-cutout" : ""}`}
        src={image}
        alt={imageAlt}
        style={{ objectPosition: imagePosition }}
        fetchPriority="high"
      />
      <div className="landing-container landing-subhero-content">
        <nav className="landing-crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>{eyebrow}</span>
        </nav>
        <h1 id="page-title">
          {title}
          {accent && (
            <>
              <br />
              <span>{accent}</span>
            </>
          )}
        </h1>
        <p className="landing-subhero-description">{description}</p>
        {children}
      </div>
    </section>
  );
}

export function Checklist({ items, single = false }: { items: readonly string[]; single?: boolean }) {
  return (
    <ul className={`landing-checklist${single ? " landing-checklist-single" : ""}`}>
      {items.map((item) => (
        <li key={item}>
          <Check aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Blue closing band with contact and booking buttons. */
export function CtaBand({
  eyebrow = "Sales · Service · Repairs · Rentals · Accident Claims",
  title = "Your next ride starts here.",
  body = "Scooters, motorcycles, expert care and ongoing support all in one place.",
  service = "Servicing",
  primaryLabel = "Book a Service",
}: {
  eyebrow?: string;
  title?: string;
  body?: string;
  service?: string;
  primaryLabel?: string;
}) {
  return (
    <section className="landing-wide-container landing-cta landing-block-cta" aria-labelledby="cta-title">
      <div>
        <p className="landing-eyebrow">{eyebrow}</p>
        <h2 id="cta-title">{title}</h2>
        <p>{body}</p>
      </div>
      <div className="landing-actions">
        <Link to="/contact" className="landing-button landing-button-white">
          Contact Us <ArrowRight />
        </Link>
        <Link to="/contact" search={{ service }} className="landing-button landing-button-navy">
          {primaryLabel} <ArrowRight />
        </Link>
      </div>
    </section>
  );
}
