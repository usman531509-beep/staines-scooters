import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Bike, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { ukDate, ukDateWithWeekday } from "@/lib/format-date";
import { getRentalPayLinkInfo, createRentalPayLinkCheckout } from "@/lib/rental-pay.functions";
import { confirmConnectRentalPayment } from "@/lib/stripe-connect.functions";
import { useEffect } from "react";
import { BRAND, BRAND_ADDRESS } from "@/lib/brand";
import { onlinePaymentsEnabled } from "@/lib/online-payments";

export const Route = createFileRoute("/pay/$token")({
  head: () => ({
    meta: [
      { title: `Pay your rent — ${BRAND.name}` },
      { name: "description", content: "Pay your weekly motorbike rent securely in a few seconds — no sign-in needed." },
      { property: "og:title", content: `Pay your rent — ${BRAND.name}` },
      { property: "og:description", content: "Pay your weekly motorbike rent securely in a few seconds — no sign-in needed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (onlinePaymentsEnabled() ? <PayLinkPage /> : <LinkUnavailable />),
  errorComponent: ({ error }) => (
    <Shell><p className="text-sm text-primary">{error.message}</p></Shell>
  ),
});

function LinkUnavailable() {
  return (
    <Shell><p className="text-sm">This payment link is not available. Please contact us.</p></Shell>
  );
}

const fmt = (p?: number | null) => (p == null ? "—" : `£${(p / 100).toFixed(2)}`);

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="font-display text-2xl uppercase tracking-wide text-primary">{BRAND.name}</h1>
      <p className="mt-1 text-xs uppercase tracking-widest text-ink-muted">Weekly rent payment</p>
      <div className="mt-6">{children}</div>
      <p className="mt-8 text-xs text-ink-muted">
        {BRAND_ADDRESS} · {BRAND.phone}
      </p>
    </main>
  );
}

function PayLinkPage() {
  const { token } = Route.useParams();
  const infoFn = useServerFn(getRentalPayLinkInfo);
  const payFn = useServerFn(createRentalPayLinkCheckout);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pay-link", token],
    queryFn: () => infoFn({ data: { token } }),
  });
  const confirmFn = useServerFn(confirmConnectRentalPayment);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const cs = q.get("cs"), acct = q.get("acct");
    if (cs && acct) confirmFn({ data: { sessionId: cs, account: acct } }).then(() => refetch()).catch(() => {});
  }, []);

  const start = useMutation({
    mutationFn: async () => {
      const r: any = await payFn({
        data: { token, environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/pay/${token}?paid=1` },
      });
      if (r.error) throw new Error(r.error);
      if (r.url) { window.location.href = r.url; return null; }
      return r.clientSecret as string;
    },
    onSuccess: (s) => { if (s) setClientSecret(s); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <Shell><p className="text-sm text-ink-muted">Loading…</p></Shell>;
  const info: any = data;
  if (!info) return <Shell><p className="text-sm text-primary">This payment link is not valid.</p></Shell>;

  if (clientSecret) {
    return (
      <Shell>
        <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: async () => clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
        <button
          onClick={() => { setClientSecret(null); refetch(); }}
          className="mt-4 text-xs uppercase tracking-widest text-ink-muted hover:text-foreground"
        >
          Cancel
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="rounded-md border border-border bg-surface-elevated p-4">
        <div className="flex items-center gap-2">
          <Bike className="h-5 w-5 text-primary" />
          <p className="font-display text-lg">{info.customerName ?? "Rental customer"}</p>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {[info.bike, info.registration].filter(Boolean).join(" · ") || "Motorbike rental"}
        </p>
        <p className="mt-1 text-xs text-ink-muted">Weekly rent {fmt(info.weeklyRatePence)}</p>
      </div>

      {info.totalPence > 0 ? (
        <>
          <div className="mt-4 rounded-md border-2 border-primary/50 bg-surface-elevated p-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
              Total due ({info.weeks.length} week{info.weeks.length === 1 ? "" : "s"})
            </p>
            <p className="font-display text-4xl">{fmt(info.totalPence)}</p>
            <button
              onClick={() => start.mutate()}
              disabled={start.isPending}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded bg-primary px-4 py-3 text-sm font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-60"
            >
              <CreditCard className="h-4 w-4" /> {start.isPending ? "Please wait…" : `Pay ${fmt(info.totalPence)} now`}
            </button>
            <p className="mt-2 text-[11px] text-ink-muted">Apple Pay, Google Pay or card — no password or sign-in needed.</p>
          </div>

          <ul className="mt-4 space-y-2">
            {info.weeks.map((w: any) => (
              <li key={w.id} className="flex items-center justify-between rounded-md border border-border bg-surface-elevated p-3 text-sm">
                <div>
                  <p><b>{ukDate(w.week_start)}</b> → {ukDate(w.week_end)}</p>
                  <p className="text-xs text-ink-muted">Rent due {ukDateWithWeekday(w.due_date)}</p>
                </div>
                <span className="font-display text-lg">{fmt(w.amount_pence)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-4 rounded-md border border-border bg-surface-elevated p-6 text-center">
          <p className="font-display text-xl">All paid up</p>
          <p className="mt-1 text-sm text-ink-muted">You have no rent due right now. Thank you.</p>
        </div>
      )}
    </Shell>
  );
}
