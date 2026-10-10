import { ukDate, ukDateTime, isoDay } from "@/lib/format-date";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bike, PoundSterling, Users, AlertTriangle, Wallet, TrendingUp, Plus, Trash2, X, Upload, FileText, Search } from "lucide-react";
import { AccountShell } from "@/components/AccountShell";
import { getMyStripeConnect, startStripeConnectOnboarding, getStripeDashboardLink } from "@/lib/stripe-connect.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-client";
import { refreshRentalBikesMot,
  rentalDashboard,
  listRentals,
  getRental,
  createRental,
  updateRental,
  endRental,
  deleteRental,
  purgeRental,
  listBikes,
  upsertBike,
  deleteBike,
  listPcns,
  upsertPcn,
  deletePcn,
  getRentalSettings,
  updateRentalSettings,
  listRentalCustomers,
  upsertRentalCustomer,
  deleteRentalCustomer,
  markWeekPaidManual,
  markWeekUnpaid,

  recordDepositManual,
  addRentalDocument,
  deleteRentalDocument,
  getRentalDocumentSignedUrl,
  setRentalBillingDay,
  chargeWeekNow,
  rentalPaymentsOverview,
  setWeekAmount,
  setWeekDates,
  deleteRentalWeek,
  deleteRentalPayments,
} from "@/lib/rental.functions";
import { WEEKDAYS } from "@/components/rental/RentalCardManager";
import { DateRangeFilter, useDateRange } from "@/components/rental/DateRangeFilter";
import { getStripeEnvironment } from "@/lib/stripe";
import { onlinePaymentsEnabled } from "@/lib/online-payments";
import { BRAND } from "@/lib/brand";


export const Route = createFileRoute("/_authenticated/admin/rental")({
  head: () => ({ meta: [{ title: `Rental — ${BRAND.name}` }] }),
  component: RentalPage,
  errorComponent: ({ error }) => (
    <AccountShell title="Rental"><p className="text-sm text-primary">{error.message}</p></AccountShell>
  ),
  notFoundComponent: () => (
    <AccountShell title="Rental"><p>Not found</p></AccountShell>
  ),
});

const fmt = (p?: number | null) => (p == null ? "—" : `£${(p / 100).toFixed(2)}`);
const today = () => isoDay();

type Tab = "dashboard" | "rentals" | "payments" | "customers" | "bikes" | "pcns" | "history" | "settings";

function RentalPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  return (
    <AccountShell title="Rental" fullWidth compact>
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-2 border-b border-border pb-2">
          {(["dashboard","rentals","payments","customers","bikes","pcns","history","settings"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-widest ${tab === t ? "bg-primary text-primary-foreground" : "bg-surface text-ink-muted hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === "dashboard" && <DashboardTab />}
        {tab === "rentals" && <RentalsTab />}
        {tab === "payments" && <PaymentsTab />}
        {tab === "customers" && <CustomersTab />}
        {tab === "bikes" && <BikesTab />}
        {tab === "pcns" && <PcnsTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "settings" && <>{onlinePaymentsEnabled() && <StripeConnectCard />}<SettingsTab /></>}



      </div>
    </AccountShell>
  );
}

// ---------- Full rental history -------------------------------------------
function HistoryTab() {
  const fn = useServerFn(listRentals);
  const [search, setSearch] = useState("");
  const dr = useDateRange("all");
  const { data, isLoading } = useQuery({ queryKey: ["rental-history-all"], queryFn: () => fn({ data: { status: "all" } }) });
  const rows = useMemo(() => {
    const all = ((data as any[]) ?? [])
      .slice()
      .sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""))
      .filter((r: any) => dr.inRange(r.start_date));
    const s = search.trim().toLowerCase();
    if (!s) return all;
    return all.filter((r: any) =>
      [r.customer?.full_name, r.rental_customer?.full_name, r.customer?.email, r.customer?.phone, r.bike?.make, r.bike?.model, r.bike?.registration]
        .some((v: any) => (v ?? "").toString().toLowerCase().includes(s)),
    );
  }, [data, search, dr.inRange]);


  return (
    <div className="space-y-3">
      <DateRangeFilter state={dr} label="Started" />
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-ink-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer or bike…"
          className="w-full max-w-sm rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
        />
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-[10px] uppercase tracking-widest text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-right w-10">#</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Bike</th>
              <th className="px-3 py-2 text-left">From</th>
              <th className="px-3 py-2 text-left">To</th>
              <th className="px-3 py-2 text-left">Weekly</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any, i: number) => (
              <tr key={r.id} className="border-t border-border hover:bg-surface">
                <td className="px-3 py-2 text-right text-xs tabular-nums text-ink-muted">{i + 1}.</td>
                <td className="px-3 py-2">
                  {r.rental_customer?.id ? (
                    <Link to="/admin/rental/customer/$customerId" params={{ customerId: r.rental_customer.id }} className="text-primary hover:underline">
                      {r.customer?.full_name ?? r.rental_customer?.full_name ?? "—"}
                    </Link>
                  ) : (r.customer?.full_name ?? "—")}
                </td>
                <td className="px-3 py-2">
                  {r.bike?.id ? (
                    <Link to="/admin/rental/bike/$bikeId" params={{ bikeId: r.bike.id }} className="text-primary hover:underline">
                      {r.bike.make} {r.bike.model} · {r.bike.registration}
                    </Link>
                  ) : "—"}
                </td>
                <td className="px-3 py-2">{ukDate(r.start_date)}</td>
                <td className="px-3 py-2">{r.end_date ? ukDate(r.end_date) : <span className="text-xs text-ink-muted">Ongoing</span>}</td>
                <td className="px-3 py-2">{fmt(r.weekly_rate_pence)}</td>
                <td className="px-3 py-2 text-xs uppercase tracking-widest">
                  {r.status}
                  {r.status !== "active" && r.end_date && <div className="text-[10px] normal-case tracking-normal text-ink-muted">Ended {ukDate(r.end_date)}</div>}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link to="/admin/rental/$rentalId" params={{ rentalId: r.id }} className="text-xs text-primary hover:underline">Open</Link>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-ink-muted">No rental history yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Dashboard ------------------------------------------------------
function DashboardTab() {
  const fn = useServerFn(rentalDashboard);
  const { data } = useQuery({ queryKey: ["rental-dash"], queryFn: () => fn() });
  const kpis = [
    { icon: Users, label: "Active rentals", value: data?.activeCount ?? 0 },
    { icon: TrendingUp, label: "Total income", value: fmt(data?.totalIncome) },
    { icon: TrendingUp, label: "Income this month", value: fmt(data?.incomeThisMonth) },
    { icon: PoundSterling, label: "Outstanding rent", value: fmt(data?.outstandingRent) },
    { icon: Wallet, label: "Deposits held", value: fmt(data?.depositHeld) },
    { icon: AlertTriangle, label: "Outstanding PCNs", value: fmt(data?.outstandingPcns) },
  ];
  const activeFn = useServerFn(listRentals);
  const { data: active = [] } = useQuery({ queryKey: ["rentals", "active", ""], queryFn: () => activeFn({ data: { status: "active", search: "" } }) });
  const [assignRental, setAssignRental] = useState<any | null>(null);
  const dr = useDateRange("all");
  const activeRows = useMemo(
    () => ((active as any[]) ?? []).filter((r: any) => dr.inRange(r.start_date)),
    [active, dr.inRange],
  );
  return (
    <div className="space-y-4">
      <DateRangeFilter state={dr} label="Started" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-md border border-border bg-surface-elevated p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              <k.icon className="h-3.5 w-3.5" /> {k.label}
            </div>
            <div className="mt-1 font-display text-2xl">{k.value}</div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
          <Bike className="h-4 w-4" /> Bikes currently on rent
        </h3>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-[10px] uppercase tracking-widest text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-right w-10">#</th>
                <th className="px-3 py-2 text-left">Rented by</th>
                <th className="px-3 py-2 text-left">Registration</th>
                <th className="px-3 py-2 text-left">Bike</th>
                <th className="px-3 py-2 text-left">Since</th>
                <th className="px-3 py-2 text-right">Weekly</th>
              </tr>
            </thead>
            <tbody>
              {activeRows.map((r: any, i: number) => (
                <tr key={r.id} className="border-t border-border hover:bg-surface">
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-ink-muted">{i + 1}.</td>
                  <td className="px-3 py-2">
                    <Link to="/admin/rental/$rentalId" params={{ rentalId: r.id }} className="hover:underline">
                      {r.customer?.full_name ?? "—"}
                    </Link>
                    <div className="text-xs text-ink-muted">{r.customer?.phone ?? r.customer?.email ?? ""}</div>
                  </td>
                  <td className="px-3 py-2">
                    {r.bike?.id
                      ? <Link to="/admin/rental/bike/$bikeId" params={{ bikeId: r.bike.id }} className="text-primary hover:underline">{r.bike.registration}</Link>
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to="/admin/rental/$rentalId" params={{ rentalId: r.id }} className="font-semibold text-primary hover:underline">
                        {r.bike ? `${r.bike.make} ${r.bike.model ?? ""}`.trim() : "No bike assigned"}
                      </Link>
                      {!r.bike && (
                        <button
                          type="button"
                          onClick={() => setAssignRental(r)}
                          className="shrink-0 whitespace-nowrap rounded-sm border border-primary px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground"
                        >
                          Assign bike
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">{ukDate(r.start_date)}</td>
                  <td className="px-3 py-2 text-right">{fmt(r.weekly_rate_pence)}</td>
                </tr>
              ))}
              {activeRows.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-ink-muted">No bikes are currently on rent</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {assignRental && (
        <AssignBikeDialog rental={assignRental} onClose={() => setAssignRental(null)} />
      )}
    </div>
  );
}

function AssignBikeDialog({ rental, onClose }: { rental: any; onClose: () => void }) {
  const qc = useQueryClient();
  const bikesFn = useServerFn(listBikes);
  const updateFn = useServerFn(updateRental);
  const { data: bikes = [] } = useQuery({ queryKey: ["rental-bikes"], queryFn: () => bikesFn() });
  const [bikeId, setBikeId] = useState("");
  const save = useMutation({
    mutationFn: () => updateFn({ data: { id: rental.id, bike_id: bikeId } }),
    onSuccess: () => {
      toast.success("Bike assigned");
      qc.invalidateQueries();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to assign bike"),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-md border border-border bg-surface-elevated p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="eyebrow">Assign bike</p>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-3 text-sm text-ink-muted">
          Rental for <span className="font-semibold text-foreground">{rental.customer?.full_name ?? "customer"}</span>
        </p>
        <label className="grid gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Bike</span>
          <select value={bikeId} onChange={(e) => setBikeId(e.target.value)} className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm">
            <option value="">— Select bike —</option>
            {(bikes as any[]).map((b: any) => (
              <option key={b.id} value={b.id}>
                {[b.registration, b.make, b.model].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            disabled={!bikeId || save.isPending}
            onClick={() => save.mutate()}
            className="rounded-sm bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Assign bike"}
          </button>
          <button type="button" onClick={onClose} className="text-xs font-semibold uppercase tracking-widest text-ink-muted">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Rentals --------------------------------------------------------
function RentalsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listRentals);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "ended" | "all">("active");
  const [showNew, setShowNew] = useState(false);
  const purgeFn = useServerFn(purgeRental);
  const { data: allRows = [] } = useQuery({ queryKey: ["rentals", status, search], queryFn: () => listFn({ data: { status, search } }) });
  const dr = useDateRange("all");
  const rows = useMemo(
    () => ((allRows as any[]) ?? []).filter((r: any) => dr.inRange(r.start_date)),
    [allRows, dr.inRange],
  );

  async function purge(r: any) {
    const who = r.customer?.full_name ?? "this customer";
    if (!confirm(`Permanently delete the rental for ${who}? This ends the rental and erases all its weeks, payments, PCNs and documents. This cannot be undone.`)) return;
    try {
      await purgeFn({ data: { id: r.id } });
      toast.success("Rental deleted permanently");
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not delete rental");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {([
          { k: "active", label: "Active rentals" },
          { k: "ended", label: "Ended rentals" },
          { k: "all", label: "All" },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setStatus(t.k)}
            className={`rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-widest ${status === t.k ? "bg-primary text-primary-foreground" : "border border-border bg-surface-elevated text-ink-muted hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <DateRangeFilter state={dr} label="Started" />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-2">
          <Search className="h-4 w-4 text-ink-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone, reg…" className="w-64 bg-transparent px-1 py-2 text-sm outline-none" />
        </div>
        <button onClick={() => setShowNew(true)} className="ml-auto inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground">
          <Plus className="h-4 w-4" /> New rental
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-[10px] uppercase tracking-widest text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-right w-10">#</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Bike</th>
              <th className="px-3 py-2 text-left">Start</th>
              <th className="px-3 py-2 text-left">Ended</th>
              <th className="px-3 py-2 text-right">Weekly</th>
              <th className="px-3 py-2 text-right">Deposit</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any, i: number) => (
              <tr key={r.id} className="border-t border-border hover:bg-surface">
                <td className="px-3 py-2 text-right text-xs tabular-nums text-ink-muted">{i + 1}.</td>
                <td className="px-3 py-2">
                  {r.rental_customer?.id
                    ? <Link to="/admin/rental/customer/$customerId" params={{ customerId: r.rental_customer.id }} className="text-primary hover:underline">{r.customer?.full_name ?? "—"}</Link>
                    : (r.customer?.full_name ?? "—")}
                  <div className="text-xs text-ink-muted">{r.customer?.email}</div>
                </td>
                <td className="px-3 py-2">
                  {r.bike?.id
                    ? <Link to="/admin/rental/bike/$bikeId" params={{ bikeId: r.bike.id }} className="text-primary hover:underline">{`${r.bike.make} ${r.bike.model} · ${r.bike.registration}`}</Link>
                    : "—"}
                </td>
                <td className="px-3 py-2">{ukDate(r.start_date)}</td>
                <td className="px-3 py-2">{r.end_date ? ukDate(r.end_date) : <span className="text-xs text-ink-muted">Ongoing</span>}</td>
                <td className="px-3 py-2 text-right">{fmt(r.weekly_rate_pence)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.deposit_paid_pence)} / {fmt(r.deposit_pence)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-widest ${r.status === "active" ? "bg-green-500/15 text-green-600" : "bg-neutral-500/15 text-neutral-600"}`}>{r.status}</span>
                  {r.status !== "active" && r.end_date && (
                    <div className="mt-1 text-[10px] uppercase tracking-widest text-ink-muted">Ended {ukDate(r.end_date)}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link to="/admin/rental/$rentalId" params={{ rentalId: r.id }} className="text-primary hover:underline text-xs">Open</Link>
                    <button
                      onClick={() => purge(r)}
                      className="text-xs uppercase tracking-widest text-ink-muted hover:text-primary"
                      title="Delete rental permanently"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-sm text-ink-muted">No rentals</td></tr>}
          </tbody>
        </table>
      </div>
      {showNew && <NewRentalDialog onClose={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ["rentals"] }); }} />}
      
    </div>
  );
}

function NewRentalDialog({ onClose }: { onClose: () => void }) {
  const createFn = useServerFn(createRental);
  const bikesFn = useServerFn(listBikes);
  const settingsFn = useServerFn(getRentalSettings);
  const rentalCustFn = useServerFn(listRentalCustomers);
  const { data: bikes = [] } = useQuery({ queryKey: ["bikes"], queryFn: () => bikesFn() });
  const { data: settings } = useQuery({ queryKey: ["rental-settings"], queryFn: () => settingsFn() });

  const [q, setQ] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const { data: rentalCustomers = [] } = useQuery({ queryKey: ["rental-customers"], queryFn: () => rentalCustFn({ data: {} }) });
  const rcMatches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return (rentalCustomers as any[]).filter((c) =>
      [c.full_name, c.email, c.phone, c.licence_number].some((v: any) => (v ?? "").toString().toLowerCase().includes(s)),
    );
  }, [rentalCustomers, q]);
  const [bikeId, setBikeId] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState("");

  const [weekly, setWeekly] = useState<number>(settings?.default_weekly_rate_pence ?? 6000);
  const [deposit, setDeposit] = useState<number>(settings?.default_deposit_pence ?? 20000);
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () => createFn({ data: {
      rental_customer_id: selectedCustomer.id,
      bike_id: bikeId || null, start_date: startDate, end_date: endDate || null, weekly_rate_pence: weekly, deposit_pence: deposit, notes: notes || null,
    } }),
    onSuccess: () => { toast.success("Rental created"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Modal onClose={onClose} title="New rental">
      <div className="space-y-3">
        {!selectedCustomer ? (
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-ink-muted">Customer</label>
            <select
              value=""
              onChange={(e) => {
                const c = (rentalCustomers as any[]).find((x) => x.id === e.target.value);
                if (c) setSelectedCustomer(c);
              }}
              className="mt-1 w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm"
            >
              <option value="">— Select a rental customer —</option>
              {(rentalCustomers as any[]).map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}{c.phone ? ` · ${c.phone}` : ""}</option>
              ))}
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="…or search by name, email or phone" className="mt-2 w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" />
            {rcMatches.length > 0 && (
              <div className="mt-1 max-h-48 overflow-y-auto rounded border border-border bg-surface-elevated">
                {rcMatches.map((m: any) => (
                  <button key={m.id} onClick={() => setSelectedCustomer(m)} className="block w-full px-2 py-1.5 text-left text-sm hover:bg-surface">
                    {m.full_name} <span className="text-xs text-ink-muted">{m.email} {m.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between rounded border border-border bg-surface-elevated px-3 py-2 text-sm">
            <span>{selectedCustomer.full_name} — {selectedCustomer.email ?? selectedCustomer.phone ?? ""}</span>
            <button onClick={() => setSelectedCustomer(null)} className="text-xs text-primary hover:underline">Change</button>
          </div>
        )}

        <Field label="Bike">
          <select value={bikeId} onChange={(e) => setBikeId(e.target.value)} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm">
            <option value="">— None —</option>
            {bikes.map((b: any) => <option key={b.id} value={b.id}>{b.make} {b.model} · {b.registration}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start date"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
          <Field label="End date (optional)"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>

          <Field label="Weekly rent (£)"><input type="number" min={0} step={0.01} value={(weekly / 100).toString()} onChange={(e) => setWeekly(Math.round(parseFloat(e.target.value || "0") * 100))} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
          <Field label="Deposit (£)"><input type="number" min={0} step={0.01} value={(deposit / 100).toString()} onChange={(e) => setDeposit(Math.round(parseFloat(e.target.value || "0") * 100))} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
        </div>
        <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
        <button disabled={!selectedCustomer || create.isPending} onClick={() => create.mutate()} className="w-full rounded bg-primary py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50">
          {create.isPending ? "Creating…" : "Create rental"}
        </button>
      </div>
    </Modal>
  );
}


// ---------- Bikes ----------------------------------------------------------
function BikesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listBikes);
  const rentalsFn = useServerFn(listRentals);
  const upsertFn = useServerFn(upsertBike);
  const delFn = useServerFn(deleteBike);
  const { data: allBikes = [] } = useQuery({ queryKey: ["bikes"], queryFn: () => listFn() });
  const motFn = useServerFn(refreshRentalBikesMot);
  useEffect(() => {
    motFn().then(() => qc.invalidateQueries({ queryKey: ["bikes"] })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { data: activeRentals = [] } = useQuery({ queryKey: ["rentals", "active", ""], queryFn: () => rentalsFn({ data: { status: "active" } }) });
  const onRent = new Map<string, any>();
  for (const r of activeRentals as any[]) if (r.bike_id) onRent.set(r.bike_id, r);
  const [edit, setEdit] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);
  const dr = useDateRange("all");
  const bikes = useMemo(
    () => ((allBikes as any[]) ?? []).filter((b: any) => dr.inRange(b.created_at)),
    [allBikes, dr.inRange],
  );
  return (
    <div className="space-y-3">
      <DateRangeFilter state={dr} label="Added" />
      <div className="flex justify-end">
        <button onClick={() => { setEdit({ make: "", model: "", registration: "", year: null, notes: "", active: true }); setShowNew(true); }} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground"><Plus className="h-4 w-4" /> Add bike</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {bikes.map((b: any, i: number) => {
          const rental = onRent.get(b.id);
          return (
          <div key={b.id} className={rental ? "rounded-md border border-green-300 bg-green-50 p-3" : "rounded-md border border-border bg-surface-elevated p-3"}>
            <div className="flex items-start justify-between">
              <div>
                <span className="mr-1 text-xs tabular-nums text-ink-muted">{i + 1}.</span>
                <Link to="/admin/rental/bike/$bikeId" params={{ bikeId: b.id }} className={rental ? "font-bold text-green-800 hover:underline" : "font-bold text-primary hover:underline"}>{b.make} {b.model}</Link>
                <div className={rental ? "text-xs font-bold text-green-800" : "text-xs text-ink-muted"}>
                  <Link to="/admin/rental/bike/$bikeId" params={{ bikeId: b.id }} className="hover:underline">{b.registration}</Link> {b.year && `· ${b.year}`}
                </div>
                {b.mot_expiry_date ? (
                  <div className={b.mot_expiry_date < new Date().toISOString().slice(0, 10) ? "text-xs font-bold text-red-600" : "text-xs font-bold text-green-700"}>
                    MOT {b.mot_expiry_date < new Date().toISOString().slice(0, 10) ? "expired" : "expiry"} {ukDate(b.mot_expiry_date)}
                  </div>
                ) : b.mot_checked_at ? (
                  <div className="text-xs text-ink-muted">MOT: no record found</div>
                ) : null}
                {rental && (
                  <div className="mt-1 text-xs font-bold uppercase tracking-widest text-green-700">On rent{rental.customer?.full_name ? ` · ${rental.customer.full_name}` : ""}</div>
                )}
              </div>
              <Bike className={rental ? "h-4 w-4 text-green-700" : "h-4 w-4 text-primary"} />
            </div>
            {b.notes && <p className={rental ? "mt-1 text-xs text-green-900/70" : "mt-1 text-xs text-ink-muted"}>{b.notes}</p>}

            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => { setEdit(b); setShowNew(true); }} className="text-xs text-primary hover:underline">Edit</button>
              <button onClick={() => { if (confirm("Delete bike?")) delFn({ data: { id: b.id } }).then(() => qc.invalidateQueries({ queryKey: ["bikes"] })); }} className="text-xs text-red-600 hover:underline">Delete</button>
            </div>
          </div>
          );
        })}
        {bikes.length === 0 && <p className="col-span-full p-4 text-center text-sm text-ink-muted">No bikes</p>}
      </div>
      {showNew && edit && (
        <Modal onClose={() => setShowNew(false)} title={edit.id ? "Edit bike" : "Add bike"}>
          <div className="space-y-2">
            <Field label="Make"><input value={edit.make} onChange={(e) => setEdit({ ...edit, make: e.target.value })} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
            <Field label="Registration"><input value={edit.registration} onChange={(e) => setEdit({ ...edit, registration: e.target.value })} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>

            <Field label="Notes"><textarea value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} rows={2} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
            <button onClick={() => upsertFn({ data: edit }).then(() => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["bikes"] }); setShowNew(false); }).catch((e) => toast.error(e.message))} className="w-full rounded bg-primary py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground">Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- PCNs -----------------------------------------------------------
function PcnsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPcns);
  const upsertFn = useServerFn(upsertPcn);
  const delFn = useServerFn(deletePcn);
  const rentalsFn = useServerFn(listRentals);
  const { data: allPcns = [] } = useQuery({ queryKey: ["pcns"], queryFn: () => listFn({ data: {} }) });
  const { data: rentals = [] } = useQuery({ queryKey: ["rentals-all"], queryFn: () => rentalsFn({ data: { status: "all" } }) });
  const [edit, setEdit] = useState<any>(null);
  const { isAdmin } = useAuth();
  const dr = useDateRange("all");
  const pcns = useMemo(
    () => ((allPcns as any[]) ?? []).filter((p: any) => dr.inRange(p.issued_on)),
    [allPcns, dr.inRange],
  );

  return (
    <div className="space-y-3">
      <DateRangeFilter state={dr} label="Issued" />
      <div className="flex justify-end">
        <button onClick={() => setEdit({ rental_id: "", issued_on: today(), reference: "", amount_pence: 0, description: "", status: "outstanding", notes: "" })} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground"><Plus className="h-4 w-4" /> New PCN</button>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-[10px] uppercase tracking-widest text-ink-muted"><tr><th className="px-3 py-2 text-right w-10">#</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Ref</th><th className="px-3 py-2 text-left">Bike</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-left">Status</th><th /></tr></thead>
          <tbody>
            {pcns.map((p: any, i: number) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2 text-right text-xs tabular-nums text-ink-muted">{i + 1}.</td>
                <td className="px-3 py-2">{ukDate(p.issued_on)}</td>
                <td className="px-3 py-2">{p.reference ?? "—"}</td>
                <td className="px-3 py-2">{p.rental?.bike?.registration ?? "—"}</td>
                <td className="px-3 py-2 text-right">{fmt(p.amount_pence)}</td>
                <td className="px-3 py-2"><span className="text-[10px] uppercase tracking-widest">{p.status}</span></td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setEdit(p)} className="text-xs text-primary hover:underline">Edit</button>
                  {isAdmin && <button onClick={() => { if (confirm("Delete PCN?")) delFn({ data: { id: p.id } }).then(() => qc.invalidateQueries({ queryKey: ["pcns"] })); }} className="ml-2 text-xs text-red-600 hover:underline">Delete</button>}
                </td>
              </tr>
            ))}
            {pcns.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-sm text-ink-muted">No PCNs</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal onClose={() => setEdit(null)} title={edit.id ? "Edit PCN" : "New PCN"}>
          <div className="space-y-2">
            <Field label="Rental">
              <select value={edit.rental_id} onChange={(e) => setEdit({ ...edit, rental_id: e.target.value })} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm">
                <option value="">— select —</option>
                {rentals.map((r: any) => <option key={r.id} value={r.id}>{r.customer?.full_name} · {r.bike?.registration ?? "no bike"}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Issued on"><input type="date" value={edit.issued_on} onChange={(e) => setEdit({ ...edit, issued_on: e.target.value })} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
              <Field label="Reference"><input value={edit.reference ?? ""} onChange={(e) => setEdit({ ...edit, reference: e.target.value })} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
              <Field label="Amount (£)"><input type="number" step={0.01} value={(edit.amount_pence / 100).toString()} onChange={(e) => setEdit({ ...edit, amount_pence: Math.round(parseFloat(e.target.value || "0") * 100) })} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
              <Field label="Status">
                <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm">
                  <option value="outstanding">Outstanding</option>
                  <option value="paid">Paid</option>
                  <option value="transferred_to_customer">Transferred to customer</option>
                  <option value="disputed">Disputed</option>
                  <option value="void">Void</option>
                </select>
              </Field>
            </div>
            <Field label="Description"><textarea rows={2} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
            <Field label="Notes"><textarea rows={2} value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
            <button onClick={() => upsertFn({ data: edit }).then(() => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["pcns"] }); setEdit(null); }).catch((e) => toast.error(e.message))} className="w-full rounded bg-primary py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground">Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- Settings -------------------------------------------------------
function SettingsTab() {
  const getFn = useServerFn(getRentalSettings);
  const updFn = useServerFn(updateRentalSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["rental-settings"], queryFn: () => getFn() });
  const [w, setW] = useState<number | null>(null);
  const [d, setD] = useState<number | null>(null);
  const [bd, setBd] = useState<number | null>(null);
  const setAmountFn = useServerFn(setWeekAmount);
  const delWeekFn = useServerFn(deleteRentalWeek);
  const weekly = w ?? data?.default_weekly_rate_pence ?? 6000;
  const deposit = d ?? data?.default_deposit_pence ?? 20000;
  const billingDay = bd ?? data?.default_billing_day ?? 1;
  return (
    <div className="max-w-md space-y-3">
      <Field label="Default weekly rate (£)"><input type="number" step={0.01} value={(weekly / 100).toString()} onChange={(e) => setW(Math.round(parseFloat(e.target.value || "0") * 100))} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
      <Field label="Default deposit (£)"><input type="number" step={0.01} value={(deposit / 100).toString()} onChange={(e) => setD(Math.round(parseFloat(e.target.value || "0") * 100))} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
      <Field label="Default billing day">
        <select value={billingDay} onChange={(e) => setBd(Number(e.target.value))} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm">
          {WEEKDAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}
        </select>
      </Field>
      <button onClick={() => updFn({ data: { default_weekly_rate_pence: weekly, default_deposit_pence: deposit, default_billing_day: billingDay } }).then(() => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["rental-settings"] }); }).catch((e) => toast.error(e.message))} className="w-full rounded bg-primary py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground">Save</button>
    </div>
  );
}


// ---------- Bits -----------------------------------------------------------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-semibold uppercase tracking-widest text-ink-muted">{label}</span><div className="mt-1">{children}</div></label>;
}
function RentalPeriodEditor({ rental, onSave }: { rental: any; onSave: (patch: { start_date: string; end_date: string | null }) => void }) {
  const [start, setStart] = useState<string>(rental.start_date ?? "");
  const [end, setEnd] = useState<string>(rental.end_date ?? "");
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Start date"><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
      <Field label="End date"><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
      <button
        onClick={() => { if (!start) { toast.error("Start date is required"); return; } onSave({ start_date: start, end_date: end || null }); }}
        className="rounded bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground"
      >
        Save period
      </button>
      {end && <button onClick={() => { setEnd(""); onSave({ start_date: start, end_date: null }); }} className="rounded border border-border px-3 py-2 text-xs">Clear end date</button>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {

  return <div className="rounded border border-border bg-surface-elevated p-2"><div className="text-[10px] uppercase tracking-widest text-ink-muted">{label}</div><div className="font-display text-lg">{value}</div></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">{title}</h3>{children}</div>;
}
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" role="dialog">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative max-h-[90vh] w-full overflow-y-auto rounded-md border border-border bg-background p-4 shadow-xl ${wide ? "max-w-3xl" : "max-w-md"}`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg uppercase">{title}</h2>
          <button onClick={onClose} className="rounded border border-border p-1"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Rental customers ----------------------------------------------
function CustomersTab() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const listFn = useServerFn(listRentalCustomers);
  const delFn = useServerFn(deleteRentalCustomer);
  const signFn = useServerFn(getRentalDocumentSignedUrl);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const { data: allRows = [] } = useQuery({ queryKey: ["rental-customers", search], queryFn: () => listFn({ data: { search } }) });
  const dr = useDateRange("all");
  const rows = useMemo(
    () => ((allRows as any[]) ?? []).filter((c: any) => dr.inRange(c.created_at)),
    [allRows, dr.inRange],
  );

  async function openPhoto(path: string) {
    const r: any = await signFn({ data: { storage_path: path } });
    if (r?.url) window.open(r.url, "_blank");
  }

  return (
    <div className="space-y-3">
      <DateRangeFilter state={dr} label="Added" />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-2">
          <Search className="h-4 w-4 text-ink-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone, licence…" className="w-64 bg-transparent px-1 py-2 text-sm outline-none" />
        </div>
        <button onClick={() => setEditing({})} className="ml-auto inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground">
          <Plus className="h-4 w-4" /> New customer
        </button>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-[10px] uppercase tracking-widest text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-right w-10">#</th>
              <th className="px-3 py-2 text-left">Photo</th>
              <th className="px-3 py-2 text-left">Full name</th>
              <th className="px-3 py-2 text-left">DOB</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Licence</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(rows as any[]).map((c, i: number) => (
              <tr key={c.id} className="border-t border-border hover:bg-surface">
                <td className="px-3 py-2 text-right text-xs tabular-nums text-ink-muted">{i + 1}.</td>
                <td className="px-3 py-2">
                  {c.photo_path
                    ? <button onClick={() => openPhoto(c.photo_path)} className="text-xs text-primary hover:underline">View</button>
                    : <span className="text-xs text-ink-muted">—</span>}
                </td>
                <td className="px-3 py-2">
                  <Link to="/admin/rental/customer/$customerId" params={{ customerId: c.id }} className="text-primary hover:underline">{c.full_name}</Link>
                </td>
                <td className="px-3 py-2">{ukDate(c.date_of_birth)}</td>
                <td className="px-3 py-2">{c.phone ?? "—"}</td>
                <td className="px-3 py-2">{c.email ?? "—"}</td>
                <td className="px-3 py-2">{c.licence_number ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setEditing(c)} className="text-xs text-primary hover:underline">Edit</button>
                  {isAdmin && (
                    <button
                      onClick={() => { if (confirm(`Delete ${c.full_name}?`)) delFn({ data: { id: c.id } }).then(() => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["rental-customers"] }); }).catch((e: any) => toast.error(e.message)); }}
                      className="ml-3 text-xs text-primary hover:underline"
                    >
                      <Trash2 className="inline h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-ink-muted">No customers yet</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && (
        <CustomerFormDialog
          customer={editing}
          onClose={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["rental-customers"] }); }}
        />
      )}
    </div>
  );
}

