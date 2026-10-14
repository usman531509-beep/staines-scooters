import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Clock,
  Cog,
  Droplets,
  KeyRound,
  Phone,
  Search,
  ShieldCheck,
  ThumbsUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { SiteLayout } from "@/components/SiteLayout";
import { Checklist, CtaBand, Feature, PageHero } from "@/components/LandingParts";
import { BRAND, siteLink, whatsappLink } from "@/lib/brand";
import keyfob from "@/assets/keyfob.jpg";
import workshopDark from "@/assets/hero-workshop.jpg";
import { enquire } from "@/lib/scooters";
import "@/styles/landing.css";

const images = {
  hero: "/images/landing/workshop.webp",
  service: "/images/landing/service.webp",
  rental: "/images/landing/rental.webp",
};

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: `Repairs & Servicing — Scooters & Motorcycles | ${BRAND.name}` },
      {
        name: "description",
        content:
          "Scooter and motorcycle servicing, repairs, fault finding, keyless key fobs, parts and pre-MOT checks — every make and model.",
      },
      { property: "og:title", content: `Repairs & Servicing — ${BRAND.name}` },
      { property: "og:url", content: siteLink("/services") },
      { property: "og:image", content: siteLink(images.hero) },
    ],
    links: [{ rel: "canonical", href: siteLink("/services") }],
  }),
  component: Services,
});

type Block = {
  /** Anchor used by the navigation dropdown. */
  id: string;
  icon: LucideIcon;
  title: string;
  service: string;
  image: string;
  imageAlt: string;
  badge: string;
  body: string;
  points: string[];
};

const blocks: Block[] = [
  {
    id: "servicing",
    icon: Droplets,
    title: "Servicing",
    service: "Servicing",
    image: images.service,
    imageAlt: "Fresh engine oil being poured during a scooter service",
    badge: "Manufacturer schedules",
    body: "Regular servicing keeps your scooter safe, reliable and economical. We follow the manufacturer's schedule and tell you about anything we spot along the way.",
    points: ["Oil & filter change", "Brake check & adjust", "Belt & roller inspection", "Tyre pressures & wear", "Lights & electrics", "Road test"],
  },
  {
    id: "repairs",
    icon: Wrench,
    title: "Repairs",
    service: "Motorbike Repair",
    image: workshopDark,
    imageAlt: "Motorcycle on a lift in the workshop",
    badge: "Every make & model",
    body: "From a scooter that won't start to a motorcycle that needs new brakes we repair every make and model, and explain the work before we start.",
    points: ["Engine running problems", "Brakes", "Tyres", "Belts & transmission", "Electrical faults", "Bodywork & panels"],
  },
  {
    id: "fault-finding",
    icon: Search,
    title: "Fault Finding",
    service: "Fault Finding",
    image: "/images/fleet/yamaha-nmax.webp",
    imageAlt: "Yamaha NMAX ready for diagnostics",
    badge: "Diagnostics",
    body: "Cutting out, failing to start or showing a warning light? We investigate the cause properly instead of guessing, so you only pay for the fix you need.",
    points: ["Starting issues", "Warning lights", "Sensor faults", "Poor running", "Battery & charging", "Intermittent faults"],
  },
  {
    id: "key-fobs",
    icon: KeyRound,
    title: "Key Fobs for Keyless Bikes",
    service: "Key Fob for Keyless Bikes",
    image: keyfob,
    imageAlt: "Technician working on a keyless scooter's ignition",
    badge: "Keyless specialists",
    body: "Keyless scooter won't recognise the fob? We help with faulty or lost fobs, keyless start problems and the checks that go with them.",
    points: ["Fob not recognised", "Keyless start faults", "Damaged or lost fobs", "Smart key system checks"],
  },
  {
    id: "pre-mot-checks",
    icon: ShieldCheck,
    title: "Pre-MOT Checks",
    service: "Pre-MOT Checks",
    image: images.rental,
    imageAlt: "Rider on a roadworthy scooter in the city",
    badge: "Pass first time",
    body: "Before the test, we check the items an MOT looks at and fix what's needed — saving you a failed test and a second trip.",
    points: ["Lights & indicators", "Brakes", "Tyres", "Mirrors & horn", "Number plate", "General roadworthiness"],
  },
];

