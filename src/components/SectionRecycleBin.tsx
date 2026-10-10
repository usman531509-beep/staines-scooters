import { ukDateTime } from "@/lib/format-date";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { listRecycled, purgeRecycled, restoreRecycled, type RecycleType } from "@/lib/recycle-bin.functions";

const LABELS: Record<RecycleType, string> = {
  products: "Products",
  categories: "Categories",
  expenses: "Expenses",
  refunds: "Refunds",
  sales: "Sales",
  claims: "Claims",
  rentals: "Rentals",
  rental_bikes: "Rental Bikes",
  rental_pcns: "Rental PCNs",
};

const fmtMoney = (p?: number | null) => `£${((p ?? 0) / 100).toFixed(2)}`;
const fmtDate = (s?: string | null) => (s ? ukDateTime(s) : "—");

function describe(type: RecycleType, row: any): string {
  switch (type) {
    case "products": return `${row.name}${row.sku ? ` · ${row.sku}` : ""} · ${fmtMoney(row.retail_price_pence)}`;
    case "categories": return row.name;
    case "expenses": return `${row.category}${row.vendor ? ` · ${row.vendor}` : ""} · ${fmtMoney(row.amount_pence)} · ${row.expense_date ?? ""}`;
    case "refunds": return `${row.refund_number ?? row.id.slice(0, 8)} · ${fmtMoney(row.amount_pence)}`;
    case "sales": return `#${row.receipt_no ?? row.id.slice(0, 8)} · ${fmtMoney(row.total_pence ?? row.amount_pence)}`;
    case "claims": return `${row.customer_full_name ?? "(no name)"}${row.claim_reference ? ` · ${row.claim_reference}` : ""}${row.vehicle_reg ? ` · ${row.vehicle_reg}` : ""}${row.accident_date ? ` · ${row.accident_date}` : ""}`;
    case "rentals": return `Rental ${row.id.slice(0, 8)} · ${row.start_date ?? ""} · ${fmtMoney(row.weekly_rate_pence)}/wk`;
    case "rental_bikes": return `${row.make ?? ""} ${row.model ?? ""} · ${row.registration ?? ""}`;
    case "rental_pcns": return `${row.reference ?? row.id.slice(0, 8)} · ${row.issued_on ?? ""} · ${fmtMoney(row.amount_pence)}`;
  }
}

export function SectionRecycleBin({
  type,
  title,
  invalidateKeys = [],
  initiallyOpen = false,
}: {
  type: RecycleType;
  title?: string;
  invalidateKeys?: Array<readonly unknown[]>;
  initiallyOpen?: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listRecycled);
  const restoreFn = useServerFn(restoreRecycled);
  const purgeFn = useServerFn(purgeRecycled);
  const [open, setOpen] = useState(initiallyOpen);
  const [msg, setMsg] = useState<string | null>(null);

  const items = useQuery({
    queryKey: ["recycle", type],
    queryFn: () => listFn({ data: { type } }),
    enabled: open,
    staleTime: 10_000,
  });

  const refreshLists = () => {
    qc.invalidateQueries({ queryKey: ["recycle", type] });
    qc.invalidateQueries({ queryKey: ["recycle-counts"] });
    invalidateKeys.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
  };

  const restore = useMutation({
    mutationFn: (id: string) => restoreFn({ data: { type, id } }),
    onSuccess: () => { setMsg("Restored."); refreshLists(); },
    onError: (e: any) => setMsg(e?.message ?? "Restore failed."),
  });

  const purge = useMutation({
    mutationFn: (id: string) => purgeFn({ data: { type, id } }),
    onSuccess: () => { setMsg("Deleted forever."); refreshLists(); },
    onError: (e: any) => setMsg(e?.message ?? "Delete failed."),
  });

  const rows = (items.data ?? []) as any[];
  const [detail, setDetail] = useState<any | null>(null);

  return (
    <section className="mb-5 rounded-md border border-border bg-surface-elevated">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 text-left text-xs font-semibold uppercase tracking-widest text-foreground hover:text-primary"
        >
          <Trash2 className="h-4 w-4" /> {title ?? `${LABELS[type]} Recycle Bin`} {open && rows.length > 0 ? `(${rows.length})` : ""}
        </button>
        {open && (
          <button
            type="button"
            onClick={() => items.refetch()}
            className="inline-flex items-center gap-1 rounded-sm border border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest hover:border-primary hover:text-primary"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-border">
          {msg && <p className="mx-4 mt-3 rounded-sm border border-border bg-surface px-3 py-2 text-xs text-primary">{msg}</p>}
          {items.isLoading ? (
            <p className="p-4 text-sm text-ink-muted">Loading recycle bin…</p>
          ) : items.error ? (
            <p className="p-4 text-sm text-primary">{(items.error as any)?.message ?? "Recycle bin failed to load."}</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">No deleted {LABELS[type].toLowerCase()}.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-auto">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <button type="button" onClick={() => setDetail(row)} className="min-w-0 text-left hover:text-primary">
                    <p className="truncate font-semibold">{describe(type, row)}</p>
                    <p className="text-xs text-ink-muted">Deleted {fmtDate(row.deleted_at)}</p>
                    {row.deleted_by_name && (
                      <p className="text-xs text-ink-muted">Deleted by {row.deleted_by_name}</p>
                    )}
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => { setMsg(null); restore.mutate(row.id); }}
                      disabled={restore.isPending}
                      className="inline-flex items-center gap-1 rounded-sm border border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (confirm("Delete forever? This cannot be undone.")) { setMsg(null); purge.mutate(row.id); } }}
                      disabled={purge.isPending}
                      className="inline-flex items-center gap-1 rounded-sm border border-primary bg-primary/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete forever
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-10" onClick={() => setDetail(null)}>
          <div className="w-full max-w-lg rounded-md border border-border bg-surface-elevated p-4" onClick={(ev) => ev.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest">Deleted {LABELS[type].replace(/s$/, "")} details</p>
              <button type="button" onClick={() => setDetail(null)} className="rounded-sm border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest hover:border-primary hover:text-primary">Close</button>
            </div>
            <p className="mb-3 text-sm font-semibold">{describe(type, detail)}</p>
            <dl className="divide-y divide-border text-sm">
              {Object.entries(detail)
                .filter(([k]) => !["deleted_by", "deleted_by_full_name", "deleted_by_name"].includes(k))
                .map(([k, v]) => (
                  <div key={k} className="flex flex-wrap justify-between gap-3 py-1.5">
                    <dt className="text-xs uppercase tracking-widest text-ink-muted">{k.replace(/_pence$/, " (£)").replace(/_/g, " ")}</dt>
                    <dd className="text-right">
                      {v === null || v === undefined || v === ""
                        ? "—"
                        : k === "deleted_at" || k === "created_at" || k === "updated_at"
                          ? fmtDate(String(v))
                          : k.endsWith("_pence")
                            ? fmtMoney(Number(v))
                            : typeof v === "object"
                              ? JSON.stringify(v)
                              : String(v)}
                    </dd>
                  </div>
                ))}
              {detail.deleted_by_full_name && (
                <div className="flex flex-wrap justify-between gap-3 py-1.5">
                  <dt className="text-xs uppercase tracking-widest text-ink-muted">Deleted by</dt>
                  <dd className="text-right">{detail.deleted_by_full_name}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}