import { ukDateTime } from "@/lib/format-date";
import { StaffGuard } from "@/components/StaffGuard";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { printInPlace } from "@/lib/print-in-place";
import { AccountShell } from "@/components/AccountShell";
import { getSaleFull, updateSale } from "@/lib/pos.functions";
import { PosCustomerPicker, type PosCustomerRef } from "@/components/PosCustomerPicker";
import { toLocalInput } from "@/components/SaleInlineEdit";
import { useAuth } from "@/lib/auth-client";
import { isCostHidden, isRestrictedAdmin } from "@/lib/cost-visibility";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/staff/sales/$saleId")({
  head: () => ({ meta: [{ title: `Sale — ${BRAND.name} Staff` }] }),
  component: () => (<StaffGuard perm="sales"><SaleDetailPage /></StaffGuard>),
  errorComponent: ({ error }) => <AccountShell title="Sale"><p className="text-sm text-primary">{error.message}</p></AccountShell>,
  notFoundComponent: () => <AccountShell title="Sale"><p>Not found</p></AccountShell>,
});

const fmt = (p: number) => `£${(p / 100).toFixed(2)}`;
const toP = (s: string) => Math.max(0, Math.round(Number(s || 0) * 100));
const fromP = (p: number) => p === 0 ? "" : String(p / 100);

type ItemDraft = {
  id: string;
  name: string;
  qty: string;
  unit_price: string;
  discount: string;
  cost: string;
  description?: string | null;
};

