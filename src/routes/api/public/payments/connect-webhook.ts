import { createFileRoute } from "@tanstack/react-router";
import { onlinePaymentsEnabled } from "@/lib/online-payments";

/**
 * Stripe Connect events from admins' own accounts. The payload is never trusted:
 * the event is re-fetched from Stripe with the platform key before acting on it.
 */
export const Route = createFileRoute("/api/public/payments/connect-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!onlinePaymentsEnabled()) return new Response("Online payments are disabled", { status: 503 });
        try {
          const body = await request.json();
          const eventId = String(body?.id ?? "");
          if (!eventId.startsWith("evt_")) return Response.json({ ignored: true });
          const { createConnectPlatformClient, settleConnectSession, fetchConnectAccountStatus } = await import("@/lib/stripe-connect.server");
          const stripe = createConnectPlatformClient();
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const refreshAccount = async (acctId: string) => {
            const upd = await fetchConnectAccountStatus(acctId);
            await supabaseAdmin.from("rental_stripe_accounts").update(upd).eq("stripe_account_id", acctId);
          };

          // Accounts v2 thin events (e.g. v2.core.account[configuration.merchant].capability_status_updated).
          if (body?.object === "v2.core.event" || String(body?.type ?? "").startsWith("v2.")) {
            const ev: any = await stripe.v2.core.events.retrieve(eventId);
            const acctId = String(ev?.related_object?.id ?? ev?.context ?? "");
            if (String(ev?.type ?? "").startsWith("v2.core.account") && acctId.startsWith("acct_")) await refreshAccount(acctId);
            return Response.json({ received: true });
          }

          const account = String(body?.account ?? "");
          if (!account.startsWith("acct_")) return Response.json({ ignored: true });
          const event: any = await stripe.events.retrieve(eventId, {}, { stripeAccount: account });
          if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
            await settleConnectSession(event.data.object.id, account);
          } else if (event.type === "account.updated") {
            await refreshAccount(account);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("connect webhook error", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
