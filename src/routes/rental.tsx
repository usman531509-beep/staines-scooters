import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Calendar,
  FileText,
  Phone,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Checklist, CtaBand, Feature, PageHero } from "@/components/LandingParts";
import { BRAND, siteLink } from "@/lib/brand";
import pcx from "@/assets/honda-pcx-125.jpg";
import forza from "@/assets/honda-forza.jpg";
import vision from "@/assets/honda-vision.jpg";
import "@/styles/landing.css";

const images = {
  hero: "/images/landing/rental.webp",
  classic: "/images/landing/classic.webp",
  urban: "/images/landing/maxi.webp",
};

export const Route = createFileRoute("/rental")({
  head: () => ({
    meta: [
      { title: `Scooter Rental — Weekly 125cc Hire | ${BRAND.name}` },
      {
        name: "description",
        content:
          "Weekly 125cc scooter rental for commuters, delivery riders and cover while your bike is repaired. Honda PCX, SH, SH Mode and Vision.",
      },
      { property: "og:title", content: `Scooter Rental — ${BRAND.name}` },
      { property: "og:url", content: siteLink("/rental") },
      { property: "og:image", content: siteLink(images.hero) },
    ],
    links: [{ rel: "canonical", href: siteLink("/rental") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "Scooter Rental",
          provider: {
            "@type": "MotorcycleDealer",
            name: BRAND.name,
            telephone: `+${BRAND.phoneIntl}`,
            address: {
              "@type": "PostalAddress",
              streetAddress: BRAND.addressLine || undefined,
              addressLocality: BRAND.town,
              postalCode: BRAND.postcode || undefined,
              addressCountry: "GB",
            },
          },
          areaServed: BRAND.town,
          url: siteLink("/rental"),
        }),
      },
    ],
  }),
  component: Rental,
});

const fleet = [
  {
    name: "Honda PCX 125",
    image: pcx,
    contain: true,
    body: "The commuter favourite — smooth, fuel-efficient and easy in city traffic.",
    tags: ["125cc", "Automatic", "Keyless"],
  },
  {
    name: "Honda SH 125",
    image: forza,
    contain: true,
    body: "Premium commuter with bigger wheels for stability on busy roads.",
    tags: ["125cc", "Automatic", '16" wheels'],
  },
  {
    name: "Honda SH Mode 125",
    image: images.classic,
    contain: false,
    body: "Lighter and more agile — perfect for nipping through traffic.",
    tags: ["125cc", "Automatic", "Lightweight"],
  },
  {
    name: "Honda Vision 110",
    image: vision,
    contain: true,
    body: "Nimble, economical and easy to ride — the ideal first scooter.",
    tags: ["110cc", "Automatic", "Low seat"],
  },
];

const documents = [
  "Full UK driving licence (photocard)",
  "Valid CBT certificate (DL196)",
  "Proof of address recent bill or bank statement",
  "Refundable deposit",
];

function Rental() {
  return (
    <SiteLayout appearance="landing" hideFloating>
      <PageHero
        eyebrow="Rentals"
        title="Scooter rental,"
        accent="week by week."
        description="Honda 125s on simple weekly terms ideal for commuters, delivery riders and cover while your own bike is in for repair."
        image={images.hero}
        imageAlt="Rider on a rental scooter in the city"
        imagePosition="70% center"
      >
        <div className="landing-chips">
          <div className="landing-chip">
            <strong>Weekly</strong>
            <span>flexible terms</span>
          </div>
          <div className="landing-chip">
            <strong>125cc</strong>
            <span>Honda automatics</span>
          </div>
          <div className="landing-chip">
            <strong>Serviced</strong>
            <span>by our workshop</span>
          </div>
        </div>
        <div className="landing-actions">
          <Link to="/contact" search={{ service: "Motorbike Rental" }} className="landing-button landing-button-blue">
            Check Availability <ArrowRight />
          </Link>
          <a href={`tel:+${BRAND.phoneIntl}`} className="landing-button landing-button-outline">
            <Phone /> Call Us
          </a>
        </div>
      </PageHero>

      <section className="landing-container landing-block" aria-labelledby="fleet-title">
        <div className="landing-section-heading">
          <div>
            <p className="landing-eyebrow">The fleet</p>
            <h2 id="fleet-title">Choose your scooter.</h2>
          </div>
          <Link to="/contact" search={{ service: "Motorbike Rental" }} className="landing-text-link">
            Reserve a Scooter <ArrowRight />
          </Link>
        </div>
        <div className="landing-card-grid landing-card-grid-4">
          {fleet.map((b) => (
            <article key={b.name} className="landing-card">
              <div className={`landing-card-photo${b.contain ? " landing-card-photo-contain" : ""}`}>
                <img src={b.image} alt={b.name} loading="lazy" />
              </div>
              <div className="landing-card-body">
                <h3>{b.name}</h3>
                <p>{b.body}</p>
                <div className="landing-tags">
                  {b.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
                <Link
                  to="/contact"
                  search={{ service: "Motorbike Rental", bike: b.name }}
                  className="landing-text-link"
                >
                  Reserve this scooter <ArrowRight />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-container landing-block" aria-labelledby="need-title">
        <div className="landing-split">
          <div className="landing-split-photo">
            <img src={images.urban} alt="Maxi scooter parked by the river, ready to ride" loading="lazy" />
            <span className="landing-photo-badge">
              <FileText aria-hidden="true" /> Quick paperwork
            </span>
          </div>
          <div className="landing-split-copy">
            <span className="landing-feature-icon">
              <FileText aria-hidden="true" />
            </span>
            <h2 id="need-title">What you'll need.</h2>
            <p>
              Bring these with you when you collect. We'll go through the agreement together and have you on
              the road the same day when a scooter is free.
            </p>
            <Checklist items={documents} single />
          </div>
        </div>
      </section>

      <section className="landing-container landing-block" aria-labelledby="terms-title">
        <div className="landing-panel">
          <div className="landing-block-heading">
            <p className="landing-eyebrow">Simple terms</p>
            <h2 id="terms-title">Rental without the runaround.</h2>
          </div>
          <div className="landing-panel-grid">
            <Feature icon={Calendar} title="Weekly terms" body="Rent by the week, then extend or return at the end of any week." />
            <Feature icon={Wrench} title="Maintained by us" body={`Servicing and maintenance are covered by ${BRAND.name}.`} />
            <Feature icon={ShieldCheck} title="Ready to ride" body="Every scooter is checked before each hire." />
          </div>
        </div>
      </section>

      <CtaBand
        eyebrow="Ready to ride?"
        title="Check what's available this week."
        body="Scooters go quickly get in touch to reserve yours."
        service="Motorbike Rental"
        primaryLabel="Reserve a Scooter"
      />
    </SiteLayout>
  );
}
