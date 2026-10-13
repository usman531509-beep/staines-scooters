import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { StaffGuard } from "@/components/StaffGuard";
import { getInvoice } from "@/lib/invoice.functions";
import logoAsset from "@/assets/logo.png";
import { BRAND, BRAND_ADDRESS } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/staff/invoice/$saleId")({
  head: () => ({
    meta: [
      { title: `Invoice — ${BRAND.name}` },
      { name: "description", content: `Printable customer invoice for a ${BRAND.name} sale.` },
      { property: "og:title", content: `Invoice — ${BRAND.name}` },
      { property: "og:description", content: `Printable customer invoice for a ${BRAND.name} sale.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <StaffGuard perm="sales">
      <InvoicePrintPage />
    </StaffGuard>
  ),
});

const money = (p: number) => (p / 100).toFixed(2);

function InvoicePrintPage() {
  const { saleId } = Route.useParams();
  const getFn = useServerFn(getInvoice);
  const { data } = useQuery({ queryKey: ["invoice", saleId], queryFn: () => getFn({ data: { saleId } }) });
  const inv = data?.invoice;

  useEffect(() => {
    if (!inv) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [inv]);

  if (!inv) return <p className="p-6 text-sm">Preparing invoice…</p>;

  return (
    <div className="mx-auto max-w-[820px] bg-white p-10 text-black print:px-[14mm] print:py-[12mm]">
      {/* Zero page margins hide the browser's own title/date header and footer. */}
      <style>{"@page { margin: 0; }"}</style>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[19px] font-bold">{BRAND.legalName.toUpperCase()}</h1>
          <p className="text-[10px]">{BRAND_ADDRESS}</p>
          <p className="text-[11px]">Company Number: {BRAND.companyNumber}</p>
        </div>
        <img src={logoAsset} alt={BRAND.name} className="h-[62px] w-auto" />
      </div>

      <h2 className="mt-10 text-center text-[18px] font-bold">INVOICE</h2>

      <div className="mt-8 flex items-center justify-between text-[12px]">
        <span>Invoice Number: {inv.invoiceNumber}</span>
        <span>Date: {inv.dateLabel}</span>
      </div>

      <div className="mt-7 text-[12px]">
        <p className="font-bold">Client Information:</p>
        <p>Client: {inv.clientName}</p>
        <p>Vehicle Registration: {inv.registration}</p>
      </div>

      <table className="mt-8 w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-[#ebebeb]">
            <th className="border border-[#8c8c8c] px-2 py-1.5 text-left font-bold">Description</th>
            <th className="w-[110px] border border-[#8c8c8c] px-2 py-1.5 text-left font-bold">Quantity</th>
            <th className="w-[130px] border border-[#8c8c8c] px-2 py-1.5 text-right font-bold">Amount (£)</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l: any, i: number) => (
            <tr key={i}>
              <td className="border border-[#8c8c8c] px-2 py-1.5">{l.description}</td>
              <td className="border border-[#8c8c8c] px-2 py-1.5">{l.qty}</td>
              <td className="border border-[#8c8c8c] px-2 py-1.5 text-right">{money(l.amountPence)}</td>
            </tr>
          ))}
          <tr>
            <td className="border border-[#8c8c8c] px-2 py-1.5 font-bold">Total</td>
            <td className="border border-[#8c8c8c] px-2 py-1.5" />
            <td className="border border-[#8c8c8c] px-2 py-1.5 text-right font-bold">£{money(inv.totalPence)}</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-7 text-[12px] italic">Thank you for your business!</p>
      <p className="mt-3 text-[12px] italic">
        Please include your invoice number when making any correspondence.
      </p>

      <div className="mt-24 text-center">
        <p className="text-[10px] italic">
          {BRAND.legalName.toUpperCase()}, {BRAND_ADDRESS}
        </p>
        <p className="text-[10px] italic">Company Number: {BRAND.companyNumber}</p>
      </div>
    </div>
  );
}
