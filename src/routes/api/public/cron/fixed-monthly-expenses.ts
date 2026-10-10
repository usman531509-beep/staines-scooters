import { createFileRoute } from "@tanstack/react-router";

// Fixed monthly recurring expenses. Runs on the 1st of every month.
// Header: x-cron-secret: <CRON_SECRET>
// Idempotent — each fixed expense uses a stable description tag so re-runs won't duplicate.

// Add this business's fixed monthly costs here, e.g.
// { category: "Rent", vendor: "Landlord", description: "Shop Rent", amount_pence: 150_000 },
const FIXED_EXPENSES: { category: string; vendor: string; description: string; amount_pence: number }[] = [];

export const Route = createFileRoute("/api/public/cron/fixed-monthly-expenses")({
  server: {
    handlers: {
      // Vercel Cron calls with GET + `Authorization: Bearer <CRON_SECRET>`; other schedulers may POST.
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});

async function run(request: Request) {
  const provided = request.headers.get("x-cron-secret") ?? "";
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const cronSecret = process.env.CRON_SECRET ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const ok =
    (!!cronSecret && (provided === cronSecret || bearer === cronSecret)) ||
    (!!serviceKey && bearer === serviceKey);
  if (!ok) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const today = new Date();
  // Company month = 1st..last day. Book expenses on the 1st of the current month.
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const expense_date = first.toISOString().slice(0, 10);

  let inserted = 0;
  let skipped = 0;
  for (const e of FIXED_EXPENSES) {
    // Idempotency: same description on same expense_date already exists → skip.
    const { data: existing } = await supabaseAdmin
      .from("expenses")
      .select("id")
      .eq("expense_date", expense_date)
      .eq("description", e.description)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing) { skipped++; continue; }
    const { error } = await supabaseAdmin.from("expenses").insert({
      category: e.category,
      vendor: e.vendor,
      description: e.description,
      amount_pence: e.amount_pence,
      tax_pence: 0,
      payment_method: "bank",
      expense_date,
      notes: "Auto-posted fixed monthly expense",
    });
    if (!error) inserted++;
  }

  return new Response(JSON.stringify({ ok: true, expense_date, inserted, skipped }), {
    headers: { "Content-Type": "application/json" },
  });
}
