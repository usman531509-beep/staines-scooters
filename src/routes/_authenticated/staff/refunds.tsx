import { ukDate } from "@/lib/format-date";
import { StaffGuard } from "@/components/StaffGuard";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AccountShell } from "@/components/AccountShell";
import { SectionRecycleBin } from "@/components/SectionRecycleBin";
import { Trash2 } from "lucide-react";
import { listRefunds, createRefund, deleteRefund } from "@/lib/garage.functions";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/staff/refunds")({
  head: () => ({ meta: [{ title: `Refunds — ${BRAND.name} Staff` }] }),
  component: () => (<StaffGuard perm="refunds"><RefundsPage /></StaffGuard>),
  errorComponent: ({ error }) => <AccountShell title="Refunds"><p className="text-sm text-primary">{error.message}</p></AccountShell>,
  notFoundComponent: () => <AccountShell title="Refunds"><p>Not found</p></AccountShell>,
});

function RefundsPage() {
  const list = useServerFn(listRefunds);
  const create = useServerFn(createRefund);
  const del = useServerFn(deleteRefund);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["refunds"], queryFn: () => list() });
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ amount: "", payment_method: "cash", reason: "", notes: "" });

  async function save() {
    const amount_pence = Math.round(Number(form.amount) * 100);
    if (!amount_pence || amount_pence <= 0) return;
    await create({ data: { amount_pence, payment_method: form.payment_method, reason: form.reason, notes: form.notes, items: [] } });
    setForm({ amount: "", payment_method: "cash", reason: "", notes: "" });
    setShow(false);
    qc.invalidateQueries({ queryKey: ["refunds"] });
  }

  return (
    <AccountShell title="Refunds">
      <SectionRecycleBin type="refunds" invalidateKeys={[["refunds"]]} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => setShow(!show)} className="rounded-sm bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground">{show ? "Cancel" : "+ Record refund"}</button>
      </div>
      {show && (
        <div className="mb-6 rounded-md border border-border bg-surface-elevated p-4 grid gap-2 sm:grid-cols-2">
          <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount £" className="rounded-sm border border-border bg-input px-3 py-2 text-sm" />
          <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="rounded-sm border border-border bg-input px-3 py-2 text-sm">
            <option value="cash">Cash</option><option value="card">Card</option><option value="bank">Bank Transfer</option>
          </select>
          <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason" className="rounded-sm border border-border bg-input px-3 py-2 text-sm sm:col-span-2" />
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className="rounded-sm border border-border bg-input px-3 py-2 text-sm sm:col-span-2" />
          <button onClick={save} className="sm:col-span-2 rounded-sm bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground">Save refund</button>
        </div>
      )}
      {isLoading ? <p>Loading…</p> : (
        <div className="overflow-hidden rounded-md border border-border bg-surface-elevated">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase tracking-widest text-ink-muted"><tr><th className="px-4 py-3 text-left">Refund #</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Method</th><th className="px-4 py-3 text-left">Reason</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3"></th></tr></thead>
            <tbody>
              {(data ?? []).map((r: any) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs">{r.refund_number}</td>
                  <td className="px-4 py-3">{ukDate(r.created_at)}</td>
                  <td className="px-4 py-3">{r.payment_method}</td>
                  <td className="px-4 py-3">{r.reason ?? "—"}</td>
                  <td className="px-4 py-3 text-right">£{(r.amount_pence/100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={async () => { if (confirm("Move this refund to the Recycle Bin?")) { await del({ data: { id: r.id } }); qc.invalidateQueries({ queryKey: ["refunds"] }); qc.invalidateQueries({ queryKey: ["recycle", "refunds"] }); } }}
                      className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-ink-muted hover:text-primary"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AccountShell>
  );
}
