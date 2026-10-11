import { Printer } from "lucide-react";
import { printInPlace } from "@/lib/print-in-place";

/**
 * "Print Invoice" prints the invoice page in place (no new tab).
 */
export function InvoiceActions({ saleId }: { saleId: string }) {
  function print() {
    printInPlace(`/staff/invoice/${saleId}`);
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest hover:border-primary disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={print} className={btn}>
        <Printer className="h-3 w-3" /> Print Invoice
      </button>
    </div>
  );
}
