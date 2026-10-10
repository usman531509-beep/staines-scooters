import { ukDate, ukDateTime, isoDay } from "@/lib/format-date";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-client";
import {
  getRental,
  updateRental,
  endRental,
  deleteRental,
  markWeekPaidManual,
  recordDepositManual,
  addRentalDocument,
  deleteRentalDocument,
  getRentalDocumentSignedUrl,
  setRentalBillingDay,
  chargeWeekNow,
  setWeekAmount,
  setWeekDates,
  deleteRentalWeek,
  setWeeklyRate,
  getArrearsPlanForUser,
} from "@/lib/rental.functions";
import { ArrearsPlanCard } from "@/components/rental/ArrearsPlanCard";
import { RentalCardManager, WEEKDAYS } from "@/components/rental/RentalCardManager";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { formatDueDate, isWeekDue } from "@/lib/rental-due";
import { getRentalPayLinkForStaff, createStaffRentalCheckout } from "@/lib/rental-pay.functions";
import { BRAND } from "@/lib/brand";
import { onlinePaymentsEnabled } from "@/lib/online-payments";

const fmt = (p?: number | null) => (p == null ? "—" : `£${(p / 100).toFixed(2)}`);
const today = () => isoDay();

export function RentalDetailView({ id, onDeleted }: { id: string; onDeleted?: () => void }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const getFn = useServerFn(getRental);
  const markPaidFn = useServerFn(markWeekPaidManual);
  const depositFn = useServerFn(recordDepositManual);
  const endFn = useServerFn(endRental);
  const delFn = useServerFn(deleteRental);
  const addDocFn = useServerFn(addRentalDocument);
  const delDocFn = useServerFn(deleteRentalDocument);
  const signFn = useServerFn(getRentalDocumentSignedUrl);
  const updateFn = useServerFn(updateRental);
  const billingDayFn = useServerFn(setRentalBillingDay);
  const chargeNowFn = useServerFn(chargeWeekNow);
  const setAmountFn = useServerFn(setWeekAmount);
  const setDatesFn = useServerFn(setWeekDates);
  const delWeekFn = useServerFn(deleteRentalWeek);
  const rateFn = useServerFn(setWeeklyRate);
  const staffPayFn = useServerFn(createStaffRentalCheckout);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [payingLabel, setPayingLabel] = useState<string>("");
  const [payBusy, setPayBusy] = useState(false);
  const [wkStatus, setWkStatus] = useState<"all" | "unpaid" | "paid" | "failed">("all");
  const [wkSearch, setWkSearch] = useState("");
  const [wkFrom, setWkFrom] = useState("");
  const [wkTo, setWkTo] = useState("");
  const [wkSort, setWkSort] = useState<"unpaid-first" | "newest" | "oldest" | "amount">("newest");


  async function takePayment(label: string, week_id?: string) {
    setPayBusy(true);
    try {
      const res: any = await staffPayFn({
        data: { rental_id: id, week_id, environment: getStripeEnvironment(), returnUrl: `${window.location.href.split("?")[0]}?paid=1` },
      });
      if (res?.error) throw new Error(res.error);
      setPayingLabel(label);
      setClientSecret(res.clientSecret as string);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPayBusy(false);
    }
  }


  async function editWeekDates(w: any) {
    const start = prompt("Week start date (YYYY-MM-DD)", w.week_start);
    if (start === null) return;
    const end = prompt("Week end date (YYYY-MM-DD)", w.week_end);
    if (end === null) return;
    try {
      await setDatesFn({ data: { week_id: w.id, week_start: start.trim(), week_end: end.trim() } });
      toast.success("Dates updated");
      refresh();
    } catch (e: any) { toast.error(e.message); }
  }

  async function editWeekAmount(w: any) {
    const input = prompt("Payment amount (£)", ((w.amount_pence ?? 0) / 100).toFixed(2));
    if (input === null) return;
    const pence = Math.round(parseFloat(input) * 100);
    if (!Number.isFinite(pence) || pence < 0) { toast.error("Enter a valid amount"); return; }
    try {
      await setAmountFn({ data: { week_id: w.id, amount_pence: pence } });
      toast.success("Amount updated");
      refresh();
    } catch (e: any) { toast.error(e.message); }
  }

  async function removeWeek(w: any) {
    if (!confirm(`Delete the payment for ${w.week_start} → ${w.week_end}?`)) return;
    try {
      await delWeekFn({ data: { week_id: w.id } });
      toast.success("Payment deleted");
      refresh();
    } catch (e: any) { toast.error(e.message); }
  }

  const { data, isLoading } = useQuery({ queryKey: ["rental", id], queryFn: () => getFn({ data: { id } }) });
  const planFn = useServerFn(getArrearsPlanForUser);
  const customerUserId = (data as any)?.rental?.customer_id ?? null;
  const { data: planData } = useQuery({
    queryKey: ["arrears-plan", customerUserId],
    enabled: !!customerUserId,
    queryFn: () => planFn({ data: { userId: customerUserId as string } }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["rental", id] });

  const [uploadType, setUploadType] = useState<string>("driving_licence");
  const [uploadExpiry, setUploadExpiry] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  async function upload(f: File) {
    setUploading(true);
    try {
      const path = `${id}/${crypto.randomUUID()}-${f.name}`;
      const { error } = await supabase.storage.from("rental-documents").upload(path, f);
      if (error) throw error;
      await addDocFn({ data: { rental_id: id, doc_type: uploadType as any, storage_path: path, file_name: f.name, expires_at: uploadExpiry || null } });
      toast.success("Uploaded");
      refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  }

  async function openDoc(path: string) {
    const r: any = await signFn({ data: { storage_path: path } });
    if (r?.url) window.open(r.url, "_blank");
  }

  if (isLoading || !data) return <p className="text-sm">Loading…</p>;
  const r = data.rental;
  const paidTotal = data.payments.filter((p: any) => p.kind === "weekly").reduce((s: number, p: any) => s + p.amount_pence, 0);
  // Only weeks whose rent due date has arrived are shown (paid weeks always stay visible).
  const dueWeeks = (data.weeks as any[]).filter(
    (w: any) => w.status === "paid" || isWeekDue(w.week_end, r.billing_day ?? 1),
  );
  const chronological = [...dueWeeks].sort((a, b) => String(a.week_start).localeCompare(String(b.week_start)));
  const firstWeekId = chronological[0]?.id;
  const q = wkSearch.trim().toLowerCase();
  const filteredWeeks = dueWeeks.filter((w: any) => {
    if (wkStatus === "paid" && w.status !== "paid") return false;
    if (wkStatus === "unpaid" && w.status !== "unpaid") return false;
    if (wkStatus === "failed" && !(w.status === "unpaid" && w.last_charge_error)) return false;
    if (wkFrom && String(w.week_end) < wkFrom) return false;
    if (wkTo && String(w.week_start) > wkTo) return false;
    if (q) {
      const hay = [
        ukDate(w.week_start),
        ukDate(w.week_end),
        w.week_start,
        w.week_end,
        w.status,
        (w.amount_pence / 100).toFixed(2),
        w.last_charge_error ?? "",
        w.paid_at ?? "",
      ].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const visibleWeeks = [...filteredWeeks].sort((a: any, b: any) => {
    if (wkSort === "newest") return String(b.week_start).localeCompare(String(a.week_start));
    if (wkSort === "oldest") return String(a.week_start).localeCompare(String(b.week_start));
    if (wkSort === "amount") return b.amount_pence - a.amount_pence;
    // unpaid first, then oldest first within each group
    const rank = (w: any) => (w.status === "unpaid" ? 0 : 1);
    return rank(a) - rank(b) || String(a.week_start).localeCompare(String(b.week_start));
  });
  const unpaidTotal = dueWeeks.filter((w: any) => w.status === "unpaid").reduce((s: number, w: any) => s + w.amount_pence, 0);

  const depositOutstanding = Math.max(0, (r.deposit_pence ?? 0) - (r.deposit_paid_pence ?? 0));

  return (
    <>
      {clientSecret && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4">
          <div className="mx-auto max-w-lg rounded-md border border-border bg-surface-elevated p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">Take payment · {payingLabel}</p>
              <button
                onClick={() => { setClientSecret(null); refresh(); }}
                className="rounded border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest"
              >Close</button>
            </div>
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: async () => clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        </div>
      )}
      <h2 className="mb-3 font-display text-xl uppercase">Rental — {data.profile?.full_name ?? ""}</h2>

      {r.status !== "active" && (
        <div className="mb-3 rounded-md border border-border bg-surface-elevated p-3 text-sm">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Rental ended</span>
          <div className="font-display text-lg">{r.end_date ? ukDate(r.end_date) : "End date not set"}</div>
        </div>
      )}
      {(planData as any)?.plan && (
        <div className="mb-4">
          <ArrearsPlanCard plan={(planData as any).plan} installments={(planData as any).installments ?? []} />
        </div>
      )}
      <div className="space-y-4">

        <div className="grid gap-2 sm:grid-cols-4">
          <WeeklyRateStat
            rental={r}
            onSave={async (pence: number) => {
              await rateFn({ data: { rental_id: id, weekly_rate_pence: pence } });
              toast.success("Weekly rent updated — applies to future weeks");
              refresh();
            }}
          />
          <Stat label="Paid to date" value={fmt(paidTotal)} />
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="text-[10px] uppercase tracking-widest text-ink-muted">Unpaid</p>
            <p className="mt-1 font-display text-lg">{fmt(unpaidTotal)}</p>
            {onlinePaymentsEnabled() && unpaidTotal > 0 && (
              <button
                onClick={() => takePayment(`Total due — ${fmt(unpaidTotal)}`)}
                disabled={payBusy}
                className="mt-2 w-full rounded bg-primary px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-60"
              >
                Pay now
              </button>
            )}
          </div>
          <Stat label="Deposit" value={`${fmt(r.deposit_paid_pence)} / ${fmt(r.deposit_pence)}`} />
        </div>

        <Section title="Rental period">
          <RentalPeriodEditor rental={r} onSave={(patch) => updateFn({ data: { id, ...patch } }).then(() => { toast.success("Rental period updated"); refresh(); }).catch((e: any) => toast.error(e.message))} />
        </Section>

        {onlinePaymentsEnabled() && (
          <Section title="Customer pay link">
            <PayLinkBox rentalId={id} />
          </Section>
        )}



        <Section title="Weekly collection">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs uppercase tracking-widest text-ink-muted">Billing day</span>
              <select
                value={r.billing_day ?? 1}
                onChange={(e) => billingDayFn({ data: { rental_id: id, billing_day: Number(e.target.value) } }).then(() => { toast.success("Billing day updated"); refresh(); })}
                className="rounded border border-border bg-surface-elevated px-2 py-1 text-sm"
              >
                {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
              <span className="text-xs text-ink-muted">Each week's rent falls due on this day.</span>
            </div>
            {onlinePaymentsEnabled() && <RentalCardManager rental={r} onChanged={refresh} isStaff />}
          </div>
        </Section>

        <Section title="Weekly ledger">
          <div className="mb-2 flex flex-wrap items-end gap-2">
            <input
              value={wkSearch}
              onChange={(e) => setWkSearch(e.target.value)}
              placeholder="Search week, amount, error…"
              className="w-56 rounded border border-border bg-surface-elevated px-2 py-1 text-sm"
            />
            <div className="flex gap-1">
              {(["all", "unpaid", "paid", "failed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setWkStatus(s)}
                  className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-widest ${wkStatus === s ? "bg-primary text-primary-foreground" : "border border-border bg-surface-elevated text-ink-muted"}`}
                >{s}</button>
              ))}
            </div>
            <label className="text-[10px] uppercase tracking-widest text-ink-muted">From
              <input type="date" value={wkFrom} onChange={(e) => setWkFrom(e.target.value)} className="ml-1 rounded border border-border bg-surface-elevated px-2 py-1 text-sm" />
            </label>
            <label className="text-[10px] uppercase tracking-widest text-ink-muted">To
              <input type="date" value={wkTo} onChange={(e) => setWkTo(e.target.value)} className="ml-1 rounded border border-border bg-surface-elevated px-2 py-1 text-sm" />
            </label>
            <select value={wkSort} onChange={(e) => setWkSort(e.target.value as any)} className="rounded border border-border bg-surface-elevated px-2 py-1 text-sm">
              <option value="unpaid-first">Unpaid first</option>
              <option value="oldest">Oldest first</option>
              <option value="newest">Newest first</option>
              <option value="amount">Highest amount</option>
            </select>
            {(wkSearch || wkFrom || wkTo || wkStatus !== "all" || wkSort !== "newest") && (
              <button onClick={() => { setWkSearch(""); setWkFrom(""); setWkTo(""); setWkStatus("all"); setWkSort("newest"); }} className="text-xs text-primary hover:underline">Clear filters</button>
            )}
            <span className="ml-auto text-xs text-ink-muted">{visibleWeeks.length} of {dueWeeks.length} weeks</span>
          </div>
          <div className="rounded border border-border">

            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-[10px] uppercase tracking-widest text-ink-muted"><tr><th className="px-2 py-1 text-left">Week</th><th className="px-2 py-1 text-left">Rent due</th><th className="px-2 py-1 text-right">Days</th><th className="px-2 py-1 text-right">Amount</th><th className="px-2 py-1 text-left">Status</th><th /></tr></thead>
              <tbody>
                {visibleWeeks.map((w: any) => (
                  <tr key={w.id} className="border-t border-border">
                    <td className="px-2 py-1">
                      {ukDate(w.week_start)} → {ukDate(w.week_end)}
                      {firstWeekId === w.id && (
                        <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">First payment</span>
                      )}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">{formatDueDate(w.week_end, r.billing_day ?? 1)}</td>
                    <td className="px-2 py-1 text-right">{w.days_charged}</td>
                    <td className="px-2 py-1 text-right">{fmt(w.amount_pence)}</td>
                    <td className="px-2 py-1"><span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${w.status === "paid" ? "bg-green-500/15 text-green-600" : "bg-orange-500/15 text-orange-600"}`}>{w.status}</span>{w.paid_at && <span className="ml-1 text-[10px] text-ink-muted">{w.paid_at.slice(0,10)}</span>}</td>
                    <td className="px-2 py-1 text-right">
                      {w.status === "unpaid" && (
                        <div className="flex items-center justify-end gap-2">
                          {onlinePaymentsEnabled() && (
                            <button
                              onClick={() => takePayment(`${ukDate(w.week_start)} → ${ukDate(w.week_end)} — ${fmt(w.amount_pence)}`, w.id)}
                              disabled={payBusy}
                              className="rounded bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-60"
                            >Pay now</button>
                          )}

                          {onlinePaymentsEnabled() && r.default_payment_method_id && (
                            <button
                              onClick={async () => {
                                const res: any = await chargeNowFn({ data: { week_id: w.id, environment: getStripeEnvironment() } });
                                if (res?.ok) toast.success("Card charged");
                                else toast.error(res?.error ?? "Charge failed");
                                refresh();
                              }}
                              className="text-xs text-primary hover:underline"
                            >Charge card</button>
                          )}
                          <button onClick={() => editWeekDates(w)} className="text-xs hover:underline">Edit dates</button>
                          <button onClick={() => editWeekAmount(w)} className="text-xs hover:underline">Edit £</button>
                          <button onClick={() => markPaidFn({ data: { week_id: w.id, method: "cash" } }).then(() => refresh())} className="text-xs hover:underline">Mark paid</button>
                          {isAdmin && <button onClick={() => removeWeek(w)} className="text-xs text-red-500 hover:underline">Delete</button>}
                        </div>
                      )}
                      {w.status === "paid" && isAdmin && (
                        <button onClick={() => removeWeek(w)} className="text-xs text-red-500 hover:underline">Delete</button>
                      )}
                      {w.status === "unpaid" && w.last_charge_error && (
                        <p className="text-[10px] text-red-500">{w.last_charge_error}</p>
                      )}
                    </td>
                  </tr>
                ))}
                {visibleWeeks.length === 0 && <tr><td colSpan={6} className="p-3 text-center text-xs text-ink-muted">No rent due yet</td></tr>}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Deposit">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Held: <b>{fmt((r.deposit_paid_pence ?? 0) - (r.deposit_refunded_pence ?? 0))}</b> · Outstanding: <b>{fmt(depositOutstanding)}</b></span>
            {(r.deposit_refunded_pence ?? 0) > 0 && (
              <span className="text-xs text-ink-muted">
                Refunded: <b>{fmt(r.deposit_refunded_pence)}</b>
                {r.deposit_refunded_at ? ` · ${ukDateTime(r.deposit_refunded_at)}` : ""}
              </span>
            )}
            {depositOutstanding > 0 && (
              <button onClick={() => depositFn({ data: { rental_id: id, amount_pence: depositOutstanding, kind: "deposit", method: "cash" } }).then(() => refresh())} className="ml-auto rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Record deposit paid</button>
            )}
            {(r.deposit_paid_pence ?? 0) > (r.deposit_refunded_pence ?? 0) && (
              <button onClick={() => {
                const amt = prompt("Refund amount (£)");
                if (!amt) return;
                const p = Math.round(parseFloat(amt) * 100);
                depositFn({ data: { rental_id: id, amount_pence: p, kind: "deposit_refund", method: "cash" } }).then(() => refresh());
              }} className="rounded border border-border px-2 py-1 text-xs">Refund deposit</button>
            )}
          </div>
        </Section>

        <Section title="Documents">
          <div className="flex flex-wrap items-end gap-2 rounded border border-border bg-surface p-2">
            <label className="text-xs">Type
              <select value={uploadType} onChange={(e) => setUploadType(e.target.value)} className="ml-1 rounded border border-border bg-surface-elevated px-2 py-1 text-sm">
                <option value="driving_licence">Driving Licence</option>
                <option value="cbt">CBT</option>
                <option value="proof_of_address">Proof of Address</option>
                <option value="vehicle_insurance">Vehicle Insurance</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="text-xs">Expires <input type="date" value={uploadExpiry} onChange={(e) => setUploadExpiry(e.target.value)} className="ml-1 rounded border border-border bg-surface-elevated px-2 py-1 text-sm" /></label>
            <label className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
              <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload"}
              <input type="file" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>
          <ul className="mt-2 space-y-1">
            {data.documents.map((d: any) => (
              <li key={d.id} className="flex items-center justify-between rounded border border-border bg-surface-elevated px-2 py-1 text-sm">
                <span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-primary" /><b className="uppercase text-[10px] tracking-widest">{d.doc_type}</b> {d.file_name} {d.expires_at && <span className="text-[10px] text-ink-muted">exp {ukDate(d.expires_at)}</span>}</span>
                <span className="flex gap-2">
                  <button onClick={() => openDoc(d.storage_path)} className="text-xs text-primary hover:underline">View</button>
                  <button onClick={() => delDocFn({ data: { id: d.id } }).then(() => refresh())} className="text-xs text-red-600 hover:underline">Delete</button>
                </span>
              </li>
            ))}
            {data.documents.length === 0 && <li className="p-2 text-center text-xs text-ink-muted">No documents</li>}
          </ul>
        </Section>

        {data.pcns.length > 0 && (
          <Section title="PCNs">
            <ul className="space-y-1">
              {data.pcns.map((p: any) => (
                <li key={p.id} className="flex items-center justify-between rounded border border-border bg-surface-elevated px-2 py-1 text-sm">
                  <span>{ukDate(p.issued_on)} · {p.reference ?? "—"} · {fmt(p.amount_pence)}</span>
                  <span className="text-xs uppercase text-ink-muted">{p.status}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border pt-2">
          {r.status === "active" && (
            <button onClick={() => { const d = prompt("End date", today()); if (d) endFn({ data: { id, end_date: d } }).then(() => refresh()); }} className="rounded border border-border px-3 py-2 text-xs">End rental</button>
          )}
          {isAdmin && (
            <button onClick={() => { if (confirm("Move rental to Recycle Bin?")) delFn({ data: { id } }).then(() => onDeleted?.()); }} className="ml-auto rounded border border-red-500 px-3 py-2 text-xs text-red-600"><Trash2 className="mr-1 inline h-3 w-3" />Delete</button>
          )}
        </div>
      </div>
    </>
  );
}

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

function WeeklyRateStat({ rental, onSave }: { rental: any; onSave: (pence: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(((rental.weekly_rate_pence ?? 0) / 100).toFixed(2));
  const [saving, setSaving] = useState(false);

  async function save() {
    const pence = Math.round(parseFloat(value) * 100);
    if (!Number.isFinite(pence) || pence < 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try { await onSave(pence); setEditing(false); }
    catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="rounded border border-border bg-surface-elevated p-2">
      <p className="text-[10px] uppercase tracking-widest text-ink-muted">Weekly</p>
      {editing ? (
        <div className="mt-1 space-y-1">
          <div className="flex items-center gap-1">
            <span className="text-sm">£</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-sm"
            />
          </div>
          <div className="flex gap-1">
            <button onClick={save} disabled={saving} className="rounded bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setEditing(false); setValue(((rental.weekly_rate_pence ?? 0) / 100).toFixed(2)); }} className="rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest">
              Cancel
            </button>
          </div>
          <p className="text-[10px] text-ink-muted">Applies to weeks starting after today.</p>
        </div>
      ) : (
        <div className="mt-1 flex items-center gap-2">
          <span className="font-display text-lg">{fmt(rental.weekly_rate_pence)}</span>
          <button onClick={() => setEditing(true)} className="text-[10px] font-semibold uppercase tracking-widest text-primary hover:underline">Edit</button>
        </div>
      )}
    </div>
  );
}

function PayLinkBox({ rentalId }: { rentalId: string }) {
  const linkFn = useServerFn(getRentalPayLinkForStaff);
  const { data } = useQuery({
    queryKey: ["rental-pay-link", rentalId],
    queryFn: () => linkFn({ data: { rental_id: rentalId } }),
  });
  const url = (data as any)?.url as string | undefined;
  if (!url) return <p className="text-xs text-ink-muted">Loading link…</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-muted">
        Send this to the customer on WhatsApp — they can pay whatever is due with Apple Pay, Google Pay or card,
        with no sign-in or password.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded border border-border bg-surface px-2 py-1 text-xs">{url}</code>
        <button
          onClick={() => { navigator.clipboard.writeText(url); toast.success("Pay link copied"); }}
          className="rounded border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest hover:bg-surface"
        >
          Copy
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Hi, you can pay your ${BRAND.name} rent here: ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest hover:bg-surface"
        >
          WhatsApp
        </a>
      </div>
    </div>
  );
}
