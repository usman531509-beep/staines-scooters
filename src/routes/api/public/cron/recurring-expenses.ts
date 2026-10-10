import { createFileRoute } from "@tanstack/react-router";

// Materializes due recurring expense templates. Run daily.
// Header: x-cron-secret: <CRON_SECRET>
// Idempotent — a template is only rolled forward once its next_run_date <= today,
// and we insert a fresh dated expense row before advancing next_run_date.

function advance(dateIso: string, recurrence: "weekly" | "monthly"): string {
  const d = new Date(dateIso + "T00:00:00Z");
  if (recurrence === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

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
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const today = new Date().toISOString().slice(0, 10);
  const { data: templates, error } = await supabaseAdmin
    .from("expenses")
    .select("*")
    .eq("is_template", true)
    .is("deleted_at", null)
    .in("recurrence", ["weekly", "monthly"])
    .lte("next_run_date", today);
  if (error) return new Response(error.message, { status: 500 });

  let created = 0;
  for (const t of templates ?? []) {
    let due: string = (t as any).next_run_date;
    // Catch up any missed periods (up to 24 iterations for safety).
    for (let i = 0; i < 24 && due && due <= today; i++) {
      const { data: existing } = await supabaseAdmin
        .from("expenses")
        .select("id")
        .eq("template_id", t.id)
        .eq("expense_date", due)
        .is("deleted_at", null)
        .maybeSingle();
      if (!existing) {
        const { error: insErr } = await supabaseAdmin.from("expenses").insert({
          category: t.category,
          vendor: t.vendor,
          description: t.description,
          amount_pence: t.amount_pence,
          tax_pence: t.tax_pence ?? 0,
          payment_method: t.payment_method ?? "bank",
          expense_date: due,
          notes: t.notes,
          created_by: t.created_by,
          template_id: t.id,
          recurrence: "none",
          is_template: false,
        });
        if (!insErr) created++;
      }
      due = advance(due, t.recurrence as "weekly" | "monthly");
    }
    await supabaseAdmin.from("expenses").update({ next_run_date: due }).eq("id", t.id);
  }

  return new Response(JSON.stringify({ ok: true, templates: templates?.length ?? 0, created }), {
    headers: { "content-type": "application/json" },
  });
}
