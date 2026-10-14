import type { ReactNode } from "react";
import { Check, Phone, type LucideIcon } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { BRAND, whatsappLink } from "@/lib/brand";

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

/** Photo-backed page header for the inner public pages. */
export function PageHero({
  title,
  accent,
  description,
  image,
  imageAlt,
  imagePosition = "center",
  cutout = false,
  children,
}: {
  /** Page name; kept for callers, no longer shown (breadcrumbs were removed). */
  eyebrow?: string;
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

/** Closing band: WhatsApp the shop about this service, or call. */
export function CtaBand({
  eyebrow = "Sales · Service · Repairs · Rentals · Accident Claims",
  title = "Your next ride starts here.",
  body = "Scooters, motorcycles, expert care and ongoing support all in one place.",
  service = "Repairs & Service",
  primaryLabel = "WhatsApp Us",
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
        <a
          href={whatsappLink(`Hi ${BRAND.name}, I'd like to ask about ${service.toLowerCase()}.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="ss-btn-whatsapp"
        >
          <WhatsAppIcon aria-hidden="true" /> {primaryLabel}
        </a>
        <a href={`tel:+${BRAND.phoneIntl}`} className="ss-btn-yellow">
          <Phone aria-hidden="true" /> Call {BRAND.phone}
        </a>
      </div>
    </section>
  );
}
