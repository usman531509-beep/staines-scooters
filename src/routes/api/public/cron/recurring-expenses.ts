import { createFileRoute } from "@tanstack/react-router";

// Posts due recurring expense templates (see recurring-expenses.server.ts).
// Staff page loads already do this; the route stays for an external scheduler.
// Header: x-cron-secret: <CRON_SECRET>
export const Route = createFileRoute("/api/public/cron/recurring-expenses")({
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

  const { postDueRecurringExpenses } = await import("@/lib/recurring-expenses.server");
  let result;
  try {
    result = await postDueRecurringExpenses();
  } catch (err: any) {
    return new Response(err?.message ?? "failed", { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, ...result }), {
    headers: { "content-type": "application/json" },
  });
}
