import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOnlinePaymentsEnabled } from "@/lib/online-payments";

async function requireRentalAdmin(context: any) {
  assertOnlinePaymentsEnabled();
  const { supabase, userId, claims } = context;
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!(roles ?? []).some((r: any) => ["owner", "admin"].includes(r.role))) throw new Error("Forbidden");
  const email = String(claims?.email ?? "").toLowerCase();
  return { userId: userId as string, email };
}

/** Current admin's Stripe payout account status. */
export const getMyStripeConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, email } = await requireRentalAdmin(context);
    const { CONNECT_EXEMPT_EMAILS, fetchConnectAccountStatus } = await import("@/lib/stripe-connect.server");
    if (CONNECT_EXEMPT_EMAILS.includes(email)) return { exempt: true as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("rental_stripe_accounts").select("*").eq("admin_id", userId).maybeSingle();
    if (!row) return { exempt: false as const, connected: false };
    try {
      const upd = await fetchConnectAccountStatus(row.stripe_account_id);
      await supabaseAdmin.from("rental_stripe_accounts").update(upd).eq("admin_id", userId);
      return { exempt: false as const, connected: true, ...upd, account_id: row.stripe_account_id };
    } catch (e) {
      console.error("getMyStripeConnect", e);
      return { exempt: false as const, connected: true, ...row, account_id: row.stripe_account_id };
    }
  });

/** Create (once) the admin's own Stripe account (Accounts v2) and return a Stripe-hosted onboarding link. */
export const startStripeConnectOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ returnUrl: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, email } = await requireRentalAdmin(context);
    const { CONNECT_EXEMPT_EMAILS, createConnectPlatformClient } = await import("@/lib/stripe-connect.server");
    if (CONNECT_EXEMPT_EMAILS.includes(email)) throw new Error("Your account already uses the existing Stripe setup.");
    const stripe = createConnectPlatformClient();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("rental_stripe_accounts").select("stripe_account_id").eq("admin_id", userId).maybeSingle();
    let accountId = row?.stripe_account_id as string | undefined;
    try {
      if (!accountId) {
        // Accounts v2, Stripe-managed risk: Stripe collects fees and covers losses; admin gets the full Stripe Dashboard.
        const acct: any = await stripe.v2.core.accounts.create({
          contact_email: email || undefined,
          dashboard: "full",
          identity: { country: "gb" },
          defaults: {
            currency: "gbp",
            responsibilities: { fees_collector: "stripe", losses_collector: "stripe" },
          },
          configuration: {
            merchant: { capabilities: { card_payments: { requested: true } } },
          },
          metadata: { admin_id: userId },
          include: ["configuration.merchant", "requirements"],
        } as any, { idempotencyKey: `connect-acct-${userId}` } as any);
        accountId = acct.id as string;
        const { error } = await supabaseAdmin.from("rental_stripe_accounts").insert({
          admin_id: userId, stripe_account_id: accountId, email: email || null, livemode: !!acct.livemode,
        });
        if (error) {
          // Another request saved first — reuse that one.
          const { data: again } = await supabaseAdmin.from("rental_stripe_accounts").select("stripe_account_id").eq("admin_id", userId).maybeSingle();
          if (again?.stripe_account_id) accountId = again.stripe_account_id;
          else throw error;
        }
      }
      const link: any = await stripe.v2.core.accountLinks.create({
        account: accountId!,
        use_case: {
          type: "account_onboarding",
          account_onboarding: {
            configurations: ["merchant"],
            refresh_url: data.returnUrl,
            return_url: data.returnUrl,
          },
        },
      } as any);
      return { url: link.url as string };
    } catch (e: any) {
      console.error("startStripeConnectOnboarding", e);
      throw new Error(e?.raw?.message ?? e?.message ?? "Stripe onboarding failed");
    }
  });

/** Admins use the full Stripe Dashboard (Stripe-managed risk), so send them there. */
export const getStripeDashboardLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = await requireRentalAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("rental_stripe_accounts").select("stripe_account_id").eq("admin_id", userId).maybeSingle();
    if (!row) throw new Error("No Stripe account connected yet.");
    return { url: "https://dashboard.stripe.com/" };
  });

/** Public: confirm a pay-link payment made to an admin's own Stripe account. */
export const confirmConnectRentalPayment = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ sessionId: z.string().startsWith("cs_").max(200), account: z.string().startsWith("acct_").max(64) }).parse(d))
  .handler(async ({ data }) => {
    try {
      assertOnlinePaymentsEnabled();
      const { settleConnectSession } = await import("@/lib/stripe-connect.server");
      return await settleConnectSession(data.sessionId, data.account);
    } catch (e) {
      console.error("confirmConnectRentalPayment", e);
      return { paid: false };
    }
  });
