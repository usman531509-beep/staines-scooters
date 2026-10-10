import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { CreditCard, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCardSetupCheckout, removeRentalCard } from "@/lib/rental.functions";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function RentalCardManager({
  rental,
  onChanged,
  isStaff = false,
}: {
  rental: any;
  onChanged: () => void;
  isStaff?: boolean;
}) {
  const setupFn = useServerFn(createCardSetupCheckout);
  const removeFn = useServerFn(removeRentalCard);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const hasCard = !!rental?.default_payment_method_id;

  const startSetup = useMutation({
    mutationFn: async () => {
      const r: any = await setupFn({
        data: {
          rental_id: rental.id,
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}${window.location.pathname}?card=saved`,
        },
      });
      if (r.error) throw new Error(r.error);
      return r.clientSecret as string;
    },
    onSuccess: (s) => setClientSecret(s),
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => await removeFn({ data: { rental_id: rental.id } }),
    onSuccess: () => { toast.success("Card removed"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-md border border-border bg-surface-elevated p-4">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-primary" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Payment card for weekly rent</p>
      </div>

      {hasCard ? (
        <p className="mt-2 text-sm">
          <b className="uppercase">{rental.card_brand ?? "Card"}</b> •••• {rental.card_last4}
          {rental.card_exp_month && (
            <span className="text-ink-muted"> · expires {String(rental.card_exp_month).padStart(2, "0")}/{String(rental.card_exp_year).slice(-2)}</span>
          )}
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">
          No card stored yet. {isStaff ? "Add the customer's card (with them present) " : "Add your card "}
          so the weekly rent can be charged to it.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => startSetup.mutate()}
          disabled={startSetup.isPending}
          className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
        >
          <CreditCard className="h-3.5 w-3.5" /> {hasCard ? "Update card" : "Add card"}
        </button>
        {hasCard && (
          <button onClick={() => remove.mutate()} className="rounded border border-border px-3 py-1.5 text-xs">
            Remove card
          </button>
        )}
      </div>

      <p className="mt-2 flex items-center gap-1 text-[11px] text-ink-muted">
        <ShieldCheck className="h-3.5 w-3.5" /> Card details are stored securely by our payment provider — never on our servers.
      </p>

      {clientSecret && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-md border border-border bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-sm uppercase">Card details</p>
              <button onClick={() => { setClientSecret(null); onChanged(); }}><X className="h-4 w-4" /></button>
            </div>
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        </div>
      )}
    </div>
  );
}
