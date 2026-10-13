import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowRight, Bike, CalendarDays, Inbox, Package, PackageX, PoundSterling, Receipt, ShoppingBag, TrendingUp, TriangleAlert, Users, Wrench,
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
    <div className="rounded-2xl border border-border/70 bg-surface-elevated p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_8px_24px_-12px_rgb(15_23_42/0.12)] sm:p-6">
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
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-sky-400" style={{ width: `${Math.max(pct, 1)}%` }} />
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
          <Welcome till={data.till} todayPence={data.today.salesPence} todayCount={data.today.salesCount} />

          {/* Headline numbers */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              featured
              icon={PoundSterling}
              label="Today's sales"
              value={gbp(data.today.salesPence)}
              sub={`${data.today.salesCount} ${data.today.salesCount === 1 ? "sale" : "sales"}${data.today.refundsPence ? ` · ${gbp(data.today.refundsPence)} refunded` : ""}`}
            />
            <Kpi tone="sky" icon={CalendarDays} label="Last 7 days" value={gbp(data.weekPence)} sub="Sales incl. today" />
            <Kpi tone="emerald" icon={TrendingUp} label="This month" value={gbp(data.monthPence)} sub="Sales since the 1st" />
            <Kpi tone="amber" icon={Receipt} label="Expenses this month" value={gbp(data.monthExpensesPence)} sub="Recorded expenses" />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            {/* Sales chart */}
            <Card
              className="xl:col-span-2"
              title="Sales — last 7 days"
              action={<span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold tabular-nums text-primary">{gbp(data.weekPence)}</span>}
            >
              <WeekChart week={data.week} />
            </Card>

            {/* Quick actions + shop stats */}
            <div className="grid content-start gap-6">
              <Card title="Quick actions">
                <div className="grid grid-cols-2 gap-3">
                  <QuickLink to="/staff/pos" icon={Wrench} label="Open POS" tone="blue" />
                  <QuickLink to="/staff/products" icon={Package} label="Products" tone="sky" />
                  <QuickLink to="/staff/expenses" icon={Receipt} label="Add expense" tone="amber" />
                  <QuickLink to="/admin/rental" icon={Bike} label="Rentals" tone="emerald" />
                </div>
              </Card>
              <div className="grid grid-cols-3 gap-3">
                <MiniStat icon={Package} label="Products" value={data.productsCount} tone="sky" />
                <MiniStat icon={Users} label="Customers" value={data.customersCount} tone="violet" />
                <MiniStat icon={Bike} label="Rentals" value={data.activeRentals} tone="emerald" />
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            {/* Recent sales */}
            <Card
              className="xl:col-span-2"
              title="Recent sales"
              action={
                <Link to="/staff/sales" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  View all <ArrowRight className="size-3.5" />
                </Link>
              }
            >
              {data.recentSales.length === 0 ? (
                <Empty icon={ShoppingBag} text="No sales yet. Sales from the POS will show here." />
              ) : (
                <ul className="-mx-2 grid gap-1">
                  {data.recentSales.map((s) => {
                    const name = s.pos_customer?.name ?? "Walk-in customer";
                    return (
                      <li key={s.id}>
                        <Link
                          to="/staff/sales/$saleId"
                          params={{ saleId: s.id }}
                          className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent"
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-sm font-semibold text-primary">
                            {s.pos_customer ? initials(name) : <ShoppingBag className="size-4" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              {name}
                              {s.receipt_no && <span className="ml-2 text-xs font-normal text-ink-muted">#{s.receipt_no}</span>}
                            </span>
                            <span className="block text-xs text-ink-muted">
                              {new Date(s.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </span>
                          {s.payment_method && <MethodBadge method={s.payment_method} />}
                          <span className={`w-24 text-right font-semibold tabular-nums ${s.amount_pence < 0 ? "text-destructive" : ""}`}>{gbp(s.amount_pence)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {/* Things to look at */}
            <Card title="Needs attention">
              <ul className="grid gap-2">
                <AttentionRow
                  to="/admin/enquiries"
                  icon={Inbox}
                  tone="blue"
                  label="New enquiries"
                  count={data.newEnquiriesCount}
                  detail={data.newEnquiries[0] ? `Latest: ${data.newEnquiries[0].name}${data.newEnquiries[0].service ? ` · ${data.newEnquiries[0].service}` : ""}` : "All caught up"}
                />
                <AttentionRow
                  to="/admin/inventory"
                  icon={PackageX}
                  tone="amber"
                  label="Low stock"
                  count={data.lowStockCount}
                  detail={data.lowStock.length ? data.lowStock.map((p) => `${p.name} (${p.stock})`).join(", ") : "Stock levels are fine"}
                />
                <AttentionRow
                  to="/staff/sales"
                  icon={TriangleAlert}
                  tone="rose"
                  label="Negative transactions"
                  count={data.negative.count}
                  detail={data.negative.count ? `Total ${gbp(data.negative.pence)}` : "None"}
                />
              </ul>
            </Card>
          </div>

          <DbStorageCard />
        </div>
      )}
    </AccountShell>
  );
}

// Themed tints for icon tiles and accents (blue brand first, supporting hues after).
type Tone = "blue" | "sky" | "emerald" | "amber" | "violet" | "rose";
const TONE: Record<Tone, string> = {
  blue: "bg-primary/10 text-primary",
  sky: "bg-sky-500/10 text-sky-600",
  emerald: "bg-emerald-500/10 text-emerald-600",
  amber: "bg-amber-500/15 text-amber-600",
  violet: "bg-violet-500/10 text-violet-600",
  rose: "bg-rose-500/10 text-rose-600",
};
const TONE_BAR: Record<Tone, string> = {
  blue: "from-primary to-primary/40",
  sky: "from-sky-500 to-sky-300",
  emerald: "from-emerald-500 to-emerald-300",
  amber: "from-amber-500 to-amber-300",
  violet: "from-violet-500 to-violet-300",
  rose: "from-rose-500 to-rose-300",
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/London" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** Brand banner: greeting, today's date, till status and the main actions. */
function Welcome({ till, todayPence, todayCount }: { till: { openedAt: string; floatPence: number } | null; todayPence: number; todayCount: number }) {
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-[oklch(0.42_0.2_265)] p-6 text-primary-foreground shadow-lg shadow-primary/20 sm:p-7">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-40 size-56 rounded-full bg-white/10 blur-2xl" />
      <img src="/images/brand/staines-logo.webp" alt="" className="pointer-events-none absolute -right-6 top-1/2 hidden size-48 -translate-y-1/2 opacity-15 lg:block" />
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-medium text-primary-foreground/75">{today}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{greeting()}, welcome back</h2>
          <p className="mt-2 text-sm text-primary-foreground/80">
            {todayCount ? `${todayCount} ${todayCount === 1 ? "sale" : "sales"} so far today · ${gbp(todayPence)}` : "No sales yet today."}
          </p>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur">
            <span className={`size-2 rounded-full ${till ? "bg-emerald-300 shadow-[0_0_0_3px_rgb(110_231_183/0.35)]" : "bg-white/50"}`} aria-hidden="true" />
            {till
              ? `Till open since ${new Date(till.openedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · float ${gbp(till.floatPence)}`
              : "Till closed"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 lg:mr-44">
          <Link to="/staff/pos" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-white/90">
            <Wrench className="size-4" /> {till ? "Go to POS" : "Open till"}
          </Link>
          <Link to="/staff/sales" className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2.5 text-sm font-semibold text-primary-foreground ring-1 ring-white/30 transition hover:bg-white/25">
            <ShoppingBag className="size-4" /> Sales
          </Link>
        </div>
      </div>
    </section>
  );
}

function Card({ title, action, className = "", children }: { title: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-border/70 bg-surface-elevated p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_8px_24px_-12px_rgb(15_23_42/0.12)] sm:p-6 ${className}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone = "blue", featured }: { icon: LucideIcon; label: string; value: string; sub?: string; tone?: Tone; featured?: boolean }) {
  if (featured) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[oklch(0.48_0.22_264)] p-5 text-primary-foreground shadow-lg shadow-primary/25">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-white/10" />
        <div className="relative flex items-center justify-between">
          <p className="text-sm font-medium text-primary-foreground/80">{label}</p>
          <span className="grid size-10 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <Icon className="size-5" />
          </span>
        </div>
        <p className="relative mt-4 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
        {sub && <p className="relative mt-1 text-xs text-primary-foreground/75">{sub}</p>}
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-surface-elevated p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_8px_24px_-12px_rgb(15_23_42/0.12)]">
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${TONE_BAR[tone]}`} />
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <span className={`grid size-10 place-items-center rounded-xl ${TONE[tone]}`}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}

function WeekChart({ week }: { week: Array<{ day: string; pence: number }> }) {
  const max = Math.max(...week.map((d) => d.pence), 1);
  const total = week.reduce((s, d) => s + d.pence, 0);
  if (total === 0) return <Empty icon={TrendingUp} text="No sales in the last 7 days yet." />;
  return (
    <div className="relative h-64">
      {/* Guide lines */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-7 top-6 flex flex-col justify-between">
        {[0, 1, 2, 3].map((i) => <div key={i} className="border-t border-dashed border-border" />)}
      </div>
      <div className="relative flex h-full items-end gap-2 sm:gap-4">
        {week.map((d, i) => {
          const date = new Date(`${d.day}T12:00:00`);
          const isToday = i === week.length - 1;
          return (
            <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
              <span className={`text-xs font-semibold tabular-nums ${d.pence ? "text-foreground" : "text-transparent"} transition-opacity sm:opacity-0 sm:group-hover:opacity-100 ${isToday ? "sm:opacity-100" : ""}`}>
                {d.pence ? gbp(d.pence) : "–"}
              </span>
              <div
                className={`w-full max-w-12 rounded-t-lg bg-gradient-to-t transition-all ${isToday ? "from-primary to-primary/70 shadow-md shadow-primary/30" : "from-primary/35 to-primary/15 group-hover:from-primary/60 group-hover:to-primary/35"}`}
                style={{ height: `${Math.max((d.pence / max) * 82, d.pence ? 4 : 1.5)}%` }}
                title={`${d.day}: ${gbp(d.pence)}`}
              />
              <span className={`text-xs ${isToday ? "font-semibold text-primary" : "text-ink-muted"}`}>
                {isToday ? "Today" : date.toLocaleDateString("en-GB", { weekday: "short" })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label, tone }: { to: string; icon: LucideIcon; label: string; tone: Tone }) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-start gap-3 rounded-xl border border-border/70 p-3.5 text-sm font-medium transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <span className={`grid size-9 place-items-center rounded-lg ${TONE[tone]}`}>
        <Icon className="size-4" />
      </span>
      <span className="flex w-full items-center justify-between">
        {label}
        <ArrowRight className="size-3.5 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </span>
    </Link>
  );
}

function MethodBadge({ method }: { method: string }) {
  const style: Record<string, string> = {
    card: "bg-primary/10 text-primary",
    cash: "bg-emerald-500/10 text-emerald-700",
    split: "bg-violet-500/10 text-violet-700",
    bank_transfer: "bg-sky-500/10 text-sky-700",
  };
  return (
    <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline ${style[method] ?? "bg-muted text-ink-muted"}`}>
      {METHOD_LABEL[method] ?? method}
    </span>
  );
}

function AttentionRow({ to, icon: Icon, label, count, detail, tone }: { to: string; icon: LucideIcon; label: string; count: number; detail: string; tone: Tone }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:border-primary/30 hover:bg-accent/60">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${count ? TONE[tone] : "bg-muted text-ink-muted"}`}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{label}</span>
          <span className="block truncate text-xs text-ink-muted">{detail}</span>
        </span>
        <span className={`min-w-7 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums ${count ? "bg-primary text-primary-foreground" : "bg-muted text-ink-muted"}`}>{count}</span>
      </Link>
    </li>
  );
}

function MiniStat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone: Tone }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface-elevated p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      <span className={`grid size-8 place-items-center rounded-lg ${TONE[tone]}`}>
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-ink-muted">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      {text}
    </div>
  );
}

/** Placeholder blocks in the dashboard's shape while it loads. */
function DashboardSkeleton() {
  const block = "animate-pulse rounded-2xl bg-muted";
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="animate-pulse rounded-2xl bg-primary/15 h-40" />
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
