import { ukDate, isoDay } from "@/lib/format-date";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AccountShell } from "@/components/AccountShell";
import { useAuth } from "@/lib/auth-client";
import { listLostDamaged, createLostDamaged, deleteLostDamaged } from "@/lib/lost-damaged.functions";
import { listProducts } from "@/lib/pos.functions";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/admin/lost-damaged")({
  head: () => ({ meta: [{ title: `Lost & Damaged — ${BRAND.name}` }] }),
  component: LostDamagedPage,
  errorComponent: ({ error }) => (
    <AccountShell title="Lost & Damaged"><p className="text-sm text-primary">{error.message}</p></AccountShell>
  ),
  notFoundComponent: () => <AccountShell title="Lost & Damaged"><p>Not found</p></AccountShell>,
});

const REASONS = ["lost", "damaged", "theft", "expired", "other"] as const;
const fmt = (p: number) => `£${(p / 100).toFixed(2)}`;

function todayIso() {
  return isoDay();
}

function LostDamagedPage() {
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const listFn = useServerFn(listLostDamaged);
  const createFn = useServerFn(createLostDamaged);
  const deleteFn = useServerFn(deleteLostDamaged);
  const productsFn = useServerFn(listProducts);

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return isoDay(d);
  });
  const [to, setTo] = useState(todayIso());
  const [reasonFilter, setReasonFilter] = useState<"" | (typeof REASONS)[number]>("");

  const { data, isLoading } = useQuery({
    queryKey: ["lost-damaged", from, to, reasonFilter],
    queryFn: () =>
      listFn({ data: { fromDate: from, toDate: to, reason: reasonFilter || undefined } }),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["ld-products"],
    queryFn: () => productsFn({ data: {} }),
    staleTime: 5 * 60_000,
  });

  // Add form
  const [productId, setProductId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitCostPounds, setUnitCostPounds] = useState(0);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("damaged");
  const [notes, setNotes] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayIso());
  const [productSearch, setProductSearch] = useState("");
  const filteredProducts = useMemo(() => {
    const s = productSearch.trim().toLowerCase();
    if (!s) return products as any[];
    return (products as any[]).filter(
      (p) => p.name.toLowerCase().includes(s) || (p.sku ?? "").toLowerCase().includes(s),
    );
  }, [products, productSearch]);
  const [formError, setFormError] = useState<string | null>(null);

  const productMap = useMemo(
    () => new Map((products as any[]).map((p) => [p.id, p])),
    [products],
  );

  function onPickProduct(id: string) {
    setProductId(id);
    const p = productMap.get(id);
    if (p) {
      setDescription(p.name);
      if (typeof p.cost_price_pence === "number") setUnitCostPounds(p.cost_price_pence / 100);
    }
  }

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          productId: productId || null,
          description,
          quantity,
          unitCostPence: Math.round(unitCostPounds * 100),
          reason,
          notes: notes || undefined,
          occurredOn,
        },
      }),
    onSuccess: () => {
      setProductId(""); setDescription(""); setQuantity(1); setUnitCostPounds(0);
      setReason("damaged"); setNotes(""); setOccurredOn(todayIso()); setFormError(null);
      qc.invalidateQueries({ queryKey: ["lost-damaged"] });
    },
    onError: (e: any) => setFormError(e.message ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lost-damaged"] }),
  });

  return (
    <AccountShell title="Lost & Damaged">
      <div className="grid gap-6">
        {/* Filters */}
        <div className="rounded-md border border-border bg-surface-elevated p-4">
          <div className="grid gap-3 sm:grid-cols-4">
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
            <label className="text-[11px] font-semibold uppercase tracking-widest">
              Reason
              <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value as any)}
                className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2 text-sm">
                <option value="">All reasons</option>
                {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <div className="flex items-end">
              <div className="rounded-sm border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
                <p className="eyebrow text-primary">Total loss</p>
                <p className="font-display text-2xl">{fmt(data?.totalPence ?? 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Add form */}
        <div className="rounded-md border border-border bg-surface-elevated p-4">
          <p className="eyebrow mb-3">Record a loss</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="text-[11px] font-semibold uppercase tracking-widest sm:col-span-2 lg:col-span-3">
              <label className="block">
                Product (optional)
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search product by name or SKU…"
                  className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2 text-sm normal-case"
                />
              </label>
              <select value={productId} onChange={(e) => onPickProduct(e.target.value)}
                className="mt-2 w-full rounded-sm border border-border bg-input px-3 py-2 text-sm normal-case">
                <option value="">— free-text —</option>
                {filteredProducts.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>
                ))}
              </select>
              {productSearch && (
                <p className="mt-1 normal-case tracking-normal text-[10px] text-ink-muted">
                  {filteredProducts.length} match{filteredProducts.length === 1 ? "" : "es"}
                </p>
              )}
            </div>
            <label className="text-[11px] font-semibold uppercase tracking-widest sm:col-span-2">
              Description
              <input value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="What was lost/damaged"
                className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-widest">
              Quantity
              <input type="number" min={0.01} step={0.01} value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-widest">
              Unit cost (£)
              <input type="number" min={0} step={0.01} value={unitCostPounds}
                onChange={(e) => setUnitCostPounds(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-widest">
              Reason
              <select value={reason} onChange={(e) => setReason(e.target.value as any)}
                className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2 text-sm">
                {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-widest">
              Occurred on
              <input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)}
                className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-widest sm:col-span-2 lg:col-span-3">
              Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className="mt-1 w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !description || quantity <= 0}
              className="rounded-sm bg-primary px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
            >
              {createMut.isPending ? "Saving…" : "Record loss"}
            </button>
            <p className="text-xs text-ink-muted">Records an entry and, if a product is picked, decrements stock.</p>
          </div>
          {formError && (
            <p className="mt-3 rounded-sm border border-primary/40 bg-primary/5 px-3 py-2 text-sm text-primary">
              {formError}
            </p>
          )}
        </div>

        {/* List */}
        <div className="rounded-md border border-border bg-surface-elevated">
          <div className="border-b border-border px-4 py-3">
            <p className="eyebrow">Entries</p>
          </div>
          {isLoading ? (
            <p className="p-4 text-sm text-ink-muted">Loading…</p>
          ) : !data || data.rows.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">No entries in this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2">Reason</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Unit</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.rows.map((r: any) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2">{ukDate(r.occurred_on)}</td>
                      <td className="px-4 py-2">
                        <div>{r.description}</div>
                        {r.product?.name && <div className="text-xs text-ink-muted">Product: {r.product.name}</div>}
                        {r.notes && <div className="text-xs text-ink-muted">{r.notes}</div>}
                      </td>
                      <td className="px-4 py-2 capitalize">{r.reason}</td>
                      <td className="px-4 py-2 text-right">{r.quantity}</td>
                      <td className="px-4 py-2 text-right">{fmt(r.unit_cost_pence ?? 0)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{fmt(r.total_cost_pence ?? 0)}</td>
                      <td className="px-4 py-2 text-right">
                        {isOwner ? (
                          <button
                            onClick={() => { if (confirm("Delete this entry?")) deleteMut.mutate(r.id); }}
                            className="text-xs text-primary hover:underline"
                          >
                            Delete
                          </button>
                        ) : (
                          <span title="Only the Master Admin can delete lost & damaged entries" className="text-[10px] uppercase tracking-widest text-ink-muted/50">Locked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AccountShell>
  );
}
