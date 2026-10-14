import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Calendar,
  CircleCheck,
  FileText,
  Phone,
  PoundSterling,
  Wallet,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { SiteLayout } from "@/components/SiteLayout";
import { Checklist, CtaBand, Feature, PageHero } from "@/components/LandingParts";
import { BRAND, siteLink } from "@/lib/brand";
import { RENTAL_FLEET, RENTAL_TERMS, enquire, gbp } from "@/lib/scooters";
import "@/styles/landing.css";

const images = {
  hero: "/images/landing/rental.webp",
  urban: "/images/landing/maxi.webp",
};

export const Route = createFileRoute("/rental")({
  head: () => ({
    meta: [
      { title: `Scooter Rental — Weekly 125cc Hire | ${BRAND.name}` },
      {
        name: "description",
        content:
          "Weekly scooter rental in Staines from £60 a week: Honda Vision, SH Mode, PCX and Yamaha NMAX. £200 refundable deposit, minimum 4 weeks.",
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

const documents = [
  "Full UK driving licence (photocard)",
  "Valid CBT certificate (DL196)",
  "Proof of address recent bill or bank statement",
  `${gbp(RENTAL_TERMS.depositPence)} refundable deposit`,
];

function Rental() {
  return (
    <SiteLayout appearance="landing">
      <PageHero
        eyebrow="Rentals"
        title="Scooter rental,"
        accent="week by week."
        description={`Honda and Yamaha scooters from ${gbp(RENTAL_FLEET[0].weeklyPence)} a week ideal for commuters, delivery riders and cover while your own bike is in for repair.`}
        image={images.hero}
        imageAlt="Rider on a rental scooter in the city"
        imagePosition="70% 8%"
      >
        <div className="landing-chips">
          <div className="landing-chip">
            <strong>From {gbp(RENTAL_FLEET[0].weeklyPence)}</strong>
            <span>per week</span>
          </div>
          <div className="landing-chip">
            <strong>{gbp(RENTAL_TERMS.depositPence)}</strong>
            <span>refundable deposit</span>
          </div>
          <div className="landing-chip">
            <strong>{RENTAL_TERMS.minWeeks} weeks</strong>
            <span>minimum rental</span>
          </div>
        </div>
        <div className="landing-actions">
          <a href={enquire.rent()} target="_blank" rel="noopener noreferrer" className="ss-btn-whatsapp">
            <WhatsAppIcon aria-hidden="true" /> Check Availability
          </a>
          <a href={`tel:+${BRAND.phoneIntl}`} className="ss-btn-yellow">
            <Phone aria-hidden="true" /> Call {BRAND.phone}
          </a>
        </div>
      </PageHero>

      <section id="fleet" className="landing-container ss-section" aria-labelledby="fleet-title">
        <div className="ss-section-head">
          <div>
            <h2 id="fleet-title" className="ss-title">
              Choose your <span>scooter</span>
            </h2>
            <p className="ss-subtitle">
              {gbp(RENTAL_TERMS.depositPence)} refundable deposit · Minimum rental period {RENTAL_TERMS.minWeeks} weeks
            </p>
          </div>
        </div>
        <div className="ss-rent-grid">
          {RENTAL_FLEET.map((s) => (
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
      </section>

      <section id="requirements" className="landing-container landing-block" aria-labelledby="need-title">
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

      <section id="terms" className="landing-container landing-block" aria-labelledby="terms-title">
        <div className="landing-panel">
          <div className="landing-block-heading">
            <p className="landing-eyebrow">Rental requirements</p>
            <h2 id="terms-title">Rental without the runaround.</h2>
            <p>
              Bring your documents to the workshop and we'll go through the weekly rate, deposit and handover
              with you.
            </p>
          </div>
          <div className="landing-panel-grid">
            <Feature icon={Wallet} title="Deposit" body={`${gbp(RENTAL_TERMS.depositPence)}, fully refundable when the scooter comes back as it went out.`} />
            <Feature
              icon={PoundSterling}
              title="Weekly rent"
              body={RENTAL_FLEET.map((f) => `${f.name} ${gbp(f.weeklyPence)}`).join(" · ")}
            />
            <Feature icon={Calendar} title={`Minimum ${RENTAL_TERMS.minWeeks} weeks`} body={`Rent is paid weekly. After the first ${RENTAL_TERMS.minWeeks} weeks, extend the hire or return the scooter at the end of any week.`} />
            <Feature icon={FileText} title="Simple paperwork" body="A standard rental agreement is signed at the workshop when you collect." />
            <Feature icon={Wrench} title="Maintained by us" body={`Full servicing and maintenance are included at no cost to you by ${BRAND.name}.`} />
            <Feature icon={ShieldCheck} title="Ready to ride" body="Every scooter is checked before each hire." />
          </div>
        </div>
      </section>

      <CtaBand
        eyebrow="Ready to ride?"
        title="Check what's available this week."
        body="Scooters go quickly — message us on WhatsApp to reserve yours."
        service="Motorbike Rental"
        primaryLabel="Reserve a Scooter"
      />
    </SiteLayout>
  );
}
