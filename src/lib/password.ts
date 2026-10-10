// Mobile keyboards and password managers frequently add invisible junk to what
// the customer types: a trailing space from autocorrect, a non-breaking space,
// or a different unicode normalisation form. If that junk gets stored at
// registration, the customer can never sign in again with "the same" password.
// Normalising identically at registration, sign-in and password reset removes
// that whole class of "my registration password doesn't work" reports.
export function normalizePassword(raw: string): string {
  let v = String(raw ?? "").replace(/[\u00a0\u2007\u202f\u200b\u200c\u200d\ufeff]/g, " ");
  v = v.trim();
  try {
    v = v.normalize("NFC");
  } catch {
    /* ignore */
  }
  return v;
}
