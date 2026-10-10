import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "crypto";

/**
 * Callback the card machine (or Takepayments' service) posts the outcome to.
 * Secured with the terminal's integration key, so only the paired terminal can settle a payment.
 */
export const Route = createFileRoute("/api/public/terminal/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid body", { status: 400 });
        }
        const key = request.headers.get("x-integration-key") ?? body?.integrationKey;
        const reference = String(body?.reference ?? "").trim();
        if (!key || !reference) return new Response("Missing key or reference", { status: 400 });

        const { data: tx } = await supabaseAdmin
          .from("card_terminal_transactions")
          .select("id, terminal_id, status")
          .eq("reference", reference)
          .maybeSingle();
        if (!tx) return new Response("Unknown reference", { status: 404 });

        const { data: terminal } = await supabaseAdmin
          .from("card_terminals")
          .select("integration_key")
          .eq("id", tx.terminal_id ?? "")
          .maybeSingle();
        const expected = terminal?.integration_key ?? "";
        const a = createHmac("sha256", "hmc-terminal").update(String(key)).digest("hex");
        const b = createHmac("sha256", "hmc-terminal").update(expected).digest("hex");
        if (!expected || a !== b) return new Response("Unauthorized", { status: 401 });

        const raw = String(body?.status ?? body?.result ?? "").toLowerCase();
        const status = raw.includes("approv") || raw.includes("author") || raw === "success" || raw === "00"
          ? "approved"
          : raw.includes("cancel") || raw.includes("abort")
            ? "cancelled"
            : raw.includes("declin") || raw.includes("refus")
              ? "declined"
              : "error";

        await supabaseAdmin
          .from("card_terminal_transactions")
          .update({
            status,
            message: body?.message ?? null,
            auth_code: body?.authCode ?? null,
            card_scheme: body?.cardScheme ?? null,
            card_last4: body?.cardLast4 ?? null,
            raw: body,
            completed_at: new Date().toISOString(),
          })
          .eq("id", tx.id);

        return Response.json({ received: true, status });
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "content-type, x-integration-key",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
          },
        }),
    },
  },
});
