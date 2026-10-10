import Stripe from "stripe";
import { OWNER_EMAILS } from "@/lib/brand";

/** Accounts that keep the original built-in Stripe setup and never use Connect. */
export const CONNECT_EXEMPT_EMAILS = OWNER_EMAILS;

export function createConnectPlatformClient(): Stripe {
  const key = process.env["STRIPE_CONNECT_SECRET_KEY"];
  if (!key) throw new Error("Stripe Connect is not configured");
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia", httpClient: Stripe.createFetchHttpClient() });
}

/** Connected account for a rental's admin, or null when the built-in Stripe setup must be used. */
export async function getConnectedAccountForAdmin(adminId: string | null | undefined): Promise<string | null> {
  if (!adminId) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(adminId);
  const email = (u?.user?.email ?? "").toLowerCase();
  if (CONNECT_EXEMPT_EMAILS.includes(email)) return null;
  const { data: acct } = await supabaseAdmin
    .from("rental_stripe_accounts")
    .select("stripe_account_id, charges_enabled")
    .eq("admin_id", adminId)
    .maybeSingle();
  if (!acct?.stripe_account_id || !acct.charges_enabled) return null;
  return acct.stripe_account_id;
}

/** Re-read a connected-account checkout session from Stripe and record it if paid (idempotent). */
export async function settleConnectSession(sessionId: string, accountId: string) {
  const stripe = createConnectPlatformClient();
  const session: any = await stripe.checkout.sessions.retrieve(sessionId, {}, { stripeAccount: accountId });
  if (session.payment_status !== "paid") return { paid: false };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rentalId = session.metadata?.rentalId as string | undefined;
  if (!rentalId) return { paid: true };
  // Make sure the session belongs to a rental owned by this connected account's admin.
  const { data: rental } = await supabaseAdmin.from("rentals").select("id, admin_id").eq("id", rentalId).maybeSingle();
  const owner = await getConnectedAccountForAdmin((rental as any)?.admin_id);
  if (owner !== accountId) throw new Error("Account mismatch");
  const { data: already } = await supabaseAdmin.from("rental_payments").select("id").eq("stripe_session_id", session.id).limit(1);
  if (already?.length) return { paid: true };

  const nowIso = new Date().toISOString();
  let q = supabaseAdmin.from("rental_weeks").select("*").eq("rental_id", rentalId).eq("status", "unpaid").is("deleted_at", null);
  if (session.metadata?.weekFrom) q = q.gte("week_start", session.metadata.weekFrom);
  if (session.metadata?.weekTo) q = q.lte("week_start", session.metadata.weekTo);
  const { data: weeks } = await q.order("week_start");
  for (const wk of (weeks ?? []) as any[]) {
    await supabaseAdmin.from("rental_weeks").update({ status: "paid", paid_at: nowIso, stripe_session_id: session.id }).eq("id", wk.id);
    await supabaseAdmin.from("rental_payments").insert({
      rental_id: rentalId, week_id: wk.id, amount_pence: wk.amount_pence,
      kind: "weekly", method: "stripe", stripe_session_id: session.id, paid_at: nowIso,
    });
  }
  return { paid: true };
}

/** Read a v2 connected account and map it to the stored status flags. */
export async function fetchConnectAccountStatus(accountId: string) {
  const stripe = createConnectPlatformClient();
  const acct: any = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.merchant", "requirements", "identity"],
  } as any);
  const caps = acct?.configuration?.merchant?.capabilities ?? {};
  const cardActive = caps?.card_payments?.status === "active";
  const payoutsActive = caps?.stripe_balance?.payouts?.status === "active";
  const entries: any[] = acct?.requirements?.entries ?? [];
  const outstanding = entries.some((e) => ["currently_due", "past_due"].includes(e?.minimum_deadline?.status));
  return {
    charges_enabled: cardActive,
    payouts_enabled: payoutsActive,
    details_submitted: !outstanding && (cardActive || entries.length === 0),
    livemode: !!acct?.livemode,
    display_name: acct?.display_name ?? acct?.identity?.business_details?.registered_name ?? null,
    updated_at: new Date().toISOString(),
  };
}
