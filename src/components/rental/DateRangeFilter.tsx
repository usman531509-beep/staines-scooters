import { useMemo, useState } from "react";
import { isoDay as iso } from "@/lib/format-date";

export type RangePreset =
  | "today"
  | "yesterday"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "all"
  | "custom";

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "this_year", label: "This year" },
  { key: "last_year", label: "Last year" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom range" },
];

function boundsFor(preset: RangePreset, from: string, to: string): { from: string | null; to: string | null } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "today": {
      const t = iso(now);
      return { from: t, to: t };
    }
    case "yesterday": {
      const d = new Date(y, m, now.getDate() - 1);
      return { from: iso(d), to: iso(d) };
    }
    case "this_month":
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case "last_month":
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "this_year":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "last_year":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case "custom":
      return { from: from || null, to: to || null };
    default:
      return { from: null, to: null };
  }
}

/** Shared date filter state for the rental module tabs. */
export function useDateRange(initial: RangePreset = "all") {
  const [preset, setPreset] = useState<RangePreset>(initial);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const bounds = useMemo(() => boundsFor(preset, from, to), [preset, from, to]);

  const inRange = useMemo(() => {
    return (value?: string | null) => {
      if (!bounds.from && !bounds.to) return true;
      if (!value) return false;
      const d = String(value).slice(0, 10);
      if (bounds.from && d < bounds.from) return false;
      if (bounds.to && d > bounds.to) return false;
      return true;
    };
  }, [bounds]);

  return { preset, setPreset, from, setFrom, to, setTo, bounds, inRange };
}

export type DateRangeState = ReturnType<typeof useDateRange>;

export function DateRangeFilter({ state, label }: { state: DateRangeState; label?: string }) {
  const { preset, setPreset, from, setFrom, to, setTo } = state;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && (
        <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">{label}</span>
      )}
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => setPreset(p.key)}
          className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-widest ${
            preset === p.key
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-surface-elevated text-ink-muted hover:text-foreground"
          }`}
        >
          {p.label}
        </button>
      ))}
      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-border bg-surface-elevated px-2 py-1.5 text-xs"
          />
          <span className="text-xs text-ink-muted">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-border bg-surface-elevated px-2 py-1.5 text-xs"
          />
        </div>
      )}
    </div>
  );
}
