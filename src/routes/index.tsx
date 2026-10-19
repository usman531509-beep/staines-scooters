import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Bike,
  CalendarDays,
  Check,
  CircleCheck,
  PoundSterling,
  ShieldCheck,
  ShoppingCart,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { ScooterDetails } from "@/components/ScooterDetails";
import { BRAND, siteLink } from "@/lib/brand";
import { RENTAL_FLEET, RENTAL_TERMS, SALE_SCOOTERS, enquire, gbp, type SaleScooter } from "@/lib/scooters";
import "@/styles/landing.css";

const images = {
  hero: "/images/landing/home-showroom.webp",
  sales: "/images/landing/home-sales.webp",
  rental: "/images/landing/home-rental.webp",
  repairs: "/images/landing/home-repairs.webp",
  claims: "/images/landing/home-claims.webp",
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${BRAND.name} | Scooter Sales, Rental, Repairs & Accident Claims in Staines` },
      {
        name: "description",
        content:
          "Scooter sales, weekly scooter rental, repairs and accident claim support in Staines-upon-Thames. Honda Vision, SH Mode, PCX and Yamaha NMAX from £60 a week.",
      },
      { property: "og:title", content: `${BRAND.name} | Your local scooter specialists` },
      {
        property: "og:description",
        content: "Scooter sales, rental, repairs and accident claim support in Staines.",
      },
      { property: "og:url", content: siteLink("/") },
      { property: "og:type", content: "website" },
      { property: "og:image", content: siteLink(images.hero) },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: siteLink(images.hero) },
    ],
    links: [
      { rel: "canonical", href: siteLink("/") },
      { rel: "preload", as: "image", href: images.hero },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "MotorcycleDealer",
          name: BRAND.name,
          url: siteLink("/"),
          image: siteLink(images.hero),
          telephone: `+${BRAND.phoneIntl}`,
          email: BRAND.email,
          address: {
            "@type": "PostalAddress",
            streetAddress: BRAND.addressLine,
            addressLocality: BRAND.town,
            postalCode: BRAND.postcode,
            addressCountry: "GB",
          },
        }),
      },
    ],
  }),
  component: Home,
});

type ServiceCard = {
  title: string;
  body: string;
  image: string;
  icon: LucideIcon;
  cta: string;
  to?: "/sales" | "/rental" | "/services" | "/accident-claims";
};

const serviceCards: ServiceCard[] = [
  {
    title: "Scooter Sales",
    body: "Wide range of new and used scooters from top brands.",
    image: images.sales,
    icon: ShoppingCart,
    cta: "View Scooters",
    to: "/sales",
  },
  {
    title: "Scooter Rental",
    body: `Flexible weekly rentals from ${gbp(RENTAL_FLEET[0].weeklyPence)} a week.`,
    image: images.rental,
    icon: CalendarDays,
    cta: "View Rental Bikes",
    to: "/rental",
  },
  {
    title: "Repairs & Service",
    body: "Tyres, brakes, batteries, diagnostics and more.",
    image: images.repairs,
    icon: Wrench,
    cta: "Book a Repair",
    to: "/services",
  },
  {
    title: "Accident Claims",
    body: "Support with scooter accident claims and repairs.",
    image: images.claims,
    icon: ShieldCheck,
    cta: "Get Help",
    to: "/accident-claims",
  },
];

const rentalBadges: Array<{ icon: LucideIcon; label: string; sub: string }> = [
  { icon: CalendarDays, label: `Min. ${RENTAL_TERMS.minWeeks} weeks`, sub: "Flexible weekly plans" },
  { icon: PoundSterling, label: `${gbp(RENTAL_TERMS.depositPence)} deposit`, sub: "Fully refundable" },
  { icon: ShieldCheck, label: "Serviced", sub: "& road ready" },
  { icon: Wrench, label: "Maintenance", sub: "Included" },
];

const whyChoose = [
  "Local, friendly and trusted",
  "Experienced technicians",
  "Competitive prices",
  "All makes and models",
  "Sales, rental, repairs & claims",
  "Convenient Staines location",
];

const featuredRentals = RENTAL_FLEET;

function Home() {
  const [details, setDetails] = useState<SaleScooter | null>(null);

  return (
    <SiteLayout appearance="landing" className="ss-home" hideFloating>
      {/* Hero */}
      <section className="ss-hero" aria-labelledby="hero-title">
        <img className="ss-hero-image" src={images.hero} alt="Illustration of three scooters outside a Staines Scooter showroom" fetchPriority="high" />
        <div className="landing-container ss-hero-content">
          <h1 id="hero-title">
            Scooter Sales, Rental, Repairs &amp; Accident Claim Support <span>in Staines</span>
          </h1>
          <p className="ss-hero-lead">Your local scooter specialists.</p>
          <ul className="ss-hero-points">
            <li><Bike aria-hidden="true" /> New &amp; Used Scooters</li>
            <li><Wrench aria-hidden="true" /> Expert Repairs &amp; Service</li>
            <li><CalendarDays aria-hidden="true" /> Flexible Rental Options</li>
            <li><ShieldCheck aria-hidden="true" /> Accident Claim Support</li>
          </ul>
          <div className="ss-hero-actions">
            <Link to="/register" className="ss-btn-yellow">
              Register <ArrowRight aria-hidden="true" />
            </Link>
            <Link to="/auth" className="ss-btn-white">
              Sign In <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* What we do */}
      <section className="landing-container ss-services" aria-label="Our services">
        {serviceCards.map(({ title, body, image, icon: Icon, cta, to }) => (
          <article key={title} className="ss-service-card">
            <div className="ss-service-photo">
              <img src={image} alt="" loading="lazy" />
              <span className="ss-service-icon">
                <Icon aria-hidden="true" />
              </span>
            </div>
            <div className="ss-service-body">
              <h2>{title}</h2>
              <p>{body}</p>
              <Link to={to!} className="ss-btn-dark ss-btn-block">
                {cta} <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </section>

      {/* Rental fleet */}
      <section id="rent" className="landing-container ss-section" aria-labelledby="rent-title">
        <div className="ss-section-head">
          <div>
            <h2 id="rent-title" className="ss-title">
              Rent a Scooter <span>in Staines</span>
            </h2>
            <p className="ss-subtitle">Affordable, reliable scooters for work, commuting or everyday use.</p>
          </div>
          <ul className="ss-badges">
            {rentalBadges.map(({ icon: Icon, label, sub }) => (
              <li key={label}>
                <Icon aria-hidden="true" />
                <span>
                  {label}
                  <small>{sub}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="ss-rent-grid">
          {featuredRentals.map((s) => (
            <article key={s.name} className="ss-rent-card">
              <img src={s.image} alt={s.name} loading="lazy" />
              <div className="ss-rent-body">
                <h3>
                  {s.name} <small>({s.cc})</small>
                </h3>
                <p className="ss-price">
                  {gbp(s.weeklyPence)}
                  <small>/week</small>
                </p>
                <ul>
                  {s.points.map((p) => (
                    <li key={p}>
                      <CircleCheck aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
                <a href={enquire.rent(s.name)} target="_blank" rel="noopener noreferrer" className="ss-btn-yellow ss-btn-sm">
                  Rent Now <ArrowRight aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>
        <p className="ss-note">
          {gbp(RENTAL_TERMS.depositPence)} refundable deposit · Minimum rental period {RENTAL_TERMS.minWeeks} weeks ·{" "}
          <Link to="/rental">Full rental details</Link>
        </p>
      </section>

      {/* Scooters for sale + why choose us */}
      <section id="sale" className="landing-container ss-section ss-sale-layout" aria-labelledby="sale-title">
        <div>
          <div className="ss-section-head">
            <div>
              <h2 id="sale-title" className="ss-title">
                Scooters for <span>Sale</span>
              </h2>
              <p className="ss-subtitle">Browse our latest new and used scooters.</p>
            </div>
            <Link to="/sales" className="ss-btn-yellow ss-btn-sm">
              View All Scooters <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <div className="ss-sale-grid">
            {SALE_SCOOTERS.map((s) => (
              <article key={s.name} className="ss-sale-card">
                <img src={s.image} alt={s.name} loading="lazy" />
                <h3>{s.name}</h3>
                <button type="button" className="ss-btn-outline" onClick={() => setDetails(s)}>
                  View Details
                </button>
              </article>
            ))}
          </div>
        </div>
        <aside id="about" className="ss-why" aria-labelledby="why-title">
          <h2 id="why-title">
            Why Choose <span>{BRAND.name}?</span>
          </h2>
          <ul>
            {whyChoose.map((w) => (
              <li key={w}>
                <span className="ss-why-tick">
                  <Check aria-hidden="true" />
                </span>
                {w}
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <ScooterDetails scooter={details} onClose={() => setDetails(null)} />
    </SiteLayout>
  );
}
