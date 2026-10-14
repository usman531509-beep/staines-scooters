import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bike,
  ClipboardCheck,
  HandCoins,
  KeyRound,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { SiteLayout } from "@/components/SiteLayout";
import { Checklist, CtaBand, Feature, PageHero } from "@/components/LandingParts";
import { BRAND, siteLink } from "@/lib/brand";
import { ScooterDetails } from "@/components/ScooterDetails";
import { SALE_EXTRAS, SALE_SCOOTERS, enquire, type SaleScooter } from "@/lib/scooters";
import "@/styles/landing.css";

const images = {
  hero: "/images/landing/maxi.webp",
  classic: "/images/landing/classic.webp",
  urban: "/images/landing/rental.webp",
  workshop: "/images/landing/workshop.webp",
};

export const Route = createFileRoute("/sales")({
  head: () => ({
    meta: [
      { title: `Scooter & Motorcycle Sales | ${BRAND.name}` },
      {
        name: "description",
        content:
          "New and used scooters and motorcycles, checked over by our workshop before they leave. Honda, Yamaha and more — get in touch for current stock.",
      },
      { property: "og:title", content: `Scooter & Motorcycle Sales — ${BRAND.name}` },
      { property: "og:url", content: siteLink("/sales") },
      { property: "og:image", content: siteLink(images.hero) },
    ],
    links: [{ rel: "canonical", href: siteLink("/sales") }],
  }),
  component: Sales,
});

function Sales() {
  const [details, setDetails] = useState<SaleScooter | null>(null);

  return (
    <SiteLayout appearance="landing">
      <PageHero
        eyebrow="Sales"
        title="Find your"
        accent="next ride."
        description="New and used scooters, each one checked over by our own workshop and every scooter comes with a pizza box, hot grips, muffs and a phone holder."
        image={images.hero}
        imageAlt="Maxi scooter parked by the river"
        imagePosition="60% 25%"
      >
        <div className="landing-actions">
          <a href={enquire.buy()} target="_blank" rel="noopener noreferrer" className="ss-btn-whatsapp">
            <WhatsAppIcon aria-hidden="true" /> Ask About Stock
          </a>
          <a href="#models" className="ss-btn-yellow">
            View Scooters <ArrowRight aria-hidden="true" />
          </a>
        </div>
      </PageHero>

      <section id="models" className="landing-container ss-section" aria-labelledby="models-title">
        <div className="ss-section-head">
          <div>
            <h2 id="models-title" className="ss-title">
              Scooters for <span>Sale</span>
            </h2>
            <p className="ss-subtitle">Every scooter comes with: {SALE_EXTRAS.join(", ").toLowerCase()}.</p>
          </div>
        </div>
        <div className="ss-sale-grid">
          {SALE_SCOOTERS.map((m) => (
            <article key={m.name} className="ss-sale-card">
              <img src={m.image} alt={m.name} loading="lazy" />
              <h3>
                {m.name} <small className="ss-cc">{m.cc}</small>
              </h3>
              <p className="ss-sale-text">{m.body}</p>
              <button type="button" className="ss-btn-outline" onClick={() => setDetails(m)}>
                View Details
              </button>
            </article>
          ))}
        </div>
        <p className="ss-note">Stock changes often message us on WhatsApp for what's in the showroom now.</p>
      </section>

      <section id="buying" className="landing-container landing-block" aria-labelledby="why-title">
        <div className="landing-split">
          <div className="landing-split-photo">
            <img src={images.workshop} alt="Technician preparing a scooter for sale" loading="lazy" />
            <span className="landing-photo-badge">
              <BadgeCheck aria-hidden="true" /> Workshop checked
            </span>
          </div>
          <div className="landing-split-copy">
            <span className="landing-feature-icon">
              <ShieldCheck aria-hidden="true" />
            </span>
            <h2 id="why-title">Bought with confidence.</h2>
            <p>
              Every bike we sell goes through our own workshop first. We check the brakes, tyres, lights and
              running, and talk you through its history before you ride away.
            </p>
            <Checklist
              items={[
                "Pre-sale workshop inspection",
                "Fresh service where needed",
                "Honest history and mileage",
                "Help choosing the right size",
                "Part exchange welcome",
                "Aftercare from the same team",
              ]}
            />
            <div className="landing-actions">
              <a href={enquire.buy()} target="_blank" rel="noopener noreferrer" className="ss-btn-whatsapp">
                <WhatsAppIcon aria-hidden="true" /> Talk to Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-container landing-block" aria-labelledby="steps-title">
        <div className="landing-panel">
          <div className="landing-block-heading">
            <p className="landing-eyebrow">How buying works</p>
            <h2 id="steps-title">Simple, from first chat to first ride.</h2>
          </div>
          <div className="landing-panel-grid landing-panel-grid-4">
            <Feature icon={MessageCircle} title="Tell us what you need" body="Budget, riding style and licence we'll suggest options." />
            <Feature icon={Bike} title="See it in person" body="Come and look the bike over with our team." />
            <Feature icon={HandCoins} title="Agree the deal" body="Clear pricing, with part exchange if you have one." />
            <Feature icon={KeyRound} title="Ride away" body="Handover, a run-through of the controls and you're off." />
          </div>
        </div>
      </section>

      <section className="landing-container landing-block" aria-labelledby="aftercare-title">
        <div className="landing-panel-grid">
          <Feature icon={Wrench} title="Servicing on site" body="Keep your new ride at its best with our workshop." />
          <Feature icon={ClipboardCheck} title="Pre-MOT checks" body="We help you spot issues before the test." />
          <Feature icon={Sparkles} title="Accessories & parts" body="Helmets, locks and service parts on request." />
        </div>
      </section>

      <CtaBand
        title="Found one you like?"
        body="Ask about current stock, part exchange or a specific model."
        service="Scooter Sales"
        primaryLabel="Ask About Stock"
      />
      <ScooterDetails scooter={details} onClose={() => setDetails(null)} />
    </SiteLayout>
  );
}
