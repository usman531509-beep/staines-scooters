import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AccountShell } from "@/components/AccountShell";
import { RentalDetailView } from "@/components/rental/RentalDetailView";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/admin/rental_/$rentalId")({
  head: () => ({
    meta: [
      { title: `Rental details — ${BRAND.name}` },
      { name: "description", content: "View and manage a motorbike rental agreement, weekly payments, deposit and documents." },
      { property: "og:title", content: `Rental details — ${BRAND.name}` },
      { property: "og:description", content: "View and manage a motorbike rental agreement, weekly payments, deposit and documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RentalDetailPage,
  errorComponent: ({ error }) => (
    <AccountShell title="Rental"><p className="text-sm text-primary">{error.message}</p></AccountShell>
  ),
  notFoundComponent: () => (
    <AccountShell title="Rental"><p>Rental not found</p></AccountShell>
  ),
});

function RentalDetailPage() {
  const { rentalId } = Route.useParams();
  const navigate = useNavigate();
  return (
    <AccountShell title="Rental" fullWidth compact>
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-4">
        <Link to="/admin/rental" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-ink-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to rentals
        </Link>
        <RentalDetailView id={rentalId} onDeleted={() => navigate({ to: "/admin/rental" })} />
      </div>
    </AccountShell>
  );
}
