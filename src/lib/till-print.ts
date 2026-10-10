/**
 * Printing for the till reports: an A4 sheet or an 80mm thermal roll.
 * The page is built in a hidden iframe and sent straight to the printer.
 */
import { BRAND, BRAND_ADDRESS } from "@/lib/brand";
export const SHOP = {
  name: BRAND.name,
  address: BRAND_ADDRESS,
  phone: BRAND.phone,
  email: BRAND.email,
};

export type PrintColumn = { label: string; align?: "left" | "right" | "center" };

export type PrintPayload = {
  title: string;
  subtitle?: string;
  columns: PrintColumn[];
  rows: (string | number)[][];
  totals?: { label: string; value: string }[];
  /** Marks refunded rows so they print in red. */
  refundedRows?: boolean[];
  /** true = 80mm thermal roll, false = A4 sheet. */
  thermal?: boolean;
};

export const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const money = (pence: unknown) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(pence ?? 0) / 100);

export const dstr = (d: unknown) => (d ? new Date(String(d)).toLocaleString("en-GB") : "—");

function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const fire = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      /* printer unavailable */
    }
    window.setTimeout(() => frame.remove(), 1500);
  };
  if (frame.contentWindow?.document.readyState === "complete") fire();
  else frame.onload = fire;
}

function headerHtml(title: string, subtitle?: string) {
  return `
  <div class="hd">
    <div>
      <div class="co">${esc(SHOP.name)}</div>
      <div class="sm">${esc(SHOP.address)}</div>
      <div class="sm">Tel: ${esc(SHOP.phone)} · ${esc(SHOP.email)}</div>
    </div>
    <div class="right">
      <div class="ti">${esc(title)}</div>
      ${subtitle ? `<div class="sb">${esc(subtitle)}</div>` : ""}
      <div class="sm">Generated: ${esc(new Date().toLocaleString("en-GB"))}</div>
    </div>
  </div>`;
}

function footerHtml() {
  return `<div class="ft">${esc(SHOP.name)} · Tel: ${esc(SHOP.phone)} · ${esc(SHOP.email)}</div>`;
}

