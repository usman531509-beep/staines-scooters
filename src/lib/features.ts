// Modules that are built but hidden for now. Flip a flag to true to bring the
// module back: its navigation entries, pages and public links reappear; the
// code and data are untouched while hidden.
export const FEATURES = {
  /** Motorbike finance (agreements, signing links, finance accounts). */
  finance: false,
  /** Stripe online payments: rent pay links, saved-card autopay, Stripe Connect. */
  onlinePayments: false,
} as const;
