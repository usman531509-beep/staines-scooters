import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock, Mail, Phone, MapPin, MessageCircle } from "lucide-react";
import logo from "@/assets/logo.png";
import { BRAND, BRAND_ADDRESS, whatsappLink } from "@/lib/brand";

import { LandingBrand, landingNav } from "./LandingBrand";

export function SiteFooter({ appearance = "default" }: { appearance?: "default" | "landing" }) {
  if (appearance === "landing")
    return (
      <footer className="landing-footer">
        <div className="landing-container landing-footer-grid">
          <div className="landing-footer-about">
            <LandingBrand footer />
            <p>
              Scooter and motorcycle sales, repairs, servicing, rentals and accident claims with a
              local team that keeps you moving.
            </p>
            <Link to="/contact" search={{ service: "Servicing" }} className="landing-footer-cta">
              Book a Service <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <nav aria-label="Footer navigation" className="landing-footer-col">
            <h2>Explore</h2>
            <Link to="/">Home</Link>
            <Link to="/contact" search={{ service: "Servicing" }}>Book a Service</Link>
            <Link to="/contact">Contact</Link>
          </nav>
          <nav aria-label="Our services" className="landing-footer-col">
            <h2>Services</h2>
            {landingNav
              .filter((item) => item.to !== "/")
              .map((item) => (
                <Link key={item.label} to={item.to}>
                  {item.label}
                </Link>
              ))}
          </nav>
          <address className="landing-footer-col landing-footer-contact">
            <h2>Visit or call</h2>
            <span><MapPin aria-hidden="true" />{BRAND_ADDRESS}</span>
            <a href={`tel:+${BRAND.phoneIntl}`}><Phone aria-hidden="true" />{BRAND.phone}</a>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />WhatsApp us</a>
            <a href={`mailto:${BRAND.email}`}><Mail aria-hidden="true" />{BRAND.email}</a>
            <span><Clock aria-hidden="true" />Mon–Sat 9:30–18:30 · Sun 10:00–16:00</span>
          </address>
        </div>
        <div className="landing-container landing-footer-bottom">
          <p>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
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