function CustomerFormDialog({ customer, onClose }: { customer: any; onClose: () => void }) {
  const saveFn = useServerFn(upsertRentalCustomer);
  const signFn = useServerFn(getRentalDocumentSignedUrl);
  const [fullName, setFullName] = useState(customer.full_name ?? "");
  const [dob, setDob] = useState(customer.date_of_birth ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [licence, setLicence] = useState(customer.licence_number ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [photoPath, setPhotoPath] = useState<string | null>(customer.photo_path ?? null);
  const [uploading, setUploading] = useState(false);

  async function uploadPhoto(f: File) {
    setUploading(true);
    try {
      const path = `customers/${crypto.randomUUID()}-${f.name}`;
      const { error } = await supabase.storage.from("rental-documents").upload(path, f);
      if (error) throw error;
      setPhotoPath(path);
      toast.success("Photo uploaded");
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  }

  async function viewPhoto() {
    if (!photoPath) return;
    const r: any = await signFn({ data: { storage_path: photoPath } });
    if (r?.url) window.open(r.url, "_blank");
  }

  const save = useMutation({
    mutationFn: () => saveFn({ data: {
      ...(customer.id ? { id: customer.id } : {}),
      full_name: fullName.trim(),
      date_of_birth: dob || null,
      address: address || null,
      licence_number: licence || null,
      email: email || null,
      phone: phone || null,
      photo_path: photoPath,
      notes: notes || null,
    } }),
    onSuccess: () => { toast.success("Customer saved"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Modal onClose={onClose} title={customer.id ? "Edit customer" : "New customer"} wide>
      <div className="space-y-4">
        <Section title="Personal details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name *"><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
            <Field label="Date of birth"><input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
          </div>
          <div className="mt-3">
            <Field label="Current address"><textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
          </div>
        </Section>

        <Section title="Contact">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
            <Field label="Phone number"><input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" /></Field>
          </div>
        </Section>

        <Section title="Licence & photo">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Licence number"><input value={licence} onChange={(e) => setLicence(e.target.value)} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm uppercase" /></Field>
            <Field label="Customer photo">
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-border bg-surface-elevated px-2 py-2 text-xs">
                  <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : photoPath ? "Replace" : "Upload"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }} />
                </label>
                {photoPath && <button type="button" onClick={viewPhoto} className="text-xs text-primary hover:underline">View</button>}
              </div>
            </Field>
          </div>
        </Section>

        <Section title="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded border border-border bg-surface-elevated px-2 py-2 text-sm" />
        </Section>

        <button
          disabled={!fullName.trim() || save.isPending}
          onClick={() => save.mutate()}
          className="w-full rounded bg-primary py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save customer"}
        </button>
      </div>
    </Modal>
  );
}

// ---------- Payments -------------------------------------------------------
function PaymentsTab() {
  const qc = useQueryClient();
  const fn = useServerFn(rentalPaymentsOverview);
  const chargeFn = useServerFn(chargeWeekNow);
  const markFn = useServerFn(markWeekPaidManual);
  const unpaidFn = useServerFn(markWeekUnpaid);

  const setAmountFn = useServerFn(setWeekAmount);
  const setDatesFn = useServerFn(setWeekDates);
  const delWeekFn = useServerFn(deleteRentalWeek);
  const [status, setStatus] = useState<"all" | "unpaid" | "paid" | "failed">("unpaid");
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("");
  const [endedCustomer, setEndedCustomer] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["rental-payments", status, search],
    queryFn: () => fn({ data: { status, search } }),
  });
  const { data: allData } = useQuery({
    queryKey: ["rental-payments", "all", ""],
    queryFn: () => fn({ data: { status: "all" as const, search: "" } }),
  });
  const allWeeks = ((allData?.weeks ?? data?.weeks ?? []) as any[]);
  const activeCustomerNames: string[] = Array.from(
    new Set(allWeeks.filter((w) => w.rental?.status === "active").map((w) => w.customer_name).filter((n) => n && n !== "—")),
  ).sort((a, b) => a.localeCompare(b));
  const endedCustomerNames: string[] = Array.from(
    new Set(allWeeks.filter((w) => w.rental?.status !== "active").map((w) => w.customer_name).filter((n) => n && n !== "—")),
  ).filter((n) => !activeCustomerNames.includes(n)).sort((a, b) => a.localeCompare(b));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["rental-payments"] });
    qc.invalidateQueries({ queryKey: ["rental-dash"] });
  };

  const charge = useMutation({
    mutationFn: (week_id: string) => chargeFn({ data: { week_id, environment: getStripeEnvironment() } }),
    onSuccess: (r: any) => {
      if (r?.ok) toast.success("Card charged");
      else toast.error(r?.error ?? "Charge failed");
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const markPaid = useMutation({
    mutationFn: (week_id: string) => markFn({ data: { week_id, method: "cash" } }),
    onSuccess: () => { toast.success("Marked paid"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const markUnpaid = useMutation({
    mutationFn: (week_id: string) => unpaidFn({ data: { week_id } }),
    onSuccess: () => { toast.success("Marked unpaid"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const editDates = async (w: any) => {
    const start = prompt("Week start date (YYYY-MM-DD)", w.week_start);
    if (start === null) return;
    const end = prompt("Week end date (YYYY-MM-DD)", w.week_end);
    if (end === null) return;
    try { await setDatesFn({ data: { week_id: w.id, week_start: start.trim(), week_end: end.trim() } }); toast.success("Dates updated"); refresh(); }
    catch (e: any) { toast.error(e.message); }
  };
  const editAmount = async (w: any) => {
    const input = prompt("Payment amount (£)", ((w.amount_pence ?? 0) / 100).toFixed(2));
    if (input === null) return;
    const pence = Math.round(parseFloat(input) * 100);
    if (!Number.isFinite(pence) || pence < 0) { toast.error("Enter a valid amount"); return; }
    try { await setAmountFn({ data: { week_id: w.id, amount_pence: pence } }); toast.success("Amount updated"); refresh(); }
    catch (e: any) { toast.error(e.message); }
  };
  const removeWeek = async (w: any) => {
    if (!confirm(`Delete the payment for ${w.week_start} → ${w.week_end}?`)) return;
    try { await delWeekFn({ data: { week_id: w.id } }); toast.success("Payment deleted"); refresh(); }
    catch (e: any) { toast.error(e.message); }
  };

  const t = data?.totals;
  const delPaymentsFn = useServerFn(deleteRentalPayments);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const pickName = customer || endedCustomer;
  const matchRow = (name: string, isActive: boolean) =>
    pickName ? name === pickName : isActive;
  const dr = useDateRange("all");
  const weekRows: any[] = ((data?.weeks ?? []) as any[]).filter(
    (w) => matchRow(w.customer_name, w.rental?.status === "active") && dr.inRange(w.week_start),
  );
  const paymentRows: any[] = ((data?.payments ?? []) as any[]).filter(
    (p) => matchRow(p.customer_name, p.rental_status === "active") && dr.inRange(p.paid_at),
  );
  const selected = selectedIds.filter((id) => paymentRows.some((p) => p.id === id));
  const allSelected = paymentRows.length > 0 && selected.length === paymentRows.length;
  const deleteSelected = async () => {
    if (!confirm(`Delete ${selected.length} payment record(s)? This cannot be undone.`)) return;
    try {
      await delPaymentsFn({ data: { ids: selected } });
      toast.success("Payments deleted");
      setSelectedIds([]);
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Could not delete payments"); }
  };

  const kpis = [
    { icon: PoundSterling, label: "Outstanding", value: fmt(t?.outstanding) },
    { icon: TrendingUp, label: "Collected (shown)", value: fmt(t?.collected) },
    ...(onlinePaymentsEnabled()
      ? [
          { icon: AlertTriangle, label: "Failed charges", value: t?.failedCount ?? 0 },
          { icon: Wallet, label: "Cards on file", value: t?.cardsOnFile ?? 0 },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <DateRangeFilter state={dr} label="Period" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-md border border-border bg-surface-elevated p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              <k.icon className="h-3.5 w-3.5" /> {k.label}
            </div>
            <div className="mt-1 font-display text-2xl">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-2">
          <Search className="h-4 w-4 text-ink-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, reg, week…" className="w-64 bg-transparent px-1 py-2 text-sm outline-none" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="rounded-md border border-border bg-surface-elevated px-2 py-2 text-sm">
          <option value="unpaid">Unpaid</option>
          <option value="failed">Failed</option>
          <option value="paid">Paid</option>
          <option value="all">All weeks</option>
        </select>
        <select
          value={customer}
          onChange={(e) => { setCustomer(e.target.value); setEndedCustomer(""); }}
          className="rounded-md border border-border bg-surface-elevated px-2 py-2 text-sm"
        >
          <option value="">All customers</option>
          {activeCustomerNames.map((n: string) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <select
          value={endedCustomer}
          onChange={(e) => { setEndedCustomer(e.target.value); setCustomer(""); }}
          className="rounded-md border border-border bg-surface-elevated px-2 py-2 text-sm"
        >
          <option value="">Ended rentals…</option>
          {endedCustomerNames.map((n: string) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-surface-elevated">
        <table className="w-full text-sm">
          <thead className="bg-surface text-[11px] uppercase tracking-widest text-ink-muted">
            <tr>
              <th className="p-2 text-right w-10">#</th>
              <th className="p-2 text-left">Week</th>
              <th className="p-2 text-left">Customer</th>
              <th className="p-2 text-left">Bike</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-left">Status</th>
              {onlinePaymentsEnabled() && <th className="p-2 text-left">Card</th>}
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="p-4 text-center text-ink-muted">Loading…</td></tr>}
            {!isLoading && !weekRows.length && (
              <tr><td colSpan={8} className="p-4 text-center text-ink-muted">No billing weeks found.</td></tr>
            )}
            {weekRows.map((w: any, i: number) => (
              <tr key={w.id} className="border-t border-border align-top">
                <td className="p-2 text-right text-xs tabular-nums text-ink-muted">{i + 1}.</td>
                <td className="p-2 whitespace-nowrap">{ukDate(w.week_start)} → {ukDate(w.week_end)}</td>
                <td className="p-2">{w.customer_name}</td>
                <td className="p-2">{w.registration ?? "—"}</td>
                <td className="p-2 text-right">{fmt(w.amount_pence)}</td>
                <td className="p-2">
                  <span className={`rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${w.status === "paid" ? "bg-emerald-500/15 text-emerald-500" : "bg-primary/15 text-primary"}`}>
                    {w.status}
                  </span>
                  {w.status === "paid" && w.paid_at && (
                    <p className="mt-1 text-[11px] text-ink-muted">Paid {ukDateTime(w.paid_at)}</p>
                  )}
                  {w.last_charge_at && (
                    <p className="mt-1 text-[11px] text-ink-muted">
                      Last attempt {ukDateTime(w.last_charge_at)}
                      {w.charge_attempts ? ` · ${w.charge_attempts} attempt${w.charge_attempts === 1 ? "" : "s"}` : ""}
                    </p>
                  )}
                  {w.last_charge_error && w.status !== "paid" && (
                    <p className="mt-1 max-w-[220px] text-[11px] text-primary">{w.last_charge_error}</p>
                  )}
                </td>
                {onlinePaymentsEnabled() && (
                  <td className="p-2 text-xs text-ink-muted">
                    {w.rental?.card_last4 ? `${w.rental.card_brand ?? "card"} ••${w.rental.card_last4}` : "No card"}
                  </td>
                )}
                <td className="p-2 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                  {w.status !== "paid" ? (
                    <>
                      {onlinePaymentsEnabled() && (
                        <button
                          onClick={() => charge.mutate(w.id)}
                          disabled={charge.isPending || !w.rental?.card_last4}
                          className="rounded-md border border-border px-2 py-1 text-xs font-semibold uppercase tracking-widest hover:border-primary hover:text-primary disabled:opacity-40"
                        >
                          Charge card
                        </button>
                      )}
                      <button
                        onClick={() => markPaid.mutate(w.id)}
                        disabled={markPaid.isPending}
                        className="rounded-md border border-border px-2 py-1 text-xs font-semibold uppercase tracking-widest hover:border-primary hover:text-primary disabled:opacity-40"
                      >
                        Mark paid
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => markUnpaid.mutate(w.id)}
                      disabled={markUnpaid.isPending}
                      className="rounded-md border border-border px-2 py-1 text-xs font-semibold uppercase tracking-widest hover:border-primary hover:text-primary disabled:opacity-40"
                    >
                      Mark unpaid
                    </button>
                  )}
                  <button
                    onClick={() => editAmount(w)}
                    className="rounded-md border border-border px-2 py-1 text-xs font-semibold uppercase tracking-widest hover:border-primary hover:text-primary"
                  >
                    Edit £
                  </button>
                  <button
                    onClick={() => editDates(w)}
                    className="rounded-md border border-border px-2 py-1 text-xs font-semibold uppercase tracking-widest hover:border-primary hover:text-primary"
                  >
                    Edit dates
                  </button>
                  <button
                    onClick={() => removeWeek(w)}
                    className="rounded-md border border-border px-2 py-1 text-xs font-semibold uppercase tracking-widest text-red-500 hover:border-red-500"
                  >
                    Delete
                  </button>
                  </div>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Recent payments received</h3>
          {selected.length > 0 && (
            <button
              onClick={deleteSelected}
              className="ml-auto rounded-md border border-red-500 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-red-500 hover:bg-red-500/10"
            >
              Delete selected ({selected.length})
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-md border border-border bg-surface-elevated">
          <table className="w-full text-sm">
            <thead className="bg-surface text-[11px] uppercase tracking-widest text-ink-muted">
              <tr>
                <th className="p-2 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => setSelectedIds(e.target.checked ? paymentRows.map((p: any) => p.id) : [])}
                  />
                </th>
                <th className="p-2 text-right w-10">#</th>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Customer</th>
                <th className="p-2 text-left">Bike</th>
                <th className="p-2 text-left">Kind</th>
                <th className="p-2 text-left">Method</th>
                <th className="p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {!paymentRows.length && (
                <tr><td colSpan={8} className="p-4 text-center text-ink-muted">No payments yet.</td></tr>
              )}
              {paymentRows.map((p: any, i: number) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={(e) =>
                        setSelectedIds((prev) => (e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)))
                      }
                    />
                  </td>
                  <td className="p-2 text-right text-xs tabular-nums text-ink-muted">{i + 1}.</td>
                  <td className="p-2 whitespace-nowrap">{p.paid_at ? ukDateTime(p.paid_at) : "—"}</td>
                  <td className="p-2">{p.customer_name}</td>
                  <td className="p-2">{p.registration ?? "—"}</td>
                  <td className="p-2">{p.kind}</td>
                  <td className="p-2">{p.method}</td>
                  <td className="p-2 text-right">{fmt(p.amount_pence)}</td>
                </tr>
              ))}

            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


function StripeConnectCard() {
  const statusFn = useServerFn(getMyStripeConnect);
  const startFn = useServerFn(startStripeConnectOnboarding);
  const dashFn = useServerFn(getStripeDashboardLink);
  const { data, isLoading } = useQuery({ queryKey: ["stripe-connect"], queryFn: () => statusFn() });
  const [busy, setBusy] = useState(false);
  const d: any = data;
  if (isLoading || !d || d.exempt) return null;
  const go = async (fn: () => Promise<{ url: string }>) => {
    setBusy(true);
    try { window.location.href = (await fn()).url; } catch (e: any) { toast.error(e.message); setBusy(false); }
  };
  const ready = d.connected && d.charges_enabled;
  return (
    <div className="mb-4 rounded-lg border border-border bg-surface p-4">
      <h3 className="font-display text-sm uppercase tracking-widest text-primary">Your Stripe payouts</h3>
      <p className="mt-1 text-xs text-ink-muted">
        {ready
          ? `Connected${d.display_name ? ` as ${d.display_name}` : ""}. Rent from your customers goes straight into your own Stripe account.${d.payouts_enabled ? "" : " Payouts are still being verified by Stripe."}`
          : d.connected
            ? "Stripe setup is not finished yet. Continue to complete your details."
            : "Connect your own Stripe account so your rental customers pay you directly. You never need to share any keys."}
      </p>
      <div className="mt-3 flex gap-2">
        {!ready && (
          <button disabled={busy} onClick={() => go(() => startFn({ data: { returnUrl: window.location.href } }))}
            className="rounded bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50">
            {d.connected ? "Continue setup" : "Connect Stripe"}
          </button>
        )}
        {d.connected && (
          <button disabled={busy} onClick={() => go(() => dashFn())}
            className="rounded border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-widest disabled:opacity-50">
            Open Stripe dashboard
          </button>
        )}
      </div>
    </div>
  );
}
