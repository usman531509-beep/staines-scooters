import { useMemo, useState } from "react";
import { X, Plus, Pencil, Trash2, Check } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listTitlePresets,
  addTitlePresets,
  updateTitlePreset,
  deleteTitlePreset,
  deleteTitlePresets,
} from "@/lib/title-presets.functions";

export function PriceEntryModal({
  productId,
  productName,
  initialPence,
  onCancel,
  onConfirm,
}: {
  productId?: string | null;
  productName: string;
  initialPence?: number | null;
  onCancel: () => void;
  onConfirm: (pence: number, nameOverride?: string, mileage?: number | null) => void;
}) {
  const [value, setValue] = useState(
    initialPence != null && initialPence > 0 ? (initialPence / 100).toFixed(2) : ""
  );
  const [suffix, setSuffix] = useState("");
  const [mileage, setMileage] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const parsed = Number(value.replace(/[£,\s]/g, ""));
  const valid = Number.isFinite(parsed) && parsed >= 0 && value.trim() !== "";

  const listFn = useServerFn(listTitlePresets);
  const { data: presets = [] } = useQuery({
    queryKey: ["title-presets", productId],
    queryFn: () => listFn({ data: { productId: productId! } }),
    enabled: !!productId,
    staleTime: 60_000,
  });

  const suggestions = useMemo(() => {
    const q = suffix.trim().toLowerCase();
    if (!q) return [];
    return (presets as { id: string; title: string }[])
      .filter((p) => p.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [presets, suffix]);

  const fullName = `${productName} ${suffix.trim()}`.trim();
  const norm = productName.trim().toLowerCase().replace(/\s+/g, " ");
  const titleRequired =
    norm === "belt kit //110" || /^(tyre|tire|variator|battery)s?$/.test(norm);
  const titleChosen = (presets as { title: string }[]).some(
    (p) => p.title.trim().toLowerCase() === suffix.trim().toLowerCase(),
  );
  const titleOk = !titleRequired || (suffix.trim() !== "" && titleChosen);

  const submit = () => {
    if (!valid || !titleOk) return;
    onConfirm(
      Math.round(parsed * 100),
      fullName && fullName !== productName ? fullName : undefined,
      Number(mileage.replace(/[^0-9]/g, "")) || null,
    );
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-5 sm:pt-8" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[640px] overflow-hidden rounded-lg border-2 border-primary bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border bg-primary px-5 py-3 text-primary-foreground">
          <h2 className="font-display text-xl uppercase tracking-widest">Enter price</h2>
          <button onClick={onCancel} aria-label="Close" className="rounded-sm p-1 hover:bg-primary-foreground/20">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Product title
            </span>
            {productId && (
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className="font-display text-base uppercase tracking-widest text-primary hover:underline"
              >
                Add title
              </button>
            )}
          </div>
          <div className="relative mt-1">
            <div className="flex items-center gap-2 rounded-md border-2 border-border bg-input px-3 py-2 focus-within:border-primary">
              <span className="whitespace-nowrap text-base font-bold">{productName}</span>
              <input
                type="text"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                placeholder={productId ? "start typing to pick a saved title…" : ""}
                className="w-full bg-transparent text-base font-semibold outline-none"
              />
            </div>
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-surface shadow-xl">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSuffix(s.title)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-elevated"
                    >
                      {productName} <span className="font-semibold">{s.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {titleRequired && !titleOk && (
              <p className="mt-1 text-xs font-semibold text-primary">
                Select a product title from the list before adding to cart.
              </p>
            )}
          </div>
          <div className="mt-4 flex items-end gap-3">
          <label className="block flex-1">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Price in £ (e.g. 12.50)
            </span>
            <input
              autoFocus
              inputMode="decimal"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") onCancel();
              }}
              placeholder="0.00"
              className="mt-2 w-full rounded-md border-2 border-border bg-input px-4 text-center font-bold tracking-wide focus:border-primary focus:outline-none"
              style={{ height: "1in", minHeight: "96px", fontSize: "36px", lineHeight: "1.1" }}
            />
          </label>
          <label className="block shrink-0" style={{ width: "1in" }}>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Milagge</span>
            <input
              inputMode="numeric"
              type="text"
              value={mileage}
              onChange={(e) => setMileage(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="0"
              className="mt-2 w-full rounded-md border-2 border-border bg-input px-1 text-center text-sm font-bold focus:border-primary focus:outline-none"
              style={{ height: "1in", minHeight: "96px" }}
            />
          </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-surface-elevated px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded-sm border border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest hover:border-primary"
          >
            Cancel
          </button>
          <button
            disabled={!valid || !titleOk}
            onClick={submit}
            className="rounded-sm bg-primary px-6 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >
            Add to cart
          </button>
        </div>
      </div>

      {manageOpen && productId && (
        <TitlePresetManager
          productId={productId}
          productName={productName}
          onClose={() => setManageOpen(false)}
        />
      )}
    </div>
  );
}

function TitlePresetManager({
  productId,
  productName,
  onClose,
}: {
  productId: string;
  productName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTitlePresets);
  const addFn = useServerFn(addTitlePresets);
  const updFn = useServerFn(updateTitlePreset);
  const delFn = useServerFn(deleteTitlePreset);
  const delManyFn = useServerFn(deleteTitlePresets);
  const [draft, setDraft] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());


  const { data: presets = [], isLoading } = useQuery({
    queryKey: ["title-presets", productId],
    queryFn: () => listFn({ data: { productId } }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["title-presets", productId] });

  const [note, setNote] = useState("");
  const add = useMutation({
    mutationFn: (titles: string[]) => addFn({ data: { productId, titles } }),
    onSuccess: (r: any) => {
      setDraft("");
      setNote(`Saved ${r?.saved ?? 0} title(s)${r?.skipped ? `, ${r.skipped} already existed` : ""}.`);
      invalidate();
    },
    onError: (e: any) => alert(e?.message ?? "Could not save"),
  });
  const upd = useMutation({
    mutationFn: (v: { id: string; title: string }) => updFn({ data: v }),
    onSuccess: () => { setEditId(null); invalidate(); },
    onError: (e: any) => alert(e?.message ?? "Could not update"),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: (_r, id) => { setSelected((p) => { const n = new Set(p); n.delete(id as string); return n; }); invalidate(); },
    onError: (e: any) => alert(e?.message ?? "Could not delete"),
  });
  const delMany = useMutation({
    mutationFn: (ids: string[]) => delManyFn({ data: { ids } }),
    onSuccess: () => { setSelected(new Set()); invalidate(); },
    onError: (e: any) => alert(e?.message ?? "Could not delete"),
  });
  const rows = presets as { id: string; title: string }[];
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });



  const saveDraft = () => {
    const titles = draft
      .split(/[\n,]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (titles.length) add.mutate(titles);
  };

  return (
    <div className="fixed inset-0 z-[130] overflow-y-auto bg-background" onClick={(e) => e.stopPropagation()}>
      <div className="mx-auto max-w-2xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase tracking-widest">
            Titles — {productName}
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded-sm border border-border p-2 hover:border-primary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          These titles are only used as quick suggestions in the till price popup. They change nothing else.
        </p>

        <div className="mt-4 rounded-md border border-border bg-surface p-4">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Add titles</span>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            placeholder="Enter titles separated by commas or on separate lines, e.g. YAMAHA XMAX 2010-2013, YAMAHA XMAX 2014-2017, PIAGGIO LIBERTY 2004-2008"
            className="mt-2 w-full rounded-sm border border-border bg-input px-3 py-2 text-sm"
            style={{ minHeight: "220px" }}
          />
          <button
            onClick={saveDraft}
            disabled={add.isPending || !draft.trim()}
            className="mt-2 inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> {add.isPending ? "Saving…" : "Save titles"}
          </button>
          {note && <p className="mt-2 text-xs text-ink-muted">{note}</p>}
        </div>

        {rows.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-ink-muted">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
              />
              Select all ({rows.length})
            </label>
            <button
              disabled={selected.size === 0 || delMany.isPending}
              onClick={() => {
                if (confirm(`Delete ${selected.size} selected title(s)?`)) delMany.mutate(Array.from(selected));
              }}
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {delMany.isPending ? "Deleting…" : `Delete selected${selected.size ? ` (${selected.size})` : ""}`}
            </button>
          </div>
        )}

        <div className="mt-4 divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
          {isLoading && <p className="p-4 text-sm text-ink-muted">Loading…</p>}
          {rows.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 px-3 py-2">
              <input
                type="checkbox"
                aria-label={`Select ${p.title}`}
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
              />
              <span className="w-8 text-xs text-ink-muted">{i + 1}.</span>

              {editId === p.id ? (
                <>
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="flex-1 rounded-sm border border-border bg-input px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => upd.mutate({ id: p.id, title: editText.trim() })}
                    disabled={!editText.trim()}
                    className="rounded-sm border border-border p-1.5 text-primary hover:border-primary disabled:opacity-40"
                    aria-label="Save"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditId(null)} className="rounded-sm border border-border p-1.5 hover:border-primary" aria-label="Cancel">
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-semibold">{p.title}</span>
                  <button
                    onClick={() => { setEditId(p.id); setEditText(p.title); }}
                    className="rounded-sm border border-border p-1.5 hover:border-primary"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${p.title}"?`)) del.mutate(p.id); }}
                    className="rounded-sm border border-border p-1.5 text-primary hover:border-primary"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ))}
          {!isLoading && (presets as any[]).length === 0 && (
            <p className="p-4 text-sm text-ink-muted">No titles yet.</p>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-sm border border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest hover:border-primary"
        >
          Done
        </button>
      </div>
    </div>
  );
}
