import { ukDateTime } from "@/lib/format-date";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getSaleFull } from "@/lib/pos.functions";
import { BRAND, BRAND_ADDRESS } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/staff/receipt/$saleId")({
  head: () => ({ meta: [{ title: `Receipt — ${BRAND.name}` }] }),
  component: Receipt,
  errorComponent: ({ error }) => <p className="p-10">{error.message}</p>,
  notFoundComponent: () => <p className="p-10">Not found</p>,
});

const fmt = (p: number) => `£${(p / 100).toFixed(2)}`;

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  split: "Card + Cash",
  bank_transfer: "Bank transfer",
};

// Zero page margins stop the browser printing its own title/date/URL header and
// footer; the receipt keeps its own padding. 80mm wide suits till printers and
// sits centred on A4.
const PRINT_CSS = `
@page { margin: 0; }
@media print {
  html, body { background: #fff !important; }
  .receipt-sheet { box-shadow: none !important; margin: 0 auto !important; }
}
`;

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? "text-[15px] font-bold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Rule() {
  return <div className="my-3 border-t border-dashed border-black/60" />;
}

function Receipt() {
  const { saleId } = Route.useParams();
  const fn = useServerFn(getSaleFull);
  const { data } = useQuery({ queryKey: ["receipt", saleId], queryFn: () => fn({ data: { saleId } }) });

  useEffect(() => { if (data) setTimeout(() => window.print(), 400); }, [data]);

  if (!data) return <p className="p-10">Loading…</p>;
  const s: any = data.sale;
  const items: any[] = data.items;
  const method = String(s.payment_method ?? "cash");
  const cashPart = s.cash_part_pence ?? (method === "cash" ? s.amount_pence : 0);
  const change = s.cash_tendered_pence != null ? s.cash_tendered_pence - cashPart : 0;
  const itemDiscounts = items.reduce((t, it) => t + (it.discount_pence ?? 0), 0);
  const site = BRAND.siteUrl.replace(/^https?:\/\//, "");

  return (
    <div className="min-h-screen bg-white py-6 print:py-0">
      <style>{PRINT_CSS}</style>
      <div className="receipt-sheet mx-auto w-[80mm] bg-white px-[5mm] py-[6mm] font-mono text-[12px] leading-snug text-black">
        <header className="text-center">
          <img src="/images/brand/staines-logo.webp" alt="" className="mx-auto mb-2 h-14 w-auto" />
          <h1 className="font-sans text-[17px] font-extrabold uppercase tracking-wide">{BRAND.name}</h1>
          {BRAND_ADDRESS && <p>{BRAND_ADDRESS}</p>}
          <p>Tel: {BRAND.phone}</p>
          {!site.startsWith("localhost") && <p>{site}</p>}
        </header>

        <Rule />
        <div className="space-y-0.5">
          <Row label="Receipt" value={`#${String(s.receipt_no ?? s.id.slice(0, 8)).toUpperCase()}`} />
          <Row label="Date" value={ukDateTime(s.created_at)} />
          {s.pos_customer && <Row label="Customer" value={s.pos_customer.name} />}
          {s.pos_customer?.phone && <Row label="Phone" value={s.pos_customer.phone} />}
        </div>

        <Rule />
        {items.length === 0 ? (
          <Row label={s.description || "Sale"} value={fmt(s.amount_pence)} />
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{it.name}</span>
                  <span className="tabular-nums">{fmt(it.line_total_pence)}</span>
                </div>
                {(it.qty > 1 || it.discount_pence > 0) && (
                  <div className="pl-2 text-[11px] text-black/70">
                    {it.qty} × {fmt(it.unit_price_pence)}
                    {it.discount_pence > 0 && ` · discount −${fmt(it.discount_pence)}`}
                  </div>
                )}
                {it.mileage != null && <div className="pl-2 text-[11px] text-black/70">Mileage: {it.mileage}</div>}
              </div>
            ))}
          </div>
        )}

        <Rule />
        <div className="space-y-0.5">
          {s.subtotal_pence > 0 && <Row label="Subtotal" value={fmt(s.subtotal_pence)} />}
          {itemDiscounts > 0 && <Row label="Item discounts" value={`−${fmt(itemDiscounts)}`} />}
          {s.discount_pence > 0 && <Row label="Discount" value={`−${fmt(s.discount_pence)}`} />}
          {s.tax_pence > 0 && <Row label="VAT included" value={fmt(s.tax_pence)} />}
        </div>
        <div className="mt-2 border-y-2 border-black py-1.5">
          <Row label="TOTAL" value={fmt(s.amount_pence)} strong />
        </div>

        <div className="mt-2 space-y-0.5">
          <Row label="Paid by" value={PAYMENT_LABELS[method] ?? method.replace("_", " ")} />
          {method === "split" && (
            <>
              <Row label="  Card" value={fmt(s.card_part_pence ?? 0)} />
              <Row label="  Cash" value={fmt(s.cash_part_pence ?? 0)} />
            </>
          )}
          {s.cash_tendered_pence != null && s.cash_tendered_pence > 0 && (
            <>
              <Row label="Cash given" value={fmt(s.cash_tendered_pence)} />
              <Row label="Change" value={fmt(Math.max(0, change))} />
            </>
          )}
        </div>
        {s.notes && <p className="mt-2 text-[11px]">Notes: {s.notes}</p>}

        <Rule />
        <footer className="text-center">
          <p className="font-sans font-bold">Thank you for choosing {BRAND.name}!</p>
          <p className="mt-1 text-[11px]">Please keep this receipt for returns and warranty.</p>
        </footer>
      </div>
      <div className="mt-6 text-center print:hidden">
        <button onClick={() => window.print()} className="rounded bg-black px-4 py-2 text-xs text-white">Print</button>
      </div>
    </div>
  );
}
