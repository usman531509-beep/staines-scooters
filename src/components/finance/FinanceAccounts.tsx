import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { gbp } from "@/lib/finance-calc";
import { ukDate } from "@/lib/format-date";
import { printElement } from "@/components/finance/AgreementDocument";
import { FINANCE_PERMS } from "@/lib/finance-perms";
import { getFinanceAccounts, saveFinanceReconciliation, getFinancePermissions, saveFinancePermissions } from "@/lib/finance-ops.functions";

const btn = "rounded-sm border border-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest disabled:opacity-50";
const pbtn = "rounded-sm bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50";
const inp = "rounded-sm border border-border bg-input px-2 py-1 text-sm";
const iso = (d: Date) => d.toISOString().slice(0, 10);
const CASH_IN = new Set(["deposit", "instalment_payment", "early_settlement", "termination_payment", "recovery_sale"]);

/** Double-entry postings derived from each immutable finance transaction. */
function postings(t: any): { acc: string; dr: number; cr: number }[] {
  const a = t.amount_pence, p = t.principal_pence, i = t.interest_pence;
  const cash = t.method === "card_on_file" ? "Bank — Stripe" : t.method === "cash" ? "Cash" : t.method === "card_machine" ? "Bank — card machine" : "Bank";
  switch (t.kind) {
    case "deposit": return [{ acc: cash, dr: a, cr: 0 }, { acc: "Vehicle sales (deposits)", dr: 0, cr: a }];
    case "instalment_payment":
    case "early_settlement": return [{ acc: cash, dr: a, cr: 0 }, { acc: "Finance receivables", dr: 0, cr: p }, { acc: "Interest income", dr: 0, cr: i }];
    case "termination_payment":
    case "recovery_sale": return [{ acc: cash, dr: a, cr: 0 }, { acc: "Finance receivables", dr: 0, cr: a }];
    case "recovery_costs": return [{ acc: "Recovery costs", dr: a, cr: 0 }, { acc: "Bank", dr: 0, cr: a }];
    case "write_off": return [{ acc: "Bad debt expense", dr: a, cr: 0 }, { acc: "Finance receivables", dr: 0, cr: a }];
    case "surplus_due_to_customer": return [{ acc: "Finance receivables", dr: a, cr: 0 }, { acc: "Customer refunds payable", dr: 0, cr: a }];
    default: return [];
  }
}

