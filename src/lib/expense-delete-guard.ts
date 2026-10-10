// Owner instruction: this account may never delete expenses (soft or permanent),
// regardless of admin/owner role.
export const EXPENSE_DELETE_BLOCKED_EMAILS: string[] = [];

export function isExpenseDeleteBlocked(email?: string | null): boolean {
  if (!email) return false;
  return EXPENSE_DELETE_BLOCKED_EMAILS.includes(email.trim().toLowerCase());
}

export const EXPENSE_DELETE_BLOCKED_MESSAGE =
  "Deleting expenses is not permitted for this account.";
