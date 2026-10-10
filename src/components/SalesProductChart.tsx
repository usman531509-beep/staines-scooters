import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getSalesAnalytics } from "@/lib/sales-analytics.functions";
import { ukDate } from "@/lib/format-date";

const money = (p: number) => `£${(p / 100).toFixed(2)}`;
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type CompareKey = "none" | "prev_period" | "prev_week" | "prev_month" | "prev_year" | "custom";

const COMPARE_OPTIONS: { key: CompareKey; label: string }[] = [
  { key: "none", label: "No comparison" },
  { key: "prev_period", label: "Previous period" },
  { key: "prev_week", label: "Same days, last week" },
  { key: "prev_month", label: "Same days, last month" },
  { key: "prev_year", label: "Same days, last year" },
  { key: "custom", label: "Choose dates" },
];

function shiftDays(day: string, days: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function shiftMonths(day: string, months: number) {
  const d = new Date(`${day}T00:00:00Z`);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(
    Math.min(d.getUTCDate(), last),
  ).padStart(2, "0")}`;
}

function resolveCompare(
  key: CompareKey,
  from: string,
  to: string,
  custom: { from: string; to: string },
): { from?: string; to?: string } {
  if (key === "none") return {};
  if (key === "custom") return { from: custom.from || undefined, to: custom.to || undefined };
  if (!from || !to) return {};
  if (key === "prev_period") {
    const days =
      Math.round(
        (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000,
      ) + 1;
    return { from: shiftDays(from, -days), to: shiftDays(to, -days) };
  }
  if (key === "prev_week") return { from: shiftDays(from, -7), to: shiftDays(to, -7) };
  if (key === "prev_month") return { from: shiftMonths(from, -1), to: shiftMonths(to, -1) };
  return { from: shiftMonths(from, -12), to: shiftMonths(to, -12) };
}

function Delta({ now, before, format }: { now: number; before: number; format: (n: number) => string }) {
  const diff = now - before;
  const pct = before === 0 ? (now === 0 ? 0 : 100) : (diff / before) * 100;
  const up = diff >= 0;
  return (
    <span
      className={`text-[11px] font-semibold ${up ? "text-emerald-700" : "text-primary"}`}
      title={`Previous period: ${format(before)}`}
    >
      {up ? "▲" : "▼"} {format(Math.abs(diff))} ({up ? "+" : "−"}
      {Math.abs(pct).toFixed(1)}%)
    </span>
  );
}

export function SalesProductChart({ from, to }: { from: string; to: string }) {
  const fn = useServerFn(getSalesAnalytics);
  const [compare, setCompare] = useState<CompareKey>("prev_period");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [metric, setMetric] = useState<"qty" | "revenue">("qty");
  const [topN, setTopN] = useState(10);
  const [product, setProduct] = useState("");

  const cmp = useMemo(
    () => resolveCompare(compare, from, to, { from: customFrom, to: customTo }),
    [compare, from, to, customFrom, customTo],
  );

  const q = useQuery({
    queryKey: ["sales-analytics", from, to, cmp.from ?? "", cmp.to ?? ""],
    queryFn: () =>
      fn({
        data: {
          from: from || undefined,
          to: to || undefined,
          compareFrom: cmp.from,
          compareTo: cmp.to,
        },
      }),
  });

  const current = q.data?.current;
  const previous = q.data?.previous ?? null;

  const prevMap = useMemo(
    () => new Map((previous?.products ?? []).map((p: any) => [p.name.toLowerCase(), p])),
    [previous],
  );

  const productNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of current?.products ?? []) map.set(p.name.toLowerCase(), p.name);
    for (const p of previous?.products ?? []) if (!map.has(p.name.toLowerCase())) map.set(p.name.toLowerCase(), p.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [current, previous]);

  const rows = useMemo(() => {
    if (!current) return [];
    const build = (p: any) => {
      const prev: any = prevMap.get(p.name.toLowerCase());
      return {
        name: p.name,
        short: p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name,
        current: metric === "qty" ? p.qty : p.revenuePence / 100,
        previous: prev ? (metric === "qty" ? prev.qty : prev.revenuePence / 100) : 0,
        qty: p.qty,
        revenuePence: p.revenuePence,
      };
    };
    if (product) {
      const cur =
        current.products.find((p: any) => p.name.toLowerCase() === product) ??
        ({ name: prevMap.get(product)?.name ?? product, qty: 0, revenuePence: 0 } as any);
      return [build(cur)];
    }
    return current.products
      .slice()
      .sort((a: any, b: any) =>
        metric === "qty" ? b.qty - a.qty : b.revenuePence - a.revenuePence,
      )
      .slice(0, topN)
      .map(build);
  }, [current, prevMap, metric, topN, product]);

  const fmt = (n: number) => (metric === "qty" ? `${n}` : `£${n.toFixed(2)}`);

  return (
    <section className="mt-6 rounded-md border border-border bg-surface-elevated p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-foreground">
            Products sold
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            {from || to ? `${ukDate(from || to)} → ${ukDate(to || from)}` : "All time"}
            {previous && q.data?.compareRange?.from
              ? ` · compared with ${ukDate(q.data.compareRange.from)} → ${ukDate(
                  q.data.compareRange.to ?? q.data.compareRange.from,
                )}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-sm border border-border">
            {(["qty", "revenue"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest ${
                  metric === m ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-surface"
                }`}
              >
                {m === "qty" ? "Units" : "Revenue"}
              </button>
            ))}
          </div>
          <select
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="max-w-[200px] rounded-sm border border-border bg-surface px-2 py-1.5 text-xs"
          >
            <option value="">All products</option>
            {productNames.map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={topN}
            disabled={!!product}
            onChange={(e) => setTopN(Number(e.target.value))}
            className="rounded-sm border border-border bg-surface px-2 py-1.5 text-xs"
          >
            {[5, 10, 15, 25, 50].map((n) => (
              <option key={n} value={n}>
                Top {n}
              </option>
            ))}
          </select>
          <select
            value={compare}
            onChange={(e) => setCompare(e.target.value as CompareKey)}
            className="rounded-sm border border-border bg-surface px-2 py-1.5 text-xs"
          >
            {COMPARE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          {compare === "custom" && (
            <>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-sm border border-border bg-surface px-2 py-1.5 text-xs"
              />
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-sm border border-border bg-surface px-2 py-1.5 text-xs"
              />
            </>
          )}
        </div>
      </div>

      {/* Comparison summary */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Sales" value={`${current?.salesCount ?? 0}`}>
          {previous && <Delta now={current?.salesCount ?? 0} before={previous.salesCount} format={(n) => `${n}`} />}
        </Stat>
        <Stat label="Items sold" value={`${current?.unitsSold ?? 0}`}>
          {previous && <Delta now={current?.unitsSold ?? 0} before={previous.unitsSold} format={(n) => `${n}`} />}
        </Stat>
        <Stat label="Takings" value={money(current?.totalAmountPence ?? 0)}>
          {previous && (
            <Delta now={current?.totalAmountPence ?? 0} before={previous.totalAmountPence} format={money} />
          )}
        </Stat>
      </div>

      <div className="mt-4 h-[360px] w-full">
        {q.isLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-muted">Loading chart…</div>
        ) : rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-muted">
            No products sold in this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 70 }} barGap={4}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="short"
                angle={-35}
                textAnchor="end"
                interval={0}
                height={70}
                tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                tickFormatter={(v: number) => (metric === "qty" ? `${v}` : `£${v}`)}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v: any, key: any) => [fmt(Number(v)), key === "current" ? "This period" : "Compared period"]}
                labelFormatter={(_l, payload: any) => payload?.[0]?.payload?.name ?? ""}
              />
              {previous && <Legend formatter={(v) => (v === "current" ? "This period" : "Compared period")} />}
              <Bar dataKey="current" name="current" fill="var(--primary)" radius={[3, 3, 0, 0]}>
                {rows.map((r) => (
                  <Cell key={r.name} fill="var(--primary)" />
                ))}
              </Bar>
              {previous && (
                <Bar dataKey="previous" name="previous" fill="var(--ink-muted)" fillOpacity={0.45} radius={[3, 3, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-ink-muted">
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3 text-right">Units sold</th>
                <th className="py-2 pr-3 text-right">Revenue</th>
                {previous && <th className="py-2 pr-3 text-right">vs compared period</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-semibold">{r.name}</td>
                  <td className="py-2 pr-3 text-right">{r.qty}</td>
                  <td className="py-2 pr-3 text-right">{money(r.revenuePence)}</td>
                  {previous && (
                    <td className="py-2 pr-3 text-right">
                      <Delta now={r.current} before={r.previous} format={fmt} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-border bg-surface p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-foreground">{value}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
