import { ukDateTime } from "@/lib/format-date";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { AccountShell } from "@/components/AccountShell";
import { RECYCLE_TYPES, listRecycled, restoreRecycled, purgeRecycled, type RecycleType } from "@/lib/recycle-bin.functions";
import { BRAND } from "@/lib/brand";

const searchSchema = z.object({ tab: z.enum(RECYCLE_TYPES).optional() });

export const Route = createFileRoute("/_authenticated/admin/recycle")({
  head: () => ({ meta: [{ title: `Recycle Bin — ${BRAND.name}` }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: Recycle,
  errorComponent: ({ error }) => <AccountShell title="Recycle Bin"><p className="text-sm text-primary">{error.message}</p></AccountShell>,
  notFoundComponent: () => <AccountShell title="Recycle Bin"><p>Not found</p></AccountShell>,
});

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
    case "products":       return `${row.name}${row.sku ? ` · ${row.sku}` : ""} · ${fmtMoney(row.retail_price_pence)}`;
    case "categories":     return row.name;
    case "expenses":       return `${row.category}${row.vendor ? ` · ${row.vendor}` : ""} · ${fmtMoney(row.amount_pence)} · ${row.expense_date ?? ""}`;
    case "refunds":        return `${row.refund_number ?? row.id.slice(0, 8)} · ${fmtMoney(row.amount_pence)}`;
    case "sales":          return `#${row.receipt_no ?? row.id.slice(0, 8)} · ${fmtMoney(row.amount_pence)}`;
    case "claims":         return `${row.customer_full_name ?? "(no name)"}${row.claim_reference ? ` · ${row.claim_reference}` : ""}${row.vehicle_reg ? ` · ${row.vehicle_reg}` : ""}${row.accident_date ? ` · ${row.accident_date}` : ""}`;
    case "rentals":        return `Rental ${row.id.slice(0, 8)} · ${row.start_date ?? ""} · ${fmtMoney(row.weekly_rate_pence)}/wk`;
    case "rental_bikes":   return `${row.make ?? ""} ${row.model ?? ""} · ${row.registration ?? ""}`;
    case "rental_pcns":    return `${row.reference ?? row.id.slice(0, 8)} · ${row.issued_on ?? ""} · ${fmtMoney(row.amount_pence)}`;
  }
}

function Recycle() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const active: RecycleType = tab ?? "products";

  const qc = useQueryClient();
  const listFn = useServerFn(listRecycled);
  const restoreFn = useServerFn(restoreRecycled);
  const purgeFn = useServerFn(purgeRecycled);

  const items = useQuery({
    queryKey: ["recycle", active],
    queryFn: () => listFn({ data: { type: active } }),
  });

  const [msg, setMsg] = useState<string | null>(null);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["recycle", active] });
  };

  const restore = useMutation({
    mutationFn: (id: string) => restoreFn({ data: { type: active, id } }),
    onSuccess: () => { setMsg("Restored."); invalidate(); },
    onError: (e: any) => setMsg(e?.message ?? "Restore failed."),
  });
  const purge = useMutation({
    mutationFn: (id: string) => purgeFn({ data: { type: active, id } }),
    onSuccess: () => { setMsg("Permanently deleted."); invalidate(); },
    onError: (e: any) => setMsg(e?.message ?? "Delete failed."),
  });

  return (
    <AccountShell title="Recycle Bin">
      <div className="mb-5 flex flex-wrap gap-2">
        {RECYCLE_TYPES.map((t) => {
          const isActive = t === active;
          return (
            <button
              key={t}
              onClick={() => { setMsg(null); navigate({ search: { tab: t }, replace: true }); }}
              className={`rounded-sm border px-3 py-2 text-xs font-semibold uppercase tracking-widest transition ${isActive ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-ink-muted hover:border-primary hover:text-primary"}`}
            >
              {LABELS[t]}
            </button>
          );
        })}
      </div>

      {msg && <p className="mb-3 rounded-sm border border-border bg-surface-elevated px-3 py-2 text-xs text-primary">{msg}</p>}

      <div className="rounded-md border border-border bg-surface">
        {items.isLoading ? (
          <p className="p-6 text-sm text-ink-muted">Loading…</p>
        ) : (items.data ?? []).length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">The {LABELS[active].toLowerCase()} recycle bin is empty.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(items.data as any[]).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{describe(active, row)}</p>
                  <p className="text-xs text-ink-muted">Deleted {fmtDate(row.deleted_at)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setMsg(null); restore.mutate(row.id); }}
                    disabled={restore.isPending}
                    className="rounded-sm border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-widest hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => { if (confirm("Permanently delete? This cannot be undone.")) { setMsg(null); purge.mutate(row.id); } }}
                    disabled={purge.isPending}
                    className="rounded-sm border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                  >
                    Delete forever
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AccountShell>
  );
}
