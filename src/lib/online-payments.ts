import { FEATURES } from "@/lib/features";

/** Stripe online payments are hidden while FEATURES.onlinePayments is off: no pay links, saved cards, card checkouts or Stripe Connect. */
export function onlinePaymentsEnabled(): boolean {
  return FEATURES.onlinePayments;
}
export function assertOnlinePaymentsEnabled() {
  if (!FEATURES.onlinePayments) throw new Error("Online payments are not available.");
}
