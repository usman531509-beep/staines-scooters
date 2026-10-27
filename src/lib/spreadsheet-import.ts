// Reads a product list from an Excel (.xlsx) or CSV file in the browser and
// turns it into product rows: finds the header row, guesses which column is
// which, and builds a product name when the sheet has no single title column
// (e.g. Category + Item / Model + Code). The parsing helpers are pure so they
// can be tested without a browser.

export type Grid = string[][];
export type Sheet = { name: string; grid: Grid };

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/** Every sheet of an .xlsx (in workbook order), or a .csv as one sheet. */
export async function readWorkbook(file: File): Promise<Sheet[]> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("That file is over 10 MB. Split it into smaller files.");
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") return [{ name: file.name, grid: parseCsv(await file.text()) }];
  if (name.endsWith(".xls")) throw new Error("Old .xls files can't be read. Open it in Excel and save as .xlsx (or CSV) first.");
  if (name.endsWith(".xlsx")) return readXlsx(new Uint8Array(await file.arrayBuffer()));
  throw new Error("Upload an Excel .xlsx or a .csv file.");
}

/** CSV (comma or semicolon separated, quoted cells allowed) as rows of trimmed text. */
export function parseCsv(text: string): Grid {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: Grid = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim()));
}

const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

async function readXlsx(bytes: Uint8Array): Promise<Sheet[]> {
  const { unzipSync, strFromU8 } = await import("fflate");
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("That file isn't a readable .xlsx workbook.");
  }
  const xml = (path: string) =>
    files[path] ? new DOMParser().parseFromString(strFromU8(files[path]), "application/xml") : null;

  const shared: string[] = [];
  const ss = xml("xl/sharedStrings.xml");
  if (ss) for (const si of els(ss, "si")) shared.push(els(si, "t").map((t) => t.textContent ?? "").join(""));

  const wb = xml("xl/workbook.xml");
  const rels = xml("xl/_rels/workbook.xml.rels");
  const relTarget = new Map(
    (rels ? els(rels, "Relationship") : []).map((r) => [r.getAttribute("Id") ?? "", r.getAttribute("Target") ?? ""]),
  );
  const sheets: Sheet[] = [];
  const entries = wb ? els(wb, "sheet") : [];
  entries.forEach((s, i) => {
    const relId = s.getAttributeNS(REL_NS, "id") || s.getAttribute("r:id") || "";
    const target = relTarget.get(relId) || `worksheets/sheet${i + 1}.xml`;
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
    const doc = xml(path);
    if (doc) sheets.push({ name: s.getAttribute("name") || `Sheet ${i + 1}`, grid: sheetGrid(doc, shared) });
  });
  if (!sheets.length) {
    const doc = xml("xl/worksheets/sheet1.xml");
    if (doc) sheets.push({ name: "Sheet 1", grid: sheetGrid(doc, shared) });
  }
  if (!sheets.length) throw new Error("Couldn't find a worksheet in that file.");
  return sheets;
}

function sheetGrid(sheet: Document, shared: string[]): Grid {
  const grid: Grid = [];
  for (const r of els(sheet, "row")) {
    const rowIdx = Number(r.getAttribute("r") ?? grid.length + 1) - 1;
    const out: string[] = [];
    for (const c of els(r, "c")) {
      const col = colIndex((c.getAttribute("r") ?? "").replace(/\d+/g, "")) ?? out.length;
      const t = c.getAttribute("t");
      const v = els(c, "v")[0]?.textContent ?? "";
      let val = v;
      if (t === "s") val = shared[Number(v)] ?? "";
      else if (t === "inlineStr") val = els(c, "t").map((x) => x.textContent ?? "").join("");
      else if (t === "b") val = v === "1" ? "TRUE" : "FALSE";
      out[col] = val.trim();
    }
    grid[rowIdx] = Array.from(out, (x) => x ?? "");
  }
  return Array.from(grid, (r) => r ?? []);
}

/** Elements by local name, whatever namespace prefix the file uses (x:row, row…). */
function els(node: Document | Element, name: string): Element[] {
  return Array.from(node.getElementsByTagNameNS("*", name));
}

