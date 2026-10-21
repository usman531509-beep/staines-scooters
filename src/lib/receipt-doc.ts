// The till receipt as data, rendered the same way as the printed receipt
// (staff/receipt.$saleId.tsx) for the email body and the PDF that goes by
// email or WhatsApp. Pure and isomorphic: runs on the server and in the browser.
import { BRAND, BRAND_ADDRESS } from "@/lib/brand";

const fmt = (p: number) => `£${(p / 100).toFixed(2)}`;

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  split: "Card + Cash",
  bank_transfer: "Bank transfer",
  credit: "Credit (pay later)",
};

/** PNG copy of the printed receipt's logo (email clients and jsPDF can't use webp). */
export const RECEIPT_LOGO = { path: "/images/brand/staines-logo-receipt.png", width: 283, height: 168 };

type Row = { label: string; value: string; strong?: boolean };

export type ReceiptDoc = {
  receiptNo: string;
  site: string;
  info: Row[];
  items: Array<{ name: string; value: string; sub: string[] }>;
  totals: Row[];
  total: string;
  payment: Row[];
  notes: string | null;
  customerName: string | null;
};

/** Builds the receipt from getSaleFull's sale + items. */
export function buildReceiptDoc(s: any, items: any[]): ReceiptDoc {
  const method = String(s.payment_method ?? "cash");
  const cashPart = s.cash_part_pence ?? (method === "cash" ? s.amount_pence : 0);
  const change = s.cash_tendered_pence != null ? s.cash_tendered_pence - cashPart : 0;
  const itemDiscounts = items.reduce((t, it) => t + (it.discount_pence ?? 0), 0);
  const site = BRAND.siteUrl.replace(/^https?:\/\//, "");
  const receiptNo = String(s.receipt_no ?? s.id.slice(0, 8)).toUpperCase();
  const date = new Date(s.created_at).toLocaleString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "Europe/London",
  });

  const info: Row[] = [{ label: "Receipt", value: `#${receiptNo}` }, { label: "Date", value: date }];
  if (s.pos_customer) info.push({ label: "Customer", value: s.pos_customer.name });
  if (s.pos_customer?.phone) info.push({ label: "Phone", value: s.pos_customer.phone });

  const lines = items.length === 0
    ? [{ name: s.description || "Sale", value: fmt(s.amount_pence), sub: [] }]
    : items.map((it) => {
        const sub: string[] = [];
        if (it.qty > 1 || it.discount_pence > 0) {
          sub.push(`${it.qty} × ${fmt(it.unit_price_pence)}${it.discount_pence > 0 ? ` · discount −${fmt(it.discount_pence)}` : ""}`);
        }
        if (it.mileage != null) sub.push(`Mileage: ${it.mileage}`);
        return { name: it.name, value: fmt(it.line_total_pence), sub };
      });

  const totals: Row[] = [];
  if (s.subtotal_pence > 0) totals.push({ label: "Subtotal", value: fmt(s.subtotal_pence) });
  if (itemDiscounts > 0) totals.push({ label: "Item discounts", value: `−${fmt(itemDiscounts)}` });
  if (s.discount_pence > 0) totals.push({ label: "Discount", value: `−${fmt(s.discount_pence)}` });
  if (s.tax_pence > 0) totals.push({ label: "VAT included", value: fmt(s.tax_pence) });

  const payment: Row[] = [{ label: "Paid by", value: PAYMENT_LABELS[method] ?? method.replace("_", " ") }];
  if (method === "split") {
    payment.push({ label: "  Card", value: fmt(s.card_part_pence ?? 0) });
    payment.push({ label: "  Cash", value: fmt(s.cash_part_pence ?? 0) });
  }
  if (s.cash_tendered_pence != null && s.cash_tendered_pence > 0) {
    payment.push({ label: "Cash given", value: fmt(s.cash_tendered_pence) });
    payment.push({ label: "Change", value: fmt(Math.max(0, change)) });
  }
  if (method === "credit" && (s.credit_amount_pence ?? 0) > 0) {
    payment.push({ label: "Paid", value: fmt(s.credit_paid_pence ?? 0) });
    payment.push({
      label: "Balance owed",
      value: fmt(Math.max(0, s.credit_amount_pence - (s.credit_paid_pence ?? 0))),
      strong: true,
    });
  }

  return {
    receiptNo,
    site: site.startsWith("localhost") ? "" : site,
    info,
    items: lines,
    totals,
    total: fmt(s.amount_pence),
    payment,
    notes: s.notes || null,
    customerName: s.pos_customer?.name ?? null,
  };
}

