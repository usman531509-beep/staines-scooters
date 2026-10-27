import { describe, it, expect, beforeAll } from "vitest";
import { strToU8, zipSync } from "fflate";
import { DOMParser } from "@xmldom/xmldom";
import {
  buildRows, findHeaderRow, guessColumns, matchCategory, nameKey, parseCsv, readWorkbook, toPence,
} from "./spreadsheet-import";

// A cut-down copy of the shop's supplier order: a title row, a header on row 3,
// product rows, then a blank row and a summary that must not be imported.
const ORDER = [
  ["STAINS Scooter - Garage Order"],
  [],
  ["Category", "Item / Model", "Code / Details", "Qty", "Unit", "Unit Price (£)", "Line Total (£)"],
  ["China Pads", "Pad Type 1", "China pad", "10", "pcs", "3", "30"],
  ["Belt", "PCX New", "K1Z", "2", "sets", "24", "48"],
  ["Air Filter", "Air Filter", "K1Z", "10", "pcs", "4", "40"],
  ["Variator Set", "Variator", "2DP", "2", "sets", "30", "60"],
  ["Side Mirror", "PCX Side Mirror", "Pair", "2", "sets", "16", "32"],
  [],
  ["Order Summary"],
  ["China Pads", "70", "210"],
];

describe("header and columns", () => {
  it("finds the header row below a title", () => {
    expect(findHeaderRow(ORDER)).toBe(2);
  });
  it("guesses a supplier order's columns, treating Unit Price as cost", () => {
    expect(guessColumns(ORDER[2])).toEqual({ category: 0, name: [1, 2], cost: 5, retail: null, qty: 3, sku: null });
  });
  it("treats a bare Price as the selling price and a Name column as the title", () => {
    expect(guessColumns(["Name", "Category", "SKU", "Cost price", "Price", "Qty"])).toEqual({
      category: 1, name: [0], cost: 3, retail: 4, qty: 5, sku: 2,
    });
  });
  it("falls back to the first non-empty row when nothing looks like a header", () => {
    expect(findHeaderRow([[], ["foo", "bar"], ["a", "b"]])).toBe(1);
  });
});

describe("building product rows", () => {
  const rows = buildRows(ORDER, 2, guessColumns(ORDER[2]), { prefixCategory: true, stopAtBlank: true });

  it("stops at the first blank row so the summary is left out", () => {
    expect(rows.map((r) => r.rowNumber)).toEqual([4, 5, 6, 7, 8]);
  });
  it("builds names from the item and code, adding the category only when missing", () => {
    expect(rows.map((r) => r.name)).toEqual([
      "Pad Type 1 China pad",
      "Belt PCX New K1Z",
      "Air Filter K1Z",
      "Variator 2DP",
      "PCX Side Mirror Pair",
    ]);
  });
  it("reads prices in pence and quantities", () => {
    expect(rows[1]).toMatchObject({ sheetCategory: "Belt", costPence: 2400, retailPence: 0, qty: 2 });
  });
  it("keeps going past blank rows when asked", () => {
    const all = buildRows(ORDER, 2, guessColumns(ORDER[2]), { prefixCategory: true, stopAtBlank: false });
    expect(all.map((r) => r.rowNumber)).toEqual([4, 5, 6, 7, 8, 10, 11]);
  });
  it("can leave the category off names", () => {
    const plain = buildRows(ORDER, 2, guessColumns(ORDER[2]), { prefixCategory: false, stopAtBlank: true });
    expect(plain[1].name).toBe("PCX New K1Z");
  });
});