const parts = ["Brake pads", "Belts", "Tyres", "Spark plugs", "Filters", "Oils", "Batteries", "Service items"];

function Services() {
  return (
    <SiteLayout appearance="landing">
      <PageHero
        eyebrow="Repairs & Servicing"
        title="Expert care for"
        accent="every ride."
        description="Servicing, repairs, fault finding, key fobs and pre-MOT checks for scooters and motorcycles every make and model, by technicians who ride."
        image={images.hero}
        imageAlt="Technician servicing a blue scooter in our workshop"
        imagePosition="65% 8%"
      >
        <div className="landing-actions">
          <a href={enquire.repair()} target="_blank" rel="noopener noreferrer" className="ss-btn-whatsapp">
            <WhatsAppIcon aria-hidden="true" /> WhatsApp Us
          </a>
          <a href={`tel:+${BRAND.phoneIntl}`} className="ss-btn-yellow">
            <Phone aria-hidden="true" /> Call {BRAND.phone}
          </a>
        </div>
      </PageHero>

      <section className="landing-container landing-block" aria-label="Why our workshop">
        <div className="landing-panel">
          <div className="landing-panel-grid landing-panel-grid-4">
            <Feature icon={Wrench} title="All makes & models" body="Scooters and motorcycles, big or small." />
            <Feature icon={ThumbsUp} title="Clear quotes" body="We explain the work and price before we start." />
            <Feature icon={Clock} title="Quick turnaround" body="Most services done the same day." />
            <Feature icon={Cog} title="Quality parts" body="The right parts and oils for your bike." />
          </div>
        </div>
      </section>

      <section className="landing-container landing-block" aria-labelledby="services-title">
        <div className="landing-block-heading">
          <p className="landing-eyebrow">What we do</p>
          <h2 id="services-title">Everything your ride needs.</h2>
        </div>
        <div className="landing-split-list">
          {blocks.map((b, i) => (
            <article key={b.title} id={b.id} className={`landing-split${i % 2 ? " landing-split-reverse" : ""}`}>
              <div className="landing-split-photo">
                <img src={b.image} alt={b.imageAlt} loading="lazy" />
                <span className="landing-photo-badge">
                  <b.icon aria-hidden="true" /> {b.badge}
                </span>
              </div>
              <div className="landing-split-copy">
                <span className="landing-feature-icon">
                  <b.icon aria-hidden="true" />
                </span>
                <h2>{b.title}</h2>
                <p>{b.body}</p>
                <Checklist items={b.points} />
                <div className="landing-actions">
                  <a
                    href={whatsappLink(`Hi ${BRAND.name}, I'd like to ask about ${b.title.toLowerCase()}.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ss-btn-dark"
                  >
                    <WhatsAppIcon aria-hidden="true" /> Enquire about {b.title.toLowerCase()}
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="parts" className="landing-container landing-block" aria-labelledby="parts-title">
        <div className="landing-panel">
          <div className="landing-split">
            <div className="landing-split-copy">
              <span className="landing-feature-icon">
                <Cog aria-hidden="true" />
              </span>
              <h2 id="parts-title">Parts & consumables.</h2>
              <p>
                We supply parts for repair and maintenance on common commuters and beyond ask us and we'll
                source the right one for your bike.
              </p>
              <Checklist items={parts} />
              <div className="landing-actions">
                <a
                  href={whatsappLink(`Hi ${BRAND.name}, I'm looking for a part for my scooter.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ss-btn-yellow"
                >
                  <WhatsAppIcon aria-hidden="true" /> Ask About a Part
                </a>
              </div>
            </div>
            <div className="landing-split-photo">
              <img src="/images/landing/parts.webp" alt="Motorcycle chain and sprocket on a workshop shelf" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      <CtaBand
        eyebrow="Not sure what your bike needs?"
        title="Describe the issue we'll advise."
        body="No jargon, no surprises. Just the next step for your ride."
      />
    </SiteLayout>
  );
}
