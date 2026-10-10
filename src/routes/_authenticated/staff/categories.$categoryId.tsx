import { StaffGuard } from "@/components/StaffGuard";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Pencil, AlertCircle, ChevronLeft, ImageIcon, Upload, Trash2 } from "lucide-react";
import { AccountShell } from "@/components/AccountShell";
import { CloudImage } from "@/components/CloudImage";
import { ProductForm } from "@/components/ProductForm";
import { CategoryImageField } from "@/components/CategoryImageField";

import { supabase } from "@/integrations/supabase/client";
import {
  listProducts, upsertProduct, deleteProduct, listCategories, upsertCategory,
} from "@/lib/pos.functions";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/staff/categories/$categoryId")({
  head: () => ({ meta: [{ title: `Category — ${BRAND.name} Staff` }] }),
  component: () => (<StaffGuard perm="categories"><CategoryDetailPage /></StaffGuard>),
  errorComponent: ({ error }) => <AccountShell title="Category"><p className="text-sm text-primary">{error.message}</p></AccountShell>,
});

const fmt = (p: number) => `£${(p / 100).toFixed(2)}`;

function CategoryDetailPage() {
  const { categoryId } = Route.useParams();
  const qc = useQueryClient();
  const listFn = useServerFn(listProducts);
  const catsFn = useServerFn(listCategories);
  const upsertFn = useServerFn(upsertProduct);
  const upsertCatFn = useServerFn(upsertCategory);
  const delFn = useServerFn(deleteProduct);

  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploadingCategoryImage, setUploadingCategoryImage] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const { data: categories = [] } = useQuery({ queryKey: ["all-cats"], queryFn: () => catsFn() });
  const { data: products = [] } = useQuery({
    queryKey: ["cat-products", categoryId],
    queryFn: () => listFn({ data: { categoryId, includeInactive: true } }),
  });

  const category = useMemo(
    () => (categories as any[]).find((c) => c.id === categoryId),
    [categories, categoryId],
  );

  const categoryImageById = useMemo(
    () => new Map((categories as any[]).map((c) => [c.id, c.image_url])),
    [categories],
  );

  const productImage = (p: any) => p.image_url || p.category?.image_url || categoryImageById.get(p.category_id) || null;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cat-products", categoryId] });
    qc.invalidateQueries({ queryKey: ["all-products"] });
    qc.invalidateQueries({ queryKey: ["pos-products"] });
  };

  const save = useMutation({
    mutationFn: (p: any) => upsertFn({ data: p }),
    onSuccess: (_r, v: any) => { invalidate(); setShowForm(false); setEditing(null); alert(`"${v?.name ?? "Product"}" saved.`); },
    onError: (e: any) => alert(e?.message ?? "Save failed"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["recycle", "products"] }); setShowForm(false); setEditing(null); },
  });
  const saveCategoryImage = useMutation({
    mutationFn: (image_url: string | null) => upsertCatFn({
      data: {
        id: category.id,
        name: category.name,
        sort_order: category.sort_order ?? 0,
        parent_id: category.parent_id ?? null,
        image_url,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-cats"] });
      qc.invalidateQueries({ queryKey: ["cats-all"] });
      qc.invalidateQueries({ queryKey: ["pos-cats"] });
      qc.invalidateQueries({ queryKey: ["cat-products", categoryId] });
      qc.invalidateQueries({ queryKey: ["all-products"] });
      qc.invalidateQueries({ queryKey: ["pos-products"] });
    },
    onError: (e: any) => alert(e?.message ?? "Category image update failed"),
  });

  return (
    <AccountShell title={category?.name ? `Category — ${category.name}` : "Category"}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/staff/categories"
            className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-ink-muted hover:text-primary"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> All categories
          </Link>
          {category && (
            <CategoryImageField
              imageUrl={category.image_url}
              alt={category.name ?? "Category"}
              pathPrefix={`categories/${categoryId}`}
              saving={saveCategoryImage.isPending}
              size="md"
              onChange={(path: string | null) => saveCategoryImage.mutate(path)}
            />
          )}
        </div>

        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Add product to {category?.name ?? "category"}
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
          <p className="text-xs uppercase tracking-widest text-ink-muted">
            {selectedIds.size} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-[10px] uppercase tracking-widest text-ink-muted hover:text-ink"
            >
              Clear
            </button>
            <button
              disabled={bulkDeleting}
              onClick={async () => {
                if (!confirm(`Delete ${selectedIds.size} selected product(s)? This cannot be undone from here.`)) return;
                setBulkDeleting(true);
                const ids = Array.from(selectedIds);
                let failed = 0;
                for (const id of ids) {
                  try { await delFn({ data: { id } }); } catch { failed++; }
                }
                setBulkDeleting(false);
                setSelectedIds(new Set());
                invalidate();
                qc.invalidateQueries({ queryKey: ["recycle", "products"] });
                if (failed) alert(`Deleted ${ids.length - failed} of ${ids.length}. ${failed} failed.`);
                else alert(`Deleted ${ids.length} product(s).`);
              }}
              className="inline-flex items-center gap-1 rounded-sm bg-primary px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-60"
            >
              <Trash2 className="h-3 w-3" /> {bulkDeleting ? "Deleting…" : "Delete selected"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated text-[10px] uppercase tracking-widest text-ink-muted">
            <tr>
              <th className="w-8 px-3 py-2 text-left">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={(products as any[]).length > 0 && selectedIds.size === (products as any[]).length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set((products as any[]).map((p) => p.id)));
                    else setSelectedIds(new Set());
                  }}
                />
              </th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Stock</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {(products as any[]).map((p) => (
              <tr key={p.id} className={!p.is_active ? "opacity-50" : ""}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Select ${p.name}`}
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleSelected(p.id)}
                  />
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

                    <p className="font-semibold">{p.name}</p>
                  </div>
                </td>
                <td className="px-3 py-2 text-ink-muted">{p.sku ?? "—"}</td>
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
            {(products as any[]).length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-ink-muted">No products in this category yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ProductForm
          initial={editing}
          categories={categories as any[]}
          defaultCategoryId={categoryId}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSave={(p) => save.mutate(p)}
          onDelete={editing ? () => remove.mutate(editing.id) : undefined}
          saving={save.isPending || remove.isPending}
        />
      )}
    </AccountShell>
  );
}