export function FinanceAccounts() {
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))));
  const [to, setTo] = useState(iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))));
  const [view, setView] = useState<"P&L" | "Balance sheet" | "Cash flow" | "Ledger" | "Reconciliation">("P&L");
  const fn = useServerFn(getFinanceAccounts);
  const q = useQuery({ queryKey: ["finance-accounts", from, to], queryFn: () => fn({ data: { from, to } }) });
  const ref = useRef<HTMLDivElement>(null);
  const d: any = q.data;
  const r = useMemo(() => {
    if (!d) return null;
    const tx = d.tx as any[];
    const sum = (k: string, f: (t: any) => number = (t) => t.amount_pence) => tx.filter((t) => t.kind === k).reduce((s, t) => s + f(t), 0);
    const interest = sum("instalment_payment", (t) => t.interest_pence) + sum("early_settlement", (t) => t.interest_pence);
    const writeOffs = sum("write_off"), recCosts = sum("recovery_costs"), rebates = sum("settlement_rebate");
    const advancedInPeriod = (d.agreements as any[]).filter((a) => a.company_signed_at && a.company_signed_at.slice(0, 10) >= from && a.company_signed_at.slice(0, 10) <= to).reduce((s, a) => s + a.credit_pence, 0);
    const receivable = (d.dueInstalments as any[]).filter((i) => (d.agreements as any[]).some((a) => a.id === i.agreement_id && ["active", "defaulted", "terminated", "recovered"].includes(a.status))).reduce((s, i) => s + i.principal_pence, 0);
    const unearned = (d.dueInstalments as any[]).filter((i) => (d.agreements as any[]).some((a) => a.id === i.agreement_id && ["active", "defaulted"].includes(a.status))).reduce((s, i) => s + i.interest_pence, 0);
    const byMethod: Record<string, number> = {};
    for (const t of tx) if (CASH_IN.has(t.kind)) byMethod[t.method ?? "unknown"] = (byMethod[t.method ?? "unknown"] ?? 0) + t.amount_pence;
    const cashIn = Object.values(byMethod).reduce((s, v) => s + v, 0);
    const ledger = tx.flatMap((t) => postings(t).filter((p) => p.dr || p.cr).map((p) => ({ ...p, t })));
    const tb: Record<string, { dr: number; cr: number }> = {};
    for (const l of ledger) { tb[l.acc] ??= { dr: 0, cr: 0 }; tb[l.acc].dr += l.dr; tb[l.acc].cr += l.cr; }
    return {
      interest, writeOffs, recCosts, rebates, net: interest - writeOffs - recCosts, advancedInPeriod, receivable, unearned, byMethod, cashIn, ledger, tb,
      principalIn: sum("instalment_payment", (t) => t.principal_pence) + sum("early_settlement", (t) => t.principal_pence) + sum("termination_payment") + sum("recovery_sale"),
      deposits: sum("deposit"),
    };
  }, [d, from, to]);
  const Row = ({ l, v, b }: { l: string; v: number; b?: boolean }) => <div className={`flex justify-between border-b border-border/50 py-1 ${b ? "font-bold" : ""}`}><span>{l}</span><span>{gbp(v)}</span></div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" className={inp} value={from} onChange={(e) => setFrom(e.target.value)} /> to <input type="date" className={inp} value={to} onChange={(e) => setTo(e.target.value)} />
        {(["P&L", "Balance sheet", "Cash flow", "Ledger", "Reconciliation"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={view === v ? pbtn : btn}>{v}</button>)}
        <button className={`${btn} ml-auto`} onClick={() => printElement(ref.current, `Finance ${view} ${from} to ${to}`)}>Print / PDF</button>
      </div>
      {q.isLoading && <p className="text-sm text-ink-muted">Loading…</p>}
      {q.error && <p className="text-sm text-primary">{(q.error as Error).message}</p>}
      {r && (
        <div ref={ref} className="rounded-md border border-border bg-surface-elevated p-4 text-sm">
          <p className="mb-2 font-display text-xl">{view} · {ukDate(from)} – {ukDate(to)}</p>
          {view === "P&L" && (<>
            <Row l="Interest income (charges for credit received)" v={r.interest} />
            <Row l="Less: bad debt write-offs" v={-r.writeOffs} />
            <Row l="Less: recovery costs" v={-r.recCosts} />
            <Row l="Net finance profit" v={r.net} b />
            <p className="mt-2 text-xs text-ink-muted">Memo: interest rebated on early settlements {gbp(r.rebates)} (not charged, so not income). Vehicle sale margin is reported in the main Sales accounts.</p>
          </>)}
          {view === "Balance sheet" && (<>
            <p className="text-xs uppercase text-ink-muted">As at today</p>
            <Row l="Finance receivables (principal outstanding)" v={r.receivable} b />
            <Row l="Unearned interest on live agreements (memo)" v={r.unearned} />
            <Row l="Gross amount still due from customers" v={r.receivable + r.unearned} />
          </>)}
          {view === "Cash flow" && (<>
            <Row l="Deposits received" v={r.deposits} />
            <Row l="Principal repaid" v={r.principalIn - 0} />
            <Row l="Interest received" v={r.interest} />
            <Row l="Recovery costs paid" v={-r.recCosts} />
            <Row l="Credit advanced (vehicles handed over on finance)" v={-r.advancedInPeriod} />
            <Row l="Net finance cash flow" v={r.deposits + r.principalIn + r.interest - r.recCosts - r.advancedInPeriod} b />
          </>)}
          {view === "Ledger" && (<>
            <table className="w-full text-xs"><thead><tr className="text-left text-ink-muted"><th>Date</th><th>Ref</th><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
              <tbody>{r.ledger.map((l: any, i: number) => <tr key={i} className="border-b border-border/40"><td>{ukDate(l.t.created_at)}</td><td>FA-{d.agreements.find((a: any) => a.id === l.t.agreement_id)?.ref_no} {l.t.kind.replace(/_/g, " ")}</td><td>{l.acc}</td><td className="text-right">{l.dr ? gbp(l.dr) : ""}</td><td className="text-right">{l.cr ? gbp(l.cr) : ""}</td></tr>)}</tbody></table>
            <p className="mt-3 font-semibold">Trial balance</p>
            {Object.entries(r.tb).map(([k, v]: any) => <div key={k} className="flex justify-between text-xs"><span>{k}</span><span>Dr {gbp(v.dr)} · Cr {gbp(v.cr)}</span></div>)}
          </>)}
          {view === "Reconciliation" && <Reconcile from={from} to={to} byMethod={r.byMethod} history={d.reconciliations} />}
        </div>
      )}
    </div>
  );
}

