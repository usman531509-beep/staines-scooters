import { StaffGuard } from "@/components/StaffGuard";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Trash2, ChevronRight, ImageIcon, Upload } from "lucide-react";
import { AccountShell } from "@/components/AccountShell";
import { CategoryImageField } from "@/components/CategoryImageField";
import { SectionRecycleBin } from "@/components/SectionRecycleBin";
import { listCategories, upsertCategory, deleteCategory, setCategoryHidden } from "@/lib/pos.functions";
import { useAuth } from "@/lib/auth-client";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";


export const Route = createFileRoute("/_authenticated/staff/categories/")({
  head: () => ({ meta: [{ title: `Categories — ${BRAND.name} Staff` }] }),
  component: () => (<StaffGuard perm="categories"><CategoriesPage /></StaffGuard>),
  errorComponent: ({ error }) => <AccountShell title="Categories"><p className="text-sm text-primary">{error.message}</p></AccountShell>,
});

function CategoriesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCategories);
  const upsertFn = useServerFn(upsertCategory);
  const delFn = useServerFn(deleteCategory);
  const hideFn = useServerFn(setCategoryHidden);
  const { isAdmin } = useAuth();

  const { data: cats = [] } = useQuery({ queryKey: ["cats-all"], queryFn: () => listFn({ data: { includeHidden: true } }) });
  const setHidden = useMutation({
    mutationFn: (v: { id: string; hidden: boolean }) => hideFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cats-all"] }); qc.invalidateQueries({ queryKey: ["pos-cats"] }); },
    onError: (e: any) => alert(e?.message ?? "Failed to update visibility"),
  });
  const [name, setName] = useState("");
  const [order, setOrder] = useState(0);
  const [parentId, setParentId] = useState<string>("");

  const parents = useMemo(() => (cats as any[]).filter((c) => !c.parent_id), [cats]);
  const childrenOf = (id: string) => (cats as any[]).filter((c) => c.parent_id === id);

  const add = useMutation({
    mutationFn: () => upsertFn({ data: { name, sort_order: order, parent_id: parentId || null } }),
    onSuccess: () => { setName(""); setOrder(0); setParentId(""); qc.invalidateQueries({ queryKey: ["cats-all"] }); qc.invalidateQueries({ queryKey: ["pos-cats"] }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cats-all"] }); qc.invalidateQueries({ queryKey: ["recycle", "categories"] }); },
  });
  const rename = useMutation({
    mutationFn: (c: any) => upsertFn({
      data: {
        id: c.id,
        name: c.name,
        sort_order: c.sort_order,
        parent_id: c.parent_id ?? null,
        image_url: c.image_url ?? null,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cats-all"] });
      qc.invalidateQueries({ queryKey: ["all-cats"] });
      qc.invalidateQueries({ queryKey: ["pos-cats"] });
      qc.invalidateQueries({ queryKey: ["all-products"] });
      qc.invalidateQueries({ queryKey: ["cat-products"] });
      qc.invalidateQueries({ queryKey: ["pos-products"] });
    },
    onError: (e: any) => alert(e?.message ?? "Category update failed"),
  });

  return (
    <AccountShell title="Categories & Subcategories">
      <SectionRecycleBin type="categories" invalidateKeys={[["cats-all"], ["pos-cats"], ["all-cats"]]} />
      <div className="rounded-md border border-border bg-surface-elevated p-4">
        <p className="eyebrow mb-2">Add new</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_180px_120px_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" className="rounded-sm border border-border bg-input px-3 py-2 text-sm" />
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="rounded-sm border border-border bg-input px-3 py-2 text-sm">
            <option value="">— Top-level —</option>
            {parents.map((p) => <option key={p.id} value={p.id}>Under: {p.name}</option>)}
          </select>
          <input type="number" value={order} onChange={(e) => setOrder(+e.target.value)} placeholder="Order" className="rounded-sm border border-border bg-input px-3 py-2 text-sm" />
          <button disabled={!name || add.isPending} onClick={() => add.mutate()} className="inline-flex items-center gap-1 rounded-sm bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        <p className="mt-2 text-[11px] text-ink-muted">Pick a parent to create a subcategory (e.g. Filters → Oil filters).</p>
      </div>

      <div className="mt-4 space-y-2">
        {parents.length === 0 && <p className="rounded-md border border-border bg-surface p-6 text-center text-sm text-ink-muted">No categories yet.</p>}
        {parents.map((c) => (
          <div key={c.id} className="overflow-hidden rounded-md border border-border">
            <CategoryRow c={c} isAdmin={isAdmin} onToggleHidden={(v) => setHidden.mutate({ id: c.id, hidden: v })} onRename={(x) => rename.mutate(x)} onDelete={() => { if (confirm(`Delete "${c.name}"?`)) remove.mutate(c.id); }} />
            {childrenOf(c.id).length > 0 && (
              <div className="divide-y divide-border bg-surface pl-6">
                {childrenOf(c.id).map((sc) => (
                  <CategoryRow key={sc.id} c={sc} isChild isAdmin={isAdmin} onToggleHidden={(v) => setHidden.mutate({ id: sc.id, hidden: v })} onRename={(x) => rename.mutate(x)} onDelete={() => { if (confirm(`Delete "${sc.name}"?`)) remove.mutate(sc.id); }} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </AccountShell>
  );
}

function CategoryRow({ c, isChild, isAdmin, onRename, onDelete, onToggleHidden }: { c: any; isChild?: boolean; isAdmin?: boolean; onRename: (c: any) => void; onDelete: () => void; onToggleHidden?: (hidden: boolean) => void }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2 ${isChild ? "text-sm" : "bg-surface-elevated"} ${c.hidden ? "opacity-60" : ""}`}>
      <span className="text-[10px] uppercase tracking-widest text-ink-muted">{isChild ? "└ Sub" : "Category"}</span>
      {c.hidden && <span className="rounded-sm bg-ink-muted/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-ink-muted">Hidden</span>}
      <CategoryImageField
        imageUrl={c.image_url}
        alt={c.name}
        pathPrefix="categories"
        onChange={(path: string | null) => onRename({ ...c, image_url: path })}
      />

      <input
        defaultValue={c.name}
        onBlur={(e) => { if (e.target.value !== c.name) onRename({ ...c, name: e.target.value }); }}
        className="flex-1 bg-transparent text-sm focus:outline-none"
      />
      <input
        type="number"
        defaultValue={c.sort_order}
        onBlur={(e) => { const n = +e.target.value; if (n !== c.sort_order) onRename({ ...c, sort_order: n }); }}
        className="w-16 bg-transparent text-right text-xs focus:outline-none"
        title="Sort order"
      />
      <Link
        to="/staff/categories/$categoryId"
        params={{ categoryId: c.id }}
        className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest hover:bg-surface-elevated"
        title="Open category and manage products"
      >
        Open <ChevronRight className="h-3 w-3" />
      </Link>
      {isAdmin && onToggleHidden && c.name?.toLowerCase() !== "best sellers" && (
        <button
          onClick={() => onToggleHidden(!c.hidden)}
          className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest hover:bg-surface-elevated"
          title={c.hidden ? "Show in POS" : "Hide from POS"}
        >
          {c.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {c.hidden ? "Show" : "Hide"}
        </button>
      )}
      <button onClick={onDelete} className="text-ink-muted hover:text-primary"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