describe("values", () => {
  it("parses money", () => {
    expect(toPence("£1,200.50")).toBe(120050);
    expect(toPence("3")).toBe(300);
    expect(toPence("")).toBe(0);
    expect(toPence("TBC")).toBe(0);
    expect(toPence("-5")).toBe(0);
  });
  it("compares names without case or extra spaces", () => {
    expect(nameKey("  Belt   PCX New ")).toBe("belt pcx new");
  });
  it("matches categories ignoring case and a plural s", () => {
    const cats = [{ id: "1", name: "Air Filters" }, { id: "2", name: "Belt Kits" }];
    expect(matchCategory("air filter", cats)).toBe("1");
    expect(matchCategory("Belt", cats)).toBeNull();
  });
});

describe("CSV", () => {
  it("handles quotes, commas in cells, CRLF and a BOM", () => {
    expect(parseCsv('﻿Name,Price\r\n"Tyre, 100/80","1,200"\r\nHelmet,"Say ""hi"""\r\n')).toEqual([
      ["Name", "Price"], ["Tyre, 100/80", "1,200"], ["Helmet", 'Say "hi"'],
    ]);
  });
  it("reads semicolon-separated files", () => {
    expect(parseCsv("Name;Price\nOil;12,50")).toEqual([["Name", "Price"], ["Oil", "12,50"]]);
  });
});

describe("xlsx", () => {
  beforeAll(() => {
    (globalThis as any).DOMParser = DOMParser;
  });

  // Same layout as the shop's file, which prefixes every tag with "x:".
  function workbook(sheets: Array<{ name: string; rows: string[][] }>) {
    const shared: string[] = [];
    const idx = (v: string) => (shared.includes(v) ? shared.indexOf(v) : shared.push(v) - 1);
    const col = (n: number) => String.fromCharCode(65 + n);
    const files: Record<string, Uint8Array> = {};
    sheets.forEach((sh, s) => {
      const rows = sh.rows
        .map((r, i) => `<x:row r="${i + 1}">${r.map((v, c) => (v === "" ? "" : /^\d+(\.\d+)?$/.test(v)
          ? `<x:c r="${col(c)}${i + 1}"><x:v>${v}</x:v></x:c>`
          : `<x:c r="${col(c)}${i + 1}" t="s"><x:v>${idx(v)}</x:v></x:c>`)).join("")}</x:row>`)
        .join("");
      files[`xl/worksheets/sheet${s + 1}.xml`] = strToU8(`<?xml version="1.0"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData>${rows}</x:sheetData></x:worksheet>`);
    });
    files["xl/sharedStrings.xml"] = strToU8(`<?xml version="1.0"?><x:sst xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${shared.map((v) => `<x:si><x:t>${v}</x:t></x:si>`).join("")}</x:sst>`);
    files["xl/workbook.xml"] = strToU8(`<?xml version="1.0"?><x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><x:sheets>${sheets.map((sh, s) => `<x:sheet name="${sh.name}" sheetId="${s + 1}" r:id="R${s}"/>`).join("")}</x:sheets></x:workbook>`);
    files["xl/_rels/workbook.xml.rels"] = strToU8(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, s) => `<Relationship Id="R${s}" Target="/xl/worksheets/sheet${s + 1}.xml" Type="worksheet"/>`).join("")}</Relationships>`);
    return new File([zipSync(files)], "order.xlsx");
  }

  it("reads every sheet, with x:-prefixed tags and absolute targets", async () => {
    const sheets = await readWorkbook(workbook([
      { name: "Garage Order", rows: [["Category", "Item / Model", "Unit Price (£)"], ["Belt", "PCX New", "24"]] },
      { name: "Notes", rows: [["hello"]] },
    ]));
    expect(sheets.map((s) => s.name)).toEqual(["Garage Order", "Notes"]);
    expect(sheets[0].grid).toEqual([["Category", "Item / Model", "Unit Price (£)"], ["Belt", "PCX New", "24"]]);
  });

  it("rejects old .xls and oversized files with a clear message", async () => {
    await expect(readWorkbook(new File(["x"], "old.xls"))).rejects.toThrow(/save as \.xlsx/);
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.xlsx");
    await expect(readWorkbook(big)).rejects.toThrow(/over 10 MB/);
  });
});