function Reconcile({ from, to, byMethod, history }: { from: string; to: string; byMethod: Record<string, number>; history: any[] }) {
  const qc = useQueryClient();
  const fn = useServerFn(saveFinanceReconciliation);
  const [actual, setActual] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (m: string) => fn({ data: { from, to, method: m, expectedPence: byMethod[m] ?? 0, actualPence: Math.round((parseFloat(actual[m] || "0") || 0) * 100) } }),
    onSuccess: () => { toast.success("Reconciliation saved"); qc.invalidateQueries({ queryKey: ["finance-accounts"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const methods = Array.from(new Set(["card_on_file", "card_machine", "cash", "bank_transfer", ...Object.keys(byMethod)]));
  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-muted">Enter what actually arrived (Stripe payout report, card-machine statement, cash counted, bank statement) to compare with recorded finance receipts.</p>
      {methods.map((m) => {
        const diff = Math.round((parseFloat(actual[m] || "0") || 0) * 100) - (byMethod[m] ?? 0);
        return (
          <div key={m} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="w-32 capitalize">{m.replace(/_/g, " ")}</span><span className="w-28">recorded {gbp(byMethod[m] ?? 0)}</span>
            <input className={`${inp} w-28`} placeholder="Actual £" value={actual[m] ?? ""} onChange={(e) => setActual({ ...actual, [m]: e.target.value })} />
            {actual[m] && <span className={diff === 0 ? "text-primary" : ""}>{diff === 0 ? "Matches ✓" : `Difference ${gbp(diff)}`}</span>}
            <button className={btn} disabled={!actual[m] || save.isPending} onClick={() => save.mutate(m)}>Save</button>
          </div>
        );
      })}
      <p className="pt-2 font-semibold">History</p>
      {history.map((h) => <div key={h.id} className="flex justify-between text-xs"><span>{ukDate(h.period_from)}–{ukDate(h.period_to)} · {h.method.replace(/_/g, " ")}</span><span>expected {gbp(h.expected_pence)} · actual {gbp(h.actual_pence)} · {h.actual_pence === h.expected_pence ? "✓" : `diff ${gbp(h.actual_pence - h.expected_pence)}`}</span></div>)}
    </div>
  );
}

export function FinanceCompliance({ all, settings, onOpen }: { all: any[]; settings: any; onOpen: (id: string) => void }) {
  const t = iso(new Date());
  const checks: { label: string; ok: boolean; items?: any[] }[] = [];
  checks.push({ label: "Company number & registered address set", ok: !!settings?.company_number && !!settings?.registered_address });
  const live = all.filter((a) => ["active", "defaulted"].includes(a.status));
  const missed = (a: any) => (a.instalments ?? []).filter((i: any) => i.status === "due" && i.due_date < t).length;
  checks.push({ label: "Agreements needing a NOSIA (2 monthly / 4 weekly missed)", ok: false, items: live.filter((a) => missed(a) >= (a.frequency === "weekly" ? 4 : 2)) });
  checks.push({ label: "Active agreements without a customer signature", ok: false, items: live.filter((a) => !a.signed_at) });
  checks.push({ label: "Agreements still inside the 14-day withdrawal period", ok: false, items: all.filter((a) => a.withdrawal_deadline && a.withdrawal_deadline >= t && ["signed", "active"].includes(a.status)) });
  checks.push({ label: "Awaiting signature for more than 7 days", ok: false, items: all.filter((a) => a.status === "sent" && (Date.now() - Date.parse(a.updated_at)) > 7 * 86400000) });
  return (
    <div className="space-y-2">
      {checks.map((c) => {
        const good = c.items ? c.items.length === 0 : c.ok;
        return (
          <div key={c.label} className="rounded-md border border-border bg-surface-elevated p-3">
            <p className="text-sm"><span className={good ? "text-primary" : "font-bold"}>{good ? "✓" : "!"}</span> {c.label}{c.items ? ` — ${c.items.length}` : ""}</p>
            {c.items?.map((a) => <button key={a.id} onClick={() => onOpen(a.id)} className="mr-2 mt-1 text-xs underline">FA-{a.ref_no} {a.customer_snapshot?.full_name}</button>)}
          </div>
        );
      })}
      <p className="text-xs text-ink-muted">Direct Debit collection is not connected yet — it needs a Direct Debit provider account (e.g. GoCardless).</p>
    </div>
  );
}

export function FinancePermissions() {
  const qc = useQueryClient();
  const fn = useServerFn(getFinancePermissions);
  const saveFn = useServerFn(saveFinancePermissions);
  const q = useQuery({ queryKey: ["finance-perms"], queryFn: () => fn() });
  const save = useMutation({ mutationFn: (v: { userId: string; perms: string[] }) => saveFn({ data: v }), onSuccess: () => { toast.success("Permissions saved"); qc.invalidateQueries({ queryKey: ["finance-perms"] }); }, onError: (e: any) => toast.error(e.message) });
  if (q.error) return <p className="text-sm text-primary">{(q.error as Error).message}</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-muted">Owners and admins always have full access. Staff without saved permissions can do everything except approve/cancel/delete.</p>
      {(q.data?.users ?? []).map((u: any) => {
        const cur: string[] = u.perms ?? FINANCE_PERMS.map(([k]) => k).filter((k) => k !== "approve");
        return (
          <div key={u.id} className="rounded-md border border-border bg-surface-elevated p-3">
            <p className="text-sm font-semibold">{u.name || u.email} <span className="text-xs text-ink-muted">{u.email} · {u.isAdmin ? "admin (full access)" : u.perms ? "custom" : "default staff"}</span></p>
            {!u.isAdmin && (
              <div className="mt-1 flex flex-wrap gap-3">
                {FINANCE_PERMS.map(([k, l]) => (
                  <label key={k} className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={cur.includes(k)} disabled={save.isPending} onChange={(e) => save.mutate({ userId: u.id, perms: e.target.checked ? [...cur, k] : cur.filter((x) => x !== k) })} /> {l}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
