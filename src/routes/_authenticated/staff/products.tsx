import { StaffGuard } from "@/components/StaffGuard";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Pencil, AlertCircle, Trash2, ImageIcon } from "lucide-react";
import { AccountShell } from "@/components/AccountShell";
import { CloudImage } from "@/components/CloudImage";
import { ProductForm } from "@/components/ProductForm";
import { SectionRecycleBin } from "@/components/SectionRecycleBin";
import {
  listProducts, upsertProduct, deleteProduct, listCategories,
  bulkDeleteProducts, deleteAllProductsExceptEngineOil,
} from "@/lib/pos.functions";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/staff/products")({
  head: () => ({ meta: [{ title: `Products — ${BRAND.name} Staff` }] }),
  component: () => (<StaffGuard perm="products"><ProductsPage /></StaffGuard>),
  errorComponent: ({ error }) => <AccountShell title="Products"><p className="text-sm text-primary">{error.message}</p></AccountShell>,
});

const fmt = (p: number) => `£${(p / 100).toFixed(2)}`;
type Product = any;

function ProductsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listProducts);
  const catsFn = useServerFn(listCategories);
  const upsertFn = useServerFn(upsertProduct);
  const delFn = useServerFn(deleteProduct);
  const bulkDelFn = useServerFn(bulkDeleteProducts);
  const deleteAllExceptOilFn = useServerFn(deleteAllProductsExceptEngineOil);

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: products = [] } = useQuery({
    queryKey: ["all-products", search],
    queryFn: () => listFn({ data: { search, includeInactive: true } }),
  });
  const { data: categories = [] } = useQuery({ queryKey: ["all-cats"], queryFn: () => catsFn({ data: { includeHidden: true } }) });

  const categoryImageById = useMemo(
    () => new Map((categories as any[]).map((c) => [c.id, c.image_url])),
    [categories],
  );
  const productImage = (p: Product) => p.image_url || p.category?.image_url || categoryImageById.get(p.category_id) || null;

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["all-products"] }); setSelected(new Set()); };

  const save = useMutation({
    mutationFn: (p: any) => upsertFn({ data: p }),
    onSuccess: (_res, variables: any) => {
      invalidate();
      setShowForm(false);
      setEditing(null);
      alert(`"${variables?.name ?? "Product"}" has been saved.`);
    },
    onError: (e: any) => alert(e?.message ?? "Save failed"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["recycle", "products"] }); setShowForm(false); setEditing(null); },
  });
  const bulkDel = useMutation({
    mutationFn: (ids: string[]) => bulkDelFn({ data: { ids } }),
    onSuccess: (r: any) => { invalidate(); qc.invalidateQueries({ queryKey: ["recycle", "products"] }); alert(`Moved ${r.deleted} product(s) to the Recycle Bin.`); },
    onError: (e: any) => alert(e?.message ?? "Bulk delete failed"),
  });
  const wipeExceptOil = useMutation({
    mutationFn: () => deleteAllExceptOilFn(),
    onSuccess: (r: any) => { invalidate(); qc.invalidateQueries({ queryKey: ["recycle", "products"] }); alert(`Moved ${r.deleted} product(s) to the Recycle Bin. Kept: ${r.kept}.`); },
    onError: (e: any) => alert(e?.message ?? "Failed"),
  });

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
  const toggleAll = () => {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set((products as Product[]).map((p) => p.id)));
  };

  return (
    <AccountShell title="Products & Parts">
      <SectionRecycleBin type="products" invalidateKeys={[["all-products"]]} />
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, SKU, barcode…"
          className="flex-1 min-w-[200px] rounded-sm border border-border bg-input px-3 py-2.5 text-sm"
        />
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New product
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          disabled={selected.size === 0 || bulkDel.isPending}
          onClick={() => { if (confirm(`Move ${selected.size} selected product(s) to the Recycle Bin?`)) bulkDel.mutate([...selected]); }}
          className="inline-flex items-center gap-2 rounded-sm border border-primary bg-primary/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-primary disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete selected ({selected.size})
        </button>
        <button
          disabled={wipeExceptOil.isPending}
          onClick={() => { if (confirm("Move ALL products EXCEPT those matching \"engine oil\" to the Recycle Bin?")) wipeExceptOil.mutate(); }}
          className="inline-flex items-center gap-2 rounded-sm border border-primary bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" /> {wipeExceptOil.isPending ? "Deleting…" : "Delete all except Engine Oil"}
        </button>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated text-[10px] uppercase tracking-widest text-ink-muted">
            <tr>
              <th className="px-3 py-2 w-8">
                <input type="checkbox" checked={selected.size > 0 && selected.size === products.length} onChange={toggleAll} />
              </th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Stock</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {(products as Product[]).map((p) => (
              <tr key={p.id} className={!p.is_active ? "opacity-50" : ""}>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <CloudImage
                      src={productImage(p)}
                      alt={p.name}
                      className="h-8 w-8 rounded-sm border border-border object-cover"
                      fallback={
                      <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-dashed border-border text-ink-muted">
                        <ImageIcon className="h-3.5 w-3.5" />
                      </div>
                      }
                    />

                    <div>
                      <p className="font-semibold">{p.name}</p>
                      {p.is_service && <span className="text-[10px] uppercase tracking-widest text-ink-muted">Service</span>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-ink-muted">{p.sku ?? "—"}</td>
                <td className="px-3 py-2 text-ink-muted">{p.category?.name ?? "—"}</td>
                <td className="px-3 py-2 text-right">{fmt(p.retail_price_pence)}</td>
                <td className="px-3 py-2 text-right">
                  {p.is_service ? "—" : (
                    <span className={p.stock_qty <= p.min_stock ? "inline-flex items-center gap-1 text-primary" : ""}>
                      {p.stock_qty <= p.min_stock && <AlertCircle className="h-3 w-3" />}
                      {p.stock_qty}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => { setEditing(p); setShowForm(true); }} className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-primary">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                </td>
              </tr>
            ))}
            {(products as Product[]).length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-ink-muted">No products.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ProductForm
          initial={editing}
          categories={categories as any[]}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSave={(p) => save.mutate(p)}
          onDelete={editing ? () => remove.mutate(editing.id) : undefined}
          saving={save.isPending || remove.isPending}
        />
      )}
    </AccountShell>
  );
}

