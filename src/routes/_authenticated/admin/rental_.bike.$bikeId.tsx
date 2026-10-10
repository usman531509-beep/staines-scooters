import { ukDate } from "@/lib/format-date";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Bike, ArrowLeft } from "lucide-react";
import { AccountShell } from "@/components/AccountShell";
import { getBikeHistory } from "@/lib/rental.functions";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/admin/rental_/bike/$bikeId")({
  head: () => ({
    meta: [
      { title: `Bike rental history — ${BRAND.name}` },
      { name: "description", content: "Full rental history for this motorbike: every hirer, dates, weekly rate and amounts collected." },
      { property: "og:title", content: `Bike rental history — ${BRAND.name}` },
      { property: "og:description", content: "Full rental history for this motorbike: every hirer, dates, weekly rate and amounts collected." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BikeHistoryPage,
  errorComponent: ({ error }) => (
    <AccountShell title="Bike history"><p className="text-sm text-primary">{error.message}</p></AccountShell>
  ),
  notFoundComponent: () => <AccountShell title="Bike history"><p>Not found</p></AccountShell>,
});

const fmt = (p?: number | null) => (p == null ? "—" : `£${(p / 100).toFixed(2)}`);

function BikeHistoryPage() {
  const { bikeId } = Route.useParams();
  const fn = useServerFn(getBikeHistory);
  const { data, isLoading } = useQuery({ queryKey: ["bike-history", bikeId], queryFn: () => fn({ data: { bikeId } }) });
  const bike: any = (data as any)?.bike;
  const rentals: any[] = (data as any)?.rentals ?? [];

  return (
    <AccountShell title="Bike history">
      <div className="space-y-4">
        <Link to="/admin/rental" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to rental
        </Link>

        {isLoading && <p className="text-sm text-ink-muted">Loading…</p>}

        {bike && (
          <div className="rounded-md border border-border bg-surface-elevated p-4">
            <div className="flex items-center gap-2">
              <Bike className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">{bike.make} {bike.model}</h1>
            </div>
            <p className="mt-1 text-sm text-ink-muted">{bike.registration}{bike.year ? ` · ${bike.year}` : ""}</p>
            {bike.notes && <p className="mt-2 text-xs text-ink-muted">{bike.notes}</p>}
          </div>
        )}

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-[10px] uppercase tracking-widest text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">From</th>
                <th className="px-3 py-2 text-left">To</th>
                <th className="px-3 py-2 text-left">Weekly</th>
                <th className="px-3 py-2 text-left">Weeks</th>
                <th className="px-3 py-2 text-left">Collected</th>
                <th className="px-3 py-2 text-left">Outstanding</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rentals.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-surface">
                  <td className="px-3 py-2">
                    <Link to="/admin/rental/$rentalId" params={{ rentalId: r.id }} className="text-primary hover:underline">
                      {r.customer?.full_name ?? r.rental_customer?.full_name ?? "This rental"}
                    </Link>
                    <div className="text-xs text-ink-muted">
                      {r.customer?.email ?? r.rental_customer?.email ?? ""}
                      {r.rental_customer?.id && (
                        <>
                          {" "}·{" "}
                          <Link to="/admin/rental/customer/$customerId" params={{ customerId: r.rental_customer.id }} className="hover:underline">Customer history</Link>
                        </>
                      )}
                    </div>
                  </td>

                  <td className="px-3 py-2">{ukDate(r.start_date)}</td>
                  <td className="px-3 py-2">{r.end_date ? ukDate(r.end_date) : <span className="text-xs text-ink-muted">Ongoing</span>}</td>
                  <td className="px-3 py-2">{fmt(r.weekly_rate_pence)}</td>
                  <td className="px-3 py-2">{r.totals?.weeks ?? 0}</td>
                  <td className="px-3 py-2">{fmt(r.totals?.paid ?? 0)}</td>
                  <td className="px-3 py-2">{fmt(r.totals?.outstanding ?? 0)}</td>
                  <td className="px-3 py-2 uppercase text-xs tracking-widest">
                    {r.status}
                    {r.status !== "active" && r.end_date && <div className="text-[10px] normal-case tracking-normal text-ink-muted">Ended {ukDate(r.end_date)}</div>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link to="/admin/rental/$rentalId" params={{ rentalId: r.id }} className="text-xs text-primary hover:underline">Open</Link>
                  </td>
                </tr>
              ))}
              {!isLoading && rentals.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-sm text-ink-muted">This bike has never been rented</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AccountShell>
  );
}
