import { createFileRoute, redirect } from "@tanstack/react-router";
import { FEATURES } from "@/lib/features";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, X, Search } from "lucide-react";
import { AccountShell } from "@/components/AccountShell";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { AgreementDocument, printElement, DEFAULT_AGREEMENT_TEMPLATE, TEMPLATE_FIELDS } from "@/components/finance/AgreementDocument";
import { FinancePhase2 } from "@/components/finance/FinancePhase2";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AdminSignatureManager } from "@/components/AdminSignatureManager";
import { AgreementPopup } from "@/components/finance/AgreementPopup";
import { applyMySignatureToFinance } from "@/lib/admin-signatures.functions";
import { FinanceAccounts, FinanceCompliance, FinancePermissions } from "@/components/finance/FinanceAccounts";
import { calculateFinance, gbp, type FinanceMethod, type Frequency } from "@/lib/finance-calc";
import { ukDate } from "@/lib/format-date";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { onlinePaymentsEnabled } from "@/lib/online-payments";
import {
  getFinanceOverview, saveFinanceAgreement, setFinanceStatus, recordFinancePayment, recordFinanceDeposit,
  saveFinanceSettings, getFinanceTransactions,
  listFinanceUndoFn, undoFinanceAction, saveAgreementTemplate, createFinanceCheckout,
} from "@/lib/finance.functions";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/admin/finance")({
  beforeLoad: () => {
    if (!FEATURES.finance) throw redirect({ to: "/admin" });
  },
  head: () => ({
    meta: [
      { title: `Motorbike Financing — ${BRAND.name} Admin` },
      { name: "description", content: "Quotes, finance agreements, e-signatures, schedules and collections for motorcycle finance." },
      { property: "og:title", content: `Motorbike Financing — ${BRAND.name} Admin` },
      { property: "og:description", content: "Quotes, finance agreements, e-signatures, schedules and collections for motorcycle finance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FinancePage,
});

const TABS = ["Dashboard", "Applications & Quotes", "Agreements", "Payment Schedules", "Arrears", "Accounts", "Compliance", "Permissions", "Calculator", "Settings"] as const;
type Tab = (typeof TABS)[number];
const today = () => new Date().toISOString().slice(0, 10);
const toP = (s: string) => Math.round((parseFloat(s || "0") || 0) * 100);
const STATUS_LABEL: Record<string, string> = { quote: "Quote", approved: "Approved", declined: "Declined", sent: "Awaiting signature", signed: "Signed", active: "Active", completed: "Completed", cancelled: "Cancelled", withdrawn: "Withdrawn", settled: "Settled early", terminated: "Voluntarily terminated", defaulted: "Defaulted", recovered: "Vehicle recovered", closed: "Closed" };

function metrics(a: any) {
  const inst = a.instalments ?? [];
  const paid = inst.filter((i: any) => i.status === "paid");
  const due = inst.filter((i: any) => i.status === "due");
  const overdue = due.filter((i: any) => i.due_date < today());
  return {
    paidSum: paid.reduce((s: number, i: any) => s + i.paid_pence, 0),
    interestEarned: paid.reduce((s: number, i: any) => s + i.interest_pence, 0),
    outstanding: due.reduce((s: number, i: any) => s + i.amount_pence, 0),
    principalLeft: due.reduce((s: number, i: any) => s + i.principal_pence, 0),
    overdue, overdueSum: overdue.reduce((s: number, i: any) => s + i.amount_pence, 0),
    next: due[0],
  };
}

function FinancePage() {
  const fn = useServerFn(getFinanceOverview);
  const q = useQuery({ queryKey: ["finance"], queryFn: () => fn() });
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [edit, setEdit] = useState<any | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const all = (q.data?.agreements ?? []) as any[];
  const s = q.data?.settings;
  const filtered = all.filter((a) => {
    if (!search) return true;
    const t = `${a.ref_no} ${a.customer_snapshot?.full_name} ${a.customer_snapshot?.phone} ${a.vehicle?.reg} ${a.vehicle?.make} ${a.vehicle?.model}`.toLowerCase();
    return t.includes(search.toLowerCase());
  });
  const open = all.find((a) => a.id === openId) ?? null;

  return (
    <AccountShell title="Motorbike Financing">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest ${tab === t ? "bg-primary text-primary-foreground" : "border border-border"}`}>{t}</button>
          ))}
        </div>
        <button onClick={() => setEdit({})} className="ml-auto inline-flex items-center gap-1 rounded-sm bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-primary-foreground"><Plus className="h-4 w-4" /> New finance application</button>
      </div>
      {["Applications & Quotes", "Agreements", "Payment Schedules", "Arrears"].includes(tab) && (
        <div className="mt-3 flex items-center gap-2 rounded-sm border border-border bg-input px-2"><Search className="h-4 w-4 text-ink-muted" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search agreement no., customer, phone, reg…" className="w-full bg-transparent py-1.5 text-sm outline-none" /></div>
      )}
      {q.isLoading && <p className="mt-4 text-sm text-ink-muted">Loading…</p>}
      <div className="mt-4">
        {tab === "Dashboard" && <Dashboard all={all} onOpen={setOpenId} onTab={setTab} />}
        {tab === "Applications & Quotes" && <AgreementList rows={filtered.filter((a) => ["quote", "approved", "declined", "sent"].includes(a.status))} onOpen={setOpenId} />}
        {tab === "Agreements" && <AgreementDraftButton s={s} canEdit={!!q.data?.isAdmin} />}
        {tab === "Agreements" && <AgreementList rows={filtered.filter((a) => !["quote", "approved", "declined", "sent"].includes(a.status))} onOpen={setOpenId} />}
        {tab === "Payment Schedules" && <ScheduleList rows={filtered} onOpen={setOpenId} />}
        {tab === "Arrears" && <AgreementList rows={filtered.filter((a) => ["active", "defaulted"].includes(a.status) && metrics(a).overdue.length)} onOpen={setOpenId} arrears />}
        {tab === "Accounts" && <FinanceAccounts />}
        {tab === "Compliance" && <FinanceCompliance all={all} settings={s} onOpen={setOpenId} />}
        {tab === "Permissions" && (q.data?.isAdmin ? <FinancePermissions /> : <p className="text-sm text-ink-muted">Only owners and admins can manage finance permissions.</p>)}
        {tab === "Calculator" && <Calculator settings={s} />}
        {tab === "Settings" && q.data && <SettingsForm s={s} canEdit={!!q.data.isAdmin} />}
      </div>
      {edit && <Editor a={edit} settings={s} onClose={() => setEdit(null)} />}
      {open && <Detail a={open} s={s} isAdmin={!!q.data?.isAdmin} onClose={() => setOpenId(null)} onEdit={() => { setEdit(open); setOpenId(null); }} />}
    </AccountShell>
  );
}

function Box({ l, v, sub, onClick }: { l: string; v: string; sub?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="rounded-md border border-border bg-surface-elevated p-3 text-left hover:border-primary">
      <p className="text-[10px] uppercase tracking-widest text-ink-muted">{l}</p>
      <p className="font-display text-2xl text-primary">{v}</p>
      {sub && <p className="text-[11px] text-ink-muted">{sub}</p>}
    </button>
  );
}

function Dashboard({ all, onOpen, onTab }: { all: any[]; onOpen: (id: string) => void; onTab: (t: Tab) => void }) {
  const active = all.filter((a) => a.status === "active");
  const m = active.map(metrics);
  const sum = (k: keyof ReturnType<typeof metrics>) => m.reduce((s, x) => s + (x[k] as number), 0);
  const month = today().slice(0, 7);
  const dueThisMonth = active.flatMap((a) => a.instalments).filter((i: any) => i.status === "due" && i.due_date.startsWith(month));
  const arrears = active.filter((a) => metrics(a).overdue.length);
  const advanced = all.filter((a) => ["active", "completed"].includes(a.status)).reduce((s, a) => s + a.credit_pence, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Box l="Active agreements" v={String(active.length)} onClick={() => onTab("Agreements")} />
        <Box l="Applications & quotes" v={String(all.filter((a) => ["quote", "approved", "sent"].includes(a.status)).length)} sub={`${all.filter((a) => a.status === "sent").length} awaiting signature`} onClick={() => onTab("Applications & Quotes")} />
        <Box l="Outstanding balance" v={gbp(sum("outstanding"))} sub={`principal ${gbp(sum("principalLeft"))}`} onClick={() => onTab("Payment Schedules")} />
        <Box l="In arrears" v={gbp(sum("overdueSum"))} sub={`${arrears.length} customers`} onClick={() => onTab("Arrears")} />
        <Box l="Collected to date" v={gbp(sum("paidSum"))} onClick={() => onTab("Agreements")} />
        <Box l="Interest earned" v={gbp(sum("interestEarned"))} onClick={() => onTab("Agreements")} />
        <Box l="Credit advanced" v={gbp(advanced)} onClick={() => onTab("Agreements")} />
        <Box l="Due this month" v={gbp(dueThisMonth.reduce((s: number, i: any) => s + i.amount_pence, 0))} sub={`${dueThisMonth.length} payments`} onClick={() => onTab("Payment Schedules")} />
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Recent</p>
        <AgreementList rows={all.slice(0, 8)} onOpen={onOpen} />
      </div>
    </div>
  );
}

function AgreementList({ rows, onOpen, arrears }: { rows: any[]; onOpen: (id: string) => void; arrears?: boolean }) {
  if (!rows.length) return <p className="text-sm text-ink-muted">Nothing here yet.</p>;
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead><tr className="bg-surface-elevated text-left text-[10px] uppercase tracking-widest text-ink-muted">
          <th className="p-2">No.</th><th>Customer</th><th>Motorcycle</th><th className="text-right">Credit</th><th className="text-right">Instalment</th><th className="text-right">{arrears ? "Overdue" : "Outstanding"}</th><th className="p-2 text-right">Status</th>
        </tr></thead>
        <tbody>{rows.map((a) => {
          const m = metrics(a);
          return (
            <tr key={a.id} onClick={() => onOpen(a.id)} className="cursor-pointer border-t border-border/60 hover:bg-surface-elevated">
              <td className="p-2">FA-{a.ref_no}</td>
              <td>{a.customer_snapshot?.full_name}</td>
              <td>{[a.vehicle?.make, a.vehicle?.model].filter(Boolean).join(" ")} {a.vehicle?.reg ? `· ${a.vehicle.reg}` : ""}</td>
              <td className="text-right">{gbp(a.credit_pence)}</td>
              <td className="text-right">{gbp(a.instalment_pence)}/{a.frequency === "weekly" ? "wk" : "mo"}</td>
              <td className="text-right">{arrears ? <span className="text-primary">{gbp(m.overdueSum)} ({m.overdue.length})</span> : gbp(m.outstanding)}</td>
              <td className="p-2 text-right text-[11px] uppercase">{STATUS_LABEL[a.status] ?? a.status}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function ScheduleList({ rows, onOpen }: { rows: any[]; onOpen: (id: string) => void }) {
  const list = rows.filter((a) => a.status === "active").flatMap((a) => a.instalments.filter((i: any) => i.status === "due").map((i: any) => ({ ...i, a })))
    .sort((x: any, y: any) => x.due_date.localeCompare(y.due_date));
  if (!list.length) return <p className="text-sm text-ink-muted">No upcoming payments.</p>;
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead><tr className="bg-surface-elevated text-left text-[10px] uppercase tracking-widest text-ink-muted"><th className="p-2">Due</th><th>Agreement</th><th>Customer</th><th>#</th><th className="text-right">Amount</th><th className="p-2 text-right">Note</th></tr></thead>
        <tbody>{list.slice(0, 300).map((i: any) => (
          <tr key={i.id} onClick={() => onOpen(i.a.id)} className="cursor-pointer border-t border-border/60 hover:bg-surface-elevated">
            <td className={`p-2 ${i.due_date < today() ? "text-primary" : ""}`}>{ukDate(i.due_date)}</td><td>FA-{i.a.ref_no}</td><td>{i.a.customer_snapshot?.full_name}</td><td>{i.seq}</td>
            <td className="text-right">{gbp(i.amount_pence)}</td><td className="p-2 text-right text-[11px] text-primary">{i.last_charge_error ?? (i.due_date < today() ? "Overdue" : "")}</td>
          </tr>))}</tbody>
      </table>
    </div>
  );
}

function ScheduleTable({ schedule, actions }: { schedule: any[]; actions?: (r: any) => React.ReactNode }) {
  return (
    <div className="max-h-72 overflow-auto rounded-sm border border-border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-surface-elevated"><tr className="text-[10px] uppercase text-ink-muted">{["#", "Due", "Opening", "Payment", "Interest", "Principal", "Closing", "Status", ...(actions ? [""] : [])].map((h) => <th key={h} className="p-1 text-right first:text-left">{h}</th>)}</tr></thead>
        <tbody>{schedule.map((r: any) => (
          <tr key={r.seq} className="border-t border-border/50">
            <td className="p-1">{r.seq}</td><td className="p-1 text-right">{ukDate(r.dueDate ?? r.due_date)}</td>
            <td className="p-1 text-right">{gbp(r.openingPence ?? r.opening_pence)}</td><td className="p-1 text-right font-semibold">{gbp(r.amountPence ?? r.amount_pence)}</td>
            <td className="p-1 text-right">{gbp(r.interestPence ?? r.interest_pence)}</td><td className="p-1 text-right">{gbp(r.principalPence ?? r.principal_pence)}</td>
            <td className="p-1 text-right">{gbp(r.closingPence ?? r.closing_pence)}</td><td className="p-1 text-right uppercase">{r.status ?? "—"}</td>{actions && <td className="p-1 text-right whitespace-nowrap">{actions(r)}</td>}
          </tr>))}</tbody>
      </table>
    </div>
  );
}

type Terms = { cash: string; acc: string; fees: string; dep: string; px: string; pxs: string; method: FinanceMethod; rate: string; freq: Frequency; n: string; first: string; fin: string };
const termsFrom = (a: any, s: any): Terms => ({
  cash: a.cash_price_pence != null ? (a.cash_price_pence / 100).toFixed(2) : "", acc: a.accessories_pence ? (a.accessories_pence / 100).toFixed(2) : "",
  fees: a.fees_pence ? (a.fees_pence / 100).toFixed(2) : "", dep: a.deposit_pence ? (a.deposit_pence / 100).toFixed(2) : "",
  px: a.part_ex_pence ? (a.part_ex_pence / 100).toFixed(2) : "", pxs: a.part_ex_settlement_pence ? (a.part_ex_settlement_pence / 100).toFixed(2) : "",
  method: a.method ?? s?.default_method ?? "reducing", rate: String(a.rate_pct ?? s?.default_rate_pct ?? 12), freq: a.frequency ?? "monthly",
  n: String(a.term_count ?? 12), first: a.first_payment_date ?? today(), fin: a.final_payment_pence ? (a.final_payment_pence / 100).toFixed(2) : "",
});
const calcFrom = (t: Terms) => calculateFinance({
  cashPricePence: toP(t.cash), accessoriesPence: toP(t.acc), feesPence: toP(t.fees), depositPence: toP(t.dep), partExPence: toP(t.px), partExSettlementPence: toP(t.pxs),
  method: t.method, ratePct: parseFloat(t.rate) || 0, frequency: t.freq, termCount: parseInt(t.n) || 1, firstPaymentDate: t.first, finalPaymentPence: toP(t.fin) || null,
});

const inp = "w-full rounded-sm border border-border bg-input px-2 py-1.5 text-sm";
const lab = "block text-[10px] uppercase tracking-widest text-ink-muted";
const F = ({ l, children }: { l: string; children: React.ReactNode }) => <div><label className={lab}>{l}</label>{children}</div>;

function TermsFields({ t, set }: { t: Terms; set: (p: Partial<Terms>) => void }) {
  const num = (k: keyof Terms, l: string) => <F l={l}><input inputMode="decimal" className={inp} value={t[k] as string} onChange={(e) => set({ [k]: e.target.value } as any)} /></F>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {num("cash", "Cash price £ *")}{num("acc", "Accessories £")}{num("fees", "Other charges £")}
      {num("dep", "Deposit £")}{num("px", "Part-exchange £")}{num("pxs", "PX finance settlement £")}
      <F l="Interest method"><select className={inp} value={t.method} onChange={(e) => set({ method: e.target.value as FinanceMethod })}><option value="reducing">REDUCING BALANCE</option><option value="flat">FLAT RATE</option><option value="zero">INTEREST FREE</option></select></F>
      <F l={t.method === "flat" ? "Flat rate % / yr" : "Nominal rate % / yr"}><input inputMode="decimal" disabled={t.method === "zero"} className={inp} value={t.method === "zero" ? "0" : t.rate} onChange={(e) => set({ rate: e.target.value })} /></F>
      <F l="Frequency"><select className={inp} value={t.freq} onChange={(e) => set({ freq: e.target.value as Frequency })}><option value="monthly">Monthly</option><option value="weekly">Weekly</option></select></F>
      <F l="Number of payments"><input inputMode="numeric" className={inp} value={t.n} onChange={(e) => set({ n: e.target.value })} /></F>
      <F l="First payment date"><input type="date" className={inp} value={t.first} onChange={(e) => set({ first: e.target.value })} /></F>
      <F l="Final payment £ (optional)"><input type="number" inputMode="decimal" min="0" step="0.01" placeholder="Auto" className={inp} value={t.fin} onChange={(e) => set({ fin: e.target.value.replace(/[^0-9.]/g, "") })} /></F>
    </div>
  );
}

function Summary({ r, t }: { r: ReturnType<typeof calculateFinance>; t: Terms }) {
  const S = ({ l, v, hi }: { l: string; v: string; hi?: boolean }) => <div className="rounded-sm bg-surface-elevated p-2"><p className="text-[10px] uppercase text-ink-muted">{l}</p><p className={`font-display text-lg ${hi ? "text-primary" : ""}`}>{v}</p></div>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <S l="Amount of credit" v={gbp(r.creditPence)} />
      <S l="Total interest" v={gbp(r.interestPence)} />
      <S l={`${t.freq === "weekly" ? "Weekly" : "Monthly"} payment`} v={gbp(r.instalmentPence)} hi />
      <S l="Final payment" v={gbp(r.finalInstalmentPence)} />
      <S l={t.method === "flat" ? "Flat rate" : "Nominal rate"} v={`${t.method === "zero" ? 0 : t.rate}%`} />
      <S l="APR (representative)" v={`${r.aprPct.toFixed(1)}%`} hi />
      <S l="Total of payments" v={gbp(r.totalInstalmentsPence)} />
      <S l="Total amount payable" v={gbp(r.totalPayablePence)} />
    </div>
  );
}

function Calculator({ settings }: { settings: any }) {
  const [t, setT] = useState<Terms>({ ...termsFrom({}, settings), cash: "3000", dep: "500", rate: "12" });
  const r = useMemo(() => calcFrom(t), [t]);
  return (
    <div className="space-y-3 rounded-md border border-border bg-surface p-4">
      <TermsFields t={t} set={(p) => setT({ ...t, ...p })} />
      <Summary r={r} t={t} />
      <p className="text-[11px] text-ink-muted">APR is calculated using the UK consumer-credit total-charge-for-credit formula; it is not the same as the nominal or flat rate.</p>
      <ScheduleTable schedule={r.schedule} />
    </div>
  );
}

function Editor({ a, settings, onClose }: { a: any; settings: any; onClose: () => void }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveFinanceAgreement);
  const locked = a.id && !["quote", "approved", "declined"].includes(a.status);
  const [cust, setCust] = useState<{ full_name: string; email: string; phone: string; address: string; date_of_birth: string }>({
    full_name: a.customer_snapshot?.full_name ?? "", email: a.customer_snapshot?.email ?? "", phone: a.customer_snapshot?.phone ?? "",
    address: a.customer_snapshot?.address ?? "", date_of_birth: a.customer_snapshot?.date_of_birth ?? "",
  });
  const [veh, setVeh] = useState<any>({ make: "", model: "", reg: "", vin: "", year: "", mileage: "", condition: "Used", accessories: "", ...(a.vehicle ?? {}) });
  const [aff, setAff] = useState({ income: a.affordability?.incomePence ? String(a.affordability.incomePence / 100) : "", out: a.affordability?.outgoingsPence ? String(a.affordability.outgoingsPence / 100) : "", employment: a.affordability?.employment ?? "", notes: a.affordability?.notes ?? "" });
  const [t, setT] = useState<Terms>(termsFrom(a, settings));
  const [notes, setNotes] = useState(a.notes ?? "");
  const r = useMemo(() => calcFrom(t), [t]);
  const monthlyPay = t.freq === "weekly" ? (r.instalmentPence * 52) / 12 : r.instalmentPence;
  const disposable = toP(aff.income) - toP(aff.out);

  const save = useMutation({
    mutationFn: async () => {
      if (!cust.full_name.trim()) throw new Error("Enter the customer's name");
      if (!toP(t.cash)) throw new Error("Enter the cash price");
      return saveFn({ data: {
        id: a.id ?? null,
        customer: { full_name: cust.full_name, email: cust.email || null, phone: cust.phone || null, address: cust.address || null, date_of_birth: cust.date_of_birth || null },
        vehicle: veh,
        cashPricePence: toP(t.cash), accessoriesPence: toP(t.acc), feesPence: toP(t.fees), depositPence: toP(t.dep), partExPence: toP(t.px), partExSettlementPence: toP(t.pxs),
        method: t.method, ratePct: parseFloat(t.rate) || 0, frequency: t.freq, termCount: parseInt(t.n) || 1, firstPaymentDate: t.first, finalPaymentPence: toP(t.fin) || null,
        affordability: { incomePence: toP(aff.income), outgoingsPence: toP(aff.out), employment: aff.employment || null, notes: aff.notes || null },
        notes: notes || null,
      } });
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["finance"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-8" onClick={onClose}>
      <div className="w-full max-w-4xl space-y-4 rounded-md border border-border bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="font-display text-2xl">{a.id ? `Edit FA-${a.ref_no}` : "New finance application"}</h2><button onClick={onClose}><X className="h-5 w-5" /></button></div>
        {locked && <p className="text-sm text-primary">This agreement has been signed — its terms are locked.</p>}

        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">1. Customer</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <F l="Full legal name *"><input disabled={locked} className={inp} value={cust.full_name} onChange={(e) => setCust({ ...cust, full_name: e.target.value })} /></F>
            <F l="Email"><input disabled={locked} className={inp} value={cust.email} onChange={(e) => setCust({ ...cust, email: e.target.value })} /></F>
            <F l="Phone"><input disabled={locked} className={inp} value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} /></F>
            <F l="Date of birth"><input disabled={locked} type="date" className={inp} value={cust.date_of_birth} onChange={(e) => setCust({ ...cust, date_of_birth: e.target.value })} /></F>
            <div className="col-span-2"><F l="Address"><input disabled={locked} className={inp} value={cust.address} onChange={(e) => setCust({ ...cust, address: e.target.value })} /></F></div>
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">2. Motorcycle</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["make", "model", "reg", "vin", "year", "mileage", "condition"] as const).map((k) => (
              <F key={k} l={k === "vin" ? "VIN" : k === "reg" ? "Registration" : k[0].toUpperCase() + k.slice(1)}><input disabled={locked} className={inp} value={veh[k] ?? ""} onChange={(e) => setVeh({ ...veh, [k]: k === "reg" ? e.target.value.toUpperCase() : e.target.value })} /></F>
            ))}
            <F l="Accessories"><input disabled={locked} className={inp} value={veh.accessories ?? ""} onChange={(e) => setVeh({ ...veh, accessories: e.target.value })} /></F>
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">3. Finance terms</p>
          <fieldset disabled={locked}><TermsFields t={t} set={(p) => setT({ ...t, ...p })} /></fieldset>
          <Summary r={r} t={t} />
          <details><summary className="cursor-pointer text-xs uppercase tracking-widest text-ink-muted">Show full repayment schedule</summary><div className="mt-2"><ScheduleTable schedule={r.schedule} /></div></details>
        </section>

        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">4. Affordability</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <F l="Monthly income £"><input className={inp} value={aff.income} onChange={(e) => setAff({ ...aff, income: e.target.value })} /></F>
            <F l="Monthly outgoings £"><input className={inp} value={aff.out} onChange={(e) => setAff({ ...aff, out: e.target.value })} /></F>
            <F l="Employment"><input className={inp} value={aff.employment} onChange={(e) => setAff({ ...aff, employment: e.target.value })} /></F>
            <F l="Notes"><input className={inp} value={aff.notes} onChange={(e) => setAff({ ...aff, notes: e.target.value })} /></F>
          </div>
          {toP(aff.income) > 0 && (
            <p className={`text-sm ${disposable - monthlyPay < 0 || monthlyPay > disposable * 0.5 ? "text-primary" : ""}`}>
              Disposable income {gbp(disposable)}/month · repayment ≈ {gbp(Math.round(monthlyPay))}/month ·{" "}
              {disposable - monthlyPay < 0 ? "Not affordable" : monthlyPay > disposable * 0.5 ? "High risk — over 50% of disposable income" : "Appears affordable"}
            </p>
          )}
        </section>

        <F l="Internal notes"><textarea className={inp} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></F>
        <button onClick={() => save.mutate()} disabled={save.isPending} className="w-full rounded-sm bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50">{save.isPending ? "Saving…" : a.id ? "Save changes" : "Save as quote"}</button>
      </div>
    </div>
  );
}

function Detail({ a, s, isAdmin, onClose, onEdit }: { a: any; s: any; isAdmin: boolean; onClose: () => void; onEdit: () => void }) {
  const qc = useQueryClient();
  const statusFn = useServerFn(setFinanceStatus);
  const payFn = useServerFn(recordFinancePayment);
  const depFn = useServerFn(recordFinanceDeposit);
  const txFn = useServerFn(getFinanceTransactions);
  const undoListFn = useServerFn(listFinanceUndoFn);
  const undoFn = useServerFn(undoFinanceAction);
  const checkoutFn = useServerFn(createFinanceCheckout);
  const undoQ = useQuery({ queryKey: ["finance-tx", a.id, "undo"], queryFn: () => undoListFn({ data: { agreementId: a.id } }) });
  const [secret, setSecret] = useState<string | null>(null);
  const tx = useQuery({ queryKey: ["finance-tx", a.id], queryFn: () => txFn({ data: { agreementId: a.id } }) });
  const [showDoc, setShowDoc] = useState(false);
  const [method, setMethod] = useState<"cash" | "card_machine" | "bank_transfer">("cash");
  const m = metrics(a);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["finance"] }); qc.invalidateQueries({ queryKey: ["finance-tx", a.id] }); };
  const err = (e: any) => toast.error(e.message);
  const signatureFn = useServerFn(applyMySignatureToFinance);
  const signCompany = useMutation({ mutationFn: () => signatureFn({ data: { agreementId: a.id, confirm: true } }), onSuccess: () => { toast.success("Administrator signature applied"); refresh(); }, onError: err });
  const undo = useMutation({ mutationFn: (undoId?: string) => undoFn({ data: { agreementId: a.id, undoId } }), onSuccess: (r: any) => { toast.success(`Undone: ${r.label}`); refresh(); }, onError: err });
  const done = (msg: string) => { toast.success(msg, { action: { label: "Undo", onClick: () => undo.mutate(undefined) } }); refresh(); };
  const newCard = useMutation({
    mutationFn: async (v: { instalmentId?: string; all?: boolean }) => { const r: any = await checkoutFn({ data: { agreementId: a.id, ...v, environment: getStripeEnvironment(), returnUrl: `${window.location.origin}${window.location.pathname}?paid=1` } }); if (r.error) throw new Error(r.error); return r.clientSecret as string; },
    onSuccess: setSecret, onError: err,
  });
  const act = useMutation({
    mutationFn: (action: any) => statusFn({ data: { id: a.id, action } }),
    onSuccess: (r: any, action: any) => {
      if (action === "send") { navigator.clipboard?.writeText(r.signUrl).catch(() => {}); toast.success("Signing link copied — send it to the customer"); }
      else { done(action === "delete" ? "Deleted" : "Updated"); return; }
      refresh();
    },
    onError: err,
  });
  const pay = useMutation({ mutationFn: (ids: string[]) => payFn({ data: { agreementId: a.id, instalmentIds: ids, method } }), onSuccess: () => done("Payment recorded"), onError: err });
  const dep = useMutation({ mutationFn: () => depFn({ data: { agreementId: a.id, method } }), onSuccess: () => done("Deposit recorded"), onError: err });
  const btn = "rounded-sm border border-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest disabled:opacity-50";
  const pbtn = "rounded-sm bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50";
  const depositPaid = (tx.data?.rows ?? []).some((t: any) => t.kind === "deposit");
  const signUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/fa/${a.sign_token}`;
  // Pair each audit-trail row with its undo snapshot: direct links first, then label/kind matching for older rows.
  const labelToKinds = (label: string): string[] => {
    if (label.startsWith("Status: ")) return [`status_${label.slice(8)}`];
    if (label.startsWith("Notice: ")) return [`notice_${label.slice(8)}`];
    if (label === "Record deposit") return ["deposit"];
    if (label === "Customer signed") return ["customer_signed"];
    if (label === "Administrator signed") return ["company_signed"];
    if (label === "Quote created") return ["quote_created"];
    if (label === "Settlement quote") return ["settlement_quote"];
    if (label === "Early settlement") return ["early_settlement", "settlement_rebate"];
    if (label === "Voluntary termination") return ["voluntary_termination", "termination_payment"];
    if (label === "Vehicle recovery") return ["recovery_return", "recovery_voluntary_surrender", "recovery_repossession", "recovery_sale", "recovery_costs"];
    if (label === "Edit agreement") return ["terms_updated"];
    if (label.startsWith("Record payment")) return ["instalment_payment"];
    if (label.startsWith("Card charge")) return ["instalment_payment", "charge_failed"];
    return [];
  };
  const txRows: any[] = tx.data?.rows ?? [];
  const allSnaps: any[] = undoQ.data?.rows ?? [];
  const snapByTx: Record<string, any> = {};
  const claimed = new Set<string>();
  for (const t of txRows) {
    if (!t.undo_id) continue;
    const s = allSnaps.find((u) => u.id === t.undo_id);
    if (s) { snapByTx[t.id] = s; claimed.add(t.id); }
  }
  for (const u of allSnaps) {
    const kinds = labelToKinds(u.label);
    if (!kinds.length) continue;
    let best: any = null, bestDt = Infinity;
    for (const t of txRows) {
      if (claimed.has(t.id) || !kinds.includes(t.kind)) continue;
      const dt = Math.abs(new Date(t.created_at).getTime() - new Date(u.created_at).getTime());
      if (dt < bestDt) { best = t; bestDt = dt; }
    }
    if (best) { claimed.add(best.id); snapByTx[best.id] = u; }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-8" onClick={onClose}>
      <div className="w-full max-w-4xl space-y-4 rounded-md border border-border bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl">FA-{a.ref_no} · {a.customer_snapshot?.full_name}</h2>
            <p className="text-xs text-ink-muted">{[a.vehicle?.make, a.vehicle?.model, a.vehicle?.reg].filter(Boolean).join(" · ")} · <span className="uppercase text-primary">{STATUS_LABEL[a.status]}</span></p>
            {a.signed_at && <p className="text-xs text-ink-muted">Signed by {a.signed_name} on {ukDate(a.signed_at)} · withdrawal period ends {a.withdrawal_deadline ? ukDate(a.withdrawal_deadline) : "—"}</p>}
          </div>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {[["Credit", gbp(a.credit_pence)], ["APR", `${Number(a.apr_pct).toFixed(1)}%`], ["Paid", gbp(m.paidSum)], ["Outstanding", gbp(m.outstanding)], ["Overdue", `${gbp(m.overdueSum)} (${m.overdue.length})`], ["Interest earned", gbp(m.interestEarned)], ["Next", m.next ? `${gbp(m.next.amount_pence)} · ${ukDate(m.next.due_date)}` : "—"], ["Deposit", `${gbp(a.deposit_pence)} ${depositPaid ? "✓" : ""}`]].map(([l, v]) => (
            <div key={l} className="rounded-sm bg-surface-elevated p-2"><p className="text-[10px] uppercase text-ink-muted">{l}</p><p className="font-display text-lg">{v}</p></div>
          ))}
        </div>

        {(undoQ.data?.rows ?? []).filter((u: any) => !u.undone_at).length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-surface-elevated px-3 py-2 text-xs">
            <span className="text-ink-muted">Recent actions:</span>
            {(undoQ.data?.rows ?? []).filter((u: any) => !u.undone_at).map((u: any) => <span key={u.id} className="rounded-sm border border-border px-2 py-0.5">{u.label} · {ukDate(u.created_at)}</span>)}
            <button className={`${btn} ml-auto`} disabled={undo.isPending} onClick={() => { if (confirm(`Undo "${(undoQ.data!.rows ?? []).filter((u: any) => !u.undone_at)[0].label}"?`)) undo.mutate(undefined); }}>{undo.isPending ? "Undoing…" : "Undo last action"}</button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {["quote", "approved", "declined"].includes(a.status) && <button className={btn} onClick={onEdit}>Edit terms</button>}
          {["quote", "declined"].includes(a.status) && <button className={pbtn} onClick={() => act.mutate("approve")}>Approve</button>}
          {a.status === "quote" && <button className={btn} onClick={() => act.mutate("decline")}>Decline</button>}
          {["approved", "sent"].includes(a.status) && <button className={pbtn} onClick={() => act.mutate("send")}>{a.status === "sent" ? "Resend signing link" : "Send for e-signature"}</button>}
          {a.status === "sent" && <button className={btn} onClick={() => { navigator.clipboard?.writeText(signUrl); toast.success("Link copied"); }}>Copy signing link</button>}
          {a.status === "signed" && <button className={pbtn} onClick={() => { if (confirm("Confirm the deposit is received and the motorcycle handed over? This activates the agreement.")) act.mutate("handover"); }}>Hand over &amp; activate</button>}
          {["signed", "active"].includes(a.status) && <button className={btn} onClick={() => { if (confirm("Record that the customer withdrew within 14 days?")) act.mutate("withdraw"); }}>Customer withdrew</button>}
          <Button variant="outline" className={btn} onClick={() => setShowDoc(true)}>Print / PDF agreement</Button>
          <Button variant="outline" className={btn} onClick={() => setShowDoc(true)}>View agreement</Button>
          {isAdmin && a.signed_at && !a.company_signature_data && <Button disabled={signCompany.isPending} onClick={() => { if (confirm(`Sign finance agreement FA-${a.ref_no} for the company using your saved digital signature? This saves your name, signature and signing date on this agreement. It does not activate the agreement or collect payment.`)) signCompany.mutate(); }}>Sign with my saved signature</Button>}
          {!["active", "completed"].includes(a.status) && a.status !== "cancelled" && <button className={btn} onClick={() => { if (confirm("Cancel this agreement?")) act.mutate("cancel"); }}>Cancel</button>}
          {m.paidSum === 0 && <button className={`${btn} text-primary`} onClick={() => { if (confirm("Delete this agreement?")) act.mutate("delete"); }}>Delete</button>}
        </div>

        {["signed", "active"].includes(a.status) && (
          <div className="rounded-sm border border-primary/40 bg-surface-elevated p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Take payment</p>
            <div className="flex flex-wrap items-center gap-2">
              <select className="rounded-sm border border-border bg-input px-2 py-1 text-sm" value={method} onChange={(e) => setMethod(e.target.value as any)}>
                <option value="cash">Cash</option><option value="card_machine">Card machine</option><option value="bank_transfer">Bank transfer</option>
              </select>
              {!depositPaid && a.deposit_pence > 0 && <button className={btn} onClick={() => dep.mutate()} disabled={dep.isPending}>Record deposit {gbp(a.deposit_pence)}</button>}
              {a.status === "active" && m.next && <button className={btn} onClick={() => pay.mutate([m.next.id])} disabled={pay.isPending}>Record next payment {gbp(m.next.amount_pence)}</button>}
              {a.status === "active" && m.overdue.length > 1 && <button className={btn} onClick={() => pay.mutate(m.overdue.map((i: any) => i.id))} disabled={pay.isPending}>Record all overdue {gbp(m.overdueSum)}</button>}
            </div>
            {onlinePaymentsEnabled() && m.outstanding > 0 && (
              <div className="flex flex-wrap gap-2">
                {m.next && <Button className="h-auto min-h-16 max-w-full whitespace-normal rounded-sm px-6 py-3 text-[22px] font-bold leading-snug" disabled={newCard.isPending} onClick={() => newCard.mutate({ instalmentId: m.next.id })}>Card: pay next {gbp(m.next.amount_pence)}</Button>}
                <Button className="h-auto min-h-16 max-w-full whitespace-normal rounded-sm px-6 py-3 text-[22px] font-bold leading-snug" disabled={newCard.isPending} onClick={() => newCard.mutate({ all: true })}>Card: pay full balance {gbp(m.outstanding)}</Button>
              </div>
            )}
          </div>
        )}

        <FinancePhase2 a={a} s={s} />

        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Payment schedule</p>
          <ScheduleTable schedule={a.instalments} actions={["signed", "active", "defaulted"].includes(a.status) ? (r) => r.status !== "due" ? null : (
            <span className="inline-flex gap-1">
              <button className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] uppercase" disabled={pay.isPending} onClick={() => pay.mutate([r.id])}>Record</button>
              {onlinePaymentsEnabled() && <button className="rounded-sm border border-primary px-1.5 py-0.5 text-[10px] uppercase text-primary" disabled={newCard.isPending} onClick={() => newCard.mutate({ instalmentId: r.id })}>Card</button>}
            </span>
          ) : undefined} />
        </div>

        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Transactions &amp; audit trail</p>
          <p className="mb-1 text-[11px] text-ink-muted">Undo actions from the most recent backwards — once one is undone, the one before it can be undone next.</p>
          <div className="max-h-56 overflow-auto rounded-sm border border-border text-xs">
            {(tx.data?.rows ?? []).map((t: any) => {
              const snap = snapByTx[t.id];
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 border-b border-border/50 px-2 py-1">
                  <span>{ukDate(t.created_at)} · {t.kind.replace(/_/g, " ")}{t.method ? ` · ${t.method.replace(/_/g, " ")}` : ""}{t.note ? ` · ${t.note}` : ""}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-semibold">{t.amount_pence ? gbp(t.amount_pence) : ""}</span>
                    {snap && (snap.undone_at
                      ? <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] uppercase text-ink-muted">undone</span>
                      : <button className="rounded-sm border border-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary disabled:opacity-50" disabled={undo.isPending} onClick={() => { if (confirm(`Undo "${snap.label}"?`)) undo.mutate(snap.id); }}>undo</button>)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <AgreementPopup a={a} s={s} open={showDoc} onClose={() => setShowDoc(false)} />
        {secret && <CheckoutOverlay secret={secret} onClose={() => { setSecret(null); setTimeout(refresh, 1500); }} />}
      </div>
    </div>
  );
}

function SettingsForm({ s, canEdit }: { s: any; canEdit: boolean }) {
  const qc = useQueryClient();
  const fn = useServerFn(saveFinanceSettings);
  const [f, setF] = useState<any>({ ...(s ?? {}) });
  const save = useMutation({
    mutationFn: () => fn({ data: {
      company_name: f.company_name ?? "", company_number: f.company_number || null, trading_address: f.trading_address || null,
      registered_address: f.registered_address || null, phone: f.phone || null, email: f.email || null, default_rate_pct: Number(f.default_rate_pct) || 0,
      default_method: f.default_method ?? "reducing", reminder_days_before: Number(f.reminder_days_before) || 0, extra_terms: f.extra_terms || null,
      interest_rebate_enabled: f.interest_rebate_enabled === true,
    } }),
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["finance"] }); qc.invalidateQueries({ queryKey: ["finance-pos"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const field = (k: string, l: string) => <F l={l.toUpperCase()}><input disabled={!canEdit} className={`${inp} ${k === "email" ? "" : "uppercase"}`} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></F>;
  return (
    <div className="space-y-3 rounded-md border border-border bg-surface p-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {field("company_name", "Registered company name")}{field("company_number", "Company registration number")}
        {field("phone", "Phone")}{field("email", "Email")}
        {field("trading_address", "Trading address")}{field("registered_address", "Registered office address")}
        {field("default_rate_pct", "Default interest rate %")}
        <F l="DEFAULT METHOD"><select disabled={!canEdit} className={`${inp} uppercase`} value={f.default_method ?? "reducing"} onChange={(e) => setF({ ...f, default_method: e.target.value })}><option value="reducing">REDUCING BALANCE</option><option value="flat">FLAT RATE</option><option value="zero">INTEREST FREE</option></select></F>
        <div className="flex items-center justify-between gap-3"><label htmlFor="finance-interest-rebate" className="text-xs font-semibold uppercase">INTEREST REBATE · {f.interest_rebate_enabled === true ? "ON" : "OFF"}</label><Switch id="finance-interest-rebate" checked={f.interest_rebate_enabled === true} disabled={!canEdit} onCheckedChange={(v) => setF({ ...f, interest_rebate_enabled: v })} /></div>
      </div>
      <F l="Additional agreement terms (printed on every agreement)"><textarea disabled={!canEdit} rows={5} className={inp} value={f.extra_terms ?? ""} onChange={(e) => setF({ ...f, extra_terms: e.target.value })} /></F>
      {canEdit && <button onClick={() => save.mutate()} disabled={save.isPending} className="rounded-sm bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground">Save settings</button>}
      {canEdit && <AdminSignatureManager />}
    </div>
  );
}

function AgreementDraftButton({ s, canEdit }: { s: any; canEdit: boolean }) {
  const qc = useQueryClient();
  const fn = useServerFn(saveAgreementTemplate);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const sample = useMemo(() => {
    const r = calcFrom({ ...termsFrom({}, s), cash: "3000", dep: "500" });
    return {
      ref_no: "SAMPLE", created_at: new Date().toISOString(), method: s?.default_method ?? "reducing", rate_pct: s?.default_rate_pct ?? 12, frequency: "monthly",
      cash_price_pence: 300000, accessories_pence: 0, fees_pence: 0, deposit_pence: 50000, part_ex_pence: 0, credit_pence: r.creditPence, interest_pence: r.interestPence,
      apr_pct: r.aprPct, instalment_pence: r.instalmentPence, total_payable_pence: r.totalPayablePence,
      customer_snapshot: { full_name: "Sample Customer", address: "1 Sample Road, Sample Town", phone: "07000000000", email: "customer@example.com" },
      vehicle: { make: "Honda", model: "PCX 125", reg: "AB12CDE", year: "2024", mileage: "1000", condition: "Used" },
      instalments: r.schedule.map((x) => ({ seq: x.seq, due_date: x.dueDate, opening_pence: x.openingPence, amount_pence: x.amountPence, interest_pence: x.interestPence, principal_pence: x.principalPence, closing_pence: x.closingPence })),
    };
  }, [s]);
  const save = useMutation({
    mutationFn: (t: string | null) => fn({ data: { template: t } }),
    onSuccess: () => { toast.success("Agreement draft saved — it now applies to every agreement"); qc.invalidateQueries({ queryKey: ["finance"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <>
      <div className="mb-3 flex justify-end">
        <button onClick={() => { setText(s?.agreement_template ?? DEFAULT_AGREEMENT_TEMPLATE); setOpen(true); }} className="rounded-sm border border-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-primary">Agreement Draft</button>
      </div>
      {open && (
        <div className="fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-8" onClick={() => setOpen(false)}>
          <div className="w-full max-w-6xl space-y-3 rounded-md border border-border bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-display text-2xl">Agreement Draft</h2><button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
            <p className="text-xs text-ink-muted">Edit any text. This draft is used for every customer's agreement. "# " = big title, "## " = section heading, **text** = bold, "- Label | Value" = table row. Details filled in automatically: {TEMPLATE_FIELDS.map((f) => `{{${f}}}`).join(" ")}</p>
            <div className="grid gap-3 lg:grid-cols-2">
              <textarea disabled={!canEdit} value={text} onChange={(e) => setText(e.target.value)} className={`${inp} h-[65vh] font-mono text-xs`} />
              <div className="h-[65vh] overflow-auto rounded-sm border border-border"><AgreementDocument a={sample} s={s} template={text} /></div>
            </div>
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => save.mutate(text)} disabled={save.isPending} className="rounded-sm bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground">{save.isPending ? "Saving…" : "Save draft"}</button>
                <button onClick={() => { if (confirm("Reset to the original wording?")) setText(DEFAULT_AGREEMENT_TEMPLATE); }} className="rounded-sm border border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest">Reset to original</button>
              </div>
            ) : <p className="text-sm text-ink-muted">Only owners and admins can edit the agreement draft.</p>}
          </div>
        </div>
      )}
    </>
  );
}

function CheckoutOverlay({ secret, onClose }: { secret: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-10">
      <div className="relative w-full max-w-lg rounded-md bg-white p-4 shadow-xl">
        <button onClick={onClose} className="absolute right-2 top-2 rounded-full bg-black/10 p-1.5 text-black" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret: secret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </div>
  );
}