const esc = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The receipt as an email body: an 80mm-wide monospace slip like the printed one. */
export function receiptEmailHtml(r: ReceiptDoc, logoUrl: string): string {
  const row = (x: Row) =>
    `<tr><td style="padding:1px 0;white-space:pre;${x.strong ? "font-weight:700;font-size:15px;" : ""}">${esc(x.label)}</td><td style="padding:1px 0;text-align:right;white-space:nowrap;${x.strong ? "font-weight:700;font-size:15px;" : ""}">${esc(x.value)}</td></tr>`;
  const table = (rows: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:12px">${rows}</table>`;
  const rule = `<div style="margin:12px 0;border-top:1px dashed #555"></div>`;
  const items = r.items
    .map(
      (it) =>
        `<tr><td style="padding:4px 0 0;font-weight:600">${esc(it.name)}</td><td style="padding:4px 0 0;text-align:right;white-space:nowrap">${esc(it.value)}</td></tr>` +
        it.sub.map((t) => `<tr><td colspan="2" style="padding:0 0 0 8px;font-size:11px;color:#555">${esc(t)}</td></tr>`).join(""),
    )
    .join("");
  return `<div style="background:#f3f3f3;padding:24px 8px">
<div style="max-width:320px;margin:0 auto;background:#fff;padding:22px 19px;font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.4;color:#000">
  <div style="text-align:center">
    <img src="${esc(logoUrl)}" alt="${esc(BRAND.name)}" width="94" style="display:block;margin:0 auto 8px;height:auto;border:0" />
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:800;text-transform:uppercase;letter-spacing:.04em">${esc(BRAND.name)}</div>
    ${BRAND_ADDRESS ? `<div>${esc(BRAND_ADDRESS)}</div>` : ""}
    <div>Tel: ${esc(BRAND.phone)}</div>
    ${r.site ? `<div>${esc(r.site)}</div>` : ""}
  </div>
  ${rule}${table(r.info.map(row).join(""))}
  ${rule}${table(items)}
  ${rule}${r.totals.length ? table(r.totals.map(row).join("")) : ""}
  <div style="margin-top:8px;border-top:2px solid #000;border-bottom:2px solid #000;padding:6px 0">${table(row({ label: "TOTAL", value: r.total, strong: true }))}</div>
  <div style="margin-top:8px">${table(r.payment.map(row).join(""))}</div>
  ${r.notes ? `<p style="margin:8px 0 0;font-size:11px">Notes: ${esc(r.notes)}</p>` : ""}
  ${rule}
  <div style="text-align:center">
    <div style="font-family:Arial,Helvetica,sans-serif;font-weight:700">Thank you for choosing ${esc(BRAND.name)}!</div>
    <div style="margin-top:4px;font-size:11px">Please keep this receipt for returns and warranty.</div>
  </div>
</div>
</div>`;
}

/** Plain-text version for mail clients that don't show HTML. */
export function receiptText(r: ReceiptDoc): string {
  const line = (x: Row) => `${x.label.trim()}: ${x.value}`;
  return [
    BRAND.name,
    BRAND_ADDRESS,
    `Tel: ${BRAND.phone}`,
    "",
    ...r.info.map(line),
    "",
    ...r.items.flatMap((it) => [`${it.name}: ${it.value}`, ...it.sub.map((t) => `  ${t}`)]),
    "",
    ...r.totals.map(line),
    `TOTAL: ${r.total}`,
    ...r.payment.map(line),
    r.notes ? `Notes: ${r.notes}` : "",
    "",
    `Thank you for choosing ${BRAND.name}!`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}

export const receiptFileName = (r: ReceiptDoc) => `${BRAND.name.replace(/\s+/g, "-")}-Receipt-${r.receiptNo}.pdf`;

/**
 * The receipt as an 80mm-wide PDF laid out like the printed slip. `logo` is a
 * PNG data URL; the page height grows to fit the sale.
 */
export async function receiptPdf(doc: ReceiptDoc, logo?: { dataUrl: string; width: number; height: number } | null) {
  const { jsPDF } = await import("jspdf");
  // The built-in PDF fonts have no U+2212 minus sign.
  const r: ReceiptDoc = JSON.parse(JSON.stringify(doc).replace(/\u2212|−/g, "-"));
  const W = 80;
  const M = 5;
  const inner = W - M * 2;

  // Draw twice: once to measure the height, then for real on a page that fits.
  const draw = (pdf: any | null) => {
    let y = 6;
    const font = (size: number, bold = false, family = "courier") => {
      if (!pdf) return;
      pdf.setFont(family, bold ? "bold" : "normal");
      pdf.setFontSize(size);
    };
    const lh = (size: number) => size * 0.42;
    const center = (text: string, size: number, bold = false, family = "courier") => {
      font(size, bold, family);
      const lines: string[] = pdf ? pdf.splitTextToSize(text, inner) : [text];
      for (const l of lines) {
        y += lh(size);
        pdf?.text(l, W / 2, y, { align: "center" });
      }
    };
    const row = (x: Row, size = 9) => {
      const s = x.strong ? size + 2 : size;
      font(s, !!x.strong);
      const valueW = pdf ? pdf.getTextWidth(x.value) : 20;
      const labels: string[] = pdf ? pdf.splitTextToSize(x.label, inner - valueW - 3) : [x.label];
      y += lh(s);
      pdf?.text(x.value, W - M, y, { align: "right" });
      labels.forEach((l, i) => {
        if (i > 0) y += lh(s);
        pdf?.text(l, M, y);
      });
      y += 0.6;
    };
    const rule = () => {
      y += 2.5;
      if (pdf) {
        pdf.setLineDashPattern([0.8, 0.8], 0);
        pdf.setLineWidth(0.2);
        pdf.line(M, y, W - M, y);
        pdf.setLineDashPattern([], 0);
      }
      y += 1.5;
    };

    if (logo) {
      const h = 14;
      const w = (logo.width / logo.height) * h;
      pdf?.addImage(logo.dataUrl, "PNG", (W - w) / 2, y, w, h);
      y += h + 1;
    }
    center(BRAND.name.toUpperCase(), 13, true, "helvetica");
    if (BRAND_ADDRESS) center(BRAND_ADDRESS, 8.5);
    center(`Tel: ${BRAND.phone}`, 8.5);
    if (r.site) center(r.site, 8.5);

    rule();
    r.info.forEach((x) => row(x));
    rule();
    for (const it of r.items) {
      row({ label: it.name, value: it.value });
      for (const t of it.sub) {
        font(8);
        const lines: string[] = pdf ? pdf.splitTextToSize(t, inner - 2) : [t];
        for (const l of lines) {
          y += lh(8);
          pdf?.text(l, M + 2, y);
        }
      }
      y += 1;
    }
    rule();
    r.totals.forEach((x) => row(x));
    y += 1.5;
    if (pdf) {
      pdf.setLineWidth(0.6);
      pdf.line(M, y, W - M, y);
    }
    y += 0.8;
    row({ label: "TOTAL", value: r.total, strong: true });
    y += 1.2;
    if (pdf) pdf.line(M, y, W - M, y);
    y += 1.5;
    r.payment.forEach((x) => row(x));
    if (r.notes) {
      font(8);
      const lines: string[] = pdf ? pdf.splitTextToSize(`Notes: ${r.notes}`, inner) : [r.notes];
      for (const l of lines) {
        y += lh(8);
        pdf?.text(l, M, y);
      }
    }
    rule();
    center(`Thank you for choosing ${BRAND.name}!`, 9.5, true, "helvetica");
    center("Please keep this receipt for returns and warranty.", 8);
    return y + 6;
  };

  // Measuring needs real text widths, so measure on a throwaway tall page.
  const probe = new jsPDF({ unit: "mm", format: [W, 2000] });
  const height = Math.max(100, Math.ceil(draw(probe)));
  const pdf = new jsPDF({ unit: "mm", format: [W, height] });
  pdf.setProperties({ title: `${BRAND.name} receipt #${r.receiptNo}` });
  draw(pdf);
  return pdf;
}
