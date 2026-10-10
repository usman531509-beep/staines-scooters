import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth-client";
import { isCostHidden } from "@/lib/cost-visibility";
import { money, tillPrint, tillPrintThermalSales } from "@/lib/till-print";
import {
  addTillCash,
  closeTill,
  getTillOverview,
  getTillReportData,
  listClosedTills,
  openTill,
} from "@/lib/till.functions";
import { upsertExpense } from "@/lib/garage.functions";
import { UpdateAppButton } from "@/components/till/UpdateAppButton";

const BTN =
  "inline-flex h-7 items-center rounded-sm border border-border bg-surface-elevated px-2.5 text-[10px] font-semibold uppercase tracking-wider text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50";
const BTN_RED =
  "inline-flex h-7 items-center rounded-sm border border-primary bg-primary px-2.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";
const FIELD =
  "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const LABEL = "mb-1 block text-[10px] font-semibold uppercase tracking-widest text-ink-muted";

function pounds(pence: number) {
  return money(pence);
}

function toPence(v: string) {
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

export function TillSheet({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:p-6">
      <div
        className={`w-full ${wide ? "max-w-6xl" : "max-w-lg"} rounded-sm border border-border bg-surface shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b-[3px] border-primary px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-sm p-1 hover:text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ periods */

type Period = "today" | "yesterday" | "week" | "month" | "year" | "all" | "custom";

const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom" },
];

function rangeFor(period: Period, from: string, to: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (period === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (period === "week") {
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
  } else if (period === "month") start.setDate(1);
  else if (period === "year") {
    start.setMonth(0, 1);
  } else if (period === "all") start.setFullYear(2000, 0, 1);
  else if (period === "custom") {
    if (from) start.setTime(new Date(`${from}T00:00:00`).getTime());
    if (to) end.setTime(new Date(`${to}T23:59:59`).getTime());
  }
  return { start, end };
}

function PeriodFilter({
  period,
  setPeriod,
  from,
  setFrom,
  to,
  setTo,
  search,
  setSearch,
}: {
  period: Period;
  setPeriod: (p: Period) => void;
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[180px] flex-1">
        <label className={LABEL}>Search</label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className={FIELD} />
      </div>
      <div>
        <label className={LABEL}>Period</label>
        <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className={FIELD}>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL}>From</label>
        <input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPeriod("custom");
          }}
          className={FIELD}
        />
      </div>
      <div>
        <label className={LABEL}>To</label>
        <input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPeriod("custom");
          }}
          className={FIELD}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ reports */

type Tab = "sales" | "expenses" | "summary";

function ReportsDialog({ onClose }: { onClose: () => void }) {
  const dataFn = useServerFn(getTillReportData);
  const { data } = useQuery({ queryKey: ["till-report"], queryFn: () => dataFn({ data: {} as any }) });
  const { user } = useAuth();
  const hideCost = isCostHidden(user?.email);

  const [tab, setTab] = useState<Tab>("sales");
  const [period, setPeriod] = useState<Period>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  const { start, end } = rangeFor(period, from, to);
  const periodLabel =
    period === "custom"
      ? `${from || "—"} → ${to || "—"}`
      : (PERIODS.find((p) => p.value === period)?.label ?? "Today");

  const sales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ((data as any)?.sales ?? []).filter((s: any) => {
      const t = new Date(s.created_at).getTime();
      if (t < start.getTime() || t > end.getTime()) return false;
      if (!q) return true;
      return `${s.receipt_no ?? ""} ${s.description ?? ""} ${s.payment_method ?? ""}`.toLowerCase().includes(q);
    });
  }, [data, search, start.getTime(), end.getTime()]);

  const expenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ((data as any)?.expenses ?? []).filter((e: any) => {
      const t = new Date(`${e.expense_date}T12:00:00`).getTime();
      if (t < start.getTime() || t > end.getTime()) return false;
      if (!q) return true;
      return `${e.description ?? ""} ${e.vendor ?? ""} ${e.category ?? ""} ${e.notes ?? ""}`.toLowerCase().includes(q);
    });
  }, [data, search, start.getTime(), end.getTime()]);

  const totals = useMemo(() => {
    const revenue = sales.reduce((a: number, s: any) => a + (s.refunded ? 0 : s.amount_pence), 0);
    const vat = sales.reduce((a: number, s: any) => a + (s.refunded ? 0 : s.tax_pence), 0);
    const cogs = sales.reduce((a: number, s: any) => a + (s.refunded ? 0 : s.cogs_pence), 0);
    const exp = expenses.reduce((a: number, e: any) => a + (e.amount_pence ?? 0), 0);
    return {
      revenue,
      vat,
      net: revenue - vat,
      cogs,
      gross: revenue - vat - cogs,
      expenses: exp,
      netProfit: revenue - vat - cogs - exp,
      count: sales.length,
      entries: expenses.length,
    };
  }, [sales, expenses]);

  function printSales(thermal: boolean) {
    if (thermal) {
      tillPrintThermalSales({
        periodLabel,
        sales: sales.map((s: any) => ({
          order: s.receipt_no ? `#${s.receipt_no}` : (s.id ?? "").slice(0, 8),
          dateTime: new Date(s.created_at).toLocaleString("en-GB"),
          type: s.payment_method,
          status: s.refunded ? "Refunded" : "Completed",
          vat: s.tax_pence,
          total: s.amount_pence,
          tendered: s.cash_tendered_pence,
          refunded: s.refunded,
        })),
      });
      return;
    }
    tillPrint({
      title: "Sales Report",
      subtitle: `Period: ${periodLabel}`,
      columns: [
        { label: "Order" },
        { label: "Date" },
        { label: "Type" },
        { label: "Status" },
        { label: "VAT", align: "right" },
        { label: "Total", align: "right" },
      ],
      rows: sales.map((s: any) => [
        s.receipt_no ? `#${s.receipt_no}` : (s.id ?? "").slice(0, 8),
        new Date(s.created_at).toLocaleString("en-GB"),
        s.payment_method ?? "—",
        s.refunded ? "Refunded" : "Completed",
        pounds(s.tax_pence),
        pounds(s.amount_pence),
      ]),
      refundedRows: sales.map((s: any) => !!s.refunded),
      totals: [
        { label: "Revenue", value: pounds(totals.revenue) },
        { label: "VAT", value: pounds(totals.vat) },
        ...(hideCost ? [] : [{ label: "Gross profit", value: pounds(totals.gross) }]),
        { label: "Sales", value: String(totals.count) },
      ],
    });
  }

  function printExpenses(thermal: boolean) {
    tillPrint({
      thermal,
      title: "Expenses Report",
      subtitle: `Period: ${periodLabel}`,
      columns: [
        { label: "Date" },
        { label: "Expense" },
        { label: "Category" },
        { label: "Notes" },
        { label: "Amount", align: "right" },
      ],
      rows: expenses.map((e: any) => [
        new Date(`${e.expense_date}T12:00:00`).toLocaleDateString("en-GB"),
        e.description || e.vendor || "—",
        e.category ?? "—",
        e.notes ?? "",
        pounds(e.amount_pence),
      ]),
      totals: [
        { label: "Expenses", value: pounds(totals.expenses) },
        { label: "Entries", value: String(totals.entries) },
      ],
    });
  }

  const summaryRows: [string, string][] = [
    ["Revenue incl. VAT", pounds(totals.revenue)],
    ["VAT included", pounds(totals.vat)],
    ["Net sales excl. VAT", pounds(totals.net)],
    ...(hideCost
      ? []
      : ([
          ["Cost of goods sold", pounds(totals.cogs)],
          ["Gross profit", pounds(totals.gross)],
        ] as [string, string][])),
    ["Expenses", pounds(totals.expenses)],
    ...(hideCost ? [] : ([["Net profit", pounds(totals.netProfit)]] as [string, string][])),
    ["Transactions", String(totals.count)],
  ];

  function printSummary(thermal: boolean) {
    tillPrint({
      thermal,
      title: "Profit & Revenue",
      subtitle: `Period: ${periodLabel}`,
      columns: [{ label: "Figure" }, { label: "Amount", align: "right" }],
      rows: summaryRows.map(([k, v]) => [k, v]),
      totals: [
        { label: "Revenue", value: pounds(totals.revenue) },
        { label: "Expenses", value: pounds(totals.expenses) },
        ...(hideCost
          ? []
          : [
              { label: "Gross profit", value: pounds(totals.gross) },
              { label: "Net profit", value: pounds(totals.netProfit) },
            ]),
      ],
    });
  }

  const print = tab === "sales" ? printSales : tab === "expenses" ? printExpenses : printSummary;

  const TH = "border-b border-border px-2 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-ink-muted";
  const TD = "border-b border-border/60 px-2 py-1.5 text-xs text-foreground";

  return (
    <TillSheet title="Print Reports" onClose={onClose} wide>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["sales", "expenses", "summary"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={t === tab ? BTN_RED : BTN}
          >
            {t === "summary" ? "Profit & Revenue" : t}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button onClick={() => print(false)} className={BTN}>
            A4
          </button>
          <button onClick={() => print(true)} className={BTN}>
            Thermal
          </button>
        </div>
      </div>

      <PeriodFilter
        period={period}
        setPeriod={setPeriod}
        from={from}
        setFrom={setFrom}
        to={to}
        setTo={setTo}
        search={search}
        setSearch={setSearch}
      />

      <div className="mt-3 max-h-[46vh] overflow-auto rounded-sm border border-border">
        {tab === "sales" && (
          <table className="w-full">
            <thead>
              <tr>
                <th className={TH}>Order</th>
                <th className={TH}>Date</th>
                <th className={TH}>Type</th>
                <th className={TH}>Status</th>
                <th className={`${TH} text-right`}>VAT</th>
                <th className={`${TH} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s: any) => (
                <tr key={s.id} className={s.refunded ? "text-primary" : ""}>
                  <td className={TD}>{s.receipt_no ? `#${s.receipt_no}` : (s.id ?? "").slice(0, 8)}</td>
                  <td className={TD}>{new Date(s.created_at).toLocaleString("en-GB")}</td>
                  <td className={TD}>{s.payment_method ?? "—"}</td>
                  <td className={TD}>{s.refunded ? "Refunded" : "Completed"}</td>
                  <td className={`${TD} text-right`}>{pounds(s.tax_pence)}</td>
                  <td className={`${TD} text-right font-semibold`}>{pounds(s.amount_pence)}</td>
                </tr>
              ))}
              {!sales.length && (
                <tr>
                  <td className={`${TD} text-center`} colSpan={6}>
                    No sales for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {tab === "expenses" && (
          <table className="w-full">
            <thead>
              <tr>
                <th className={TH}>Date</th>
                <th className={TH}>Expense</th>
                <th className={TH}>Category</th>
                <th className={TH}>Notes</th>
                <th className={`${TH} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e: any) => (
                <tr key={e.id}>
                  <td className={TD}>{new Date(`${e.expense_date}T12:00:00`).toLocaleDateString("en-GB")}</td>
                  <td className={TD}>{e.description || e.vendor || "—"}</td>
                  <td className={TD}>{e.category ?? "—"}</td>
                  <td className={TD}>{e.notes ?? ""}</td>
                  <td className={`${TD} text-right font-semibold`}>{pounds(e.amount_pence)}</td>
                </tr>
              ))}
              {!expenses.length && (
                <tr>
                  <td className={`${TD} text-center`} colSpan={5}>
                    No expenses for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {tab === "summary" && (
          <table className="w-full">
            <thead>
              <tr>
                <th className={TH}>Figure</th>
                <th className={`${TH} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map(([k, v]) => (
                <tr key={k}>
                  <td className={TD}>{k}</td>
                  <td className={`${TD} text-right font-semibold`}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Revenue" value={pounds(totals.revenue)} />
        {tab === "expenses" ? (
          <Stat label="Entries" value={String(totals.entries)} />
        ) : (
          <Stat label="VAT" value={pounds(totals.vat)} />
        )}
        <Stat label="Expenses" value={pounds(totals.expenses)} />
        {hideCost ? (
          <Stat label="Sales" value={String(totals.count)} />
        ) : (
          <Stat label={tab === "summary" ? "Net profit" : "Gross profit"} value={pounds(tab === "summary" ? totals.netProfit : totals.gross)} />
        )}
      </div>
    </TillSheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-surface-elevated px-3 py-2">
      <div className="text-[9px] font-bold uppercase tracking-widest text-ink-muted">{label}</div>
      <div className="text-base font-bold text-foreground">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ expense */

function ExpenseDialog({ onClose }: { onClose: () => void }) {
  const saveFn = useServerFn(upsertExpense);
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [recurrence, setRecurrence] = useState<"none" | "weekly" | "monthly">("none");
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const pence = toPence(amount);
      if (pence <= 0) throw new Error("Enter an amount.");
      return saveFn({
        data: {
          category,
          description: description || null,
          amount_pence: pence,
          tax_pence: 0,
          payment_method: paymentMethod,
          expense_date: date,
          notes: notes || null,
          recurrence,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries();
      onClose();
    },
    onError: (e: any) => setErr(e?.message ?? "Could not save the expense."),
  });

  return (
    <TillSheet title="Add Expense" onClose={onClose}>
      <div className="grid gap-3">
        <div>
          <label className={LABEL}>Expense</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={FIELD} placeholder="What was it for?" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Amount (£)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={FIELD} placeholder="0.00" />
          </div>
          <div>
            <label className={LABEL}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Category</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>Paid by</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={FIELD}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL}>Repeat</label>
          <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as any)} className={FIELD}>
            <option value="none">Does not repeat</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={FIELD} />
        </div>
        {err && <p className="text-xs font-semibold text-primary">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={BTN}>
            Cancel
          </button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className={BTN_RED}>
            {save.isPending ? "Saving…" : "Save expense"}
          </button>
        </div>
      </div>
    </TillSheet>
  );
}

/* --------------------------------------------------------------- open/close */

function TillDialog({ onClose }: { onClose: () => void }) {
  const overviewFn = useServerFn(getTillOverview);
  const openFn = useServerFn(openTill);
  const closeFn = useServerFn(closeTill);
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: ["till-overview"], queryFn: () => overviewFn({ data: {} as any }) });
  const o: any = overview.data ?? {};
  const [float, setFloat] = useState("");
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const doOpen = useMutation({
    mutationFn: () => openFn({ data: { openingFloatPence: toPence(float) } }),
    onSuccess: () => {
      qc.invalidateQueries();
      onClose();
    },
    onError: (e: any) => setErr(e?.message ?? "Could not open the till."),
  });

  const doClose = useMutation({
    mutationFn: () => closeFn({ data: { countedPence: toPence(counted), notes: notes || null } }),
    onSuccess: (r: any) => {
      setResult(`Expected ${pounds(r.expectedPence)} · Variance ${pounds(r.variancePence)}`);
      qc.invalidateQueries();
    },
    onError: (e: any) => setErr(e?.message ?? "Could not close the till."),
  });

  const open = !!o.session;

  return (
    <TillSheet title={open ? "Close Till" : "Open Till"} onClose={onClose}>
      {overview.isLoading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : open ? (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Opening float" value={pounds(o.session.opening_float_pence ?? 0)} />
            <Stat label="Cash sales" value={pounds(o.cashSalesPence ?? 0)} />
            <Stat label="Cash added" value={pounds(o.addedPence ?? 0)} />
            <Stat label="Expected in drawer" value={pounds(o.inDrawerPence ?? 0)} />
          </div>
          <div>
            <label className={LABEL}>Counted cash (£)</label>
            <input value={counted} onChange={(e) => setCounted(e.target.value)} inputMode="decimal" className={FIELD} placeholder="0.00" />
          </div>
          <div>
            <label className={LABEL}>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={FIELD} />
          </div>
          {counted !== "" && (
            <p className="text-xs font-semibold text-ink-muted">
              Variance: {pounds(toPence(counted) - (o.inDrawerPence ?? 0))}
            </p>
          )}
          {result && <p className="text-xs font-semibold text-foreground">{result}</p>}
          {err && <p className="text-xs font-semibold text-primary">{err}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className={BTN}>
              {result ? "Done" : "Cancel"}
            </button>
            {!result && (
              <button onClick={() => doClose.mutate()} disabled={doClose.isPending} className={BTN_RED}>
                {doClose.isPending ? "Closing…" : "Close till"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-xs text-ink-muted">
            Enter the cash already in the drawer so the closing count can be checked at the end of the day.
          </p>
          <div>
            <label className={LABEL}>Opening float (£)</label>
            <input value={float} onChange={(e) => setFloat(e.target.value)} inputMode="decimal" className={FIELD} placeholder="0.00" />
          </div>
          {err && <p className="text-xs font-semibold text-primary">{err}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className={BTN}>
              Cancel
            </button>
            <button onClick={() => doOpen.mutate()} disabled={doOpen.isPending} className={BTN_RED}>
              {doOpen.isPending ? "Opening…" : "Open till"}
            </button>
          </div>
        </div>
      )}
    </TillSheet>
  );
}

/* ------------------------------------------------------------ closed tills */

function ClosedTillsDialog({ onClose }: { onClose: () => void }) {
  const listFn = useServerFn(listClosedTills);
  const { data } = useQuery({ queryKey: ["closed-tills"], queryFn: () => listFn({ data: {} as any }) });
  const sessions: any[] = (data as any)?.sessions ?? [];

  const rows = sessions.map((s) => [
    new Date(s.opened_at).toLocaleString("en-GB"),
    s.closed_at ? new Date(s.closed_at).toLocaleString("en-GB") : "—",
    pounds(s.opening_float_pence ?? 0),
    pounds(s.expected_close_pence ?? 0),
    pounds(s.closing_count_pence ?? 0),
    pounds(s.variance_pence ?? 0),
  ]);

  function print(thermal: boolean) {
    tillPrint({
      thermal,
      title: "Closed Tills",
      columns: [
        { label: "Opened" },
        { label: "Closed" },
        { label: "Float", align: "right" },
        { label: "Expected", align: "right" },
        { label: "Counted", align: "right" },
        { label: "Variance", align: "right" },
      ],
      rows,
      totals: [{ label: "Sessions", value: String(sessions.length) }],
    });
  }

  const TH = "border-b border-border px-2 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-ink-muted";
  const TD = "border-b border-border/60 px-2 py-1.5 text-xs text-foreground";

  return (
    <TillSheet title="Closed Tills" onClose={onClose} wide>
      <div className="mb-3 flex justify-end gap-2">
        <button onClick={() => print(false)} className={BTN}>
          A4
        </button>
        <button onClick={() => print(true)} className={BTN}>
          Thermal
        </button>
      </div>
      <div className="max-h-[55vh] overflow-auto rounded-sm border border-border">
        <table className="w-full">
          <thead>
            <tr>
              <th className={TH}>Opened</th>
              <th className={TH}>Closed</th>
              <th className={`${TH} text-right`}>Float</th>
              <th className={`${TH} text-right`}>Expected</th>
              <th className={`${TH} text-right`}>Counted</th>
              <th className={`${TH} text-right`}>Variance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={sessions[i].id}>
                {r.map((c, j) => (
                  <td key={j} className={`${TD}${j > 1 ? " text-right" : ""}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className={`${TD} text-center`} colSpan={6}>
                  No closed tills yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </TillSheet>
  );
}

/* --------------------------------------------------------- cash / card view */

function CashInTillDialog({ onClose }: { onClose: () => void }) {
  const overviewFn = useServerFn(getTillOverview);
  const addFn = useServerFn(addTillCash);
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: ["till-overview"], queryFn: () => overviewFn({ data: {} as any }) });
  const o: any = overview.data ?? {};
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState<"cash_in" | "payout">("cash_in");
  const [err, setErr] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () => addFn({ data: { amountPence: toPence(amount), kind, reason: reason || null } }),
    onSuccess: () => {
      setAmount("");
      setReason("");
      setErr(null);
      qc.invalidateQueries({ queryKey: ["till-overview"] });
    },
    onError: (e: any) => setErr(e?.message ?? "Could not record the cash."),
  });

  return (
    <TillSheet title="Cash in Till" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Opening float" value={pounds(o.session?.opening_float_pence ?? 0)} />
        <Stat label="Cash sales" value={pounds(o.cashSalesPence ?? 0)} />
        <Stat label="Cash added" value={pounds(o.addedPence ?? 0)} />
        <Stat label="Paid out" value={pounds(o.paidOutPence ?? 0)} />
      </div>
      <div className="mt-3 rounded-sm border-2 border-primary bg-primary/5 px-3 py-2">
        <div className="text-[9px] font-bold uppercase tracking-widest text-ink-muted">Cash in drawer</div>
        <div className="text-2xl font-black text-primary">{pounds(o.inDrawerPence ?? 0)}</div>
      </div>

      {o.session ? (
        <div className="mt-3 grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL}>Amount (£)</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={FIELD} placeholder="0.00" />
            </div>
            <div>
              <label className={LABEL}>Type</label>
              <select value={kind} onChange={(e) => setKind(e.target.value as any)} className={FIELD}>
                <option value="cash_in">Add cash</option>
                <option value="payout">Pay out</option>
              </select>
            </div>
          </div>
          <div>
            <label className={LABEL}>Reason</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className={FIELD} />
          </div>
          {err && <p className="text-xs font-semibold text-primary">{err}</p>}
          <div className="flex justify-end">
            <button onClick={() => add.mutate()} disabled={add.isPending} className={BTN_RED}>
              {add.isPending ? "Saving…" : "Record"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs font-semibold text-primary">Open the till to record cash movements.</p>
      )}
    </TillSheet>
  );
}

function CardTakingsDialog({ onClose }: { onClose: () => void }) {
  const overviewFn = useServerFn(getTillOverview);
  const overview = useQuery({ queryKey: ["till-overview"], queryFn: () => overviewFn({ data: {} as any }) });
  const o: any = overview.data ?? {};
  return (
    <TillSheet title="Cash with Card" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Card takings today" value={pounds(o.cardTodayPence ?? 0)} />
        <Stat label="Cash takings today" value={pounds(o.cashTodayPence ?? 0)} />
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        Card totals include card machine payments and bank transfers taken today.
      </p>
    </TillSheet>
  );
}

/* ---------------------------------------------------------------- toolbar */

export function TillToolbar() {
  const navigate = useNavigate();
  const overviewFn = useServerFn(getTillOverview);
  const overview = useQuery({
    queryKey: ["till-overview"],
    queryFn: () => overviewFn({ data: {} as any }),
    refetchOnMount: true,
  });
  const o: any = overview.data ?? {};
  const [dialog, setDialog] = useState<
    null | "reports" | "expense" | "till" | "closed" | "cash" | "card"
  >(null);

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => navigate({ to: "/staff/sales" })} className={BTN}>
          Orders
        </button>
        <button onClick={() => setDialog("reports")} className={BTN}>
          Print Reports
        </button>
        <button onClick={() => setDialog("expense")} className={BTN}>
          Expenses
        </button>
        <button onClick={() => setDialog("till")} className={o.session ? BTN : BTN_RED}>
          {o.session ? "Close Till" : "Open Till"}
        </button>
        <button onClick={() => setDialog("closed")} className={BTN}>
          Closed Tills
        </button>
        <button onClick={() => setDialog("cash")} className={BTN}>
          Cash in Till {pounds(o.inDrawerPence ?? 0)}
        </button>
        <button onClick={() => setDialog("card")} className={BTN}>
          Cash with Card {pounds(o.cardTodayPence ?? 0)}
        </button>
        <UpdateAppButton />
      </div>

      {dialog === "reports" && <ReportsDialog onClose={() => setDialog(null)} />}
      {dialog === "expense" && <ExpenseDialog onClose={() => setDialog(null)} />}
      {dialog === "till" && <TillDialog onClose={() => setDialog(null)} />}
      {dialog === "closed" && <ClosedTillsDialog onClose={() => setDialog(null)} />}
      {dialog === "cash" && <CashInTillDialog onClose={() => setDialog(null)} />}
      {dialog === "card" && <CardTakingsDialog onClose={() => setDialog(null)} />}
    </>
  );
}

/* ------------------------------------------------------- cash / split pay */

const QUICK = [500, 1000, 2000, 5000];

export function CashPayDialog({
  totalPence,
  onCancel,
  onConfirm,
  busy,
}: {
  totalPence: number;
  onCancel: () => void;
  onConfirm: (tenderedPence: number) => void;
  busy?: boolean;
}) {
  const [tendered, setTendered] = useState("");
  const pence = toPence(tendered);
  const change = pence - totalPence;
  return (
    <TillSheet title="Cash payment" onClose={onCancel}>
      <div className="grid gap-3">
        <Stat label="Amount due" value={pounds(totalPence)} />
        <div>
          <label className={LABEL}>Cash tendered (£)</label>
          <input
            autoFocus
            value={tendered}
            onChange={(e) => setTendered(e.target.value)}
            inputMode="decimal"
            className={`${FIELD} text-xl font-bold`}
            placeholder="0.00"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button key={q} onClick={() => setTendered((toPence(tendered) + q) / 100 + "")} className={BTN}>
              +{pounds(q)}
            </button>
          ))}
          <button onClick={() => setTendered(String(totalPence / 100))} className={BTN}>
            Exact {pounds(totalPence)}
          </button>
          <button onClick={() => setTendered("")} className={BTN}>
            Clear
          </button>
        </div>
        <div className="rounded-sm border-2 border-primary bg-primary/5 px-3 py-2">
          <div className="text-[9px] font-bold uppercase tracking-widest text-ink-muted">Change due</div>
          <div className="text-3xl font-black text-primary">{pounds(Math.max(0, change))}</div>
          {pence > 0 && change < 0 && (
            <p className="text-xs font-semibold text-primary">Short by {pounds(-change)}</p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className={BTN}>
            Cancel
          </button>
          <button
            onClick={() => onConfirm(pence > 0 ? pence : totalPence)}
            disabled={busy || (pence > 0 && change < 0)}
            className={BTN_RED}
          >
            {busy ? "Recording…" : "Complete cash sale"}
          </button>
        </div>
      </div>
    </TillSheet>
  );
}

export function SplitPayDialog({
  totalPence,
  onCancel,
  onConfirm,
  busy,
  status,
}: {
  totalPence: number;
  onCancel: () => void;
  onConfirm: (cashPence: number) => void;
  busy?: boolean;
  status?: string | null;
}) {
  const [cash, setCash] = useState("");
  const cashPence = Math.min(toPence(cash), totalPence);
  const cardPence = Math.max(0, totalPence - cashPence);
  return (
    <TillSheet title="Card + Cash payment" onClose={onCancel}>
      <div className="grid gap-3">
        <Stat label="Amount due" value={pounds(totalPence)} />
        <div>
          <label className={LABEL}>Cash part (£)</label>
          <input
            autoFocus
            value={cash}
            onChange={(e) => setCash(e.target.value)}
            inputMode="decimal"
            className={`${FIELD} text-xl font-bold`}
            placeholder="0.00"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Cash" value={pounds(cashPence)} />
          <Stat label="On card" value={pounds(cardPence)} />
        </div>
        {status && <p className="text-xs font-semibold text-foreground">{status}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className={BTN}>
            Cancel
          </button>
          <button onClick={() => onConfirm(cashPence)} disabled={busy || cashPence <= 0} className={BTN_RED}>
            {busy ? "Recording…" : "Charge"}
          </button>
        </div>
      </div>
    </TillSheet>
  );
}
