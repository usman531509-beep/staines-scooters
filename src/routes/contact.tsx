import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Phone, Mail, MapPin, Clock, Send, CheckCircle2, MessageCircle, type LucideIcon } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { PageHero } from "@/components/LandingParts";
import { BRAND, BRAND_ADDRESS, siteLink, whatsappLink } from "@/lib/brand";
import "@/styles/landing.css";

const images = {
  hero: "/images/landing/nmax-hero.webp",
  workshop: "/images/landing/workshop.webp",
};

export const Route = createFileRoute("/contact")({
  validateSearch: (search: Record<string, unknown>): { service?: string; bike?: string } => ({
    service:
      typeof search.service === "string" && services.includes(search.service)
        ? search.service
        : undefined,
    bike: typeof search.bike === "string" ? search.bike.slice(0, 120) : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Contact — ${BRAND.name}` },
      {
        name: "description",
        content: `Contact ${BRAND.name} for motorbike repair, parts, rental, key fobs and pre-MOT checks. Workshop at ${BRAND_ADDRESS}.`,
      },
      { property: "og:title", content: `Contact ${BRAND.name}` },
      {
        property: "og:description",
        content: `Call ${BRAND.phone} or visit the workshop at ${BRAND_ADDRESS}.`,
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AutoRepair",
          name: BRAND.name,
          image: siteLink("/favicon.png"),
          telephone: `+${BRAND.phoneIntl}`,
          email: BRAND.email,
          url: siteLink("/contact"),
          address: {
            "@type": "PostalAddress",
            streetAddress: BRAND.addressLine || undefined,
            addressLocality: BRAND.town,
            postalCode: BRAND.postcode || undefined,
            addressCountry: "GB",
          },
          areaServed: BRAND.town,
          openingHoursSpecification: [
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
              opens: "09:30",
              closes: "18:30",
            },
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: "Sunday",
              opens: "10:00",
              closes: "16:00",
            },
          ],
          priceRange: "££",
        }),
      },
    ],
  }),
  component: Contact,
});

const services = [
  "Scooter Sales",
  "Servicing",
  "Accident Claims",
  "Key Fob for Keyless Bikes",
  "Motorbike Repair",
  "Parts",
  "Fault Finding",
  "Motorbike Rental",
  "Pre-MOT Checks",
  "Other",
];

function Contact() {
  const enquiry = Route.useSearch();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSending(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      bike: String(fd.get("bike") ?? ""),
      reg: String(fd.get("reg") ?? ""),
      service: String(fd.get("service") ?? ""),
      message: String(fd.get("message") ?? ""),
      website: String(fd.get("website") ?? ""),
    };
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to send");
      setSent(true);
    } catch (e: any) {
      setErr(e.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <SiteLayout appearance="landing" hideFloating>
      <PageHero
        eyebrow="Contact"
        title="Let's get you"
        accent="moving."
        description="Sales, servicing, repairs, rentals or a claim call, email or send an enquiry and the team will get back to you."
        image={images.hero}
        imageAlt="Yamaha NMAX scooter"
        cutout
      >
        <div className="landing-actions">
          <a href="#enquiry" className="landing-button landing-button-blue">
            Send an Enquiry <ArrowRight />
          </a>
          <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="landing-button landing-button-whatsapp">
            <MessageCircle /> WhatsApp Us
          </a>
          <a href={`tel:+${BRAND.phoneIntl}`} className="landing-button landing-button-outline">
            <Phone /> {BRAND.phone}
          </a>
        </div>
      </PageHero>

      <section className="landing-container landing-block" aria-label="Contact details and enquiry form">
        <div className="landing-contact-grid">
          <aside className="landing-info-list">
            <InfoCard icon={MapPin} label="Workshop">
              <strong>{BRAND.name}</strong>
              <p>
                {BRAND.addressLine && (
                  <>
                    {BRAND.addressLine}
                    <br />
                  </>
                )}
                {[BRAND.town, BRAND.postcode].filter(Boolean).join(", ")}
              </p>
            </InfoCard>
            <InfoCard icon={Phone} label="Telephone">
              <a href={`tel:+${BRAND.phoneIntl}`}>{BRAND.phone}</a>
            </InfoCard>
            <InfoCard icon={MessageCircle} label="WhatsApp">
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer">
                Chat with us on WhatsApp
              </a>
            </InfoCard>
            <InfoCard icon={Mail} label="Email">
              <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
            </InfoCard>
            <InfoCard icon={Clock} label="Opening hours">
              <p>
                Mon – Sat: 9:30 – 18:30
                <br />
                Sunday: 10:00 – 16:00
              </p>
            </InfoCard>
            <div className="landing-info-photo">
              <img src={images.workshop} alt="Our workshop team at work" loading="lazy" />
            </div>
          </aside>

          <div id="enquiry" className="landing-form-card">
            <p className="landing-eyebrow">Send an enquiry</p>
            <h2>Tell us about your ride.</h2>

            {sent ? (
              <div className="landing-form-done" role="status">
                <CheckCircle2 aria-hidden="true" />
                <strong>Thanks — we'll be in touch.</strong>
                <p>
                  For anything urgent, call <a href={`tel:+${BRAND.phoneIntl}`}>{BRAND.phone}</a>.
                </p>
              </div>
            ) : (
              <form onSubmit={submitForm} className="landing-form">
                {/* Honeypot: hidden from people and assistive tech, filled in by spam bots. */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" hidden />
                <Field label="Full name" name="name" autoComplete="name" required />
                <Field label="Phone number" name="phone" type="tel" autoComplete="tel" required />
                <Field label="Email address" name="email" type="email" autoComplete="email" required wide />
                <Field label="Bike make & model" name="bike" placeholder="e.g. Honda PCX 125" defaultValue={enquiry.bike} />
                <Field label="Registration" name="reg" placeholder="e.g. AB12 CDE" />

                <div className="landing-field-wide">
                  <label htmlFor="contact-service">What do you need?</label>
                  <select id="contact-service" name="service" defaultValue={enquiry.service ?? ""}>
                    <option value="" disabled>
                      Select a service…
                    </option>
                    {services.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="landing-field-wide">
                  <label htmlFor="contact-message">Message</label>
                  <textarea
                    id="contact-message"
                    name="message"
                    rows={5}
                    placeholder="Describe the issue or what you're looking for."
                  />
                </div>

                {err && <p className="landing-form-error" role="alert">{err}</p>}

                <div className="landing-field-wide">
                  <button type="submit" disabled={sending} className="landing-button landing-button-blue">
                    <Send /> {sending ? "Sending…" : "Send Enquiry"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="landing-container landing-block" aria-labelledby="map-title">
        <div className="landing-block-heading">
          <p className="landing-eyebrow">Find us</p>
          <h2 id="map-title">Visit the workshop.</h2>
        </div>
        <div className="landing-map">
          <iframe
            title={`${BRAND.name} map`}
            src={`https://www.google.com/maps?q=${encodeURIComponent(BRAND_ADDRESS)}&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>
    </SiteLayout>
  );
}

function InfoCard({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="landing-info-card">
      <span className="landing-feature-icon">
        <Icon aria-hidden="true" />
      </span>
      <div>
        <small>{label}</small>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
  autoComplete,
  wide = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  autoComplete?: string;
  wide?: boolean;
}) {
  const id = `contact-${name}`;
  return (
    <div className={wide ? "landing-field-wide" : undefined}>
      <label htmlFor={id}>
        {label}
        {required && <span> *</span>}
      </label>
      <input
        id={id}
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
      />
    </div>
  );
}
