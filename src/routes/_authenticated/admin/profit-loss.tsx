import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { AccountShell } from "@/components/AccountShell";
import { getProfitLoss, getProfitLossDetail } from "@/lib/profit-loss.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isoDay, ukDate, ukDateTime } from "@/lib/format-date";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/admin/profit-loss")({
  head: () => ({ meta: [{ title: `Profit & Loss — ${BRAND.name}` }, { name: "description", content: `Sales, expenses, stock count adjustments and financial reporting for ${BRAND.name}.` }, { property: "og:title", content: `Profit & Loss — ${BRAND.name}` }, { property: "og:description", content: "Sales, expenses and stock count financial reporting." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ProfitLossPage,
  errorComponent: ({ error }) => (
    <AccountShell title="Profit & Loss"><p className="text-sm text-primary">{error.message}</p></AccountShell>
  ),
  notFoundComponent: () => <AccountShell title="Profit & Loss"><p>Not found</p></AccountShell>,
});

const fmt = (p: number) => {
  const neg = p < 0;
  const abs = Math.abs(p);
  return `${neg ? "−" : ""}£${(abs / 100).toFixed(2)}`;
};

const iso = (d: Date) => isoDay(d);

function presetRange(kind: "this_month" | "last_month" | "this_quarter" | "this_year" | "last_30" | "ytd") {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (kind === "this_month") return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
  if (kind === "last_month") return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
  if (kind === "this_quarter") {
    const qStart = Math.floor(m / 3) * 3;
    return { from: iso(new Date(y, qStart, 1)), to: iso(new Date(y, qStart + 3, 0)) };
  }
  if (kind === "this_year" || kind === "ytd") return { from: iso(new Date(y, 0, 1)), to: iso(now) };
  if (kind === "last_30") {
    const from = new Date(now); from.setDate(from.getDate() - 29);
    return { from: iso(from), to: iso(now) };
  }
  return { from: iso(new Date(y, m, 1)), to: iso(now) };
}

function ProfitLossPage() {
  const fn = useServerFn(getProfitLoss);
  const initial = presetRange("this_month");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [detail, setDetail] = useState<DetailKind | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["profit-loss", from, to],
    queryFn: () => fn({ data: { fromDate: from, toDate: to } }),
  });

  function applyPreset(k: Parameters<typeof presetRange>[0]) {
    const r = presetRange(k);
    setFrom(r.from); setTo(r.to);
  }

  function downloadCsv() {
    if (!data) return;
    const rows: string[][] = [
      ["Section", "Item", "Amount (£)"],
      ["Sales", "Total sales", (data.totalSalesPence / 100).toFixed(2)],
      ["Sales", "Refunds", (data.refundsPence / 100).toFixed(2)],
      ["Sales", "Net sales", (data.netSalesPence / 100).toFixed(2)],
      ["COGS", "Cost of goods sold", (data.cogsGoodsPence / 100).toFixed(2)],
      ["COGS", "Lost & damaged", (data.lostDamagedPence / 100).toFixed(2)],
      ["COGS", "Stock count adjustments", (-data.stockCountProfitPence / 100).toFixed(2)],
      ["COGS", "Total COGS", (data.cogsPence / 100).toFixed(2)],
      ["Profit", "Gross profit", (data.grossProfitPence / 100).toFixed(2)],
      ...Object.entries(data.expensesByCategory).map(([c, v]) => ["Expenses", c, ((v as number) / 100).toFixed(2)]),
      ["Expenses", "Total expenses", (data.expensesPence / 100).toFixed(2)],
      ["Profit", "Net profit", (data.netProfitPence / 100).toFixed(2)],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit-loss-${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AccountShell title="Profit & Loss">
      <div className="grid gap-6">
        {/* Controls */}
        <div className="rounded-md border border-border bg-surface-elevated p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="text-[11px] font-semibold uppercase tracking-widest">
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-widest">
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" />
            </label>
            <div className="flex items-end">
              <button onClick={downloadCsv} disabled={!data}
                className="rounded-sm border border-border bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-widest hover:border-primary hover:text-primary disabled:opacity-50">
                Export CSV
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["this_month","last_month","last_30","this_quarter","ytd"] as const).map((k) => (
              <button key={k} onClick={() => applyPreset(k)}
                className="rounded-sm border border-border bg-surface px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest hover:border-primary hover:text-primary">
                {k.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        {isLoading || !data ? (
          <p className="text-sm text-ink-muted">{isFetching ? "Loading…" : "No data"}</p>
        ) : (
          <>
            {/* Summary */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <SummaryCard onClick={() => setDetail("sales")} label="Net sales" value={fmt(data.netSalesPence)} />
              <SummaryCard onClick={() => setDetail("cogs")} label="COGS" value={fmt(data.cogsPence)} muted />
              <SummaryCard onClick={() => setDetail("gross")} label="Gross profit" value={fmt(data.grossProfitPence)} tone={data.grossProfitPence >= 0 ? "good" : "bad"} />
              <SummaryCard onClick={() => setDetail("expenses")} label="Expenses" value={fmt(data.expensesPence)} muted />
              <SummaryCard onClick={() => setDetail("net")} label="Net profit" value={fmt(data.netProfitPence)} tone={data.netProfitPence >= 0 ? "good" : "bad"} big />
            </div>

            {/* Breakdown tables */}
            <div className="grid gap-4 lg:grid-cols-2">
              <BreakdownTable
                title="Sales"
                rows={[
                  ["Total sales", data.totalSalesPence, `${data.salesCount} sale${data.salesCount === 1 ? "" : "s"}`],
                  ["Refunds", -data.refundsPence],
                  ["Net sales", data.netSalesPence, undefined, true],
                ]}
              />
              <BreakdownTable
                title="Cost of goods sold"
                rows={[
                  ["Cost of goods sold", data.cogsGoodsPence],
                  ["Lost & damaged", data.lostDamagedPence],
                  ["Stock count adjustments", -data.stockCountProfitPence],
                  ["Total COGS", data.cogsPence, undefined, true],
                ]}
              />
              <BreakdownTable
                title="Expenses by category"
                rows={[
                  ...Object.entries(data.expensesByCategory).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([c, v]) => [c, v as number] as [string, number]),
                  ["Total expenses", data.expensesPence, undefined, true],
                ]}
                empty="No expenses in this range."
              />
              <BreakdownTable
                title="Lost & damaged by reason"
                rows={[
                  ...Object.entries(data.lostDamagedByReason).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([c, v]) => [c, v as number] as [string, number]),
                  ["Total", data.lostDamagedPence, undefined, true],
                ]}
                empty="No lost/damaged entries in this range."
              />
            </div>

            <section className="space-y-4 border-t border-border pt-4">
              <h2 className="font-display text-xl">Stock count accounts</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                <BreakdownTable title="Balance sheet · Inventory as at today" rows={[["Inventory asset (financial value)", data.stockInventoryAssetPence]]} />
                <BreakdownTable title="Cash flow · Stock count corrections" rows={[["Cash movement", data.stockCountCashPence]]} />
              </div>
              <h3 className="font-semibold">Stock count ledger</h3>
              {data.stockCountLedger.length === 0 ? <p className="text-sm text-muted-foreground">No financial stock count postings in this period.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th className="p-2">Date</th><th className="p-2">Product</th><th className="p-2">Account</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th></tr></thead><tbody>{data.stockCountLedger.flatMap((entry) => {
                const delta = entry.inventoryDeltaPence;
                return [["Inventory", Math.max(delta, 0), Math.max(-delta, 0)], ["Stock count gain / loss", Math.max(-delta, 0), Math.max(delta, 0)]].map(([account, dr, cr], i) => <tr key={`${entry.id}-${i}`} className="border-t border-border"><td className="p-2">{ukDateTime(entry.created_at)}</td><td className="p-2">{entry.product}{entry.kind === "undo" ? " · reversal" : ""}</td><td className="p-2">{account}</td><td className="p-2 text-right">{dr ? fmt(Number(dr)) : "—"}</td><td className="p-2 text-right">{cr ? fmt(Number(cr)) : "—"}</td></tr>);
              })}</tbody></table></div>}
            </section>

            {/* Bottom line */}
            <div className="rounded-md border border-primary/40 bg-primary/5 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="eyebrow text-primary">Bottom line — Net profit</p>
                <p className={`font-display text-4xl uppercase ${data.netProfitPence >= 0 ? "text-primary" : "text-red-500"}`}>
                  {fmt(data.netProfitPence)}
                </p>
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                Net sales {fmt(data.netSalesPence)} − COGS {fmt(data.cogsPence)} − Expenses {fmt(data.expensesPence)}
              </p>
            </div>
          </>
        )}
      </div>
      {detail && <DetailDialog kind={detail} initialFrom={from} initialTo={to} onClose={() => setDetail(null)} />}
    </AccountShell>
  );
}

type DetailKind = "sales" | "cogs" | "gross" | "expenses" | "net";
const DETAIL_TITLES: Record<DetailKind, string> = { sales: "Net sales", cogs: "Cost of goods sold", gross: "Gross profit", expenses: "Expenses", net: "Net profit" };
const DETAIL_PRESETS = [["today", "Today"], ["yesterday", "Yesterday"], ["this_week", "This week"], ["last_week", "Last week"], ["this_month", "This month"], ["last_month", "Last month"], ["last_30", "Last 30 days"], ["this_quarter", "This quarter"], ["this_year", "This year"], ["last_year", "Last year"]] as const;
function detailRange(k: (typeof DETAIL_PRESETS)[number][0]) {
  const now = new Date(); const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const mon = d - ((now.getDay() + 6) % 7);
  switch (k) {
    case "today": return { from: iso(now), to: iso(now) };
    case "yesterday": { const t = iso(new Date(y, m, d - 1)); return { from: t, to: t }; }
    case "this_week": return { from: iso(new Date(y, m, mon)), to: iso(new Date(y, m, mon + 6)) };
    case "last_week": return { from: iso(new Date(y, m, mon - 7)), to: iso(new Date(y, m, mon - 1)) };
    case "last_year": return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case "this_year": return { from: `${y}-01-01`, to: `${y}-12-31` };
    default: return presetRange(k);
  }
}

function DetailDialog({ kind, initialFrom, initialTo, onClose }: { kind: DetailKind; initialFrom: string; initialTo: string; onClose: () => void }) {
  const fn = useServerFn(getProfitLossDetail);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const { data, isFetching, error } = useQuery({ queryKey: ["profit-loss-detail", kind, from, to], queryFn: () => fn({ data: { kind, fromDate: from, toDate: to } }), enabled: !!from && !!to });
  const flip = kind === "cogs" || kind === "expenses";
  const all = data?.rows ?? [];
  const types = Array.from(new Set(all.map((r) => r.type)));
  const needle = q.trim().toLowerCase().replace(/[£,]/g, "");
  const rows = all.filter((r) => {
    if (type !== "all" && r.type !== type) return false;
    if (!needle) return true;
    const amt = (Math.abs(r.amountPence) / 100).toFixed(2);
    return [r.type, r.description, r.detail, ukDate(r.date), amt].some((v) => String(v ?? "").toLowerCase().includes(needle));
  });
  const shown = (p: number) => (flip ? -p : p);
  const total = rows.reduce((s, r) => s + shown(r.amountPence), 0);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader><DialogTitle>{DETAIL_TITLES[kind]}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-semibold uppercase tracking-widest">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" /></label>
            <label className="text-[11px] font-semibold uppercase tracking-widest">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" /></label>
          </div>
          <div className="flex flex-wrap gap-2">
            {DETAIL_PRESETS.map(([k, l]) => <button key={k} onClick={() => { const r = detailRange(k); setFrom(r.from); setTo(r.to); }} className="rounded-sm border border-border bg-surface px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest hover:border-primary hover:text-primary">{l}</button>)}
          </div>
          <div className="flex flex-wrap gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product, receipt, customer, category, supplier, reason, date or amount" className="h-11 min-w-0 flex-1 rounded-sm border border-border bg-input px-3 text-sm" />
            <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)} className="h-11 rounded-sm border border-border bg-input px-2 text-sm"><option value="all">All types</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          </div>
          {error && <p className="text-sm text-primary">{(error as Error).message}</p>}
          <div className="flex items-baseline justify-between rounded-md border border-border bg-surface-elevated px-4 py-3"><span className="text-xs text-ink-muted">{isFetching ? "Loading…" : `${rows.length} entr${rows.length === 1 ? "y" : "ies"}`}</span><span className="font-display text-2xl">{fmt(total)}</span></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase tracking-widest text-ink-muted"><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Description</th><th className="p-2">Details</th><th className="p-2 text-right">Amount</th></tr></thead>
            <tbody>{rows.map((r) => (
              <Fragment key={r.id}>
                <tr onClick={() => setOpen(open === r.id ? null : r.id)} className="cursor-pointer border-t border-border hover:bg-muted/40" aria-expanded={open === r.id}>
                  <td className="p-2 whitespace-nowrap">{ukDate(r.date)}</td><td className="p-2">{r.type}</td><td className="p-2">{r.description}</td><td className="p-2 text-ink-muted">{r.detail}</td><td className="p-2 text-right font-mono">{fmt(shown(r.amountPence))}</td>
                </tr>
                {open === r.id && (
                  <tr className="border-t border-border bg-muted/30"><td colSpan={5} className="p-3">
                    <dl className="grid gap-1.5 text-xs sm:grid-cols-2">
                      {(r.extra ?? []).map(([k, v], i) => <div key={i} className="flex gap-2"><dt className="w-32 shrink-0 uppercase tracking-widest text-ink-muted">{k}</dt><dd className="min-w-0">{v}</dd></div>)}
                    </dl>
                  </td></tr>
                )}
              </Fragment>
            ))}
             {!isFetching && rows.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-ink-muted">Nothing found for this range.</td></tr>}</tbody></table></div>
          <p className="text-[11px] text-ink-muted">Click any row to see the full record behind it.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ label, value, tone, muted, big, onClick }: { label: string; value: string; tone?: "good" | "bad"; muted?: boolean; big?: boolean; onClick?: () => void }) {
  const color = tone === "good" ? "text-primary" : tone === "bad" ? "text-red-500" : muted ? "text-ink-muted" : "text-foreground";
  return (
    <button type="button" onClick={onClick} className={`rounded-md border border-border bg-surface-elevated p-4 text-left hover:border-primary ${big ? "sm:col-span-2 lg:col-span-1" : ""}`}>
      <p className="eyebrow">{label}</p>
      <p className={`mt-1 font-display ${big ? "text-3xl" : "text-2xl"} ${color}`}>{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-ink-muted">View details</p>
    </button>
  );
}

function BreakdownTable({ title, rows, empty }: { title: string; rows: Array<[string, number, string?, boolean?]>; empty?: string }) {
  const dataRows = rows.filter((r) => !r[3]);
  const totalRow = rows.find((r) => r[3]);
  return (
    <div className="rounded-md border border-border bg-surface-elevated">
      <div className="border-b border-border px-4 py-3">
        <p className="eyebrow">{title}</p>
      </div>
      {dataRows.length === 0 && empty ? (
        <p className="p-4 text-sm text-ink-muted">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {dataRows.map(([label, value, sub], i) => (
              <tr key={i}>
                <td className="px-4 py-2">
                  <div className="capitalize">{label}</div>
                  {sub && <div className="text-xs text-ink-muted">{sub}</div>}
                </td>
                <td className="px-4 py-2 text-right font-mono">{fmt(value)}</td>
              </tr>
            ))}
            {totalRow && (
              <tr className="bg-surface/40">
                <td className="px-4 py-2 font-semibold uppercase tracking-widest text-[11px]">{totalRow[0]}</td>
                <td className="px-4 py-2 text-right font-display text-lg">{fmt(totalRow[1])}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
