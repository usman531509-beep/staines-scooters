// Single source of truth for business identity shown across the site, receipts,
// invoices and payment links; update contact details here only.

const env = import.meta.env as Record<string, string | undefined>;

export const BRAND = {
  name: "Staines Scooters",
  legalName: "Staines Scooters Ltd",
  companyNumber: "00000000",
  /** Public site origin (no trailing slash); used for links in emails and payment pages. */
  siteUrl: (env.VITE_SITE_URL || "http://localhost:3000").replace(/\/+$/, ""),
  email: "staines_scooter@outlook.com",
  /** Main number; also the WhatsApp number every enquiry goes to. */
  phone: "07471 109963",
  /** Digits only, international format, for tel:/wa.me links. */
  phoneIntl: "447471109963",
  phone2: "07423 242927",
  phone2Intl: "447423242927",
  addressLine: "Burma House, Station Path",
  town: "Staines-upon-Thames",
  postcode: "TW18 4LA",
} as const;

/** One-line address, skipping any part that is still blank. */
export const BRAND_ADDRESS = [BRAND.addressLine, BRAND.town, BRAND.postcode].filter(Boolean).join(", ");

/** Google Maps directions to the shop. */
export const DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  [BRAND.addressLine, BRAND.town, BRAND.postcode].join(", "),
)}`;

/** Opening hours shown on the site. */
export const OPENING_HOURS: Array<[string, string]> = [
  ["Monday", "9:00am – 6:00pm"],
  ["Tuesday", "9:00am – 6:00pm"],
  ["Wednesday", "9:00am – 6:00pm"],
  ["Thursday", "9:00am – 6:00pm"],
  ["Friday", "9:00am – 6:00pm"],
  ["Saturday", "9:00am – 5:00pm"],
  ["Sunday", "Closed"],
];

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
