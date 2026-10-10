import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { AccountShell } from "@/components/AccountShell";
import { StaffGuard } from "@/components/StaffGuard";
import { listProducts } from "@/lib/pos.functions";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/staff/sales/new")({
  head: () => ({
    meta: [
      { title: `Add New Sale — ${BRAND.name}` },
      { name: "description", content: "Record a sale manually: choose the date, products, costs and notes." },
      { property: "og:title", content: `Add New Sale — ${BRAND.name}` },
      { property: "og:description", content: "Record a sale manually with date, products and costs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (<StaffGuard perm="sales"><AddSalePage /></StaffGuard>),
  errorComponent: ({ error }) => <AccountShell title="Add New Sale"><p className="text-sm text-primary">{error.message}</p></AccountShell>,
  notFoundComponent: () => <AccountShell title="Add New Sale"><p>Not found</p></AccountShell>,
});

function money(pence: number) { return `£${(pence / 100).toFixed(2)}`; }
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type Line = {
  key: string;
  productId: string | null;
  name: string;
  qty: string;
  cost: string;   // pounds
  price: string;  // pounds
  discount: string; // pounds
};

const newLine = (): Line => ({
  key: crypto.randomUUID(),
  productId: null,
  name: "",
  qty: "1",
  cost: "",
  price: "",
  discount: "",
});

const pence = (v: string) => Math.max(0, Math.round((Number(v) || 0) * 100));

const inputCls =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted";

function AddSalePage() {
  const navigate = useNavigate();
  const products = useServerFn(listProducts);

  const [saleDate, setSaleDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);

  const productList = useQuery({
    queryKey: ["products", "all-active"],
    queryFn: () => products({ data: {} }),
  });

  const totals = useMemo(() => {
    let subtotal = 0, cost = 0, discount = 0;
    for (const l of lines) {
      const qty = Number(l.qty) || 0;
      subtotal += Math.round(pence(l.price) * qty);
      cost += Math.round(pence(l.cost) * qty);
      discount += pence(l.discount);
    }
    const total = Math.max(0, subtotal - discount);
    return { subtotal, cost, discount, total, profit: total - cost };
  }, [lines]);

  const patch = (key: string, p: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));

  const pickProduct = (key: string, productId: string) => {
    const p = (productList.data as any[] | undefined)?.find((x) => x.id === productId);
    if (!p) { patch(key, { productId: null }); return; }
    patch(key, {
      productId: p.id,
      name: p.name,
      price: ((p.retail_price_pence ?? 0) / 100).toFixed(2),
      cost: p.cost_price_pence != null ? (p.cost_price_pence / 100).toFixed(2) : "",
    });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const items = lines
        .filter((l) => l.name.trim() && (Number(l.qty) || 0) > 0)
        .map((l) => ({
          productId: l.productId,
          name: l.name.trim(),
          qty: Number(l.qty),
          unitPricePence: pence(l.price),
          costPricePence: l.cost.trim() ? pence(l.cost) : null,
          discountPence: pence(l.discount),
        }));
      if (!items.length) throw new Error("Add at least one product with a name and quantity.");
      window.localStorage.setItem(
        "pos-draft-sale",
        JSON.stringify({
          saleDate,
          paymentMethod,
          notes: notes.trim() || null,
          items,
        }),
      );
      return true;
    },
    onSuccess: () => navigate({ to: "/staff/pos" }),
    onError: (e: any) => setError(e?.message ?? "Could not add the sale to the basket."),
  });

  const clearAll = () => {
    setSaleDate(todayIso());
    setPaymentMethod("cash"); setNotes(""); setLines([]); setError(null);
  };

  return (
    <AccountShell title="Add New Sale">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <button
          type="button"
          onClick={() => navigate({ to: "/staff/pos" })}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2 text-xs font-semibold uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Go back
        </button>

        <div>
          <h1 className="text-2xl font-bold text-ink">Add New Sale</h1>
          <p className="text-sm text-ink-muted">Select the date and products — the sale is added to the POS basket and completed at the till.</p>
        </div>

        {/* Sale details */}
        <section className="rounded-lg border border-border bg-surface-elevated p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-ink">Sale details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Sale Date</label>
              <input type="date" className={inputCls} value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Payment method</label>
              <select className={inputCls} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="split">Split</option>
              </select>
            </div>
          </div>
        </section>

        {/* Products */}
        <section className="rounded-lg border border-border bg-surface-elevated p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-ink">Products</h2>

          {lines.length > 0 && (
            <div className="hidden grid-cols-12 gap-2 px-1 pb-1 text-[11px] font-semibold uppercase tracking-widest text-ink-muted sm:grid">
              <span className="col-span-4">Product</span>
              <span className="col-span-1">Qty</span>
              <span className="col-span-2">Retail Price</span>
              <span className="col-span-2">Cost Price</span>
              <span className="col-span-1">Discount</span>
              <span className="col-span-1 text-right">Line Total</span>
              <span className="col-span-1 text-right">Remove</span>
            </div>
          )}

          <div className="space-y-2">
            {lines.map((l) => {
              const lineTotal = Math.max(0, Math.round(pence(l.price) * (Number(l.qty) || 0)) - pence(l.discount));
              return (
                <div key={l.key} className="grid grid-cols-2 items-center gap-2 rounded-md border border-border bg-surface p-2 sm:grid-cols-12 sm:border-0 sm:bg-transparent sm:p-0">
                  <div className="col-span-2 sm:col-span-4">
                    <select
                      className={`${inputCls} mb-1`}
                      value={l.productId ?? ""}
                      onChange={(e) => pickProduct(l.key, e.target.value)}
                    >
                      <option value="">— SELECT PRODUCT —</option>
                      {(productList.data as any[] | undefined)?.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <input className={inputCls} placeholder="Item name" value={l.name} onChange={(e) => patch(l.key, { name: e.target.value })} />
                  </div>
                  <div className="sm:col-span-1">
                    <label className={`${labelCls} sm:hidden`}>Qty</label>
                    <input className={inputCls} inputMode="decimal" value={l.qty} onChange={(e) => patch(l.key, { qty: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={`${labelCls} sm:hidden`}>Retail £</label>
                    <input className={inputCls} inputMode="decimal" placeholder="0.00" value={l.price} onChange={(e) => patch(l.key, { price: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={`${labelCls} sm:hidden`}>Cost £</label>
                    <input className={inputCls} inputMode="decimal" placeholder="0.00" value={l.cost} onChange={(e) => patch(l.key, { cost: e.target.value })} />
                  </div>
                  <div className="sm:col-span-1">
                    <label className={`${labelCls} sm:hidden`}>Discount £</label>
                    <input className={inputCls} inputMode="decimal" placeholder="0.00" value={l.discount} onChange={(e) => patch(l.key, { discount: e.target.value })} />
                  </div>
                  <div className="text-sm font-semibold text-ink sm:col-span-1 sm:text-right">{money(lineTotal)}</div>
                  <div className="sm:col-span-1 sm:text-right">
                    <button
                      type="button"
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-ink-muted hover:border-primary hover:text-primary"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLines((ls) => [...ls, newLine()])}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" /> Add Product
            </button>
            <button
              type="button"
              onClick={() => setLines((ls) => [...ls, newLine()])}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-border bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Add Product Manually
            </button>
          </div>
        </section>

        {/* Notes + totals */}
        <section className="grid gap-4 rounded-lg border border-border bg-surface-elevated p-4 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-ink">Sale Notes</h2>
            <textarea
              className={`${inputCls} min-h-[140px]`}
              placeholder="Optional notes about this sale"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-2 text-sm">
            <Row label="Subtotal" value={money(totals.subtotal)} />
            <Row label="Discounts" value={`− ${money(totals.discount)}`} />
            <Row label="Total Cost" value={money(totals.cost)} />
            <Row label="Estimated Gross Profit" value={money(totals.profit)} />
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-lg font-bold text-ink">
              <span>Total</span>
              <span>{money(totals.total)}</span>
            </div>
          </div>
        </section>

        {error && <p className="text-sm font-semibold text-primary">{error}</p>}

        <div className="flex justify-end gap-2 pb-8">
          <button
            type="button"
            onClick={clearAll}
            className="rounded-md border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={saveMut.isPending}
            onClick={() => { setError(null); saveMut.mutate(); }}
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold uppercase tracking-widest text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saveMut.isPending ? "Adding…" : "Add to POS Basket"}
          </button>
        </div>
      </div>
    </AccountShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
