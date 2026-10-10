/** UK date formatting helpers — everything in the app renders dates as dd/mm/yyyy. */

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  // Plain date strings (YYYY-MM-DD) are treated as UTC calendar dates.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T00:00:00Z" : value;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

const isPlainDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** dd/mm/yyyy */
export function ukDate(value: string | number | Date | null | undefined, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(isPlainDate(value) ? { timeZone: "UTC" } : {}),
  });
}

/** dd/mm/yyyy, HH:mm */
export function ukDateTime(value: string | number | Date | null | undefined, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Weekday + dd/mm/yyyy */
export function ukDateWithWeekday(value: string | number | Date | null | undefined, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(isPlainDate(value) ? { timeZone: "UTC" } : {}),
  });
}

/**
 * YYYY-MM-DD for a Date using its LOCAL calendar day.
 * Never use `d.toISOString().slice(0,10)` for date filters — in UK summer time
 * (UTC+1) local midnight converts back to the previous UTC day, which shifts
 * every preset range ("This month" started on the 31st of the prior month).
 */
export function isoDay(value: Date = new Date()): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
