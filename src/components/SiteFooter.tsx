import { Link } from "@tanstack/react-router";
import { Clock, Mail, Phone, MapPin, Navigation } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import logo from "@/assets/logo.png";
import { BRAND, BRAND_ADDRESS, DIRECTIONS_URL, OPENING_HOURS } from "@/lib/brand";
import { enquire } from "@/lib/scooters";


export function SiteFooter({ appearance = "default" }: { appearance?: "default" | "landing" }) {
  if (appearance === "landing")
    return (
      <footer className="ss-footer">
        <div className="landing-container ss-footer-grid">
          <section className="ss-footer-block ss-footer-visit" aria-labelledby="ft-visit">
            <MapPin aria-hidden="true" className="ss-footer-icon" />
            <div>
              <h2 id="ft-visit">Visit Our Shop</h2>
              <address>
                {BRAND.name}
                <br />
                {BRAND.addressLine}
                <br />
                {BRAND.town}, {BRAND.postcode}
              </address>
              <p className="ss-footer-hint">Directions end at bus stop J, in front of the Co-op, we're right opposite.</p>
              <a href={DIRECTIONS_URL} target="_blank" rel="noopener noreferrer" className="ss-btn-yellow ss-btn-sm">
                <Navigation aria-hidden="true" /> Get Directions
              </a>
            </div>
          </section>
          <section className="ss-find-us" aria-label="How to find us">
            <div className="ss-find-us-photos">
              <a href={DIRECTIONS_URL} target="_blank" rel="noopener noreferrer" aria-label="Street view — open directions">
                <img src="/images/landing/find-us-street.webp" alt="High Street with the walkway beside Nomad Stop marked" width={1000} height={719} loading="lazy" />
              </a>
              <a href={DIRECTIONS_URL} target="_blank" rel="noopener noreferrer" aria-label="Walking route — open directions">
                <img src="/images/landing/find-us-map.webp" alt="Map: walking route from High Street opposite the Co-op to Burma House" width={1000} height={614} loading="lazy" />
              </a>
            </div>
          </section>
          <section className="ss-footer-block" aria-labelledby="ft-hours">
            <Clock aria-hidden="true" className="ss-footer-icon" />
            <div>
              <h2 id="ft-hours">Opening Hours</h2>
              <dl className="ss-hours">
                {OPENING_HOURS.map(([day, hours]) => (
                  <div key={day}>
                    <dt>{day}</dt>
                    <dd>{hours}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
          <section className="ss-footer-block" aria-labelledby="ft-contact">
            <Phone aria-hidden="true" className="ss-footer-icon" />
            <div>
              <h2 id="ft-contact">Get in Touch</h2>
              <ul className="ss-footer-contact">
                <li>
                  <a href={`tel:+${BRAND.phoneIntl}`}><Phone aria-hidden="true" />{BRAND.phone}</a>
                </li>
                <li>
                  <a href={`tel:+${BRAND.phone2Intl}`}><Phone aria-hidden="true" />{BRAND.phone2}</a>
                </li>
                <li>
                  <a href={enquire.general()} target="_blank" rel="noopener noreferrer" className="ss-wa-link">
                    <WhatsAppIcon aria-hidden="true" />WhatsApp {BRAND.phone}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${BRAND.email}`}><Mail aria-hidden="true" />{BRAND.email}</a>
                </li>
              </ul>
            </div>
          </section>
        </div>
        <div className="ss-footer-bottom">
          <div className="landing-container ss-footer-bottom-row">
            <p>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    );
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-x grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
              className="h-10 w-10"
            />
            <span className="font-display text-lg tracking-wide">{BRAND.name}</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            Motorbike repair garage and 125cc scooter rental. Parts, key fobs, fault finding and
            pre-MOT checks.
          </p>
        </div>

        <div>
          <h4 className="eyebrow">Quick Links</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link to="/" className="text-foreground hover:text-primary">
                Home
              </Link>
            </li>
            <li>
              <Link to="/services" className="text-foreground hover:text-primary">
                Services
              </Link>
            </li>
            <li>
              <Link to="/rental" className="text-foreground hover:text-primary">
                Rental
              </Link>
            </li>
            <li>
              <Link to="/contact" className="text-foreground hover:text-primary">
                Contact Us
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="eyebrow">Rental Fleet</h4>
          <ul className="mt-4 space-y-2 text-sm text-foreground">
            <li>Honda PCX 125</li>
            <li>Honda SH 125</li>
            <li>Honda SH Mode 125</li>
            <li>Honda Vision 110</li>
          </ul>
        </div>

        <div>
          <h4 className="eyebrow">Contact</h4>
          <ul className="mt-4 space-y-3 text-sm text-foreground">
            <li className="flex gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{BRAND_ADDRESS}</span>
            </li>
            <li className="flex gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <a href={`tel:+${BRAND.phoneIntl}`} className="hover:text-primary">
                {BRAND.phone}
              </a>
            </li>
            <li className="flex gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <a href={`mailto:${BRAND.email}`} className="hover:text-primary break-all">
                {BRAND.email}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-6 text-xs text-ink-muted md:flex-row">
          <p>
            © {new Date().getFullYear()} {BRAND.name}. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
