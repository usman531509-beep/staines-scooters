// Posts due weekly/monthly recurring expenses. A recurring expense is saved as a
// template row (is_template) that is itself the first period's expense; each
// later period becomes its own dated row linked by template_id.
//
// The host has no scheduler, so this runs when staff open Expenses, the
// Dashboard or P&L (and from the cron route if a scheduler is ever added).
// Each period is claimed by moving the template's next_run_date forward only if
// it still holds the value we read, so two requests at once can't post twice.

type Recurrence = "weekly" | "monthly";

export function advanceRunDate(dateIso: string, recurrence: Recurrence): string {
  const d = new Date(dateIso + "T00:00:00Z");
  if (recurrence === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/** UK calendar date (YYYY-MM-DD), so a rent due "today" posts from midnight UK time. */
function ukToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

export async function postDueRecurringExpenses(): Promise<{ templates: number; created: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const today = ukToday();
  const { data: templates, error } = await supabaseAdmin
    .from("expenses")
    .select("*")
    .eq("is_template", true)
    .is("deleted_at", null)
    .in("recurrence", ["weekly", "monthly"])
    .lte("next_run_date", today);
  if (error) throw error;

  let created = 0;
  for (const t of templates ?? []) {
    let due = t.next_run_date as string | null;
    // Catch up missed periods (capped for safety).
    for (let i = 0; i < 24 && due && due <= today; i++) {
      const next = advanceRunDate(due, t.recurrence as Recurrence);
      const { data: claimed } = await supabaseAdmin
        .from("expenses")
        .update({ next_run_date: next })
        .eq("id", t.id)
        .eq("next_run_date", due)
        .select("id");
      if (!claimed?.length) break; // another request is posting this template

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
        if (insErr) {
          // Give the period back so the next run retries it.
          await supabaseAdmin.from("expenses").update({ next_run_date: due }).eq("id", t.id).eq("next_run_date", next);
          console.error("recurring expense post failed", insErr);
          break;
        }
        created++;
      }
      due = next;
    }
  }
  return { templates: templates?.length ?? 0, created };
}

/** Best-effort call for page loads: a failure is logged, never shown to staff. */
export async function postDueRecurringExpensesQuietly() {
  try {
    await postDueRecurringExpenses();
  } catch (err) {
    console.error("recurring expenses check failed", err);
  }
}
