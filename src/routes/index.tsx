import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Settings,
  Users,
  ShieldCheck,
  Store,
  MessageCircle,
  Wrench,
  Phone,
  ClipboardList,
  Bike,
} from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Feature } from "@/components/LandingParts";
import { RotatingWords } from "@/components/ui/animated-hero";
import { BRAND, siteLink } from "@/lib/brand";
import "@/styles/landing.css";

const images = {
  hero: "/images/landing/hero.webp",
  workshop: "/images/landing/workshop.webp",
  claims: "/images/landing/claims.webp",
  rental: "/images/landing/rental.webp",
  service: "/images/landing/service.webp",
  salesScooter: "/images/landing/sales-scooter.webp",
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Staines Scooters | Sales, Repairs, Servicing & Rentals" },
      {
        name: "description",
        content:
          "Your ride. Our expertise. Scooter and motorcycle sales, repairs, servicing, rentals and accident claims all in one place at Staines Scooters.",
      },
      { property: "og:title", content: "Staines Scooters | Your ride. Our expertise." },
      {
        property: "og:description",
        content: "Scooters, motorcycles, expert care and ongoing support all in one place.",
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
          address: {
            "@type": "PostalAddress",
            streetAddress: BRAND.addressLine || undefined,
            addressLocality: BRAND.town,
            postalCode: BRAND.postcode || undefined,
            addressCountry: "GB",
          },
        }),
      },
    ],
  }),
  component: Home,
});

// Second line of the hero heading; cycles one phrase at a time.
const heroWords = ["Our expertise.", "Sold right.", "Fixed fast.", "Kept moving.", "Ready to rent."] as const;

const services = [
  {
    number: "01",
    title: "Sales",
    body: "A great range of new and used scooters and motorcycles for every ride.",
    image: images.salesScooter,
    alt: "White scooter",
    to: "/sales",
    className: "landing-service-sales",
  },
  {
    number: "02",
    title: "Repairs",
    body: "Get back on the road with expert diagnostics and reliable repairs.",
    image: images.workshop,
    alt: "Mechanic working on a scooter",
    to: "/services",
    className: "landing-service-repairs",
  },
  {
    number: "03",
    title: "Services",
    body: "Keep your scooter running at its best with manufacturer-recommended care.",
    image: images.service,
    alt: "Fresh engine oil being added during servicing",
    to: "/contact",
    service: "Servicing",
    className: "landing-service-servicing",
  },
  {
    number: "04",
    title: "Rentals",
    body: "Flexible scooter rentals for work, leisure or while yours is being repaired.",
    image: images.rental,
    alt: "Helmeted rider on an urban scooter",
    to: "/rental",
    className: "landing-service-rentals",
  },
  {
    number: "05",
    title: "Accident Claims",
    body: "Support to get you moving again quickly and with less hassle.",
    image: images.claims,
    alt: "Motorcycle helmet on the road",
    to: "/accident-claims",
    className: "landing-service-claims",
  },
] as const;

// Rental fleet shown on the home page; photos live in public/images/fleet/
// (a card without `image` shows a placeholder).
const fleet: Array<{ name: string; body: string; image?: string }> = [
  { name: "Honda PCX 125", body: "Smooth, economical and comfortable for daily London riding.", image: "/images/fleet/honda-pcx.webp" },
  { name: "Honda Vision 110", body: "Light and easy to handle, ideal for new riders and short trips.", image: "/images/fleet/honda-vision.webp" },
  { name: "Honda SH Mode 125", body: "Slim step-through style that slips through city traffic.", image: "/images/fleet/honda-sh-mode.webp" },
  { name: "Yamaha NMAX 125", body: "Sporty maxi-style comfort with plenty of storage.", image: "/images/fleet/yamaha-nmax.webp" },
];
const trust = [
  {
    icon: Store,
    title: "All your riding needs in one place",
    body: "Sales, servicing, rentals and accident claims.",
  },
  {
    icon: MessageCircle,
    title: "Friendly, practical advice",
    body: "Honest guidance from people who ride.",
  },
  {
    icon: Wrench,
    title: "Care for scooters & motorcycles",
    body: "Skilled technicians and the right equipment.",
  },
  { icon: Users, title: "Support from sales to servicing", body: "We're here for the long run." },
];

