// Owner instruction: this account must never see product cost prices
// (or the profit figures derived from them) on the sales pages.
export const COST_HIDDEN_EMAILS: string[] = [];

export function isCostHidden(email?: string | null): boolean {
  if (!email) return false;
  return COST_HIDDEN_EMAILS.includes(email.trim().toLowerCase());
}

// Owner instruction: these admins cannot edit/delete expenses, see the expenses
// recycle bin, see cost in sale inline/quick edit, or see the COGS box.
export const RESTRICTED_ADMIN_EMAILS: string[] = [];

export function isRestrictedAdmin(email?: string | null): boolean {
  if (!email) return false;
  return RESTRICTED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
