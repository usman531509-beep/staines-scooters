import { ukDate, ukDateTime } from "@/lib/format-date";
import { StaffGuard } from "@/components/StaffGuard";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Trash2 } from "lucide-react";
import { AccountShell } from "@/components/AccountShell";
import { SectionRecycleBin } from "@/components/SectionRecycleBin";
import { SaleInlineEdit } from "@/components/SaleInlineEdit";
import { SalesProductChart } from "@/components/SalesProductChart";
import { InvoiceActions } from "@/components/InvoiceActions";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { listSales, bulkDeleteSales, deleteAllSales, undoSale } from "@/lib/pos.functions";
import { getProfitLoss } from "@/lib/profit-loss.functions";
import { useAuth } from "@/lib/auth-client";
import { isCostHidden, isRestrictedAdmin } from "@/lib/cost-visibility";
import { getLastEditedSaleId, subscribeLastEditedSale } from "@/lib/last-edited-sale";
import castrolBottle from "@/assets/product-placeholder.svg";

import { useSalesRealtime } from "@/hooks/use-realtime";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/staff/sales/")({

  head: () => ({
    meta: [
      { title: `Sales — ${BRAND.name}` },
      { name: "description", content: `Review sales, revenue, gross profit and net profit for ${BRAND.name}.` },
      { property: "og:title", content: `Sales — ${BRAND.name}` },
      { property: "og:description", content: `Review sales, revenue, gross profit and net profit for ${BRAND.name}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (<StaffGuard perm="sales"><SalesPage /></StaffGuard>),
  errorComponent: ({ error }) => <AccountShell title="Sales"><p className="text-sm text-primary">{error.message}</p></AccountShell>,
  notFoundComponent: () => <AccountShell title="Sales"><p>Not found</p></AccountShell>,
});

function money(pence: number) { return `£${(pence / 100).toFixed(2)}`; }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Monday-based start of the week containing d. */
function weekStart(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}

type PresetKey =
  | "today" | "yesterday" | "this_week" | "last_week"
  | "this_month" | "last_month" | "this_year" | "last_year" | "all" | "custom";

const PRESETS: { key: PresetKey; label: string; resolve: () => { from: string; to: string } }[] = [
  { key: "today", label: "Today", resolve: () => { const n = new Date(); return { from: iso(n), to: iso(n) }; } },
  { key: "yesterday", label: "Yesterday", resolve: () => { const y = new Date(); y.setDate(y.getDate() - 1); return { from: iso(y), to: iso(y) }; } },
  { key: "this_week", label: "This week", resolve: () => { const s = weekStart(new Date()); const e = new Date(s); e.setDate(e.getDate() + 6); return { from: iso(s), to: iso(e) }; } },
  { key: "last_week", label: "Last week", resolve: () => { const s = weekStart(new Date()); s.setDate(s.getDate() - 7); const e = new Date(s); e.setDate(e.getDate() + 6); return { from: iso(s), to: iso(e) }; } },
  { key: "this_month", label: "This month", resolve: () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), n.getMonth(), 1)), to: iso(new Date(n.getFullYear(), n.getMonth() + 1, 0)) }; } },
  { key: "last_month", label: "Last month", resolve: () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), to: iso(new Date(n.getFullYear(), n.getMonth(), 0)) }; } },
  { key: "this_year", label: "This year", resolve: () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), 0, 1)), to: iso(new Date(n.getFullYear(), 11, 31)) }; } },
  { key: "last_year", label: "Last year", resolve: () => { const n = new Date(); return { from: iso(new Date(n.getFullYear() - 1, 0, 1)), to: iso(new Date(n.getFullYear() - 1, 11, 31)) }; } },
  { key: "all", label: "All time", resolve: () => ({ from: "", to: "" }) },
  { key: "custom", label: "Date range", resolve: () => ({ from: "", to: "" }) },
];

const PAGE_SIZE = 50;


function SalesPage() {
  useSalesRealtime();
  const lastEditedId = useSyncExternalStore(subscribeLastEditedSale, getLastEditedSaleId, () => null);
  const qc = useQueryClient();
  const fn = useServerFn(listSales);
  const bulkFn = useServerFn(bulkDeleteSales);
  const wipeFn = useServerFn(deleteAllSales);
  const undoFn = useServerFn(undoSale);
  const profitLossFn = useServerFn(getProfitLoss);
  const { isAdmin, user } = useAuth();
  const hideCost = isCostHidden(user?.email);
  const restricted = isRestrictedAdmin(user?.email);
  const cols = hideCost ? 8 : 9;

  const range = "all" as const;
  const initial = useMemo(() => PRESETS.find((p) => p.key === "this_month")!.resolve(), []);
  const [preset, setPreset] = useState<PresetKey>("this_month");
  const [search, setSearch] = useState("");
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [payment, setPayment] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>(initial.from);
  const [dateTo, setDateTo] = useState<string>(initial.to);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"active" | "refunded" | "zero_cost" | "no_single_oil" | "bin">("active");
  const [inlineId, setInlineId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const summaryFrom = dateFrom || "2000-01-01";
  const summaryTo = dateTo || iso(new Date());
  const profitLoss = useQuery({
    queryKey: ["sales-profit-loss", summaryFrom, summaryTo],
    queryFn: () => profitLossFn({ data: { fromDate: summaryFrom, toDate: summaryTo } }),
    enabled: isAdmin,
  });

  /** Total cost (COGS) for a sale — 0 when every line item has null/0 cost. */
  const cogsOf = (s: any) => {
    const items = Array.isArray(s.items) ? s.items : [];
    return items.reduce((sum: number, it: any) => sum + Math.round(Number(it.qty ?? 0) * (it.cost_price_pence ?? it.product?.cost_price_pence ?? 0)), 0);
  };


  const infinite = useInfiniteQuery({
    queryKey: ["sales", range, search, dateFrom, dateTo],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fn({ data: { range, search: search || undefined, from: dateFrom || undefined, to: dateTo || undefined, limit: PAGE_SIZE, offset: pageParam as number } }),
    getNextPageParam: (last: any) => last.nextOffset ?? undefined,
  });

  const pages = infinite.data?.pages ?? [];
  const firstPage: any = pages[0];
  const all = useMemo(() => pages.flatMap((p: any) => p.sales as any[]), [pages]);
  const active = all.filter((s: any) => !s.refunded);
  const refunded = all.filter((s: any) => s.refunded);
  /** True when at least one line item on the sale has no cost recorded. */
  const hasZeroCostItem = (s: any) => {
    const items = Array.isArray(s.items) ? s.items : [];
    if (!items.length) return true;
    return items.some((it: any) => Math.round(Number(it.cost_price_pence ?? it.product?.cost_price_pence ?? 0)) === 0);
  };
  /** True when the sale is a single engine oil line only. */
  const isSingleEngineOil = (s: any) => {
    const items = Array.isArray(s.items) ? s.items : [];
    if (items.length !== 1) return false;
    const it = items[0];
    if (Number(it.qty ?? 1) > 1) return false;
    return String(it.name ?? "").trim().toLowerCase().includes("engine oil");
  };
  const zeroCost = all.filter((s: any) => hasZeroCostItem(s));
  const noSingleOil = active.filter((s: any) => !isSingleEngineOil(s));
  const base =
    tab === "refunded" ? refunded : tab === "zero_cost" ? zeroCost : tab === "no_single_oil" ? noSingleOil : active;
  const filtered = base.filter((s: any) => payment === "all" || s.payment_method === payment);
  const data = firstPage;
  const isLoading = infinite.isLoading;

  // Auto-load next page when the sentinel scrolls into view.
  const sentinelRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !infinite.hasNextPage) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !infinite.isFetchingNextPage) infinite.fetchNextPage();
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [infinite.hasNextPage, infinite.isFetchingNextPage, infinite, all.length]);

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["sales"] }); setSelected(new Set()); };


  const bulkDel = useMutation({
    mutationFn: (ids: string[]) => bulkFn({ data: { ids } }),
    onSuccess: (r: any) => { invalidate(); qc.invalidateQueries({ queryKey: ["recycle", "sales"] }); alert(`Moved ${r.deleted} sale(s) to the Recycle Bin.`); },
    onError: (e: any) => alert(e?.message ?? "Delete failed"),
  });
  const undo = useMutation({
    mutationFn: (id: string) => undoFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => alert(e?.message ?? "Undo failed"),
  });

  const wipeAll = useMutation({
    mutationFn: () => wipeFn(),
    onSuccess: (r: any) => { invalidate(); qc.invalidateQueries({ queryKey: ["recycle", "sales"] }); alert(`Moved ${r.deleted} sale(s) to the Recycle Bin.`); },
    onError: (e: any) => alert(e?.message ?? "Delete failed"),
  });

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((s: any) => s.id)));
  };

  return (
    <AccountShell title="Sales">
      <div className={`grid gap-3 sm:grid-cols-2 ${isAdmin ? (restricted ? "lg:grid-cols-4" : "lg:grid-cols-5") : "lg:max-w-sm"}`}>
        <div className="rounded-md bg-yellow-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-yellow-900">Net Sales</p>
          <p className="mt-0.5 text-xl font-bold text-yellow-950">
            {profitLoss.isLoading ? "…" : money(profitLoss.data?.netSalesPence ?? data?.totalAmount ?? 0)}
          </p>
        </div>
        {isAdmin && (
          <>
            {!restricted && <div className="rounded-md bg-yellow-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-yellow-900">COGS</p>
              <p className="mt-0.5 text-xl font-bold text-yellow-950">
                {profitLoss.isLoading ? "…" : money(profitLoss.data?.cogsPence ?? 0)}
              </p>
              <p className="text-[10px] text-yellow-900">Cost of goods sold</p>
            </div>}
            <div className="rounded-md bg-yellow-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-yellow-900">Gross Profit</p>
              <p className="mt-0.5 text-xl font-bold text-yellow-950">
                {profitLoss.isLoading ? "…" : money(profitLoss.data?.grossProfitPence ?? 0)}
              </p>
              <p className="text-[10px] text-yellow-900">Net sales − COGS</p>
            </div>
            <div className="rounded-md bg-yellow-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-yellow-900">Expenses</p>
              <p className="mt-0.5 text-xl font-bold text-yellow-950">
                {profitLoss.isLoading ? "…" : money(profitLoss.data?.expensesPence ?? 0)}
              </p>
              <p className="text-[10px] text-yellow-900">All expenses</p>
            </div>
            <div className="rounded-md bg-yellow-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-yellow-900">Net Profit</p>
              <p className="mt-0.5 text-xl font-bold text-yellow-950">
                {profitLoss.isLoading ? "…" : money(profitLoss.data?.netProfitPence ?? 0)}
              </p>
              <p className="text-[10px] text-yellow-900">Gross profit − all expenses</p>
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          onClick={() => setShowAnalytics(true)}
          className="rounded-md border border-border bg-surface-elevated px-4 py-2 text-xs font-semibold uppercase tracking-widest text-foreground hover:bg-surface"
        >
          Sales Insights & Comparison
        </button>
        <p className="text-xs text-ink-muted">
          Click a sale to view or refund. Refunded sales are left out of the totals above.
        </p>
        <Link to="/staff/pos" className="ml-auto rounded-md bg-emerald-700 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white hover:bg-emerald-800">New sale</Link>
      </div>

      <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold uppercase tracking-widest">
              Sales Insights & Comparison
            </DialogTitle>
          </DialogHeader>
          <SalesProductChart from={dateFrom} to={dateTo} />
        </DialogContent>
      </Dialog>

      <div className="mt-3 rounded-md border border-border bg-surface-elevated p-4">
        <div className="flex flex-wrap gap-2">
          <TabBtn active={tab === "active"} onClick={() => setTab("active")} label={`Active (${active.length})`} />
          <TabBtn active={tab === "refunded"} onClick={() => setTab("refunded")} label={`Refunded (${refunded.length})`} />
          <TabBtn active={tab === "zero_cost"} onClick={() => setTab("zero_cost")} label={`Sales with Zero Cost (${zeroCost.length})`} />
          <TabBtn active={tab === "no_single_oil"} onClick={() => setTab("no_single_oil")} label={`Ignore single Engine oil sales (${noSingleOil.length})`} />
          <TabBtn active={tab === "bin"} onClick={() => setTab("bin")} label="Recycle Bin" />
        </div>

        {tab === "bin" ? (
          <div className="mt-4">
            <SectionRecycleBin type="sales" invalidateKeys={[["sales"]]} initiallyOpen />
          </div>
        ) : (<>


        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                setPreset(p.key);
                const r = p.resolve();
                setDateFrom(r.from);
                setDateTo(r.to);
              }}
              className={`rounded-sm px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest ${preset === p.key ? "bg-primary text-primary-foreground" : "border border-border text-foreground hover:bg-surface"}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">

          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, product, reference, notes…" className="min-w-[220px] flex-1 rounded-sm border border-border bg-surface px-3 py-2 text-sm" />
          <select value={payment} onChange={(e) => setPayment(e.target.value)} className="w-[190px] rounded-sm border border-border bg-surface px-3 py-2 text-sm">
            <option value="all">All payment methods</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank</option>
            <option value="split">Split</option>
            <option value="credit">Credit</option>
          </select>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">From</span>
          <input type="date" value={dateFrom} onChange={(e) => { setPreset("custom"); setDateFrom(e.target.value); }} className="rounded-sm border border-border bg-surface px-3 py-2 text-sm" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">To</span>
          <input type="date" value={dateTo} onChange={(e) => { setPreset("custom"); setDateTo(e.target.value); }} className="rounded-sm border border-border bg-surface px-3 py-2 text-sm" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setPreset("all"); setDateFrom(""); setDateTo(""); }} className="rounded-sm border border-border px-3 py-2 text-[11px] uppercase tracking-widest hover:border-primary">Clear</button>
          )}
          <span className="text-xs text-ink-muted">
            {dateFrom || dateTo ? `Showing ${ukDate(dateFrom || dateTo)} → ${ukDate(dateTo || dateFrom)}` : "Showing all time"}
          </span>
        </div>


        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="rounded-sm bg-surface px-3 py-2 text-xs text-ink-muted">{filtered.length} sales in view</p>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={selected.size === 0 || bulkDel.isPending}
              onClick={() => { if (confirm(`Move ${selected.size} selected sale(s) to the Recycle Bin?`)) bulkDel.mutate([...selected]); }}
              className="inline-flex items-center gap-2 rounded-sm border border-primary bg-primary/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-primary disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete selected ({selected.size})
            </button>
            <button
              disabled={wipeAll.isPending}
              onClick={() => { if (confirm("Move ALL sales to the Recycle Bin?")) wipeAll.mutate(); }}
              className="inline-flex items-center gap-2 rounded-sm border border-primary bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" /> {wipeAll.isPending ? "Deleting…" : "Delete ALL sales"}
            </button>
          </div>
        </div>

        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-ink-muted">
                <th className="py-3 pr-3 w-8">
                  <input type="checkbox" checked={selected.size > 0 && selected.size === filtered.length} onChange={toggleAll} />
                </th>
                <th className="py-3 pr-3">Reference</th>
                <th className="py-3 pr-3">Date</th>
                <th className="py-3 pr-3">Customer</th>
                <th className="py-3 pr-3">Method</th>
                <th className="py-3 pr-3 text-right">Total</th>
                {!hideCost && <th className="py-3 pr-3 text-right">Profit</th>}
                <th className="py-3 pr-3">Status</th>
                <th className="py-3 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={cols} className="py-6 text-center text-ink-muted">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={cols} className="py-8 text-center text-ink-muted">No sales found</td></tr>
              ) : filtered.map((s: any) => {
                return (
                <Fragment key={s.id}>
                <tr
                  className={`cursor-pointer border-b border-border/60 hover:bg-surface ${lastEditedId === s.id ? "bg-yellow-200" : expandedId === s.id ? "bg-yellow-100" : ""}`}
                  onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                >
                  <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                  </td>
                  <td className="py-3 pr-3">
                    <Link to="/staff/receipt/$saleId" params={{ saleId: s.id }} className="font-mono text-xs text-primary hover:underline">
                      {s.receipt_no ?? s.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="py-3 pr-3 text-xs">
                    <div className="flex items-start gap-1">
                      {Array.isArray(s.items) && s.items.some((it: any) => /engine\s*oil/i.test(String(it.name ?? ""))) && (
                        <img src={castrolBottle} alt="Engine oil" className="h-6 w-4 shrink-0 self-stretch object-contain" />
                      )}
                      <span className="whitespace-nowrap leading-tight">{ukDate(s.created_at)}<br />{ukDateTime(s.created_at).split(",")[1]?.trim() ?? ""}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    {s.pos_customer && (
                      <div className="mb-0.5 leading-tight">
                        <span className="font-semibold">{s.pos_customer.name}</span>
                        <span className="block text-[11px] text-ink-muted">{s.pos_customer.phone}</span>
                      </div>
                    )}
                    {Array.isArray(s.items) && s.items.some((it: any) => it.description) ? (
                      <div className="space-y-0.5 text-[11px] text-ink-muted">
                        {s.items.filter((it: any) => it.description).map((it: any, i: number) => (
                          <div key={i} className="line-clamp-2"><span className="font-semibold text-foreground/70">{it.name}:</span> {it.description}</div>
                        ))}
                      </div>
                    ) : !s.pos_customer ? (
                      <span className="text-ink-muted">—</span>
                    ) : null}
                  </td>

                  <td className="py-3 pr-3 whitespace-nowrap uppercase text-xs">{s.payment_method}</td>
                  <td className="py-3 pr-3 whitespace-nowrap text-right font-semibold">{money(s.amount_pence)}</td>
                  {!hideCost && <td className="py-3 pr-3 text-right">{money(s.profit_pence)}</td>}
                  <td className="py-3 pr-3 whitespace-nowrap">
                    {s.refunded ? (
                      <span className="inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest bg-primary/10 text-primary">Refunded</span>
                    ) : (
                      <span className="inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest bg-emerald-100 text-emerald-800">Completed</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-nowrap justify-end gap-2">
                      <Link to="/staff/sales/$saleId" params={{ saleId: s.id }} className="whitespace-nowrap text-xs font-semibold uppercase tracking-widest text-primary hover:underline">
                        View / Edit
                      </Link>
                      <button
                        onClick={() => setInlineId(inlineId === s.id ? null : s.id)}
                        className="whitespace-nowrap rounded-sm border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-foreground hover:border-primary"
                      >
                        {inlineId === s.id ? "Close" : "Inline edit"}
                      </button>
                      {isAdmin && (
                        <button
                          disabled={undo.isPending}
                          onClick={() => {
                            if (confirm("Undo this sale? Stock will be restored as if it never happened.")) {
                              undo.mutate(s.id);
                            }
                          }}
                          className="whitespace-nowrap rounded-sm border border-primary bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-40"
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  </td>

                </tr>
                {inlineId === s.id && (
                  <tr className="border-b border-border/60">
                    <td colSpan={cols} className="px-3 pb-4">
                      <SaleInlineEdit saleId={s.id} onDone={() => setInlineId(null)} />
                    </td>
                  </tr>
                )}
                {expandedId === s.id && (
                  <tr className="border-b border-border/60 bg-surface/50">
                    <td colSpan={cols} className="px-6 py-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Items in this sale</p>
                        <InvoiceActions saleId={s.id} />
                      </div>

                      {Array.isArray(s.items) && s.items.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-ink-muted">
                                <th className="py-1.5 pr-3">Item</th>
                                <th className="py-1.5 pr-3 text-right">Qty</th>
                                <th className="py-1.5 pr-3 text-right">Unit Price</th>
                                <th className="py-1.5 pr-3 text-right">Line Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.items.map((it: any, i: number) => (
                                <tr key={i} className="border-b border-border/40">
                                  <td className="py-1.5 pr-3">
                                    <span className="font-semibold">{it.name}</span> {it.mileage ? <span className="ml-1 rounded-sm bg-primary/10 px-1 text-[11px] font-semibold text-primary">{Number(it.mileage).toLocaleString("en-GB")} miles</span> : null}
                                    {it.description && <span className="ml-1 text-ink-muted">— {it.description}</span>}
                                  </td>
                                  <td className="py-1.5 pr-3 text-right">{it.qty ?? 1}</td>
                                  <td className="py-1.5 pr-3 text-right">{money(it.unit_price_pence ?? 0)}</td>
                                  <td className="py-1.5 pr-3 text-right font-semibold">{money(it.line_total_pence ?? (it.unit_price_pence ?? 0) * (it.qty ?? 1))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-ink-muted">No items recorded.</p>
                      )}
                    </td>
                  </tr>
                )}
                </Fragment>
                );
              })}
              {infinite.hasNextPage && (
                <tr ref={sentinelRef}>
                  <td colSpan={cols} className="py-4 text-center text-xs text-ink-muted">
                    <button
                      onClick={() => infinite.fetchNextPage()}
                      disabled={infinite.isFetchingNextPage}
                      className="rounded-sm border border-border px-4 py-2 uppercase tracking-widest hover:border-primary disabled:opacity-40"
                    >
                      {infinite.isFetchingNextPage ? "Loading…" : "Load more"}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>)}
      </div>

    </AccountShell>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-widest ${active ? "bg-emerald-700 text-white" : "bg-surface text-ink-muted hover:text-foreground"}`}>
      {label}
    </button>

  );
}