/** Report printed on A4 or on the 80mm thermal roll, in the shop's red/black styling. */
export function tillPrint({ title, subtitle, columns, rows, totals, refundedRows, thermal }: PrintPayload) {
  const css = thermal
    ? `@page{size:80mm auto;margin:4mm}body{width:72mm;font:11px/1.35 'Courier New',monospace;color:#000}
       .hd{display:block;text-align:center;border-bottom:1px dashed #000;padding-bottom:4px;margin-bottom:6px}
       .hd .right{margin-top:4px}.co{font-size:13px;font-weight:700;text-transform:uppercase}
       .ti{font-size:12px;font-weight:700;text-transform:uppercase}
       .sb{font-size:10px}.sm{font-size:9px}
       table{width:100%;border-collapse:collapse}th,td{padding:1px 0;font-size:10px}
       th{border-bottom:1px solid #000;text-align:left;text-transform:uppercase}
       .tot{border-top:1px dashed #000;margin-top:6px;padding-top:4px}
       .tot div{display:flex;justify-content:space-between;font-size:11px;font-weight:700}
       .tot span{text-transform:uppercase}
       .ft{margin-top:8px;border-top:1px dashed #000;padding-top:4px;text-align:center;font-size:9px}
       tr.refunded td{color:#c8102e;font-weight:700}`
    : `@page{size:A4;margin:16mm}body{font:12px/1.45 Arial,Helvetica,sans-serif;color:#111}
       .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c8102e;padding-bottom:10px;margin-bottom:14px}
       .co{font-size:19px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:#c8102e}
       .ti{font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
       .right{text-align:right}.sb{font-size:12px;font-weight:600}.sm{font-size:10px;color:#555}
       table{width:100%;border-collapse:collapse;margin-top:4px}
       th{background:#c8102e;color:#fff;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;padding:6px;text-align:left}
       td{padding:5px 6px;border-bottom:1px solid #e5e7eb;font-size:11px}
       tr:nth-child(even) td{background:#fafafa}
       .tot{margin-top:12px;display:flex;flex-wrap:wrap;gap:8px}
       .tot div{border:1.5px solid #111;padding:6px 10px;min-width:130px}
       .tot span{display:block;font-size:9.5px;text-transform:uppercase;color:#555}
       .tot b{font-size:15px}
       .ft{margin-top:18px;border-top:1px solid #d4d4d4;padding-top:6px;text-align:center;font-size:9.5px;color:#555}
       tr.refunded td{color:#c8102e;font-weight:700}`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>
    ${headerHtml(title, subtitle)}
    <table><thead><tr>${columns
      .map((c) => `<th style="text-align:${c.align ?? "left"}">${esc(c.label)}</th>`)
      .join("")}</tr></thead>
    <tbody>${
      rows.length
        ? rows
            .map(
              (r, rowIndex) =>
                `<tr${refundedRows?.[rowIndex] ? ` class="refunded"` : ""}>${r
                  .map((cell, i) => `<td style="text-align:${columns[i]?.align ?? "left"}">${esc(cell)}</td>`)
                  .join("")}</tr>`,
            )
            .join("")
        : `<tr><td colspan="${columns.length}" style="text-align:center;padding:14px">No records for this period.</td></tr>`
    }</tbody></table>
    ${totals?.length ? `<div class="tot">${totals.map((t) => `<div><span>${esc(t.label)}</span><b>${esc(t.value)}</b></div>`).join("")}</div>` : ""}
    ${footerHtml()}
  </body></html>`;

  printHtml(html);
}

export type ThermalSaleLine = {
  order: string;
  dateTime: string;
  type?: string | null;
  status: string;
  vat: number;
  total: number;
  tendered?: number | null;
  refunded?: boolean;
};

/** 80mm sales report in the classic till-roll layout. */
export function tillPrintThermalSales({
  periodLabel,
  sales,
}: {
  periodLabel: string;
  sales: ThermalSaleLine[];
}) {
  const css = `@page{size:80mm auto;margin:4mm}
    body{width:72mm;font:11px/1.4 'Courier New',monospace;color:#000}
    .hd{text-align:center;margin-bottom:6px}
    .co{font-size:15px;font-weight:700;text-transform:uppercase}
    .ad{font-size:10px}
    .ti{font-size:14px;font-weight:700;letter-spacing:.06em;margin-top:6px}
    .sb{font-size:10px}
    .rule{border-top:2px solid #000;margin:6px 0}
    table.hdr{width:100%;border-collapse:collapse;font-size:11px;font-weight:700;text-transform:uppercase}
    .blk{margin:6px 0}.blk.refunded{color:#c8102e;font-weight:700}
    .r1{display:flex;justify-content:space-between;font-size:13px;font-weight:700}
    .r2{font-size:10px;margin-top:2px}
    .ln{display:flex;justify-content:space-between;font-size:11px}
    .sep{border-top:1px solid #000;margin:6px 0}
    .sum{margin-top:8px}.sum .ln{margin:1px 0}
    .top-sum{margin:6px 0 2px;text-align:center;font-size:13px;font-weight:700;line-height:1.5}
    .end{text-align:center;margin-top:10px;font-size:10px;letter-spacing:.08em}`;

  const orders = sales.length
    ? sales
        .map(
          (s) => `
      <div class="blk${s.refunded ? " refunded" : ""}">
        <div class="r1"><span>${esc(s.order)}</span><span>${esc(money(s.total))}</span></div>
        <div class="r2">${esc(s.dateTime)}</div>
        <div class="r2">${esc([s.type, s.status].filter(Boolean).join("  –  "))}</div>
        ${s.tendered != null ? `<div class="ln"><span>Cash tendered</span><span>${esc(money(s.tendered))}</span></div>` : ""}
      </div>
      <div class="sep"></div>`,
        )
        .join("")
    : `<div class="blk" style="text-align:center;padding:10px 0">No sales in this period.</div>`;

  const salesShown = sales.reduce((a, s) => a + Number(s.total ?? 0), 0);

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Sales Report</title><style>${css}</style></head><body>
    <div class="hd">
      <div class="co">${esc(SHOP.name)}</div>
      <div class="ad">${esc(SHOP.address)}</div>
      <div class="ad">Tel: ${esc(SHOP.phone)}</div>
      <div class="ti">SALES REPORT</div>
      <div class="sb">Period: ${esc(periodLabel)}</div>
      <div class="sb">Generated: ${esc(new Date().toLocaleString("en-GB"))}</div>
      <div class="top-sum">Orders shown ${sales.length}<br>Sales shown ${esc(money(salesShown))}</div>
    </div>
    <div class="rule"></div>
    <table class="hdr"><tr><td>ORDER DETAILS</td><td style="text-align:right">TOTAL</td></tr></table>
    <div class="rule"></div>
    ${orders}
    <div class="sum">
      <div class="ln"><span>Orders shown</span><span>${sales.length}</span></div>
      <div class="ln" style="font-weight:700;font-size:13px"><span>Sales shown</span><span>${esc(money(salesShown))}</span></div>
    </div>
    <div class="rule"></div>
    <div class="end">END OF REPORT</div>
  </body></html>`;

  printHtml(html);
}
