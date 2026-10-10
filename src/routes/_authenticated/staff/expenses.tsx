import { ukDate, isoDay } from "@/lib/format-date";
import { StaffGuard } from "@/components/StaffGuard";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AccountShell } from "@/components/AccountShell";
import { SectionRecycleBin } from "@/components/SectionRecycleBin";
import { listExpenses, upsertExpense, deleteExpense } from "@/lib/garage.functions";
import { useAuth } from "@/lib/auth-client";
import { isExpenseDeleteBlocked } from "@/lib/expense-delete-guard";
import { isRestrictedAdmin } from "@/lib/cost-visibility";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/staff/expenses")({
  head: () => ({ meta: [{ title: `Expenses — ${BRAND.name} Staff` }] }),
  component: () => (<StaffGuard perm="expenses"><ExpensesPage /></StaffGuard>),
  errorComponent: ({ error }) => <AccountShell title="Expenses"><p className="text-sm text-primary">{error.message}</p></AccountShell>,
  notFoundComponent: () => <AccountShell title="Expenses"><p>Not found</p></AccountShell>,
});

const TYPES = ["Other", "Rent", "Utilities"] as const;
type ExpType = (typeof TYPES)[number];

type FormState = {
  id?: string;
  name: string;
  amount: string;
  expense_date: string;
  category: ExpType;
  recurrence: "none" | "weekly" | "monthly";
};

const today = () => isoDay();
const empty = (): FormState => ({
  name: "", amount: "", expense_date: today(), category: "Other", recurrence: "none",
});

