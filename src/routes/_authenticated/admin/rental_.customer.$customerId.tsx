import { ukDate } from "@/lib/format-date";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users } from "lucide-react";
import { AccountShell } from "@/components/AccountShell";
import { ArrearsPlanCard } from "@/components/rental/ArrearsPlanCard";
import { getRentalCustomerHistory, getArrearsPlanForUser } from "@/lib/rental.functions";
import { BRAND } from "@/lib/brand";


export const Route = createFileRoute("/_authenticated/admin/rental_/customer/$customerId")({
  head: () => ({
    meta: [
      { title: `Customer rental history — ${BRAND.name}` },
      { name: "description", content: "Every motorbike this customer has rented, with dates, weekly rate and amounts collected." },
      { property: "og:title", content: `Customer rental history — ${BRAND.name}` },
      { property: "og:description", content: "Every motorbike this customer has rented, with dates, weekly rate and amounts collected." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerHistoryPage,
  errorComponent: ({ error }) => (
    <AccountShell title="Customer history"><p className="text-sm text-primary">{error.message}</p></AccountShell>
  ),
  notFoundComponent: () => <AccountShell title="Customer history"><p>Not found</p></AccountShell>,
});

const fmt = (p?: number | null) => (p == null ? "—" : `£${(p / 100).toFixed(2)}`);

function CustomerHistoryPage() {
  const { customerId } = Route.useParams();
  const fn = useServerFn(getRentalCustomerHistory);
  const { data, isLoading } = useQuery({ queryKey: ["rental-customer-history", customerId], queryFn: () => fn({ data: { customerId } }) });
  const customer: any = (data as any)?.customer;
  const rentals: any[] = (data as any)?.rentals ?? [];
  const planFn = useServerFn(getArrearsPlanForUser);
  const { data: planData } = useQuery({
    queryKey: ["rental-arrears-plan", customer?.user_id],
    queryFn: () => planFn({ data: { userId: customer.user_id } }),
    enabled: !!customer?.user_id,
  });


  return (
    <AccountShell title="Customer history">
      <div className="space-y-4">
        <Link to="/admin/rental" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to rental
        </Link>

        {isLoading && <p className="text-sm text-ink-muted">Loading…</p>}

        {customer && (
          <div className="rounded-md border border-border bg-surface-elevated p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">{customer.full_name}</h1>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {[customer.phone, customer.email, customer.licence_number].filter(Boolean).join(" · ") || "—"}
            </p>
            {customer.address && <p className="mt-1 text-xs text-ink-muted">{customer.address}</p>}
          </div>
        )}

        <ArrearsPlanCard plan={(planData as any)?.plan ?? null} installments={(planData as any)?.installments ?? []} />


        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-[10px] uppercase tracking-widest text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">Vehicle</th>
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
                      {r.bike ? `${r.bike.make} ${r.bike.model}` : "This rental"}
                    </Link>
                    <div className="text-xs text-ink-muted">
                      {r.bike?.registration ?? ""}
                      {r.bike?.id && (
                        <>
                          {" "}·{" "}
                          <Link to="/admin/rental/bike/$bikeId" params={{ bikeId: r.bike.id }} className="hover:underline">Bike history</Link>
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
                  <td className="px-3 py-2 text-xs uppercase tracking-widest">
                    {r.status}
                    {r.status !== "active" && r.end_date && <div className="text-[10px] normal-case tracking-normal text-ink-muted">Ended {ukDate(r.end_date)}</div>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link to="/admin/rental/$rentalId" params={{ rentalId: r.id }} className="text-xs text-primary hover:underline">Open</Link>
                  </td>
                </tr>
              ))}
              {!isLoading && rentals.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-sm text-ink-muted">No rentals for this customer yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AccountShell>
  );
}