function colIndex(letters: string): number | null {
  if (!letters) return null;
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export type ColumnMap = {
  category: number | null;
  /** Columns joined to make the product name, in order. */
  name: number[];
  cost: number | null;
  retail: number | null;
  qty: number | null;
  sku: number | null;
};

const HEADER_WORDS = /^(category|categories|type|group|item|items|model|item\s*\/\s*model|name|product|product name|title|description|details|code|code\s*\/\s*details|part|part\s*no\.?|sku|qty|quantity|unit|unit price.*|price.*|cost.*|retail.*|sell.*|line total.*|total.*|barcode)$/i;

/** The header row: the first row where at least two cells look like column names. */
export function findHeaderRow(grid: Grid): number {
  for (let i = 0; i < Math.min(grid.length, 25); i++) {
    const hits = (grid[i] ?? []).filter((c) => c && HEADER_WORDS.test(c.trim())).length;
    if (hits >= 2) return i;
  }
  return Math.max(0, grid.findIndex((r) => r.some(Boolean)));
}

/** Best guess at which column holds what, from the header names. */
export function guessColumns(header: string[]): ColumnMap {
  const find = (re: RegExp, skip: number[] = []) => {
    const i = header.findIndex((h, idx) => !skip.includes(idx) && re.test((h ?? "").trim()));
    return i >= 0 ? i : null;
  };
  const category = find(/^(category|categories|group|type)$/i);
  const title = find(/^(name|product|product name|title)$/i);
  const item = find(/item|model/i);
  const code = find(/code|details|part\s*no/i);
  const sku = find(/^sku$/i);
  const name = title != null ? [title] : [item, code].filter((x): x is number => x != null);
  // "Unit price" on a supplier order is what the shop paid; a bare "Price" is the selling price.
  const retail = find(/retail|sell|sale price|rrp|^price( \(£\))?$/i);
  const cost = find(/cost|unit price|buy|purchase/i, retail != null ? [retail] : []);
  const qty = find(/^(qty|quantity|stock)/i);
  return { category, name, cost, retail, qty, sku };
}

/** "£1,200.50" → 120050; blanks, text and negatives → 0. */
export function toPence(v: string | undefined): number {
  const n = Number(String(v ?? "").replace(/[£$€,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

export type ImportRow = {
  /** Row number as shown in Excel (1-based). */
  rowNumber: number;
  include: boolean;
  name: string;
  sheetCategory: string;
  costPence: number;
  retailPence: number;
  qty: number;
  sku: string;
};

/**
 * Data rows under the header. With `stopAtBlank`, the first blank row after the
 * data ends the list, so totals or summaries further down are left out.
 * With `prefixCategory`, the category starts the name unless the item already
 * mentions it ("Belt" + "PCX New" + "K1Z" → "Belt PCX New K1Z").
 */
export function buildRows(
  grid: Grid,
  headerRow: number,
  map: ColumnMap,
  opts: { prefixCategory: boolean; stopAtBlank: boolean },
): ImportRow[] {
  const out: ImportRow[] = [];
  for (let i = headerRow + 1; i < grid.length; i++) {
    const r = grid[i] ?? [];
    if (r.every((c) => !c)) {
      if (out.length && opts.stopAtBlank) break;
      continue;
    }
    const get = (idx: number | null) => (idx == null ? "" : (r[idx] ?? "").trim());
    const sheetCategory = get(map.category);
    const parts: string[] = [];
    const add = (p: string) => {
      if (p && !parts.join(" ").toLowerCase().includes(p.toLowerCase())) parts.push(p);
    };
    const nameParts = map.name.map(get).filter(Boolean);
    if (opts.prefixCategory && sheetCategory) {
      const firstWord = sheetCategory.split(/\s+/)[0].toLowerCase();
      if (!nameParts.join(" ").toLowerCase().includes(firstWord)) add(sheetCategory);
    }
    nameParts.forEach(add);
    const name = parts.join(" ").replace(/\s+/g, " ").slice(0, 120);
    if (!name) continue;
    out.push({
      rowNumber: i + 1,
      include: true,
      name,
      sheetCategory: sheetCategory.slice(0, 60),
      costPence: toPence(get(map.cost)),
      retailPence: toPence(get(map.retail)),
      qty: Math.max(0, Math.floor(Number(get(map.qty).replace(/[^0-9.]/g, "")) || 0)),
      sku: get(map.sku).slice(0, 40),
    });
  }
  return out;
}

/** Product-name key for duplicate checks: case and spacing don't matter. */
export const nameKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Matches a sheet category to an existing one, ignoring case and a trailing "s". */
export function matchCategory(sheetName: string, categories: Array<{ id: string; name: string }>): string | null {
  const norm = (s: string) => nameKey(s).replace(/s$/, "");
  const key = norm(sheetName);
  if (!key) return null;
  return categories.find((c) => norm(c.name) === key)?.id ?? null;
}

/** A starter file showing the columns the import understands. */
export function templateCsv(): string {
  return [
    "Category,Name,SKU,Cost price,Retail price,Qty",
    "Tyres,Michelin City Grip 100/80-16,,32.00,55.00,4",
    "Oils,Castrol Power1 10W-40 1L,,6.50,12.00,12",
  ].join("\n");
}
