import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoryOptions } from "@/components/BulkProductsDialog";
import {
  buildRows, findHeaderRow, guessColumns, matchCategory, nameKey, readWorkbook, templateCsv,
  type ColumnMap, type ImportRow, type Sheet,
} from "@/lib/spreadsheet-import";

export type ImportPayload = {
  receiveStock: boolean;
  reference: string;
  items: Array<{
    name: string;
    category_id: string | null;
    new_category: string | null;
    cost_price_pence: number;
    retail_price_pence: number;
    qty: number;
    sku: string | null;
  }>;
};

export type ImportResult = {
  created: number;
  categoriesCreated: number;
  newCategories: string[];
  received: number;
  stockErrors: string[];
  products: Array<{ id: string; name: string; categoryId: string | null; costPence: number; retailPence: number; qtyReceived: number }>;
  skipped: Array<{ name: string; reason: string }>;
};

const NONE = "__none__";
const NEW = "__new__";
const MAX_ROWS = 1000;
const fmt = (p: number) => (p ? `£${(p / 100).toFixed(2)}` : "—");
const selectCls = "w-full rounded-sm border border-border bg-input px-2 py-1.5 text-sm";

type Issue = { kind: "exists" | "duplicate" | "sku"; text: string };

/**
 * Adds products from an Excel/CSV sheet in three steps: pick the file (sheet and
 * header row are found automatically), check the columns, categories and every
 * row in a preview, then import and review what was added or skipped.
 */
