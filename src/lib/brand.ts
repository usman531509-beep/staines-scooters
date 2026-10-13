// Single source of truth for business identity shown across the site, emails,
// invoices and payment links. Contact details are placeholders until the real
// Staines Scooters details are available; update them here only.

const env = import.meta.env as Record<string, string | undefined>;

export const BRAND = {
  name: "Staines Scooters",
  legalName: "Staines Scooters Ltd",
  companyNumber: "00000000",
  /** Public site origin (no trailing slash); used for links in emails and payment pages. */
  siteUrl: (env.VITE_SITE_URL || "http://localhost:3000").replace(/\/+$/, ""),
  email: "contact@example.com",
  phone: "+44 7721 541806",
  /** Digits only, international format, for tel:/wa.me links. */
  phoneIntl: "447721541806",
  /** Street and postcode are blank until the exact London address is known. */
  addressLine: "" as string,
  town: "London",
  postcode: "" as string,
} as const;

/** One-line address, skipping any part that is still blank. */
export const BRAND_ADDRESS = [BRAND.addressLine, BRAND.town, BRAND.postcode].filter(Boolean).join(", ");

/** WhatsApp chat with the business number, with an optional pre-filled message. */
export function whatsappLink(text = `Hi ${BRAND.name}, I'd like to enquire about `): string {
  return `https://wa.me/${BRAND.phoneIntl}?text=${encodeURIComponent(text)}`;
}

/** Absolute URL on the public site for a path such as "/rental". */
export function siteLink(path = "/"): string {
  return `${BRAND.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Owner accounts with super-admin powers (managing other admins, built-in Stripe
 * rather than Connect, storage usage, rental MOT alerts). Comma-separated
 * VITE_OWNER_EMAILS; empty means nobody has these powers.
 */
export const OWNER_EMAILS: readonly string[] = (env.VITE_OWNER_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isOwnerEmail(email?: string | null): boolean {
  return !!email && OWNER_EMAILS.includes(email.trim().toLowerCase());
}
