import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Item = { name: string; retail_price_pence: number; cost_price_pence: number };

const toPence = (v: string | undefined) => {
  const n = Number((v ?? "").replace(/[£,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};

/** One product per line: "Name, price" or "Name, price, cost" (prices optional). */
export function parseBulkProducts(text: string): Item[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      return { name: parts[0].slice(0, 120), retail_price_pence: toPence(parts[1]), cost_price_pence: toPence(parts[2]) };
    })
    .filter((it) => it.name);
}

/** Adds many products to one category at once from a pasted list. */
export function BulkProductsDialog({
  categories,
  saving,
  onCancel,
  onSave,
}: {
  categories: any[];
  saving: boolean;
  onCancel: () => void;
  onSave: (v: { category_id: string | null; is_service: boolean; items: Item[] }) => void;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [isService, setIsService] = useState(false);
  const [text, setText] = useState("");
  const items = useMemo(() => parseBulkProducts(text), [text]);
  const fmt = (p: number) => (p ? `£${(p / 100).toFixed(2)}` : "—");
  const options = useMemo(() => categoryOptions(categories), [categories]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-2 sm:p-4">
      <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-md border border-border bg-surface px-5 pb-5">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface py-4">
          <h2 className="font-display text-2xl uppercase">Bulk add products</h2>
          <Button variant="outline" size="icon" aria-label="Close" onClick={onCancel}><X /></Button>
        </div>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
            Category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded-sm border border-border bg-input px-3 py-2 text-sm normal-case tracking-normal text-foreground">
              <option value="">— none —</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
            Products — one per line: name, price, cost (price and cost optional)
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder={"100/80-16 Tyre, 45\n110/70-14 Tyre, 50, 32\nInner tube 10 inch"}
              className="rounded-sm border border-border bg-input px-3 py-2 font-mono text-sm normal-case tracking-normal text-foreground"
            />
          </label>
          <label className="flex items-center gap-2 text-xs uppercase tracking-widest">
            <input type="checkbox" checked={isService} onChange={(e) => setIsService(e.target.checked)} /> Services (no stock)
          </label>
          {items.length > 0 && (
            <div className="max-h-56 overflow-auto rounded-sm border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-elevated text-[10px] uppercase tracking-widest text-ink-muted">
                  <tr><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Cost</th></tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-1.5">{it.name}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmt(it.retail_price_pence)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmt(it.cost_price_pence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-ink-muted">Stock starts at 0; receive stock in Stock / Inventory as usual.</p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            disabled={saving || items.length === 0 || items.length > 500}
            onClick={() => onSave({ category_id: categoryId || null, is_service: isService, items })}
          >
            {saving ? "Adding…" : `Add ${items.length || ""} product${items.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Categories with subcategories listed under their parent as "Parent › Child". */
export function categoryOptions(categories: any[]) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return categories
    .map((c) => ({ id: c.id as string, label: c.parent_id && byId.get(c.parent_id) ? `${byId.get(c.parent_id).name} › ${c.name}` : (c.name as string) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