function ExpensesPage() {
  const { isAdmin, user } = useAuth();
  const restricted = isRestrictedAdmin(user?.email);
  const canDelete = !isExpenseDeleteBlocked(user?.email) && !restricted;
  const list = useServerFn(listExpenses);
  const upsert = useServerFn(upsertExpense);
  const del = useServerFn(deleteExpense);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["expenses"], queryFn: () => list() });
  const [form, setForm] = useState<FormState>(empty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState<string>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  async function save() {
    setErr(null);
    const amount_pence = Math.round(Number(form.amount) * 100);
    if (!form.name.trim() || !amount_pence) { setErr("Enter a name and cost."); return; }
    setBusy(true);
    try {
      await upsert({ data: {
        id: form.id,
        category: form.category,
        description: form.name.trim(),
        vendor: null,
        amount_pence,
        tax_pence: 0,
        payment_method: "card",
        expense_date: form.expense_date,
        notes: null,
        recurrence: form.recurrence,
      } });
      setForm(empty());
      qc.invalidateQueries({ queryKey: ["expenses"] });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally { setBusy(false); }
  }

  function edit(e: any) {
    setForm({
      id: e.id,
      name: e.description ?? e.vendor ?? "",
      amount: ((e.amount_pence ?? 0) / 100).toFixed(2),
      expense_date: e.expense_date,
      category: (TYPES as readonly string[]).includes(e.category) ? e.category : "Other",
      recurrence: (e.recurrence ?? "none") as FormState["recurrence"],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id: string) {
    if (!confirm("Move this expense to the Recycle Bin?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["recycle", "expenses"] });
  }

  return (
    <AccountShell title="Expenses">
      {!restricted && <SectionRecycleBin type="expenses" invalidateKeys={[["expenses"]]} />}

      <div className="mb-4 rounded-md border border-border bg-surface-elevated p-4 grid gap-3">
        <div className="flex items-center justify-between">
          <p className="eyebrow">{form.id ? "Edit expense" : "Add expense"}</p>
          {form.id && (
            <button onClick={() => setForm(empty())} className="text-[11px] uppercase tracking-widest text-ink-muted hover:text-primary">Cancel</button>
          )}
        </div>
        <label className="text-[11px] font-semibold uppercase tracking-widest">
          Expense name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Shop rent" className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2.5 text-base normal-case" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[11px] font-semibold uppercase tracking-widest">
            Expense cost (£)
            <input inputMode="decimal" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2.5 text-base" />
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-widest">
            Expense date
            <input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2.5 text-base" />
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-widest">
            Type of expense
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpType })} className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2.5 text-base normal-case">
              {TYPES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-widest">
            Repeat
            <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value as FormState["recurrence"] })} className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2.5 text-base normal-case">
              <option value="none">Doesn't repeat</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
            </select>
          </label>
        </div>
        {form.recurrence !== "none" && (
          <p className="text-xs text-ink-muted">This expense will be added automatically every {form.recurrence === "weekly" ? "week" : "month"} from the date above.</p>
        )}
        {err && <p className="rounded-sm border border-primary/40 bg-primary/5 px-3 py-2 text-sm text-primary">{err}</p>}
        <button onClick={save} disabled={busy} className="rounded-sm bg-primary px-4 py-3 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50">
          {busy ? "Saving…" : form.id ? "Save changes" : "Add expense"}
        </button>
      </div>

      {isLoading ? <p>Loading…</p> : (() => {
        const all: any[] = data ?? [];
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const iso = (d: Date) => isoDay(d);
        const ranges: Record<string, { from: string; to: string } | null> = {
          all: null,
          this_month: { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) },
          last_month: { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) },
          this_year: { from: `${y}-01-01`, to: `${y}-12-31` },
          last_year: { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
          custom: { from: customFrom, to: customTo },
        };
        const r = ranges[preset];
        const q = search.trim().toLowerCase();
        const filtered = all.filter((e) => {
          if (q) {
            const hay = `${e.description ?? ""} ${e.vendor ?? ""} ${e.category ?? ""} ${e.notes ?? ""}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          if (r) {
            if (r.from && e.expense_date < r.from) return false;
            if (r.to && e.expense_date > r.to) return false;
          }
          return true;
        });
        const total = filtered.reduce((s, e) => s + (e.amount_pence ?? 0), 0);
        return (
        <div className="grid gap-2">
          <div className="rounded-md border border-border bg-surface-elevated p-3 grid gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, vendor, category, notes…"
              className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-1.5">
              {([
                ["all", "All time"],
                ["this_month", "This month"],
                ["last_month", "Last month"],
                ["this_year", "This year"],
                ["last_year", "Last year"],
                ["custom", "Custom"],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setPreset(k)}
                  className={`rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-widest ${preset === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}
                >{label}</button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-sm border border-border bg-input px-2 py-1.5 text-sm" />
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-sm border border-border bg-input px-2 py-1.5 text-sm" />
              </div>
            )}
            <div className="text-xs text-ink-muted">{filtered.length} of {all.length}</div>
          </div>

          <div className="rounded-md border-2 border-yellow-500 bg-yellow-500/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Total expenses{r?.from || r?.to ? ` · ${r?.from ? ukDate(r.from) : "start"} – ${r?.to ? ukDate(r.to) : "today"}` : " · all time"}
            </p>
            <p className="mt-1 text-3xl font-semibold">£{(total / 100).toFixed(2)}</p>
          </div>

          {filtered.length === 0 && <p className="text-sm text-ink-muted">No expenses match.</p>}
          {filtered.map((e: any) => (
            <div key={e.id} className="rounded-md border border-border bg-surface-elevated p-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{e.description || e.vendor || "—"}</p>
                  <span className="rounded-sm bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-ink-muted">{e.category}</span>
                  {e.is_template && (
                    <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-primary">Repeats {e.recurrence}</span>
                  )}
                  {e.template_id && (
                    <span className="rounded-sm bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-ink-muted">Auto</span>
                  )}
                </div>
                <p className="text-xs text-ink-muted">{ukDate(e.expense_date)}</p>
              </div>
              <p className="font-semibold whitespace-nowrap">£{(e.amount_pence / 100).toFixed(2)}</p>
              {restricted ? null : isAdmin ? (
                <div className="flex gap-2">
                  <button onClick={() => edit(e)} className="rounded-sm border border-border px-3 py-1.5 text-xs uppercase tracking-widest hover:border-primary">Edit</button>
                  {canDelete && (
                    <button onClick={() => remove(e.id)} className="rounded-sm border border-border px-3 py-1.5 text-xs uppercase tracking-widest text-ink-muted hover:text-primary hover:border-primary">Delete</button>
                  )}
                </div>
              ) : (
                <span className="text-[10px] uppercase tracking-widest text-ink-muted/50">Locked</span>
              )}
            </div>
          ))}
        </div>
        );
      })()}

    </AccountShell>
  );
}
