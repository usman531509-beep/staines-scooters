import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getSaleFull, updateSale } from "@/lib/pos.functions";
import { markSaleEdited } from "@/lib/last-edited-sale";
import { useAuth } from "@/lib/auth-client";
import { isCostHidden, isRestrictedAdmin } from "@/lib/cost-visibility";

const fmt = (p: number) => `£${(p / 100).toFixed(2)}`;
const toP = (s: string) => Math.max(0, Math.round(Number(s || 0) * 100));
const fromP = (p: number) => (p === 0 ? "" : String(p / 100));

/** ISO timestamp -> value for <input type="datetime-local"> in local time. */
export const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

type Draft = { id: string; name: string; qty: string; unit_price: string; discount: string; cost: string };

export function SaleInlineEdit({ saleId, onDone }: { saleId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const hideCost = isCostHidden(user?.email) || isRestrictedAdmin(user?.email);
  const getFn = useServerFn(getSaleFull);
  const updateFn = useServerFn(updateSale);
  const { data, isLoading } = useQuery({ queryKey: ["sale-detail", saleId], queryFn: () => getFn({ data: { saleId } }) });

  const [items, setItems] = useState<Draft[]>([]);
  const [orderDiscount, setOrderDiscount] = useState("");
  const [saleDate, setSaleDate] = useState("");

  useEffect(() => {
    if (!data) return;
    setSaleDate(toLocalInput((data.sale as any).created_at));
    setOrderDiscount(fromP((data.sale as any).discount_pence ?? 0));
    setItems((data.items as any[]).map((it) => ({
      id: it.id,
      name: it.name,
      qty: String(it.qty),
      unit_price: fromP(it.unit_price_pence),
      discount: fromP(it.discount_pence),
      cost: it.cost_price_pence == null ? "" : String(it.cost_price_pence / 100),
    })));
  }, [data]);

  const upd = (id: string, patch: Partial<Draft>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const save = useMutation({
    mutationFn: () => updateFn({
      data: {
        saleId,
        discount_pence: toP(orderDiscount),
        created_at: saleDate ? new Date(saleDate).toISOString() : undefined,
        items: items.map((it) => ({
          id: it.id,
          name: it.name,
          qty: Number(it.qty) || 0,
          unit_price_pence: toP(it.unit_price),
          discount_pence: toP(it.discount),
          cost_price_pence: it.cost.trim() === "" ? null : toP(it.cost),
        })),
      },
    }),
    onSuccess: () => {
      markSaleEdited(saleId);
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["sale-detail", saleId] });
      qc.invalidateQueries({ queryKey: ["receipt", saleId] });
      onDone();
    },
    onError: (e: any) => alert(e?.message ?? "Update failed"),
  });

  if (isLoading) return <p className="p-3 text-xs text-ink-muted">Loading items…</p>;

  const total = Math.max(
    0,
    items.reduce((s, it) => s + Math.max(0, Math.round((Number(it.qty) || 0) * toP(it.unit_price)) - toP(it.discount)), 0) - toP(orderDiscount),
  );

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left uppercase tracking-widest text-ink-muted">
            <th className="pb-2 pr-2">Item</th>
            <th className="pb-2 pr-2 w-16">Qty</th>
            <th className="pb-2 pr-2 w-24 text-right">Price</th>
            <th className="pb-2 pr-2 w-24 text-right">Discount</th>
            {!hideCost && <th className="pb-2 pr-2 w-24 text-right">Cost</th>}
            <th className="pb-2 pr-2 w-24 text-right">Line</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const line = Math.max(0, Math.round((Number(it.qty) || 0) * toP(it.unit_price)) - toP(it.discount));
            return (
              <tr key={it.id}>
                <td className="py-1 pr-2"><input value={it.name} onChange={(e) => upd(it.id, { name: e.target.value })} className="w-full rounded-sm border border-border bg-input px-2 py-1" /></td>
                <td className="py-1 pr-2"><input type="number" min="0" step="1" value={it.qty} onChange={(e) => upd(it.id, { qty: e.target.value })} className="w-full rounded-sm border border-border bg-input px-2 py-1" /></td>
                <td className="py-1 pr-2"><input type="number" min="0" step="any" value={it.unit_price} onChange={(e) => upd(it.id, { unit_price: e.target.value })} className="w-full rounded-sm border border-border bg-input px-2 py-1 text-right" /></td>
                <td className="py-1 pr-2"><input type="number" min="0" step="any" value={it.discount} onChange={(e) => upd(it.id, { discount: e.target.value })} className="w-full rounded-sm border border-border bg-input px-2 py-1 text-right" /></td>
                {!hideCost && <td className="py-1 pr-2"><input type="number" min="0" step="any" value={it.cost} onChange={(e) => upd(it.id, { cost: e.target.value })} className="w-full rounded-sm border border-border bg-input px-2 py-1 text-right" /></td>}
                <td className="py-1 pr-2 text-right font-semibold">{fmt(line)}</td>
              </tr>
            );
          })}
          {items.length === 0 && <tr><td colSpan={hideCost ? 5 : 6} className="py-3 text-center text-ink-muted">No line items.</td></tr>}
        </tbody>
      </table>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
        <span className="text-[11px] uppercase tracking-widest text-ink-muted">Sale date</span>
        <input type="datetime-local" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className="rounded-sm border border-border bg-input px-2 py-1 text-xs" />
        <span className="text-[11px] uppercase tracking-widest text-ink-muted">Order discount</span>
        <input type="number" min="0" step="any" value={orderDiscount} onChange={(e) => setOrderDiscount(e.target.value)} className="w-24 rounded-sm border border-border bg-input px-2 py-1 text-right text-xs" />
        <span className="text-xs font-semibold">Total {fmt(total)}</span>
        <button onClick={onDone} className="rounded-sm border border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest hover:border-primary">Cancel</button>
        <button disabled={save.isPending} onClick={() => save.mutate()} className="rounded-sm bg-primary px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-40">
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
