// Owner instruction: this account must never see or access the Activity module.
export const ACTIVITY_BLOCKED_EMAILS: string[] = [];

export function isActivityBlocked(email?: string | null): boolean {
  if (!email) return false;
  return ACTIVITY_BLOCKED_EMAILS.includes(email.trim().toLowerCase());
}

export const ACTIVITY_BLOCKED_MESSAGE = "You do not have access to the Activity log.";
