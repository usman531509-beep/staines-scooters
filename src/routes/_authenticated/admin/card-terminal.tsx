import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, Copy, RefreshCw, Wifi } from "lucide-react";
import { AccountShell } from "@/components/AccountShell";
import { ukDateTime } from "@/lib/format-date";
import {
  getCardTerminal,
  saveCardTerminal,
  rotateTerminalKey,
  startTerminalPayment,
  finishTerminalPayment,
  listTerminalTransactions,
} from "@/lib/card-terminal.functions";
import { sendToTerminal } from "@/lib/card-terminal";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/admin/card-terminal")({
  head: () => ({
    meta: [
      { title: `Card Terminal Setup — ${BRAND.name}` },
      { name: "description", content: `Pair your Takepayments card machine with the ${BRAND.name} POS so amounts appear automatically.` },
      { property: "og:title", content: `Card Terminal Setup — ${BRAND.name}` },
      { property: "og:description", content: `Pair your Takepayments card machine with the ${BRAND.name} POS.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CardTerminalPage,
  errorComponent: ({ error }) => (
    <AccountShell title="Card Terminal"><p className="text-sm text-primary">{error.message}</p></AccountShell>
  ),
  notFoundComponent: () => <AccountShell title="Card Terminal"><p>Not found</p></AccountShell>,
});

function CardTerminalPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getCardTerminal);
  const saveFn = useServerFn(saveCardTerminal);
  const rotateFn = useServerFn(rotateTerminalKey);
  const startFn = useServerFn(startTerminalPayment);
  const finishFn = useServerFn(finishTerminalPayment);
  const txFn = useServerFn(listTerminalTransactions);

  const { data } = useQuery({ queryKey: ["card-terminal"], queryFn: () => getFn() });
  const { data: txData } = useQuery({ queryKey: ["card-terminal-tx"], queryFn: () => txFn() });
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (data?.terminal) setForm(data.terminal);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: form.id,
          name: form.name,
          provider: form.provider,
          protocol: form.protocol,
          host: form.host || null,
          port: Number(form.port) || 8080,
          path: form.path || "/",
          serial_number: form.serial_number || null,
          ecr_id: form.ecr_id,
          currency: form.currency || "GBP",
          enabled: !!form.enabled,
          notes: form.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Card machine settings saved.");
      qc.invalidateQueries({ queryKey: ["card-terminal"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save"),
  });

  const rotate = useMutation({
    mutationFn: () => rotateFn({ data: { id: form.id } }),
    onSuccess: () => {
      toast.success("New integration key created — retype it on the card machine.");
      qc.invalidateQueries({ queryKey: ["card-terminal"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not create a new key"),
  });

  const test = useMutation({
    mutationFn: async () => {
      const req: any = await startFn({ data: { amountPence: 100 } });
      const result = await sendToTerminal(req.endpoint, req.payload, 90_000);
      await finishFn({
        data: {
          transactionId: req.transactionId,
          status: result.status,
          message: result.message ?? null,
          authCode: result.authCode ?? null,
          cardScheme: result.cardScheme ?? null,
          cardLast4: result.cardLast4 ?? null,
          raw: result.raw ?? null,
        },
      });
      return result;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["card-terminal-tx"] });
      if (r.status === "approved") toast.success("Test £1.00 approved on the card machine.");
      else toast.error(r.message ?? `Test ${r.status}`);
    },
    onError: (e: any) => toast.error(e.message ?? "Test failed"),
  });

  if (!form) return <AccountShell title="Card Terminal"><p>Loading…</p></AccountShell>;

  const origin = typeof window !== "undefined" ? window.location.origin : BRAND.siteUrl;
  const endpoint = `${form.protocol}://${form.host || "TERMINAL-IP"}:${form.port}${String(form.path || "/").startsWith("/") ? form.path : `/${form.path}`}`;

  return (
    <AccountShell title="Card Terminal">
      <div className="grid max-w-3xl gap-6">
        <section className="rounded-md border border-border bg-surface-elevated p-5">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg uppercase tracking-wide">Give these details to Takepayments</h2>
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            These are the POS / EPOS connection details Takepayments (or Awais) asked for. Read them out or copy them
            into the card machine's ECR / integration settings.
          </p>
          <div className="mt-4 grid gap-2">
            <Detail label="EPOS / POS name" value={`${BRAND.name} POS`} />
            <Detail label="ECR / POS ID" value={form.ecr_id} />
            <Detail label="Integration key (shared secret)" value={form.integration_key} />
            <Detail label="Currency" value={form.currency} />
            <Detail label="Terminal IP address" value={form.host || "— not set yet —"} />
            <Detail label="Terminal port" value={String(form.port)} />
            <Detail label="Terminal path" value={form.path} />
            <Detail label="POS → terminal request URL" value={endpoint} />
            <Detail label="Terminal → POS result URL (callback / webhook)" value={`${origin}/api/public/terminal/callback`} />
            <Detail label="Callback header" value="x-integration-key: (the integration key above)" />
            <Detail label="Message format" value='POST JSON — { ecrId, reference, amount, amountMinor, currency, transactionType: "sale" }' />
          </div>
          <button
            type="button"
            onClick={() => rotate.mutate()}
            disabled={rotate.isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-sm border border-border bg-surface px-4 py-2.5 text-xs font-semibold uppercase tracking-widest hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> New integration key
          </button>
        </section>

        <section className="grid gap-4 rounded-md border border-border bg-surface-elevated p-5">
          <h2 className="font-display text-lg uppercase tracking-wide">Card machine settings</h2>
          <p className="text-sm text-ink-muted">
            Ask Takepayments for the terminal's IP address, port and path (they appear on the terminal under
            Settings → Communications / ECR). The POS device and the card machine must be on the same shop Wi‑Fi.
          </p>
          <Text label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Text label="Provider" value={form.provider} onChange={(v) => setForm({ ...form, provider: v })} />
          <Text label="Terminal IP address" value={form.host ?? ""} onChange={(v) => setForm({ ...form, host: v })} placeholder="e.g. 192.168.1.50" />
          <Text label="Port" value={String(form.port)} onChange={(v) => setForm({ ...form, port: v.replace(/\D/g, "") })} placeholder="8080" />
          <Text label="Path" value={form.path} onChange={(v) => setForm({ ...form, path: v })} placeholder="/ecr" />
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-widest text-ink-muted">Protocol</span>
            <select
              value={form.protocol}
              onChange={(e) => setForm({ ...form, protocol: e.target.value })}
              className="rounded-sm border border-border bg-input px-3 py-2.5 text-sm"
            >
              <option value="http">http</option>
              <option value="https">https</option>
            </select>
          </label>
          <Text label="Terminal serial number" value={form.serial_number ?? ""} onChange={(v) => setForm({ ...form, serial_number: v })} />
          <Text label="ECR / POS ID" value={form.ecr_id} onChange={(v) => setForm({ ...form, ecr_id: v })} />
          <Text label="Currency" value={form.currency} onChange={(v) => setForm({ ...form, currency: v.toUpperCase().slice(0, 3) })} />
          <label className="flex items-center justify-between gap-3 rounded-sm border border-border bg-surface px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-widest">Send POS totals to this card machine</span>
            <input type="checkbox" checked={!!form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="h-4 w-4" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-widest text-ink-muted">Notes</span>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="rounded-sm border border-border bg-input px-3 py-2.5 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="rounded-sm bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : "Save settings"}
            </button>
            <button
              onClick={() => test.mutate()}
              disabled={test.isPending || !form.host}
              className="inline-flex items-center gap-2 rounded-sm border border-border bg-surface px-6 py-3 text-sm font-semibold uppercase tracking-widest hover:border-primary hover:text-primary disabled:opacity-50"
            >
              <Wifi className="h-4 w-4" /> {test.isPending ? "Waiting for terminal…" : "Send £1.00 test"}
            </button>
          </div>
        </section>

        <section className="rounded-md border border-border bg-surface-elevated p-5">
          <h2 className="font-display text-lg uppercase tracking-wide">Recent terminal payments</h2>
          <ul className="mt-3 grid gap-2">
            {(txData?.transactions ?? []).length === 0 && <li className="text-sm text-ink-muted">Nothing yet.</li>}
            {(txData?.transactions ?? []).map((t: any) => (
              <li key={t.id} className="flex items-center justify-between rounded-sm border border-border bg-surface px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold">£{(t.amount_pence / 100).toFixed(2)} · {t.status}</p>
                  <p className="text-xs text-ink-muted">
                    {ukDateTime(t.created_at)} · ref {t.reference}
                    {t.card_last4 ? ` · ****${t.card_last4}` : ""}
                    {t.message ? ` · ${t.message}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AccountShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-sm border border-border bg-surface px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">{label}</p>
        <p className="break-all text-sm">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          toast.success(`${label} copied`);
        }}
        className="shrink-0 rounded-sm border border-border p-1.5 hover:border-primary hover:text-primary"
        aria-label={`Copy ${label}`}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-widest text-ink-muted">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-sm border border-border bg-input px-3 py-2.5 text-sm"
      />
    </label>
  );
}