export function ProductImportDialog({
  categories,
  existing,
  loadingExisting,
  result,
  canReceiveStock,
  saving,
  onCancel,
  onImport,
}: {
  categories: any[];
  /** Current products by name key, to flag ones already in the catalogue. */
  existing: Map<string, any>;
  /** True while the current product list is still loading (files wait for it). */
  loadingExisting: boolean;
  /** What the server did, once the import has run. */
  result: ImportResult | null;
  canReceiveStock: boolean;
  saving: boolean;
  onCancel: () => void;
  onImport: (p: ImportPayload) => void;
}) {
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [prefixCategory, setPrefixCategory] = useState(true);
  const [stopAtBlank, setStopAtBlank] = useState(true);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [catChoice, setCatChoice] = useState<Record<string, string>>({});
  const [receiveStock, setReceiveStock] = useState(false);
  // When the sheet has no category column: one category for every row.
  const [defaultCategory, setDefaultCategory] = useState(NONE);
  const [showColumns, setShowColumns] = useState(false);
  const [showAllCats, setShowAllCats] = useState(false);
  const [unticked, setUnticked] = useState<ImportRow[]>([]);
  const options = useMemo(() => categoryOptions(categories), [categories]);
  const grid = sheets[sheetIdx]?.grid ?? null;
  const header = grid?.[headerRow] ?? [];

  const existingSkus = useMemo(
    () => new Set([...existing.values()].map((p) => nameKey(p.sku ?? "")).filter(Boolean)),
    [existing],
  );

  // Problems per row, recomputed as names are edited.
  const issues = useMemo(() => {
    const out = new Map<number, Issue>();
    const firstSeen = new Map<string, ImportRow>();
    for (const r of rows) {
      const k = nameKey(r.name);
      const match = existing.get(k);
      if (match) {
        out.set(r.rowNumber, {
          kind: "exists",
          text: `Already exists · ${match.category?.name ?? "No category"} · retail ${fmt(match.retail_price_pence)} · cost ${fmt(match.cost_price_pence)} · stock ${match.stock_qty ?? 0}`,
        });
        continue;
      }
      const sku = nameKey(r.sku);
      if (sku && existingSkus.has(sku)) {
        out.set(r.rowNumber, { kind: "sku", text: `SKU ${r.sku} is already used by another product` });
        continue;
      }
      const prev = firstSeen.get(k);
      if (prev) out.set(r.rowNumber, { kind: "duplicate", text: `Same name appears earlier in the sheet (row ${prev.rowNumber})` });
      else if (k) firstSeen.set(k, r);
    }
    return out;
  }, [rows, existing, existingSkus]);

  function rebuild(g: Sheet["grid"], h: number, m: ColumnMap, opts: { prefixCategory: boolean; stopAtBlank: boolean }) {
    const built = buildRows(g, h, m, opts);
    // Untick rows that are already in the catalogue or repeat an earlier row.
    const seen = new Set<string>();
    setRows(built.map((r) => {
      const k = nameKey(r.name);
      const sku = nameKey(r.sku);
      const ok = !existing.has(k) && !seen.has(k) && !(sku && existingSkus.has(sku));
      seen.add(k);
      return { ...r, include: ok };
    }));
    const choices: Record<string, string> = {};
    for (const r of built) {
      if (!r.sheetCategory || r.sheetCategory in choices) continue;
      choices[r.sheetCategory] = catChoice[r.sheetCategory] ?? matchCategory(r.sheetCategory, categories) ?? NEW;
    }
    setCatChoice(choices);
  }

  function loadSheet(all: Sheet[], idx: number) {
    const g = all[idx]?.grid ?? [];
    const h = findHeaderRow(g);
    const m = guessColumns(g[h] ?? []);
    setSheetIdx(idx); setHeaderRow(h); setMap(m);
    rebuild(g, h, m, { prefixCategory, stopAtBlank });
  }

  async function onFile(file: File) {
    setError(""); setFileName(file.name); setReading(true);
    try {
      const all = await readWorkbook(file);
      // Start on the first sheet that has any content.
      const first = Math.max(0, all.findIndex((s) => s.grid.some((r) => r.some(Boolean))));
      setSheets(all);
      loadSheet(all, first);
    } catch (e: any) {
      setSheets([]); setRows([]); setMap(null);
      setError(e?.message ?? "Couldn't read that file");
    } finally {
      setReading(false);
    }
  }

  function update(next: Partial<{ map: ColumnMap; headerRow: number; prefixCategory: boolean; stopAtBlank: boolean }>) {
    if (!grid || !map) return;
    const m = next.map ?? map;
    const h = next.headerRow ?? headerRow;
    const opts = { prefixCategory: next.prefixCategory ?? prefixCategory, stopAtBlank: next.stopAtBlank ?? stopAtBlank };
    if (next.map) setMap(next.map);
    if (next.headerRow != null) setHeaderRow(next.headerRow);
    if (next.prefixCategory != null) setPrefixCategory(next.prefixCategory);
    if (next.stopAtBlank != null) setStopAtBlank(next.stopAtBlank);
    rebuild(grid, h, m, opts);
  }
  function setColumn(key: Exclude<keyof ColumnMap, "name">, value: string) {
    if (map) update({ map: { ...map, [key]: value === NONE ? null : Number(value) } });
  }
  function setNamePart(pos: number, value: string) {
    if (!map) return;
    const parts: Array<number | null> = [map.name[0] ?? null, map.name[1] ?? null, map.name[2] ?? null];
    parts[pos] = value === NONE ? null : Number(value);
    const name = parts.filter((p, i, a): p is number => p != null && a.indexOf(p) === i);
    update({ map: { ...map, name } });
  }
  function setRow(i: number, patch: Partial<ImportRow>) {
    setRows((rs) => rs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([templateCsv()], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "products-import-template.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  const included = rows.filter((r) => r.include && r.name.trim());
  const blockedIncluded = included.filter((r) => issues.has(r.rowNumber));
  const stockRows = included.filter((r) => r.qty > 0).length;
  const sheetCats = Object.keys(catChoice);
  const newCats = sheetCats.filter((c) => catChoice[c] === NEW && included.some((r) => r.sheetCategory === c));
  const tooMany = included.length > MAX_ROWS;

  function submit() {
    setUnticked(rows.filter((r) => !r.include));
    onImport({
      receiveStock: canReceiveStock && receiveStock,
      reference: fileName ? `Import: ${fileName}`.slice(0, 120) : "Spreadsheet import",
      items: included.map((r) => {
        const choice = r.sheetCategory ? catChoice[r.sheetCategory] : defaultCategory;
        return {
          name: r.name.trim().replace(/\s+/g, " ").slice(0, 120),
          category_id: choice && choice !== NONE && choice !== NEW ? choice : null,
          new_category: choice === NEW ? r.sheetCategory : null,
          cost_price_pence: r.costPence,
          retail_price_pence: r.retailPence,
          qty: r.qty,
          sku: r.sku || null,
        };
      }),
    });
  }

  const columnSelect = (value: number | null | undefined, onChange: (v: string) => void, allowNone = true) => (
    <select value={value == null ? NONE : String(value)} onChange={(e) => onChange(e.target.value)} className={selectCls}>
      {allowNone && <option value={NONE}>— none —</option>}
      {header.map((h, i) => (h ? <option key={i} value={i}>{h}</option> : null))}
    </select>
  );

  if (result) {
    const catLabel = (id: string | null) => (id ? options.find((o) => o.id === id)?.label ?? "—" : "—");
    const skipped = [
      ...result.skipped,
      ...unticked.map((r) => ({ name: r.name, reason: issues.get(r.rowNumber)?.text ?? "Unticked in the preview" })),
    ];
    return (
      <Shell title="Import finished" onClose={onCancel}>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Stat label="Products added" value={result.created} />
          <Stat label="New categories" value={result.categoriesCreated} />
          <Stat label="Stock received" value={result.received} />
          <Stat label="Skipped" value={skipped.length} />
        </div>
        {result.newCategories.length > 0 && (
          <p className="mt-3 text-sm">New categories: <strong>{result.newCategories.join(", ")}</strong></p>
        )}
        {result.stockErrors.length > 0 && (
          <div className="mt-3 rounded-md border border-primary bg-primary/10 p-3 text-sm">
            <p className="font-semibold">Stock not received for these (receive it in Stock / Inventory):</p>
            <ul className="mt-1 list-disc pl-5">{result.stockErrors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
        {result.products.length > 0 && (
          <>
            <SectionLabel>Added</SectionLabel>
            <div className="mt-1 max-h-[40vh] overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-elevated text-[10px] uppercase tracking-widest text-ink-muted">
                  <tr>
                    <th className="px-2 py-2 text-left">Product</th>
                    <th className="px-2 py-2 text-left">Category</th>
                    <th className="px-2 py-2 text-right">Cost</th>
                    <th className="px-2 py-2 text-right">Retail</th>
                    <th className="px-2 py-2 text-right">Stock in</th>
                  </tr>
                </thead>
                <tbody>
                  {result.products.map((p) => (
                    <tr key={p.id || p.name} className="border-t border-border">
                      <td className="px-2 py-1.5 font-medium">{p.name}</td>
                      <td className="px-2 py-1.5 text-xs text-ink-muted">{catLabel(p.categoryId)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(p.costPence)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(p.retailPence)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{p.qtyReceived ? `+${p.qtyReceived}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {skipped.length > 0 && (
          <>
            <SectionLabel>Skipped (not imported)</SectionLabel>
            <div className="mt-1 max-h-[30vh] overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <tbody>
                  {skipped.map((r, i) => (
                    <tr key={i} className="border-t border-border first:border-t-0">
                      <td className="px-2 py-1.5">{r.name}</td>
                      <td className="px-2 py-1.5 text-xs text-ink-muted">{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="mt-4 flex justify-end">
          <Button onClick={onCancel}>Done</Button>
        </div>
      </Shell>
    );
  }

  const colName = (i: number | null | undefined) => (i == null ? null : header[i] || null);
  const summaryParts = map
    ? [
        `Name: ${map.name.map(colName).filter(Boolean).join(" + ") || "—"}`,
        colName(map.cost) && `Cost: ${colName(map.cost)}`,
        colName(map.retail) && `Retail: ${colName(map.retail)}`,
        colName(map.qty) && `Qty: ${colName(map.qty)}`,
      ].filter(Boolean)
    : [];
  const matchedCats = sheetCats.filter((c) => catChoice[c] !== NEW);
  const visibleCats = showAllCats ? sheetCats : sheetCats.filter((c) => catChoice[c] === NEW);
  const catSelect = (sc: string) => (
    <select value={catChoice[sc]} onChange={(e) => setCatChoice((c) => ({ ...c, [sc]: e.target.value }))} className={selectCls}>
      <option value={NEW}>Create new “{sc}”</option>
      <option value={NONE}>No category</option>
      {options.map((o) => <option key={o.id} value={o.id}>Put in {o.label}</option>)}
    </select>
  );

  return (
    <Shell title="Import from Excel / CSV" onClose={onCancel}>
      {/* Step 1: the file. Shrinks to one line once a file is loaded. */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f && !loadingExisting) void onFile(f); }}
        className={`mt-4 flex cursor-pointer items-center justify-center gap-3 rounded-md border-2 border-dashed px-4 text-center ${grid ? "py-3" : "flex-col py-8"} ${dragging ? "border-primary bg-primary/10" : "border-border bg-surface-elevated hover:border-primary"}`}
      >
        <FileSpreadsheet className="h-6 w-6 shrink-0 text-ink-muted" />
        <span className="text-sm font-semibold">
          {loadingExisting ? "Loading your products…" : reading ? "Reading…" : fileName || "Choose or drop an Excel (.xlsx) or CSV file"}
        </span>
        {grid && <span className="text-xs font-semibold text-primary-ink underline">Change file</span>}
        <input type="file" disabled={loadingExisting} accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.currentTarget.value = ""; }} />
      </label>
      {!grid && (
        <p className="mt-2 text-center text-xs text-ink-muted">
          Any product list works. Need a starting point?{" "}
          <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1 font-semibold text-primary-ink hover:underline">
            <Download className="h-3 w-3" /> Download a template
          </button>
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-primary">{error}</p>}

      {grid && map && (
        <>
          {/* What was read, in one line; the column settings stay out of the way. */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-elevated px-3 py-2 text-sm">
            <span>
              Found <strong>{rows.length}</strong> product{rows.length === 1 ? "" : "s"}
              {sheets.length > 1 && <> on “{sheets[sheetIdx]?.name}”</>}
              <span className="text-ink-muted"> · {summaryParts.join(" · ")}</span>
            </span>
            <button type="button" onClick={() => setShowColumns((v) => !v)} className="text-xs font-semibold text-primary-ink hover:underline">
              {showColumns ? "Hide settings" : "Not right? Adjust columns"}
            </button>
          </div>

          {showColumns && (
            <div className="mt-2 grid gap-3 rounded-md border border-border p-3 sm:grid-cols-3">
              {sheets.length > 1 && (
                <label className="grid gap-1 text-xs">Sheet
                  <select value={sheetIdx} onChange={(e) => loadSheet(sheets, Number(e.target.value))} className={selectCls}>
                    {sheets.map((sh, i) => <option key={i} value={i}>{sh.name}</option>)}
                  </select>
                </label>
              )}
              <label className="grid gap-1 text-xs">Headings are on
                <select value={headerRow} onChange={(e) => { const h = Number(e.target.value); update({ headerRow: h, map: guessColumns(grid[h] ?? []) }); }} className={selectCls}>
                  {grid.slice(0, 30).map((r, i) => r.some(Boolean) ? (
                    <option key={i} value={i}>Row {i + 1}: {r.filter(Boolean).slice(0, 3).join(", ").slice(0, 50)}</option>
                  ) : null)}
                </select>
              </label>
              <label className="grid gap-1 text-xs">Product name from {columnSelect(map.name[0], (v) => setNamePart(0, v), false)}</label>
              <label className="grid gap-1 text-xs">…plus {columnSelect(map.name[1], (v) => setNamePart(1, v))}</label>
              <label className="grid gap-1 text-xs">…plus {columnSelect(map.name[2], (v) => setNamePart(2, v))}</label>
              <label className="grid gap-1 text-xs">Category {columnSelect(map.category, (v) => setColumn("category", v))}</label>
              <label className="grid gap-1 text-xs">Cost price {columnSelect(map.cost, (v) => setColumn("cost", v))}</label>
              <label className="grid gap-1 text-xs">Selling price {columnSelect(map.retail, (v) => setColumn("retail", v))}</label>
              <label className="grid gap-1 text-xs">Quantity {columnSelect(map.qty, (v) => setColumn("qty", v))}</label>
              <label className="grid gap-1 text-xs">SKU {columnSelect(map.sku, (v) => setColumn("sku", v))}</label>
              <div className="grid gap-1.5 text-xs sm:col-span-3 sm:grid-cols-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={prefixCategory} onChange={(e) => update({ prefixCategory: e.target.checked })} />
                  Add the category to the name when it's missing
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={stopAtBlank} onChange={(e) => update({ stopAtBlank: e.target.checked })} />
                  Ignore everything after the first empty row
                </label>
              </div>
            </div>
          )}

          {/* Categories: only the ones that need a decision are shown. */}
          {sheetCats.length === 0 && rows.length > 0 && (
            <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              Put all products in
              <select value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)} className={`${selectCls} w-auto min-w-[200px]`}>
                <option value={NONE}>No category</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          )}
          {sheetCats.length > 0 && (
            <div className="mt-3 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">
                  {newCats.length > 0
                    ? `${sheetCats.filter((c) => catChoice[c] === NEW).length} categor${sheetCats.filter((c) => catChoice[c] === NEW).length === 1 ? "y is" : "ies are"} new — create them, or put the products in one you already have`
                    : "Categories"}
                </p>
                {matchedCats.length > 0 && (
                  <button type="button" onClick={() => setShowAllCats((v) => !v)} className="text-xs font-semibold text-primary-ink hover:underline">
                    {showAllCats ? "Show only new ones" : `Show all ${sheetCats.length}`}
                  </button>
                )}
              </div>
              {visibleCats.length > 0 && (
                <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                  {visibleCats.map((sc) => (
                    <label key={sc} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-2 text-sm">
                      <span className="truncate font-medium" title={sc}>{sc} <span className="text-xs text-ink-muted">({rows.filter((r) => r.sheetCategory === sc).length})</span></span>
                      {catSelect(sc)}
                    </label>
                  ))}
                </div>
              )}
              {!showAllCats && matchedCats.length > 0 && (
                <p className="mt-2 text-xs text-ink-muted">
                  Already in your categories: {matchedCats.map((c) => catChoice[c] === NONE ? `${c} → none` : `${c} → ${options.find((o) => o.id === catChoice[c])?.label ?? c}`).join(", ")}
                </p>
              )}
            </div>
          )}

          {/* The products. */}
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">Products</p>
            <p className="text-xs text-ink-muted">
              {issues.size > 0 && <span className="text-primary-ink">{issues.size} already exist or repeat and won't be added. </span>}
              Click a name or price to change it.
            </p>
          </div>
          <div className="mt-1 max-h-[45vh] overflow-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface-elevated text-[10px] uppercase tracking-widest text-ink-muted">
                <tr>
                  <th className="w-8 px-2 py-2">
                    <input type="checkbox" aria-label="Select all" checked={rows.length > 0 && rows.every((r) => r.include)}
                      onChange={(e) => setRows((rs) => rs.map((r) => ({ ...r, include: e.target.checked })))} />
                  </th>
                  <th className="px-2 py-2 text-left">Name</th>
                  <th className="px-2 py-2 text-left">Category</th>
                  <th className="px-2 py-2 text-right">Cost</th>
                  <th className="px-2 py-2 text-right">Selling price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const issue = issues.get(r.rowNumber);
                  const choice = r.sheetCategory ? catChoice[r.sheetCategory] : NONE;
                  return (
                    <tr key={`${sheetIdx}-${r.rowNumber}`} className={`border-t border-border align-top ${issue ? "bg-primary/10" : ""} ${r.include ? "" : "opacity-60"}`}>
                      <td className="px-2 py-1.5 text-center">
                        <input type="checkbox" aria-label={`Import ${r.name}`} checked={r.include} onChange={(e) => setRow(i, { include: e.target.checked })} />
                      </td>
                      <td className="px-2 py-1">
                        <input value={r.name} maxLength={120} aria-label={`Name (sheet row ${r.rowNumber})`}
                          onChange={(e) => setRow(i, { name: e.target.value })}
                          className="w-full min-w-[220px] rounded-sm border border-transparent bg-transparent px-1 py-0.5 hover:border-border focus:border-primary focus:bg-input focus:outline-none" />
                        {issue && <span className="block px-1 text-[11px] font-medium text-primary-ink">{issue.text}</span>}
                        {!r.name.trim() && <span className="block px-1 text-[11px] font-medium text-primary-ink">Name is empty</span>}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-ink-muted">
                        {!r.sheetCategory ? (defaultCategory === NONE ? "—" : options.find((o) => o.id === defaultCategory)?.label) : choice === NEW ? <>{r.sheetCategory} <span className="font-semibold text-primary-ink">new</span></> : choice === NONE ? "—" : options.find((o) => o.id === choice)?.label}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.costPence)}</td>
                      <td className="px-2 py-1 text-right">
                        <input key={`${r.rowNumber}-${r.retailPence}`} inputMode="decimal" aria-label={`Selling price for ${r.name}`}
                          defaultValue={r.retailPence ? (r.retailPence / 100).toFixed(2) : ""}
                          onBlur={(e) => {
                            const n = Number(e.target.value.replace(/[£,\s]/g, ""));
                            setRow(i, { retailPence: Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0 });
                          }}
                          placeholder="—" className="w-20 rounded-sm border border-border bg-input px-1.5 py-0.5 text-right tabular-nums" />
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-muted">No products found. Use “Adjust columns” above to point at the right headings.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {map.retail == null && (
            <p className="mt-1 text-xs text-ink-muted">No selling price in the sheet — add them here, or leave blank and the till will ask for a price.</p>
          )}

          {canReceiveStock && map.qty != null && (
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={receiveStock} onChange={(e) => setReceiveStock(e.target.checked)} />
              <span>
                Also receive the quantities as stock ({stockRows} {stockRows === 1 ? "product" : "products"}), at the cost price, dated today.
                <span className="block text-xs text-ink-muted">Leave off to add the products only and receive stock later in Stock / Inventory.</span>
              </span>
            </label>
          )}
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">
          {grid && (
            <>
              <strong className="text-foreground">{included.length}</strong> of {rows.length} rows will be imported
              {newCats.length > 0 && <> · {newCats.length} new categor{newCats.length === 1 ? "y" : "ies"}</>}
              {receiveStock && canReceiveStock && <> · stock for {stockRows}</>}.
              {blockedIncluded.length > 0 && <span className="text-primary-ink"> {blockedIncluded.length} ticked row(s) already exist or repeat; they'll be skipped.</span>}
              {tooMany && <span className="text-primary-ink"> Import at most {MAX_ROWS} at a time.</span>}
            </>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button disabled={saving || included.length === 0 || tooMany} onClick={submit}>
            {saving ? "Importing…" : `Import ${included.length || ""} product${included.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-5xl overflow-y-auto rounded-md border border-border bg-surface px-5 pb-5">
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-surface py-4">
          <h2 className="font-display text-2xl uppercase">{title}</h2>
          <Button variant="outline" size="icon" aria-label="Close" onClick={onClose}><X /></Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SectionLabel({ children, className = "mt-4" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[11px] font-semibold uppercase tracking-widest text-ink-muted ${className}`}>{children}</p>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-surface-elevated px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
