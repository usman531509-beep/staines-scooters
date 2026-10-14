import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bike,
  Camera,
  ClipboardList,
  FileText,
  Phone,
  Search,
  ShieldCheck,
  Truck,
  Wrench,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { SiteLayout } from "@/components/SiteLayout";
import { Checklist, CtaBand, Feature, PageHero } from "@/components/LandingParts";
import { BRAND, siteLink, whatsappLink } from "@/lib/brand";
import "@/styles/landing.css";

const claimMessage = `Hi ${BRAND.name}, I've had an accident and need help with a claim.`;

const images = {
  hero: "/images/landing/claims.webp",
  workshop: "/images/landing/workshop.webp",
  rental: "/images/landing/rental.webp",
  nmax: "/images/landing/nmax-red.webp",
  riding: "/images/landing/pcx-riding.webp",
};

export const Route = createFileRoute("/accident-claims")({
  head: () => ({
    meta: [
      { title: `Accident Claims Support | ${BRAND.name}` },
      {
        name: "description",
        content:
          "Had a scooter or motorcycle accident? We inspect the damage, prepare repair estimates, help with your claim and can keep you riding while yours is fixed.",
      },
      { property: "og:title", content: `Accident Claims Support — ${BRAND.name}` },
      { property: "og:url", content: siteLink("/accident-claims") },
      { property: "og:image", content: siteLink(images.hero) },
    ],
    links: [{ rel: "canonical", href: siteLink("/accident-claims") }],
  }),
  component: AccidentClaims,
});

function AccidentClaims() {
  return (
    <SiteLayout appearance="landing">
      <PageHero
        eyebrow="Accident Claims"
        title="Had an accident?"
        accent="We're here to help."
        description="We'll inspect your bike, put together the repair estimate and help you through the claim so you can get back on the road with less hassle."
        image={images.hero}
        imageAlt="Motorcycle helmet on the road after an accident"
        imagePosition="70% center"
      >
        <div className="landing-actions">
          <a href={whatsappLink(claimMessage)} target="_blank" rel="noopener noreferrer" className="ss-btn-whatsapp">
            <WhatsAppIcon aria-hidden="true" /> Start Your Claim on WhatsApp
          </a>
          <a href={`tel:+${BRAND.phoneIntl}`} className="ss-btn-yellow">
            <Phone aria-hidden="true" /> Call {BRAND.phone}
          </a>
        </div>
      </PageHero>

      <section className="landing-container landing-block" aria-labelledby="help-title">
        <div className="landing-block-heading">
          <p className="landing-eyebrow">How we help</p>
          <h2 id="help-title">Support at every step.</h2>
        </div>
        <div className="landing-panel-grid landing-panel-grid-4">
          <Feature icon={Search} title="Damage inspection" body="A thorough check of your bike by our technicians." />
          <Feature icon={FileText} title="Repair estimates" body="Clear, itemised reports your insurer can work with." />
          <Feature icon={ShieldCheck} title="Claim guidance" body="We explain the process and what you need to send." />
          <Feature icon={Wrench} title="Quality repairs" body="Repairs carried out in our own workshop." />
        </div>
      </section>

      <section className="landing-container landing-block" aria-labelledby="ready-title">
        <div className="landing-split-list">
          <div className="landing-split">
            <div className="landing-split-photo landing-split-photo-cutout">
              <img src={images.nmax} alt="Red Yamaha NMAX scooter" loading="lazy" />
              <span className="landing-photo-badge">
                <Wrench aria-hidden="true" /> Inspected in-house
              </span>
            </div>
            <div className="landing-split-copy">
              <span className="landing-feature-icon">
                <ClipboardList aria-hidden="true" />
              </span>
              <h2 id="ready-title">What to have ready.</h2>
              <p>
                The more you can share early on, the faster things move. Don't worry if you don't have
                everything we'll tell you what's still needed.
              </p>
              <Checklist
                items={[
                  "Date, time and place of the accident",
                  "The other party's details",
                  "Your insurance details",
                  "Photos of the scene and damage",
                  "Witness details, if any",
                  "Police reference, if given",
                ]}
              />
              <div className="landing-actions">
                <a
                  href={whatsappLink(`${claimMessage} I'll send photos of the damage here.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ss-btn-whatsapp"
                >
                  <WhatsAppIcon /> Send Photos on WhatsApp
                </a>
              </div>
            </div>
          </div>

          <div className="landing-split landing-split-reverse">
            <div className="landing-split-photo">
              <img src={images.riding} alt="Rider on a red Honda PCX" loading="lazy" />
              <span className="landing-photo-badge">
                <Bike aria-hidden="true" /> Keep riding
              </span>
            </div>
            <div className="landing-split-copy">
              <span className="landing-feature-icon">
                <Truck aria-hidden="true" />
              </span>
              <h2>Stay on the road meanwhile.</h2>
              <p>
                Need to keep working while your bike is off the road? Ask about our weekly scooter rentals so
                you're not left stranded during the repair.
              </p>
              <div className="landing-actions">
                <Link to="/rental" className="landing-button landing-button-outline">
                  See Rentals <ArrowRight />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-container landing-block" aria-labelledby="steps-title">
        <div className="landing-panel">
          <div className="landing-block-heading">
            <p className="landing-eyebrow">The process</p>
            <h2 id="steps-title">Three steps back to riding.</h2>
          </div>
          <div className="landing-panel-grid">
            <Feature icon={Phone} title="1. Get in touch" body="Call, WhatsApp or send an enquiry with what happened." />
            <Feature icon={Camera} title="2. We assess the bike" body="Inspection, photos and a written estimate." />
            <Feature icon={Wrench} title="3. Repaired & returned" body="Once approved, we repair and hand it back." />
          </div>
        </div>
      </section>

      <CtaBand
        eyebrow="Support when it matters"
        title="Let's get your claim moving."
        body="Tell us what happened and we'll guide you from there."
        service="Accident Claims"
        primaryLabel="Start Your Claim"
      />
    </SiteLayout>
  );
}
