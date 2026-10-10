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

function Receipt() {
  const { saleId } = Route.useParams();
  const fn = useServerFn(getSaleFull);
  const { data } = useQuery({ queryKey: ["receipt", saleId], queryFn: () => fn({ data: { saleId } }) });

  useEffect(() => { if (data) setTimeout(() => window.print(), 400); }, [data]);

  if (!data) return <p className="p-10">Loading…</p>;
  const s: any = data.sale;
  const items: any[] = data.items;
  return (
    <div className="mx-auto max-w-sm bg-white p-6 text-black font-mono text-[13px] print:p-0">
      <h1 className="text-center text-lg font-bold uppercase">{BRAND.name}</h1>
      <p className="text-center text-xs">{BRAND_ADDRESS}</p>
      <p className="text-center text-xs">Tel: {BRAND.phone}</p>
      <hr className="my-3 border-black" />
      <p>Date: {ukDateTime(s.created_at)}</p>
      <p>Receipt: {String(s.receipt_no ?? s.id.slice(0, 8)).toUpperCase()}</p>
      {s.pos_customer && (
        <>
          <p>Customer: {s.pos_customer.name}</p>
          <p className="text-[11px]">{[s.pos_customer.phone, s.pos_customer.email].filter(Boolean).join(" · ")}</p>
        </>
      )}
      <hr className="my-3 border-black" />
      {items.length === 0 ? (
        <div className="flex justify-between"><span>{s.description}</span><span>{fmt(s.amount_pence)}</span></div>
      ) : (
        items.map((it) => (
          <div key={it.id} className="mb-1">
            <div className="flex justify-between">
              <span className="pr-2">{it.qty > 1 ? `${it.qty} × ` : ""}{it.name}</span>
              <span>{fmt(it.line_total_pence)}</span>
            </div>
            {it.discount_pence > 0 && (
              <div className="flex justify-between text-[11px]"><span>  discount</span><span>− {fmt(it.discount_pence)}</span></div>
            )}
          </div>
        ))
      )}
      <hr className="my-3 border-black" />
      {s.subtotal_pence > 0 && <div className="flex justify-between"><span>Subtotal</span><span>{fmt(s.subtotal_pence)}</span></div>}
      {s.discount_pence > 0 && <div className="flex justify-between"><span>Discount</span><span>− {fmt(s.discount_pence)}</span></div>}
      {s.tax_pence > 0 && <div className="flex justify-between"><span>VAT incl.</span><span>{fmt(s.tax_pence)}</span></div>}
      <div className="flex justify-between font-bold"><span>TOTAL</span><span>{fmt(s.amount_pence)}</span></div>
      <p className="mt-1 text-[11px]">Paid by: {String(s.payment_method ?? "cash").replace("_", " ").toUpperCase()}</p>
      {s.notes && <p className="mt-1 text-[11px]">Notes: {s.notes}</p>}
      <hr className="my-3 border-black" />
      <p className="text-center text-xs">Thank you for choosing {BRAND.name}</p>
      <div className="mt-6 text-center print:hidden">
        <button onClick={() => window.print()} className="rounded bg-black px-4 py-2 text-xs text-white">Print</button>
      </div>
    </div>
  );
}
