import { StaffGuard } from "@/components/StaffGuard";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AccountShell } from "@/components/AccountShell";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCreditSale, listCredit, recordCreditPayment, type CreditCustomer } from "@/lib/credit.functions";
import { ukDate } from "@/lib/format-date";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/staff/credit")({
  head: () => ({ meta: [{ title: `Credit — ${BRAND.name} Staff` }] }),
  component: () => (<StaffGuard perm="pos"><CreditPage /></StaffGuard>),
  errorComponent: ({ error }) => <AccountShell title="Credit"><p className="text-sm text-primary">{error.message}</p></AccountShell>,
});

const gbp = (p: number) => `£${(p / 100).toFixed(2)}`;
const METHOD_LABEL: Record<string, string> = { cash: "Cash", card: "Card", bank_transfer: "Bank transfer" };

const STATUS_STYLE: Record<string, string> = {
  unpaid: "bg-primary text-primary-foreground",
  partial: "bg-primary/25 text-[var(--primary-ink)]",
  paid: "bg-muted text-ink-muted",
};

function CreditPage() {
  const [tab, setTab] = useState<"unpaid" | "paid">("unpaid");
  const [openSale, setOpenSale] = useState<string | null>(null);
  const listFn = useServerFn(listCredit);
  const { data, isLoading } = useQuery({
    queryKey: ["credit", tab],
    queryFn: () => listFn({ data: { tab } }),
  });
  const customers = data?.customers ?? [];

  return (
    <AccountShell title="Credit">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-muted p-1">
          {(["unpaid", "paid"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1.5 text-xs font-semibold uppercase tracking-widest ${tab === t ? "bg-primary text-primary-foreground" : "text-ink-muted"}`}
            >
              {t === "unpaid" ? "Owing" : "Paid off"}
            </button>
          ))}
        </div>
        {tab === "unpaid" && (
          <p className="text-sm">
            Total owed: <strong className="text-lg">{gbp(data?.totalOutstandingPence ?? 0)}</strong>
          </p>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : customers.length === 0 ? (
        <p className="rounded-md border border-border bg-surface p-6 text-center text-sm text-ink-muted">
          {tab === "unpaid"
            ? "Nobody owes anything. Put a sale on credit from the POS with “Credit · pay later”."
            : "No paid-off credit yet."}
        </p>
      ) : (
        <div className="grid gap-3">
          {customers.map((c, i) => (
            <CustomerCard key={c.customer?.id ?? `walkin-${i}`} c={c} onOpen={setOpenSale} />
          ))}
        </div>
      )}

      <Dialog open={openSale !== null} onOpenChange={(o) => { if (!o) setOpenSale(null); }}>
        <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-md">
          {openSale && <SaleCredit saleId={openSale} />}
        </DialogContent>
      </Dialog>
    </AccountShell>
  );
}

function CustomerCard({ c, onOpen }: { c: CreditCustomer; onOpen: (saleId: string) => void }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{c.customer?.name ?? "Unknown customer"}</p>
          {c.customer?.phone && (
            <a href={`tel:${c.customer.phone}`} className="text-xs text-ink-muted hover:underline">{c.customer.phone}</a>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-ink-muted">{c.outstandingPence > 0 ? "Owes" : "Paid"}</p>
          <p className="text-xl font-bold tabular-nums">{gbp(c.outstandingPence > 0 ? c.outstandingPence : c.paidPence)}</p>
          {c.outstandingPence > 0 && c.paidPence > 0 && (
            <p className="text-[11px] text-ink-muted">paid {gbp(c.paidPence)} of {gbp(c.owedPence)}</p>
          )}
        </div>
      </div>
      <div className="mt-3 divide-y divide-border/60 border-t border-border/60">
        {c.sales.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onOpen(s.id)}
            className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:bg-muted/40"
          >
            <span className="min-w-0">
              <span className="font-semibold">#{s.receipt_no ?? "—"}</span>{" "}
              <span className="text-ink-muted">{ukDate(s.created_at)} · {s.description}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="tabular-nums">{gbp(Math.max(0, s.credit_amount_pence - s.credit_paid_pence))} owed</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLE[s.credit_status ?? "unpaid"]}`}>
                {s.credit_status}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SaleCredit({ saleId }: { saleId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getCreditSale);
  const payFn = useServerFn(recordCreditPayment);
  const { data, isLoading } = useQuery({
    queryKey: ["credit-sale", saleId],
    queryFn: () => getFn({ data: { saleId } }),
  });
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "card" | "bank_transfer">("cash");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const sale: any = data?.sale;
  const outstanding = sale ? Math.max(0, sale.credit_amount_pence - sale.credit_paid_pence) : 0;
  const amountPence = Math.round((parseFloat(amount.replace(/[^0-9.]/g, "")) || 0) * 100);

  const pay = useMutation({
    mutationFn: () => payFn({ data: { saleId, amountPence, method, note: note || null } }),
    onSuccess: () => {
      setAmount("");
      setNote("");
      setErr(null);
      qc.invalidateQueries({ queryKey: ["credit"] });
      qc.invalidateQueries({ queryKey: ["credit-sale", saleId] });
      qc.invalidateQueries({ queryKey: ["customer-credit"] });
      qc.invalidateQueries({ queryKey: ["customer-balances"] });
    },
    onError: (e: any) => setErr(e?.message ?? "Could not record the payment"),
  });

  if (isLoading || !sale) {
    return (
      <DialogHeader>
        <DialogTitle>Credit sale</DialogTitle>
        <DialogDescription>Loading…</DialogDescription>
      </DialogHeader>
    );
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Receipt #{sale.receipt_no} · {sale.pos_customer?.name ?? "Customer"}</DialogTitle>
        <DialogDescription>
          {ukDate(sale.created_at)} · total {gbp(sale.credit_amount_pence)}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Figure label="Total" value={gbp(sale.credit_amount_pence)} />
        <Figure label="Paid" value={gbp(sale.credit_paid_pence)} />
        <Figure label="Owed" value={gbp(outstanding)} strong />
      </div>

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Items</p>
        <ul className="text-sm">
          {(data?.items ?? []).map((it: any, i: number) => (
            <li key={i} className="flex justify-between gap-2">
              <span>{it.name}{Number(it.qty) !== 1 ? ` ×${Number(it.qty)}` : ""}</span>
              <span className="tabular-nums">{gbp(it.line_total_pence)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Payments</p>
        {(data?.payments ?? []).length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing paid yet.</p>
        ) : (
          <ul className="text-sm">
            {(data?.payments ?? []).map((p: any) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>
                  {ukDate(p.created_at)} · {METHOD_LABEL[p.method] ?? p.method}
                  {p.note ? <span className="text-ink-muted"> · {p.note}</span> : null}
                </span>
                <span className="tabular-nums">{gbp(p.amount_pence)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {outstanding > 0 && (
        <form
          onSubmit={(e) => { e.preventDefault(); setErr(null); pay.mutate(); }}
          className="grid gap-2 rounded-md border border-border p-3"
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Take a payment</p>
          <div className="flex gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="h-10 min-w-0 flex-1 rounded-sm border border-border bg-input px-3 text-lg font-bold"
            />
            <button
              type="button"
              onClick={() => setAmount((outstanding / 100).toFixed(2))}
              className="rounded-sm border border-border px-3 text-xs font-semibold hover:border-primary"
            >
              All {gbp(outstanding)}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {(["cash", "card", "bank_transfer"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`h-8 rounded-md text-xs font-semibold ${method === m ? "bg-primary text-primary-foreground" : "text-ink-muted"}`}
              >
                {m === "bank_transfer" ? "Bank" : METHOD_LABEL[m]}
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="h-9 rounded-sm border border-border bg-input px-3 text-sm"
          />
          {err && <p className="text-xs text-primary">{err}</p>}
          <button
            disabled={pay.isPending || amountPence <= 0 || amountPence > outstanding}
            className="h-10 rounded-sm bg-primary text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
          >
            {pay.isPending ? "Saving…" : `Record ${gbp(amountPence)} payment`}
          </button>
          {method === "cash" && <p className="text-[11px] text-ink-muted">Cash is added to the open till.</p>}
        </form>
      )}

      <Link to="/staff/sales/$saleId" params={{ saleId }} className="text-center text-xs font-semibold underline">
        Open the full sale
      </Link>
    </div>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-md border p-2 ${strong ? "border-primary bg-primary/15" : "border-border"}`}>
      <p className="text-[10px] uppercase tracking-widest text-ink-muted">{label}</p>
      <p className="text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}
