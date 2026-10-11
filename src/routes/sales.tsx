import { createFileRoute, Link } from "@tanstack/react-router";
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
import { SiteLayout } from "@/components/SiteLayout";
import { Checklist, CtaBand, Feature, PageHero } from "@/components/LandingParts";
import { BRAND, siteLink } from "@/lib/brand";
import pcx from "@/assets/honda-pcx-125.jpg";
import forza from "@/assets/honda-forza.jpg";
import vision from "@/assets/honda-vision.jpg";
import nmax from "@/assets/yamaha-nmax.jpg";
import sportsBike from "@/assets/app-hero-bike.jpg";
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

const models = [
  {
    name: "Honda PCX 125",
    body: "The best-selling commuter: smooth, frugal and easy in traffic.",
    image: pcx,
    tags: ["125cc", "Automatic", "Learner legal"],
  },
  {
    name: "Honda Forza",
    body: "Maxi-scooter comfort with room for longer runs and a passenger.",
    image: forza,
    tags: ["Maxi", "Touring", "Storage"],
  },
  {
    name: "Yamaha NMAX",
    body: "Sharp, sporty and efficient — a great everyday all-rounder.",
    image: nmax,
    tags: ["125cc", "Automatic", "ABS"],
  },
  {
    name: "Honda Vision 110",
    body: "Light, low seat and simple to ride — ideal for new riders.",
    image: vision,
    tags: ["110cc", "Lightweight", "Low seat"],
  },
];

const styles = [
  {
    name: "Urban Commuter",
    body: "Practical 125s built for the daily run into town.",
    image: images.urban,
  },
  {
    name: "Everyday Classic",
    body: "Retro looks with modern, reliable running gear.",
    image: images.classic,
  },
  {
    name: "Motorcycles",
    body: "Geared bikes for riders ready to step up.",
    image: sportsBike,
  },
];

function Sales() {
  return (
    <SiteLayout appearance="landing" hideFloating>
      <PageHero
        eyebrow="Sales"
        title="Find your"
        accent="next ride."
        description="New and used scooters and motorcycles, each one checked over by our own workshop before it leaves with honest advice from people who ride."
        image={images.hero}
        imageAlt="Maxi scooter parked by the river"
        imagePosition="60% 25%"
      >
        <div className="landing-actions">
          <Link to="/contact" search={{ service: "Scooter Sales" }} className="landing-button landing-button-blue">
            Ask About Stock <ArrowRight />
          </Link>
          <a href="#models" className="landing-button landing-button-outline">
            Popular Models <ArrowRight />
          </a>
        </div>
      </PageHero>

      <section id="models" className="landing-container landing-block" aria-labelledby="models-title">
        <div className="landing-section-heading">
          <div>
            <p className="landing-eyebrow">Popular models</p>
            <h2 id="models-title">Scooters riders love.</h2>
          </div>
          <Link to="/contact" search={{ service: "Scooter Sales" }} className="landing-text-link">
            Check Availability <ArrowRight />
          </Link>
        </div>
        <div className="landing-card-grid landing-card-grid-4">
          {models.map((m) => (
            <article key={m.name} className="landing-card">
              <div className="landing-card-photo landing-card-photo-contain">
                <img src={m.image} alt={m.name} loading="lazy" width={1280} height={960} />
              </div>
              <div className="landing-card-body">
                <h3>{m.name}</h3>
                <p>{m.body}</p>
                <div className="landing-tags">
                  {m.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
                <Link
                  to="/contact"
                  search={{ service: "Scooter Sales", bike: m.name }}
                  className="landing-text-link"
                >
                  Enquire <ArrowRight />
                </Link>
              </div>
            </article>
          ))}
        </div>
        <p className="landing-availability">
          Models shown are examples of what we sell. Stock changes often — get in touch for what's in the showroom now.
        </p>
      </section>

      <section id="styles" className="landing-container landing-block" aria-labelledby="styles-title">
        <div className="landing-block-heading">
          <p className="landing-eyebrow">Something for every rider</p>
          <h2 id="styles-title">Pick your style.</h2>
        </div>
        <div className="landing-card-grid">
          {styles.map((s) => (
            <article key={s.name} className="landing-card">
              <div className="landing-card-photo">
                <img src={s.image} alt={`${s.name} style`} loading="lazy" width={1536} height={1024} />
              </div>
              <div className="landing-card-body">
                <h3>{s.name}</h3>
                <p>{s.body}</p>
                <Link
                  to="/contact"
                  search={{ service: "Scooter Sales", bike: s.name }}
                  className="landing-text-link"
                >
                  View Options <ArrowRight />
                </Link>
              </div>
            </article>
          ))}
        </div>
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
              <Link to="/contact" search={{ service: "Scooter Sales" }} className="landing-button landing-button-blue">
                Talk to Sales <ArrowRight />
              </Link>
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
    </SiteLayout>
  );
}