function SaleDetailPage() {
  const { saleId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const getFn = useServerFn(getSaleFull);
  const updateFn = useServerFn(updateSale);
  const { data, isLoading } = useQuery({ queryKey: ["sale-detail", saleId], queryFn: () => getFn({ data: { saleId } }) });
  const { user } = useAuth();
  const hideCost = isCostHidden(user?.email) || isRestrictedAdmin(user?.email);

  const [editing, setEditing] = useState(false);
  const [payment, setPayment] = useState("cash");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [orderDiscount, setOrderDiscount] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [customer, setCustomer] = useState<PosCustomerRef | null>(null);

  useEffect(() => {
    if (!data) return;
    const s: any = data.sale;
    setPayment(s.payment_method ?? "cash");
    setNotes(s.notes ?? "");
    setDescription(s.description ?? "");
    setOrderDiscount(fromP(s.discount_pence ?? 0));
    setSaleDate(toLocalInput(s.created_at));
    setCustomer(s.pos_customer ?? null);
    setItems((data.items as any[]).map((it) => ({
      mileage: it.mileage ?? null,
      id: it.id,
      name: it.name,
      qty: String(it.qty),
      unit_price: fromP(it.unit_price_pence),
      discount: fromP(it.discount_pence),
      cost: it.cost_price_pence == null ? "" : String(it.cost_price_pence / 100),
      description: it.description ?? null,
    })));
  }, [data]);

  const save = useMutation({
    mutationFn: () => updateFn({
      data: {
        saleId,
        payment_method: payment as any,
        notes: notes || null,
        description: description || null,
        discount_pence: toP(orderDiscount),
        created_at: saleDate ? new Date(saleDate).toISOString() : undefined,
        pos_customer_id: customer?.id ?? null,
        items: items.map((it) => ({
          id: it.id,
          qty: Number(it.qty) || 0,
          unit_price_pence: toP(it.unit_price),
          discount_pence: toP(it.discount),
          cost_price_pence: it.cost.trim() === "" ? null : toP(it.cost),
          name: it.name,
        })),
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sale-detail", saleId] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["receipt", saleId] });
      setEditing(false);
      alert("Sale updated.");
    },
    onError: (e: any) => alert(e?.message ?? "Update failed"),
  });

  if (isLoading || !data) return <AccountShell title="Sale"><p>Loading…</p></AccountShell>;
  const s: any = data.sale;

  const updateItem = (id: string, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  // Live totals
  const linesTotal = items.reduce((sum, it) => {
    const line = Math.max(0, Math.round((Number(it.qty) || 0) * toP(it.unit_price)) - toP(it.discount));
    return sum + line;
  }, 0);
  // Subtotal is the sum of line totals (after per-item discounts), before the order discount.
  const subtotal = linesTotal;
  const total = Math.max(0, linesTotal - toP(orderDiscount));

  return (
    <AccountShell title={`Sale #${s.receipt_no ?? s.id.slice(0, 8)}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-xs">
          <Link to="/staff/sales" className="rounded-sm border border-border px-3 py-2 uppercase tracking-widest hover:border-primary">← Back to sales</Link>
          <button type="button" onClick={() => printInPlace(`/staff/receipt/${saleId}`)} className="rounded-sm border border-border px-3 py-2 uppercase tracking-widest hover:border-primary">Print receipt</button>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <>
              <Link
                to="/staff/pos"
                search={{ editSale: saleId } as any}
                disabled={s.refunded}
                className={`rounded-sm bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground ${s.refunded ? "pointer-events-none opacity-40" : ""}`}
              >
                {s.refunded ? "Refunded — read-only" : "Edit sale in POS"}
              </Link>
              <button
                disabled={s.refunded}
                onClick={() => setEditing(true)}
                className="rounded-sm border border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest hover:border-primary disabled:opacity-40"
              >Quick edit</button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(false)}
                className="rounded-sm border border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest hover:border-primary"
              >Cancel</button>
              <button
                disabled={save.isPending}
                onClick={() => save.mutate()}
                className="rounded-sm bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-40"
              >{save.isPending ? "Saving…" : "Save changes"}</button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-md border border-border bg-surface p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">Line items</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-ink-muted">
                  <th className="py-2 pr-2">Item</th>
                  <th className="py-2 pr-2 w-20">Qty</th>
                  <th className="py-2 pr-2 w-28 text-right">Unit price</th>
                  <th className="py-2 pr-2 w-28 text-right">Discount</th>
                  {!hideCost && <th className="py-2 pr-2 w-28 text-right">Cost</th>}
                  <th className="py-2 pr-2 w-28 text-right">Line total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const line = Math.max(0, Math.round((Number(it.qty) || 0) * toP(it.unit_price)) - toP(it.discount));
                  return (
                    <tr key={it.id} className="border-b border-border/60">
                      <td className="py-2 pr-2">
                        {editing ? (
                          <input value={it.name} onChange={(e) => updateItem(it.id, { name: e.target.value })} className="w-full rounded-sm border border-border bg-input px-2 py-1 text-sm" />
                        ) : (
                          <div>
                            <div>{it.name} {(it as any).mileage ? <span className="ml-1 rounded-sm bg-primary/10 px-1 text-[11px] font-semibold text-primary">{Number((it as any).mileage).toLocaleString("en-GB")} miles</span> : null}</div>
                            {it.description && (
                              <div className="mt-0.5 whitespace-pre-wrap text-[11px] text-ink-muted">{it.description}</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        {editing ? (
                          <input type="number" step="1" min="0" value={it.qty} onChange={(e) => updateItem(it.id, { qty: e.target.value })} className="w-full rounded-sm border border-border bg-input px-2 py-1 text-sm" />
                        ) : it.qty}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {editing ? (
                          <input type="number" step="any" min="0" value={it.unit_price} onChange={(e) => updateItem(it.id, { unit_price: e.target.value })} className="w-24 rounded-sm border border-border bg-input px-2 py-1 text-right text-sm" />
                        ) : fmt(toP(it.unit_price))}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {editing ? (
                          <input type="number" step="any" min="0" value={it.discount} onChange={(e) => updateItem(it.id, { discount: e.target.value })} className="w-24 rounded-sm border border-border bg-input px-2 py-1 text-right text-sm" />
                        ) : fmt(toP(it.discount))}
                      </td>
                      {!hideCost && (
                        <td className="py-2 pr-2 text-right">
                          {editing ? (
                            <input type="number" step="any" min="0" value={it.cost} onChange={(e) => updateItem(it.id, { cost: e.target.value })} className="w-24 rounded-sm border border-border bg-input px-2 py-1 text-right text-sm" />
                          ) : fmt(toP(it.cost))}
                        </td>
                      )}
                      <td className="py-2 pr-2 text-right font-semibold">{fmt(line)}</td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={hideCost ? 5 : 6} className="py-6 text-center text-ink-muted">No line items — {s.description ?? "custom sale"}.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {editing && items.length === 0 && (
            <div className="mt-4">
              <label className="text-[10px] uppercase tracking-widest text-ink-muted">Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-surface p-4 text-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">Customer</h2>
            {editing ? (
              <PosCustomerPicker value={customer} onChange={setCustomer} disabled={save.isPending} />
            ) : customer ? (
              <div>
                <p className="font-semibold">{customer.name}</p>
                <p className="text-xs text-ink-muted">{[customer.phone, customer.email].filter(Boolean).join(" · ")}</p>
              </div>
            ) : (
              <p className="text-ink-muted">Walk-in customer</p>
            )}
          </div>

          <div className="rounded-md border border-border bg-surface p-4 text-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">Summary</h2>
            <div className="space-y-1">
              {editing ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted">Date</span>
                  <input type="datetime-local" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className="rounded-sm border border-border bg-input px-2 py-1 text-sm" />
                </div>
              ) : <Row label="Date" value={ukDateTime(s.created_at)} />}
              <Row label="Status" value={s.refunded ? "Refunded" : "Completed"} />
            </div>
            <hr className="my-3 border-border" />
            <div className="space-y-1">
              <Row label="Subtotal" value={fmt(subtotal)} />
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Order discount</span>
                {editing ? (
                  <input type="number" step="any" min="0" value={orderDiscount} onChange={(e) => setOrderDiscount(e.target.value)} className="w-24 rounded-sm border border-border bg-input px-2 py-1 text-right text-sm" />
                ) : <span>− {fmt(toP(orderDiscount))}</span>}
              </div>
              {s.tax_pence > 0 && <Row label="VAT incl." value={fmt(s.tax_pence)} />}
              <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
                <span>Total</span><span>{fmt(total)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-surface p-4 text-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">Payment & notes</h2>
            <label className="text-[10px] uppercase tracking-widest text-ink-muted">Payment method</label>
            {editing ? (
              <select value={payment} onChange={(e) => setPayment(e.target.value)} className="mt-1 mb-3 w-full rounded-sm border border-border bg-input px-3 py-2 text-sm">
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="split">Split</option>
              </select>
            ) : <p className="mt-1 mb-3 uppercase">{payment}</p>}
            <label className="text-[10px] uppercase tracking-widest text-ink-muted">Notes</label>
            {editing ? (
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" />
            ) : <p className="mt-1 whitespace-pre-wrap">{notes || <span className="text-ink-muted">—</span>}</p>}
          </div>

          {editing && (
            <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-[11px] text-primary">
              Edits update totals and line items only. Stock movements and refunds already recorded are not adjusted.
            </p>
          )}
        </div>
      </div>
    </AccountShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
