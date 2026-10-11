import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Bike, CalendarDays, Inbox, Package, PackageX, PoundSterling, Receipt, ShoppingBag, TrendingUp, TriangleAlert, Wrench,
  type LucideIcon,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AccountShell } from "@/components/AccountShell";
import { getDashboardOverview } from "@/lib/dashboard.functions";
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
    <div className="rounded-xl border border-border bg-surface-elevated p-5 shadow-sm">
      <p className="text-base font-semibold tracking-tight">Database storage</p>
      {error ? (
        <p className="mt-3 text-sm text-primary">Couldn’t read storage: {(error as any)?.message ?? "unknown error"}</p>
      ) : isLoading || !data ? (
        <p className="mt-3 text-sm text-ink-muted">Checking…</p>
      ) : (
        <>
          <p className="mt-2 text-2xl font-bold tracking-tight">{fmtBytes(free)} free</p>
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
  head: () => ({ meta: [{ title: `Dashboard — ${BRAND.name}` }] }),
  component: AdminDashboard,
  errorComponent: ({ error }) => <AccountShell title="Admin"><p className="text-sm text-primary">{error.message}</p></AccountShell>,
  notFoundComponent: () => <AccountShell title="Admin"><p>Not found</p></AccountShell>,
});

const gbp = (pence: number) =>
  (pence / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" });

const METHOD_LABEL: Record<string, string> = { cash: "Cash", card: "Card", bank_transfer: "Bank", split: "Split" };

function AdminDashboard() {
  const fn = useServerFn(getDashboardOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  return (
    <AccountShell title="Dashboard">
      {error ? (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      ) : isLoading || !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid gap-6">
          {/* Headline numbers */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icon={PoundSterling}
              label="Today's sales"
              value={gbp(data.today.salesPence)}
              sub={`${data.today.salesCount} ${data.today.salesCount === 1 ? "sale" : "sales"}${data.today.refundsPence ? ` · ${gbp(data.today.refundsPence)} refunded` : ""}`}
            />
            <Kpi icon={CalendarDays} label="Last 7 days" value={gbp(data.weekPence)} sub="Sales incl. today" />
            <Kpi icon={TrendingUp} label="This month" value={gbp(data.monthPence)} sub="Sales since the 1st" />
            <Kpi icon={Receipt} label="Expenses this month" value={gbp(data.monthExpensesPence)} sub="Recorded expenses" />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            {/* Sales chart */}
            <Card className="xl:col-span-2" title="Sales — last 7 days">
              <WeekChart week={data.week} />
            </Card>

            {/* Till + quick actions */}
            <div className="grid gap-6">
              <Card title="Till">
                {data.till ? (
                  <div className="flex items-center gap-3">
                    <span className="size-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">Open</p>
                      <p className="text-sm text-ink-muted">
                        Since {new Date(data.till.openedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · float {gbp(data.till.floatPence)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="size-2.5 rounded-full bg-ink-muted/40" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">Closed</p>
                      <p className="text-sm text-ink-muted">Open the till from the POS to start taking sales.</p>
                    </div>
                  </div>
                )}
              </Card>
              <Card title="Quick actions">
                <div className="grid grid-cols-2 gap-2">
                  <QuickLink to="/staff/pos" icon={Wrench} label="Open POS" />
                  <QuickLink to="/staff/products" icon={Package} label="Products" />
                  <QuickLink to="/staff/expenses" icon={Receipt} label="Add expense" />
                  <QuickLink to="/admin/rental" icon={Bike} label="Rentals" />
                </div>
              </Card>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            {/* Recent sales */}
            <Card
              className="xl:col-span-2"
              title="Recent sales"
              action={<Link to="/staff/sales" className="text-sm font-medium text-primary hover:underline">View all</Link>}
            >
              {data.recentSales.length === 0 ? (
                <Empty icon={ShoppingBag} text="No sales yet. Sales from the POS will show here." />
              ) : (
                <ul className="divide-y divide-border">
                  {data.recentSales.map((s) => (
                    <li key={s.id}>
                      <Link
                        to="/staff/sales/$saleId"
                        params={{ saleId: s.id }}
                        className="flex items-center justify-between gap-3 py-3 hover:text-primary"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {s.pos_customer?.name ?? "Walk-in customer"}
                            {s.receipt_no && <span className="ml-2 text-xs text-ink-muted">#{s.receipt_no}</span>}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {new Date(s.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            {s.payment_method && ` · ${METHOD_LABEL[s.payment_method] ?? s.payment_method}`}
                          </p>
                        </div>
                        <span className={`font-semibold tabular-nums ${s.amount_pence < 0 ? "text-destructive" : ""}`}>{gbp(s.amount_pence)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Things to look at */}
            <Card title="Needs attention">
              <ul className="grid gap-2">
                <AttentionRow
                  to="/admin/enquiries"
                  icon={Inbox}
                  label="New enquiries"
                  count={data.newEnquiriesCount}
                  detail={data.newEnquiries[0] ? `Latest: ${data.newEnquiries[0].name}${data.newEnquiries[0].service ? ` · ${data.newEnquiries[0].service}` : ""}` : "All caught up"}
                />
                <AttentionRow
                  to="/admin/inventory"
                  icon={PackageX}
                  label="Low stock"
                  count={data.lowStockCount}
                  detail={data.lowStock.length ? data.lowStock.map((p) => `${p.name} (${p.stock})`).join(", ") : "Stock levels are fine"}
                />
                <AttentionRow
                  to="/staff/sales"
                  icon={TriangleAlert}
                  label="Negative transactions"
                  count={data.negative.count}
                  detail={data.negative.count ? `Total ${gbp(data.negative.pence)}` : "None"}
                />
              </ul>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
                <MiniStat label="Products" value={data.productsCount} />
                <MiniStat label="Customers" value={data.customersCount} />
                <MiniStat label="Rentals" value={data.activeRentals} />
              </div>
            </Card>
          </div>

          <DbStorageCard />
        </div>
      )}
    </AccountShell>
  );
}

function Card({ title, action, className = "", children }: { title: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-xl border border-border bg-surface-elevated p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}

function WeekChart({ week }: { week: Array<{ day: string; pence: number }> }) {
  const max = Math.max(...week.map((d) => d.pence), 1);
  const total = week.reduce((s, d) => s + d.pence, 0);
  if (total === 0) return <Empty icon={TrendingUp} text="No sales in the last 7 days yet." />;
  return (
    <div className="flex h-56 items-end gap-3">
      {week.map((d) => {
        const date = new Date(`${d.day}T12:00:00`);
        return (
          <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <span className="text-xs font-medium tabular-nums text-ink-muted">{d.pence ? gbp(d.pence) : ""}</span>
            <div
              className="w-full max-w-14 rounded-t-md bg-primary/85 transition-all hover:bg-primary"
              style={{ height: `${Math.max((d.pence / max) * 100, d.pence ? 4 : 1)}%` }}
              title={`${d.day}: ${gbp(d.pence)}`}
            />
            <span className="text-xs text-ink-muted">{date.toLocaleDateString("en-GB", { weekday: "short" })}</span>
          </div>
        );
      })}
    </div>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <Icon className="size-4 text-primary" /> {label}
    </Link>
  );
}

function AttentionRow({ to, icon: Icon, label, count, detail }: { to: string; icon: LucideIcon; label: string; count: number; detail: string }) {
  return (
    <li>
      <Link to={to} className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-accent">
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${count ? "bg-primary/10 text-primary" : "bg-muted text-ink-muted"}`}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{label}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${count ? "bg-primary text-primary-foreground" : "bg-muted text-ink-muted"}`}>{count}</span>
          </span>
          <span className="block truncate text-xs text-ink-muted">{detail}</span>
        </span>
      </Link>
    </li>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-ink-muted">
      <Icon className="size-6 opacity-50" />
      {text}
    </div>
  );
}

/** Placeholder blocks in the dashboard's shape while it loads. */
function DashboardSkeleton() {
  const block = "animate-pulse rounded-xl bg-muted";
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className={`${block} h-32`} />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className={`${block} h-72 xl:col-span-2`} />
        <div className={`${block} h-72`} />
      </div>
    </div>
  );
}
