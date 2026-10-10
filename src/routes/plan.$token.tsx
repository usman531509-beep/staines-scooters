import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { CalendarClock, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { ukDate } from "@/lib/format-date";
import { getArrearsPayLinkInfo, createArrearsPayLinkCheckout } from "@/lib/arrears-pay.functions";
import { BRAND, BRAND_ADDRESS } from "@/lib/brand";
import { onlinePaymentsEnabled } from "@/lib/online-payments";

export const Route = createFileRoute("/plan/$token")({
  head: () => ({
    meta: [
      { title: `Pay your repayment plan — ${BRAND.name}` },
      { name: "description", content: "Make your agreed overdue rent repayment securely in seconds — no sign-in needed." },
      { property: "og:title", content: `Pay your repayment plan — ${BRAND.name}` },
      { property: "og:description", content: "Make your agreed overdue rent repayment securely in seconds — no sign-in needed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (onlinePaymentsEnabled() ? <PlanPayPage /> : <LinkUnavailable />),
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
      <p className="mt-1 text-xs uppercase tracking-widest text-ink-muted">Overdue rent repayment plan</p>
      <div className="mt-6">{children}</div>
      <p className="mt-8 text-xs text-ink-muted">{BRAND_ADDRESS} · {BRAND.phone}</p>
    </main>
  );
}

function PlanPayPage() {
  const { token } = Route.useParams();
  const infoFn = useServerFn(getArrearsPayLinkInfo);
  const payFn = useServerFn(createArrearsPayLinkCheckout);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["plan-pay-link", token],
    queryFn: () => infoFn({ data: { token } }),
  });

  const start = useMutation({
    mutationFn: async (payAll: boolean) => {
      const r: any = await payFn({
        data: { token, payAll, environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/plan/${token}?paid=1` },
      });
      if (r.error) throw new Error(r.error);
      return r.clientSecret as string;
    },
    onSuccess: (s) => setClientSecret(s),
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

  const payNow = info.duePence > 0 ? info.duePence : info.nextInstallment?.amount_pence ?? 0;

  return (
    <Shell>
      <div className="rounded-md border border-border bg-surface-elevated p-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <p className="font-display text-lg">{info.customerName ?? "Rental customer"}</p>
        </div>
        <p className="mt-1 text-sm text-ink-muted">{info.title}</p>
        <p className="mt-1 text-xs text-ink-muted">
          Paid {fmt(info.paidPence)} of {fmt(info.totalPence)} · {fmt(info.remainingPence)} remaining
        </p>
        {info.cardLast4 && (
          <p className="mt-1 text-xs text-ink-muted">
            Saved card: {info.cardBrand ?? "card"} ••••{info.cardLast4}
          </p>
        )}
      </div>

      {info.remainingPence > 0 ? (
        <>
          <div className="mt-4 rounded-md border-2 border-primary/50 bg-surface-elevated p-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
              {info.duePence > 0 ? "Due now" : "Next payment"}
            </p>
            <p className="font-display text-4xl">{fmt(payNow)}</p>
            <button
              onClick={() => start.mutate(false)}
              disabled={start.isPending || payNow <= 0}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded bg-primary px-4 py-3 text-sm font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-60"
            >
              <CreditCard className="h-4 w-4" /> {start.isPending ? "Please wait…" : `Pay ${fmt(payNow)} now`}
            </button>
            <button
              onClick={() => start.mutate(true)}
              disabled={start.isPending}
              className="mt-2 w-full rounded border border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest text-ink-muted hover:text-foreground disabled:opacity-60"
            >
              Clear full balance {fmt(info.remainingPence)}
            </button>
            <p className="mt-2 text-[11px] text-ink-muted">
              Apple Pay, Google Pay or card — no password or sign-in needed. Your card is stored securely by Stripe for the
              remaining agreed payments.
            </p>
          </div>

          <ul className="mt-4 space-y-2">
            {info.dueInstallments.map((i: any) => (
              <li key={i.id} className="flex items-center justify-between rounded-md border border-border bg-surface-elevated p-3 text-sm">
                <div>
                  <p><b>Payment #{i.seq}</b></p>
                  <p className="text-xs text-ink-muted">Due {ukDate(i.due_date)}</p>
                </div>
                <span className="font-display text-lg">{fmt(i.amount_pence)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-4 rounded-md border border-border bg-surface-elevated p-6 text-center">
          <p className="font-display text-xl">Fully paid</p>
          <p className="mt-1 text-sm text-ink-muted">Your rent balance is cleared in full. Thank you.</p>
        </div>
      )}
    </Shell>
  );
}
