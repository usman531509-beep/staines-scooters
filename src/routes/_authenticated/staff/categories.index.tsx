import { StaffGuard } from "@/components/StaffGuard";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Trash2, ChevronRight, FolderTree, CornerDownRight } from "lucide-react";
import { AccountShell } from "@/components/AccountShell";
import { CategoryImageField } from "@/components/CategoryImageField";
import { SectionRecycleBin } from "@/components/SectionRecycleBin";
import { listCategories, upsertCategory, deleteCategory, setCategoryHidden } from "@/lib/pos.functions";
import { useAuth } from "@/lib/auth-client";
import { Eye, EyeOff } from "lucide-react";
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cats-all"] }); qc.invalidateQueries({ queryKey: ["pos-cats"] }); qc.invalidateQueries({ queryKey: ["all-cats"] }); },
    onError: (e: any) => alert(e?.message ?? "Failed to update visibility"),
  });
  const [name, setName] = useState("");
  const [order, setOrder] = useState(0);
  const [parentId, setParentId] = useState<string>("");

  const parents = useMemo(() => (cats as any[]).filter((c) => !c.parent_id), [cats]);
  const childrenOf = (id: string) => (cats as any[]).filter((c) => c.parent_id === id);

  const add = useMutation({
    mutationFn: () => upsertFn({ data: { name, sort_order: order, parent_id: parentId || null } }),
    onSuccess: () => { setName(""); setOrder(0); setParentId(""); qc.invalidateQueries({ queryKey: ["cats-all"] }); qc.invalidateQueries({ queryKey: ["pos-cats"] }); qc.invalidateQueries({ queryKey: ["all-cats"] }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cats-all"] }); qc.invalidateQueries({ queryKey: ["recycle", "categories"] }); qc.invalidateQueries({ queryKey: ["all-cats"] }); },
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

  const confirmDelete = (c: any) => {
    if (confirm(`Delete "${c.name}"? It moves to the recycle bin.`)) remove.mutate(c.id);
  };

  return (
    <AccountShell title="Categories">
      <div className="grid gap-6">
        {/* Add form */}
        <section className="rounded-xl border border-border bg-surface-elevated p-5 shadow-sm">
          <h2 className="text-base font-semibold tracking-tight">Add a category</h2>
          <p className="mt-1 text-sm text-ink-muted">Pick a parent to make it a subcategory (e.g. Filters → Oil filters).</p>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_110px_auto] sm:items-end"
            onSubmit={(e) => { e.preventDefault(); if (name) add.mutate(); }}
          >
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Brakes" className={FIELD} />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Parent</span>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={FIELD}>
                <option value="">None (top level)</option>
                {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm" title="Lower numbers show first in the POS">
              <span className="font-medium">Position</span>
              <input type="number" value={order} onChange={(e) => setOrder(+e.target.value)} className={FIELD} />
            </label>
            <button
              type="submit"
              disabled={!name || add.isPending}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {add.isPending ? "Adding…" : "Add"}
            </button>
          </form>
        </section>

        {/* Category list: one row per category, subcategories indented below it */}
        {parents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center text-sm text-ink-muted">
            <FolderTree className="h-6 w-6 opacity-50" />
            No categories yet. Add your first one above.
          </div>
        ) : (
          <section className="overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-sm">
            <div className="hidden grid-cols-[minmax(0,1fr)_100px_auto] items-center gap-4 border-b border-border bg-muted/50 px-4 py-2.5 text-xs font-medium text-ink-muted sm:grid">
              <span>Category</span>
              <span className="text-center">Position</span>
              <span className="w-[164px] text-right">Actions</span>
            </div>
            <ul className="divide-y divide-border">
              {parents.map((c) => (
                <li key={c.id}>
                  <CategoryRow
                    c={c}
                    subCount={childrenOf(c.id).length}
                    isAdmin={isAdmin}
                    onToggleHidden={(x, v) => setHidden.mutate({ id: x.id, hidden: v })}
                    onRename={(x) => rename.mutate(x)}
                    onDelete={confirmDelete}
                  />
                  {childrenOf(c.id).length > 0 && (
                    <ul className="divide-y divide-border border-t border-border bg-muted/30">
                      {childrenOf(c.id).map((sc) => (
                        <li key={sc.id}>
                          <CategoryRow
                            c={sc}
                            isChild
                            isAdmin={isAdmin}
                            onToggleHidden={(x, v) => setHidden.mutate({ id: x.id, hidden: v })}
                            onRename={(x) => rename.mutate(x)}
                            onDelete={confirmDelete}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <SectionRecycleBin type="categories" invalidateKeys={[["cats-all"], ["pos-cats"], ["all-cats"]]} />
      </div>
    </AccountShell>
  );
}

const FIELD = "h-10 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

type RowProps = {
  isAdmin?: boolean;
  onRename: (c: any) => void;
  onDelete: (c: any) => void;
  onToggleHidden: (c: any, hidden: boolean) => void;
};

function CategoryRow({ c, isChild, subCount = 0, ...actions }: RowProps & { c: any; isChild?: boolean; subCount?: number }) {
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_100px_auto] sm:gap-4 ${isChild ? "pl-10 sm:pl-12" : ""} ${c.hidden ? "opacity-60" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {isChild && <CornerDownRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />}
        <CategoryImageField
          imageUrl={c.image_url}
          alt={c.name}
          pathPrefix="categories"
          onChange={(path: string | null) => actions.onRename({ ...c, image_url: path })}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              defaultValue={c.name}
              onBlur={(e) => { if (e.target.value && e.target.value !== c.name) actions.onRename({ ...c, name: e.target.value }); }}
              className={`min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 outline-none hover:bg-muted focus:bg-muted ${isChild ? "text-sm" : "text-base font-semibold"}`}
              title="Click to rename"
            />
            {c.hidden && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-ink-muted">Hidden</span>}
          </div>
          {!isChild && (
            <p className="px-1 text-xs text-ink-muted">
              {subCount === 0 ? "No subcategories" : `${subCount} ${subCount === 1 ? "subcategory" : "subcategories"}`}
            </p>
          )}
        </div>
      </div>
      <div className="hidden justify-center sm:flex">
        <PositionInput c={c} onRename={actions.onRename} />
      </div>
      <div className="flex w-[164px] items-center justify-end gap-1.5">
        <Link
          to="/staff/categories/$categoryId"
          params={{ categoryId: c.id }}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          title="Open category and manage products"
        >
          Open <ChevronRight className="h-4 w-4" />
        </Link>
        <VisibilityButton c={c} {...actions} />
        <button
          onClick={() => actions.onDelete(c)}
          className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-destructive/10 hover:text-destructive"
          title={`Delete ${c.name}`}
          aria-label={`Delete ${c.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function VisibilityButton({ c, isAdmin, onToggleHidden }: RowProps & { c: any }) {
  if (!isAdmin || c.name?.toLowerCase() === "best sellers") return <span className="w-9" aria-hidden="true" />;
  const label = c.hidden ? "Show in POS" : "Hide from POS";
  return (
    <button
      onClick={() => onToggleHidden(c, !c.hidden)}
      className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-accent hover:text-accent-foreground"
      title={label}
      aria-label={label}
    >
      {c.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </button>
  );
}

function PositionInput({ c, onRename }: { c: any; onRename: (c: any) => void }) {
  return (
    <input
      type="number"
      defaultValue={c.sort_order}
      onBlur={(e) => { const n = +e.target.value; if (n !== c.sort_order) onRename({ ...c, sort_order: n }); }}
      className="h-9 w-16 rounded-lg border border-border bg-input px-2 text-center text-sm text-foreground"
      title="Lower numbers show first in the POS"
      aria-label={`Position of ${c.name}`}
    />
  );
}
