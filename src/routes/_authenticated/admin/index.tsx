import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AccountShell } from "@/components/AccountShell";
import { adminStats } from "@/lib/loyalty.functions";
import { getDbStorage } from "@/lib/db-storage.functions";
import { useAuth } from "@/lib/auth-client";
import { isOwnerEmail, BRAND } from "@/lib/brand";

function fmtBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function DbStorageCard() {
  const { user } = useAuth();
  const allowed = isOwnerEmail(user?.email);
  const fn = useServerFn(getDbStorage);
  const { data, error, isLoading } = useQuery({
    queryKey: ["db-storage"],
    queryFn: () => fn(),
    enabled: allowed,
    // Always show a fresh reading whenever an admin opens the dashboard.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
  if (!allowed) return null;
  const used = data?.usedBytes ?? 0;
  const total = data?.totalBytes ?? 0;
  const free = data?.freeBytes ?? 0;
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  return (
    <div className="mt-10 rounded-md border border-border bg-surface-elevated p-5">
      <p className="eyebrow">Database storage</p>
      {error ? (
        <p className="mt-3 text-sm text-primary">Couldn’t read storage: {(error as any)?.message ?? "unknown error"}</p>
      ) : isLoading || !data ? (
        <p className="mt-3 text-sm text-ink-muted">Checking…</p>
      ) : (
        <>
          <p className="mt-2 font-display text-3xl uppercase leading-none">{fmtBytes(free)} free</p>
          <p className="mt-1 text-xs text-ink-muted">
            {fmtBytes(used)} used of {fmtBytes(total)} ({pct.toFixed(1)}% used)
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface">
            <div className="h-full bg-primary" style={{ width: `${Math.max(pct, 1)}%` }} />
          </div>
          {data.topTables.length > 0 && (
            <ul className="mt-4 grid gap-1.5 text-xs text-ink-muted sm:grid-cols-2">
              {data.topTables.map((t) => (
                <li key={t.name} className="flex justify-between gap-3">
                  <span className="truncate">{t.name}</span>
                  <span>{fmtBytes(Number(t.bytes))}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}


export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: `Admin Dashboard — ${BRAND.name}` }] }),
  component: AdminDashboard,
  errorComponent: ({ error }) => <AccountShell title="Admin"><p className="text-sm text-primary">{error.message}</p></AccountShell>,
  notFoundComponent: () => <AccountShell title="Admin"><p>Not found</p></AccountShell>,
});

function AdminDashboard() {
  const fn = useServerFn(adminStats);
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: () => fn() });

  if (isLoading || !data) return <AccountShell title="Admin"><p>Loading…</p></AccountShell>;
  return (
    <AccountShell title="Admin Dashboard">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          label="Negative transactions"
          value={(data.negativeSalesCount ?? 0).toString()}
          sub={`Total £${((data.negativeSalesTotalPence ?? 0) / 100).toFixed(2)}`}
        />
      </div>

      <DbStorageCard />
    </AccountShell>
  );
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-elevated p-5">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-3xl uppercase leading-none">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}
