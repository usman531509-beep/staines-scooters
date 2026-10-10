import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AccountShell } from "@/components/AccountShell";
import { getReport } from "@/lib/loyalty.functions";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: `Reports — ${BRAND.name}` }] }),
  component: ReportsPage,
  errorComponent: ({ error }) => <AccountShell title="Reports"><p className="text-sm text-primary">{error.message}</p></AccountShell>,
  notFoundComponent: () => <AccountShell title="Reports"><p>Not found</p></AccountShell>,
});

const KINDS = ["sales", "audit"] as const;

function ReportsPage() {
  const fn = useServerFn(getReport);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [last, setLast] = useState<{ kind: string; rows: number } | null>(null);

  const mut = useMutation({
    mutationFn: (kind: (typeof KINDS)[number]) => fn({ data: { kind, fromDate: from || undefined, toDate: to || undefined } }),
    onSuccess: (res, kind) => {
      setLast({ kind, rows: res.rowCount });
      const blob = new Blob([res.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  return (
    <AccountShell title="Reports">
      <div className="grid gap-6 max-w-3xl">
        <div className="rounded-md border border-border bg-surface-elevated p-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs uppercase tracking-widest">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm" />
          </label>
          <label className="text-xs uppercase tracking-widest">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {KINDS.map((k) => (
            <button key={k} onClick={() => mut.mutate(k)} disabled={mut.isPending}
              className="rounded-sm border border-border bg-surface-elevated px-4 py-3 text-left text-sm font-semibold uppercase tracking-widest hover:border-primary disabled:opacity-50">
              Download {k} CSV
            </button>
          ))}
        </div>
        {last && <p className="text-sm text-ink-muted">Last export: {last.kind} ({last.rows} rows)</p>}
      </div>
    </AccountShell>
  );
}
