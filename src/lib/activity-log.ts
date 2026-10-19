/**
 * Activity log — every sales/expenses action an admin or staff member takes is
 * recorded here so admins can see the full history on /admin/activity.
 *
 * Logging is always best-effort: a failure to record must never abort the
 * business action that just succeeded.
 */

export type ActivityModule = "sales" | "expenses";

export type ActivityAction =
  | "sale_added"
  | "sale_edited"
  | "sale_deleted"
  | "sale_restored"
  | "sale_purged"
  | "sale_undone"
  | "invoice_sent"
  | "refund_added"
  | "refund_deleted"
  | "credit_payment_added"
  | "expense_added"
  | "expense_edited"
  | "expense_deleted"
  | "expense_restored"
  | "expense_purged";

/** Human wording shown on the activity page. */
export const ACTIVITY_LABELS: Record<ActivityAction, string> = {
  sale_added: "Sales Added",
  sale_edited: "Sales Edited",
  sale_deleted: "Sales Deleted",
  sale_restored: "Sales Restored",
  sale_purged: "Sales Permanently Deleted",
  sale_undone: "Sale Undone",
  invoice_sent: "Invoice Sent",
  refund_added: "Refund Issued",
  refund_deleted: "Refund Deleted",
  credit_payment_added: "Credit Payment",
  expense_added: "Expense Added",
  expense_edited: "Expense Edited",
  expense_deleted: "Expense Deleted",
  expense_restored: "Expense Restored",
  expense_purged: "Expense Permanently Deleted",
};

/** Actions that read as a removal — shown in the destructive colour. */
export const DESTRUCTIVE_ACTIONS: ActivityAction[] = [
  "sale_deleted",
  "sale_purged",
  "sale_undone",
  "refund_deleted",
  "expense_deleted",
  "expense_purged",
];

export async function logActivity(
  supabase: any,
  entry: {
    actorId: string;
    module: ActivityModule;
    action: ActivityAction;
    label?: string | null;
    entityId?: string | null;
    details?: Record<string, unknown> | null;
  },
) {
  try {
    await supabase.from("activity_log").insert({
      actor_id: entry.actorId,
      module: entry.module,
      action: entry.action,
      label: entry.label ?? null,
      entity_id: entry.entityId ?? null,
      details: entry.details ?? null,
    });
  } catch {
    /* never block the action that was just performed */
  }
}

/** "19 days ago" style label used by the timeline. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(1, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
