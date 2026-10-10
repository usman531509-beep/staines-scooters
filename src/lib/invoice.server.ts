// Server-only invoice builder: assembles invoice data from a sale for the
// printable invoice page.
export interface InvoiceLine {
  description: string;
  qty: number;
  amountPence: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  dateLabel: string;
  clientName: string;
  registration: string;
  lines: InvoiceLine[];
  totalPence: number;
}

function ukDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/** Builds invoice fields from a sale row + its line items. */
export function buildInvoiceData(sale: any, items: any[], registration?: string | null): InvoiceData {
  const reg = (registration ?? "").toUpperCase().trim();
  const clientName = sale?.pos_customer?.name || sale?.profile?.full_name || "Walk-in customer";
  const lines: InvoiceLine[] = (items ?? []).map((it: any) => ({
    description: it.name + (it.description ? ` — ${it.description}` : ""),
    qty: Number(it.qty ?? 1),
    amountPence: Math.max(
      0,
      Math.round((Number(it.qty ?? 1)) * Number(it.unit_price_pence ?? 0)) - Number(it.discount_pence ?? 0),
    ),
  }));
  if (lines.length === 0) {
    lines.push({
      description: sale?.description || "Goods / services supplied",
      qty: 1,
      amountPence: Number(sale?.amount_pence ?? 0),
    });
  }
  const totalPence = Number(sale?.amount_pence ?? lines.reduce((s, l) => s + l.amountPence, 0));
  const saleReference = String(sale?.receipt_no ?? "").replace(/\D/g, "");
  const fallbackReference = String(sale?.id ?? "").replace(/\D/g, "").slice(0, 8);
  const ref = saleReference || fallbackReference || "0";
  return {
    invoiceNumber: ref,
    dateLabel: ukDate(sale?.created_at ?? new Date().toISOString()),
    clientName,
    registration: reg || "—",
    lines,
    totalPence,
  };
}
