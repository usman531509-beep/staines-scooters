import { ukDateWithWeekday } from "@/lib/format-date";
/** Rent is collected on the rental's billing day, on or after the week end. */
export function rentDueDate(weekEndIso: string, billingDay = 1): string {
  const d = new Date(weekEndIso + "T00:00:00Z");
  for (let i = 0; i < 7; i++) {
    if (d.getUTCDay() === billingDay) break;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

export function formatDueDate(weekEndIso: string, billingDay = 1): string {
  const iso = rentDueDate(weekEndIso, billingDay);
  return ukDateWithWeekday(iso);
}


/** A week is only shown/collectable once its rent due date has arrived. */
export function isWeekDue(weekEndIso: string, billingDay = 1, today = new Date()): boolean {
  const todayIso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return rentDueDate(weekEndIso, billingDay) <= todayIso;
}