function Home() {
  return (
    <SiteLayout appearance="landing" hideFloating>
      <section className="landing-hero" aria-labelledby="hero-title">
        <img
          className="landing-hero-image"
          src={images.hero}
          alt="Blue scooter beside the Thames"
          width={1536}
          height={1024}
          fetchPriority="high"
        />
        <div className="landing-container landing-hero-content">
          <p className="landing-eyebrow">Scooters & motorcycles in London</p>
          <h1 id="hero-title">
            Your ride.
            <RotatingWords words={heroWords} className="landing-hero-rotating" />
          </h1>
          <p className="landing-hero-description">
            Scooter & motorcycle sales, repairs, servicing,
            <br className="landing-desktop-break" /> rentals and accident claims all in one place.
          </p>
          <div className="landing-actions">
            <Link to="/sales" className="landing-button landing-button-blue">
              Explore Scooters <ArrowRight />
            </Link>
            <Link
              to="/contact"
              search={{ service: "Servicing" }}
              className="landing-button landing-button-outline"
            >
              Book a Service <ArrowRight />
            </Link>
          </div>
          <div className="landing-hero-features">
            <Feature
              icon={Settings}
              title="Expert Care"
              body="Skilled technicians, reliable service."
            />
            <Feature
              icon={Users}
              title="All Riders Welcome"
              body="From new riders to experienced."
            />
            <Feature
              icon={ShieldCheck}
              title="Friendly Support"
              body="A local team that keeps you moving."
            />
          </div>
        </div>
      </section>

      <section
        id="our-services"
        className="landing-container landing-section"
        aria-labelledby="services-title"
      >
        <div className="landing-section-heading">
          <div>
            <p className="landing-eyebrow">Our services</p>
            <h2 id="services-title">Everything your ride needs.</h2>
          </div>
          <Link to="/services" className="landing-text-link">
            View All Services <ArrowRight />
          </Link>
        </div>
        <div className="landing-service-grid">
          {services.map((item) => (
            <Link
              key={item.number}
              to={item.to}
              search={"service" in item ? { service: item.service } : {}}
              className={`landing-service-card ${item.className}`}
            >
              <img src={item.image} alt={item.alt} loading="lazy" width={800} height={600} />
              <div className="landing-service-copy">
                <span className="landing-service-number">{item.number}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <span className="landing-round-arrow" aria-hidden="true">
                  <ArrowRight />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section
        id="scooters"
        className="landing-container landing-section landing-range"
        aria-labelledby="range-title"
      >
        <div className="landing-section-heading">
          <div>
            <p className="landing-eyebrow">Rentals</p>
            <h2 id="range-title">Rental Fleet</h2>
          </div>
          <Link to="/rental" className="landing-text-link">
            View Rentals <ArrowRight />
          </Link>
        </div>
        <div className="landing-scooter-grid landing-fleet-grid">
          {fleet.map((scooter) => (
            <article key={scooter.name} className="landing-scooter-card">
              <div className="landing-scooter-photo">
                {scooter.image ? (
                  <img src={scooter.image} alt={scooter.name} loading="lazy" width={800} height={500} />
                ) : (
                  <div className="landing-fleet-placeholder" aria-hidden="true">
                    <Bike />
                  </div>
                )}
              </div>
              <div className="landing-scooter-copy">
                <h3>{scooter.name}</h3>
                <p>{scooter.body}</p>
                <Link
                  to="/contact"
                  search={{ service: "Motorbike Rental", bike: scooter.name }}
                  className="landing-button landing-button-outline"
                >
                  Rent this scooter <ArrowRight />
                </Link>
              </div>
            </article>
          ))}
        </div>
        <p className="landing-availability">
          Weekly rentals, serviced and ready to ride. Get in touch to check availability.
        </p>
      </section>

      <section className="landing-trust" aria-labelledby="trust-title">
        <div className="landing-container landing-trust-inner">
          <div className="landing-trust-copy">
            <p className="landing-eyebrow">A local team you can trust</p>
            <h2 id="trust-title">
              Why choose
              <br /> Staines Scooters?
            </h2>
            <p className="landing-trust-description">
              Quality scooters and motorcycles, expert care and genuine support all from a local
              team that keeps you moving.
            </p>
            <div className="landing-trust-features">
              {trust.map((item) => (
                <Feature key={item.title} {...item} />
              ))}
            </div>
          </div>
          <div className="landing-trust-photo">
            <img
              src={images.workshop}
              alt="Our workshop team taking care of a blue scooter"
              loading="lazy"
              width={1024}
              height={1024}
            />
          </div>
        </div>
      </section>

      <section
        className="landing-container landing-section landing-steps-section"
        aria-labelledby="steps-title"
      >
        <p className="landing-eyebrow">It's easy to get started</p>
        <h2 id="steps-title">Back on the road in 3 simple steps.</h2>
        <ol className="landing-steps">
          <li>
            <Feature
              icon={Phone}
              title="Get in touch"
              body="Tell us what you need sales, service, repair, rental or a claim."
            />
            <ArrowRight className="landing-step-arrow" aria-hidden="true" />
          </li>
          <li>
            <Feature
              icon={ClipboardList}
              title="Tell us what you need"
              body="Share a few details and we'll talk through the options."
            />
            <ArrowRight className="landing-step-arrow" aria-hidden="true" />
          </li>
          <li>
            <Feature
              icon={Settings}
              title="Let us take care of your ride"
              body="Our expert team gets to work so you can get back on the road."
            />
          </li>
        </ol>
      </section>

      <section className="landing-wide-container landing-accident" aria-labelledby="accident-title">
        <img
          src={images.claims}
          alt="Motorcycle helmet with a scooter in the background"
          loading="lazy"
          width={1536}
          height={1024}
        />
        <div className="landing-accident-copy">
          <p className="landing-eyebrow">Support when it matters</p>
          <h2 id="accident-title">
            Had an accident?
            <br />
            <span>We're here to help.</span>
          </h2>
          <p>
            We'll guide you through the claims process and
            <br className="landing-desktop-break" /> get you back on the road with expert support.
          </p>
          <Link to="/accident-claims" className="landing-button landing-button-white">
            Get Claims Support <ArrowRight />
          </Link>
        </div>
      </section>

      <section className="landing-wide-container landing-cta" aria-labelledby="cta-title">
        <div>
          <p className="landing-eyebrow">Sales · Service · Repairs · Rentals · Accident Claims</p>
          <h2 id="cta-title">Your next ride starts here.</h2>
          <p>Scooters, motorcycles, expert care and ongoing support all in one place.</p>
        </div>
        <div className="landing-actions">
          <Link to="/contact" className="landing-button landing-button-white">
            Contact Us <ArrowRight />
          </Link>
          <Link
            to="/contact"
            search={{ service: "Servicing" }}
            className="landing-button landing-button-navy"
          >
            Book a Service <ArrowRight />
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
