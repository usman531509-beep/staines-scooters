import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { gbp } from "@/lib/finance-calc";
import { ukDate } from "@/lib/format-date";
import { printElement } from "@/components/finance/AgreementDocument";
import { FinanceNotes } from "@/components/finance/FinanceNotes";
import {
  getFinanceAgreementPosition, issueSettlementQuote, recordEarlySettlement, recordVoluntaryTermination,
  issueFinanceNotice, saveFinanceRecovery,
} from "@/lib/finance-ops.functions";

const btn = "rounded-sm border border-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest disabled:opacity-50";
const pbtn = "rounded-sm bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50";
const inp = "w-full rounded-sm border border-border bg-input px-2 py-1 text-sm";
const toP = (s: string) => Math.round((parseFloat(s || "0") || 0) * 100);
const plus = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

const NOTICE: Record<string, { title: string; body: (x: any) => string }> = {
  arrears: { title: "Payment reminder — arrears", body: (x) => `Our records show ${x.overdueCount} payment(s) totalling ${gbp(x.overduePence)} are overdue on your agreement. Please pay this amount now, or contact us immediately to discuss your circumstances. If you are struggling, free and impartial debt advice is available from MoneyHelper (0800 138 7777, moneyhelper.org.uk) and StepChange (stepchange.org).` },
  nosia: { title: "Notice of Sums in Arrears (Consumer Credit Act 1974, s.86B)", body: (x) => `This notice is sent to you because you are behind with your payments. You have missed ${x.overdueCount} payment(s) and the amount in arrears is ${gbp(x.overduePence)}. If you do not pay, we may take further action, including issuing a default notice. Free debt advice: MoneyHelper 0800 138 7777, StepChange, Citizens Advice.` },
  default: { title: "Default Notice (Consumer Credit Act 1974, s.87)", body: (x) => `You are in breach of your agreement because payments totalling ${gbp(x.overduePence)} are overdue. To remedy this breach you must pay ${gbp(x.overduePence)} by ${ukDate(x.remedyBy)} (at least 14 days after you receive this notice). If you do so, no further action will be taken in respect of this breach. If you do not, we may terminate the agreement, demand the balance and recover the motorcycle. ${x.protectedGoods ? "As you have paid at least one third of the total amount payable, the goods are protected and we may not recover them without a court order." : ""} Free debt advice: MoneyHelper 0800 138 7777.` },
  termination: { title: "Notice of termination", body: (x) => `As the breach set out in our Default Notice was not remedied, we hereby terminate your agreement. The balance outstanding is ${gbp(x.outstanding)}. Please contact us within 7 days to arrange return of the motorcycle and payment of the balance.` },
};

export function FinancePhase2({ a, s }: { a: any; s: any }) {
  const qc = useQueryClient();
  const posFn = useServerFn(getFinanceAgreementPosition);
  const pos = useQuery({ queryKey: ["finance-pos", a.id, s?.interest_rebate_enabled === true], queryFn: () => posFn({ data: { agreementId: a.id } }) });
  const quoteFn = useServerFn(issueSettlementQuote);
  const settleFn = useServerFn(recordEarlySettlement);
  const termFn = useServerFn(recordVoluntaryTermination);
  const noticeFn = useServerFn(issueFinanceNotice);
  const recFn = useServerFn(saveFinanceRecovery);
  const [notesOpen, setNotesOpen] = useState(false);
  const letterRef = useRef<HTMLDivElement>(null);
  const [method, setMethod] = useState<"cash" | "card_machine" | "bank_transfer">("bank_transfer");
  const [letter, setLetter] = useState<{ kind: string; remedyBy?: string } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [collected, setCollected] = useState("");
  const [rec, setRec] = useState<any | null>(null);
  const refresh = () => ["finance", "finance-tx", "finance-pos"].forEach((k) => qc.invalidateQueries({ queryKey: k === "finance" ? [k] : [k, a.id] }));
  const err = (e: any) => toast.error(e.message);
  const quote = useMutation({ mutationFn: () => quoteFn({ data: { agreementId: a.id } }), onSuccess: () => { toast.success("Settlement quote issued"); setLetter({ kind: "settlement" }); refresh(); }, onError: err });
  const settle = useMutation({ mutationFn: () => settleFn({ data: { agreementId: a.id, method } }), onSuccess: () => { toast.success("Agreement settled"); refresh(); }, onError: err });
  const term = useMutation({ mutationFn: (p: number) => termFn({ data: { agreementId: a.id, method, collectedPence: p } }), onSuccess: () => { toast.success("Voluntary termination recorded"); refresh(); }, onError: err });
  const notice = useMutation({ mutationFn: (v: { kind: any; remedyBy?: string }) => noticeFn({ data: { agreementId: a.id, ...v } }), onSuccess: (_r, v) => { toast.success("Notice logged — print it below"); setLetter(v); refresh(); }, onError: err });
  const saveRec = useMutation({ mutationFn: (r: any) => recFn({ data: r }), onSuccess: () => { toast.success("Recovery saved"); setRec(null); refresh(); }, onError: err });

  const p: any = pos.data;
  if (!p || !["active", "defaulted", "terminated", "recovered", "settled", "closed"].includes(a.status)) return null;
  const can = p.perms ?? {};
  const live = ["active", "defaulted"].includes(a.status);
  const outstanding = (a.instalments ?? []).filter((i: any) => i.status === "due").reduce((t: number, i: any) => t + i.amount_pence, 0);
  const vals = { ...p, outstanding, remedyBy: letter?.remedyBy };
  const busy = quote.isPending || settle.isPending || term.isPending || notice.isPending || saveRec.isPending;
  const identity = `Agreement FA-${a.ref_no} · ${a.customer_snapshot?.full_name ?? "Customer"} · ${a.vehicle?.reg ?? "Vehicle"}`;
  const manual = `Payment method: ${method.replace(/_/g, " ")}. This records money already received; it does not charge a card or move money from a bank account.`;
  const undoNote = "The action is added to Transactions & audit trail. Undo can restore finance records in newest-first order, but cannot recall a delivered letter/email, refund real money or reverse a physical vehicle return.";
  const ask = (title: string, purpose: string, impact: string[], onConfirm: () => void, amountInput = false) =>
    setConfirmation({ title, purpose, impact, onConfirm, amountInput });
  const askNotice = (kind: string) => {
    const remedyBy = kind === "default" ? plus(21) : undefined;
    const impacts: Record<string, string[]> = {
      arrears: ["Creates an arrears reminder letter asking the customer to pay or contact you. It does not change the agreement status, close instalments or collect a payment."],
      nosia: [`NOSIA means Notice of Sums in Arrears: a formal notice of missed payments. The button becomes available after ${a.frequency === "weekly" ? "4 weekly" : "2 monthly"} missed payments. Logging it does not change the agreement status or collect money.`, "The missed-payment threshold alone does not establish legal compliance. Check the wording, required enclosures and service requirements before sending."],
      default: [`Creates a formal default notice with remedy deadline ${ukDate(remedyBy)}. An active agreement is immediately marked DEFAULTED in this system. No payment is collected and instalments are not closed.`, "The letter asks the customer to clear the arrears by that deadline and warns about possible termination/recovery. Confirm the deadline allows at least 14 days after actual receipt; the suggested date is 21 days from today, not proof of service.", p.protectedGoods ? "Protected goods: at least one third is paid. Repossession requires a court order; this notice does not authorise taking the motorcycle." : "This notice does not itself authorise repossession. Check the agreement and lawful recovery requirements before further action."],
      termination: ["Creates a termination letter demanding the outstanding balance and arrangements for the motorcycle's return. This button logs the notice only: it does NOT change the agreement status or close instalments.", "Confirm a valid default notice was served and its remedy period has expired without the breach being remedied. Obtain appropriate legal advice before serving."],
    };
    ask(NOTICE[kind].title, "Prepare and log a customer notice about this finance agreement.", [
      `${p.overdueCount} missed payment(s) · ${gbp(p.overduePence)} overdue · ${gbp(outstanding)} remaining scheduled balance.`,
      ...impacts[kind], "On confirmation the letter appears below for Print / PDF. It is NOT automatically emailed or posted; you must arrange delivery and retain evidence of service.", undoNote,
    ], () => notice.mutate({ kind, remedyBy }));
  };


  return (
    <div className="space-y-3 rounded-sm border border-border bg-surface-elevated p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Settlement, arrears &amp; recovery</p>
      <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
        {[["Settlement figure", gbp(p.settlement.figurePence), `valid to ${ukDate(p.settlement.settlementDate)}`], ["Interest rebate", gbp(p.settlement.rebatePence), `of ${gbp(p.settlement.grossPence)} remaining`], ["To reach 50% (VT)", gbp(p.termination.toPayPence), `half = ${gbp(p.termination.halfPence)}`], ["Protected goods", p.protectedGoods ? "YES" : "No", p.protectedGoods ? "court order needed to repossess" : "under one third paid"]].map(([l, v, sub]) => (
          <div key={l} className="rounded-sm bg-surface p-2"><p className="text-[10px] uppercase text-ink-muted">{l}</p><p className="font-display text-lg">{v}</p><p className="text-[10px] text-ink-muted">{sub}</p></div>
        ))}
      </div>
      {live && (
        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded-sm border border-border bg-input px-2 py-1 text-sm" value={method} onChange={(e) => setMethod(e.target.value as any)}>
            <option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="card_machine">Card machine</option>
          </select>
          {can.settlements && <Button variant="outline" className={btn} disabled={busy} onClick={() => ask("Issue settlement quote", p.interestRebateEnabled ? "Provide the customer with the calculated amount needed to finish the agreement early, after the interest rebate." : "Provide the full remaining scheduled balance. Interest rebate is switched off.", [`Settlement figure: ${gbp(p.settlement.figurePence)} · remaining instalments: ${gbp(p.settlement.grossPence)} · interest rebate: ${gbp(p.settlement.rebatePence)}.`, `Quote valid until ${ukDate(p.settlement.settlementDate)}. The figure is recalculated when a settlement is recorded, so confirm the current amount before accepting payment.`, "Confirmation logs the quote and displays a printable settlement statement. It does not take money, change the agreement status or cancel instalments. It is not automatically emailed; print or deliver it separately.", undoNote], () => quote.mutate())}>Issue settlement quote</Button>}
          {can.settlements && a.status === "active" && <Button className={pbtn} disabled={busy} onClick={() => ask("Record settlement paid", "Use this only after you have actually received the full early-settlement amount.", [`Amount to record: ${gbp(p.settlement.figurePence)}. Interest rebate: ${gbp(p.settlement.rebatePence)}.`, manual, "Confirmation marks the agreement SETTLED and every remaining due instalment SETTLED. It records the settlement and rebate in the finance accounts; those instalments are no longer due.", "Verify the payment has cleared before confirming.", undoNote], () => settle.mutate())}>Record settlement paid</Button>}
          {can.settlements && a.status === "active" && <Button variant="outline" className={btn} disabled={busy} onClick={() => { setCollected((p.termination.toPayPence / 100).toFixed(2)); ask("Voluntary termination", "Record the customer's request to end the agreement and return the motorcycle under the applicable half-liability rules, rather than repay it in full.", [`50% liability point: ${gbp(p.termination.halfPence)}. Currently needed to reach that point: ${gbp(p.termination.toPayPence)}. Enter only the amount actually collected now.`, manual, "Confirmation marks the agreement TERMINATED and all remaining due instalments TERMINATED. It logs the calculated shortfall to the 50% point and any payment entered; it does not mean the motorcycle has physically been returned or all liabilities have been discharged.", "Record the vehicle return separately under Returns & repossessions. Check eligibility, condition and any remaining liability with appropriate advice. No termination email is automatically sent.", undoNote], () => {}, true); }}>Voluntary termination</Button>}
        </div>
      )}
      {live && can.arrears && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-muted">{p.overdueCount} missed · {gbp(p.overduePence)} overdue</span>
          <Button variant="outline" className={btn} onClick={() => askNotice("arrears")}>Arrears letter</Button>
          <Button variant="outline" className={btn} disabled={p.overdueCount < (a.frequency === "weekly" ? 4 : 2)} title="Required after 2 monthly / 4 weekly missed payments" onClick={() => askNotice("nosia")}>NOSIA</Button>
          <Button variant="outline" className={btn} disabled={!p.overdueCount} onClick={() => askNotice("default")}>Default notice</Button>
          <Button variant="outline" className={btn} onClick={() => setNotesOpen(true)}>Notes</Button>
          {a.status === "defaulted" && <Button variant="outline" className={btn} onClick={() => askNotice("termination")}>Termination notice</Button>}
        </div>
      )}
      {can.recoveries && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Returns &amp; repossessions</span>
            {!["settled", "closed"].includes(a.status) && <Button variant="outline" className={btn} onClick={() => ask("Record vehicle recovery", "Record a motorcycle returned by the customer, voluntarily surrendered or repossessed. This is not an instruction or legal authority to take the vehicle.", [`Remaining scheduled balance: ${gbp(outstanding)}. Opening the form does not change the agreement or record a payment.`, "Next, enter the recovery type, date, mileage, condition/notes, valuation, costs and any court-order reference. A further confirmation is required before saving.", p.protectedGoods ? "Protected goods: at least one third is paid. A court-order reference is required for repossession." : "Confirm the return/recovery is lawful and accurately record the circumstances.", "Saving a new recovery marks an active, defaulted or terminated agreement RECOVERED. Marking a recovery SOLD closes the agreement and posts proceeds, costs and any shortfall/write-off or surplus owed to the customer. No card charge or automatic recovery email is sent.", undoNote], () => setRec({ agreementId: a.id, kind: a.status === "terminated" ? "return" : "repossession", status: "recovered", recoveredOn: plus(0), valuationPence: 0, costsPence: 0, salePence: 0 }))}>Record vehicle recovery</Button>}
          </div>
          {p.recoveries.map((r: any) => (
            <button key={r.id} onClick={() => setRec({ id: r.id, agreementId: a.id, kind: r.kind, status: r.status, recoveredOn: r.recovered_on, mileage: r.mileage, condition: r.condition, valuationPence: r.valuation_pence, costsPence: r.costs_pence, salePence: r.sale_pence, soldOn: r.sold_on, courtOrderRef: r.court_order_ref, notes: r.notes })} className="flex w-full justify-between rounded-sm border border-border px-2 py-1 text-left text-xs hover:border-primary">
              <span>{ukDate(r.recovered_on)} · {r.kind.replace(/_/g, " ")} · {r.status.replace(/_/g, " ")}</span>
              <span>valued {gbp(r.valuation_pence)} · costs {gbp(r.costs_pence)} · sold {gbp(r.sale_pence)}</span>
            </button>
          ))}
        </div>
      )}
      {rec && <RecoveryForm r={rec} protectedGoods={p.protectedGoods} outstanding={outstanding} onCancel={() => setRec(null)} onSave={(r) => saveRec.mutate(r)} saving={saveRec.isPending} />}
      <FinanceConfirmation confirmation={confirmation} identity={identity} onClose={() => setConfirmation(null)} busy={busy}
        amount={collected} onAmountChange={setCollected}
        onConfirm={() => { if (!confirmation) return; if (confirmation.amountInput) term.mutate(toP(collected)); else confirmation.onConfirm(); setConfirmation(null); }} />
      {!(live && can.arrears) && <Button variant="outline" className={btn} onClick={() => setNotesOpen(true)}>Notes</Button>}
      <FinanceNotes a={a} open={notesOpen} onClose={() => setNotesOpen(false)} canWrite={Boolean(can.arrears)} />
      {letter && (
        <div className="space-y-2">
          <div className="flex gap-2"><button className={pbtn} onClick={() => printElement(letterRef.current, `FA-${a.ref_no} letter`)}>Print / PDF letter</button><button className={btn} onClick={() => setLetter(null)}>Close</button></div>
          <div ref={letterRef} className="rounded-sm bg-white p-6 text-sm text-black">
            <p className="font-bold">{s?.company_name}</p>
            <p>{s?.trading_address}{s?.phone ? ` · ${s.phone}` : ""}{s?.email ? ` · ${s.email}` : ""}</p>
            <p className="mt-4">{ukDate(new Date().toISOString())}</p>
            <p className="mt-2">{a.customer_snapshot?.full_name}<br />{a.customer_snapshot?.address}</p>
            <p className="mt-4">Agreement FA-{a.ref_no} · {[a.vehicle?.make, a.vehicle?.model, a.vehicle?.reg].filter(Boolean).join(" ")}</p>
            {letter.kind === "settlement" ? (
              <>
                <p className="mt-3 font-bold">Early settlement statement</p>
                <p className="mt-2">Amount required to settle your agreement in full: <b>{gbp(p.settlement.figurePence)}</b>, valid until <b>{ukDate(p.settlement.settlementDate)}</b>.</p>
                <p>Remaining instalments: {gbp(p.settlement.grossPence)}. Rebate of charges for credit: {gbp(p.settlement.rebatePence)}. {p.interestRebateEnabled ? `Calculated using the APR of ${Number(a.apr_pct).toFixed(1)}%.` : "Interest rebate is switched off; no rebate has been applied. Mandatory statutory entitlements remain unaffected."}</p>
                <p className="mt-2">Pay by bank transfer quoting FA-{a.ref_no}, or in store. On receipt your agreement will be closed and ownership of the motorcycle passes to you.</p>
              </>
            ) : (
              <>
                <p className="mt-3 font-bold">{NOTICE[letter.kind].title}</p>
                <p className="mt-2">{NOTICE[letter.kind].body(vals)}</p>
              </>
            )}
            <p className="mt-6">Yours sincerely,<br />{s?.company_name}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function L({ l, children }: { l: string; children: React.ReactNode }) {
  return <label className="block text-[10px] uppercase tracking-widest text-ink-muted">{l}{children}</label>;
}

function RecoveryForm({ r, protectedGoods, outstanding, onCancel, onSave, saving }: { r: any; protectedGoods: boolean; outstanding: number; onCancel: () => void; onSave: (r: any) => void; saving: boolean }) {
  const [f, setF] = useState<any>({ ...r, valuation: (r.valuationPence / 100).toFixed(2), costs: (r.costsPence / 100).toFixed(2), sale: (r.salePence / 100).toFixed(2) });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  const shortfall = outstanding + toP(f.costs) - toP(f.sale);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  return (
    <div className="grid grid-cols-2 gap-2 rounded-sm border border-primary/40 p-3 sm:grid-cols-4">
      <L l="Type"><select className={inp} value={f.kind} onChange={(e) => set("kind", e.target.value)}><option value="return">Return (after termination)</option><option value="voluntary_surrender">Voluntary surrender</option><option value="repossession">Repossession</option></select></L>
      <L l="Status"><select className={inp} value={f.status} onChange={(e) => set("status", e.target.value)}>{["recovered", "in_storage", "for_sale", "sold", "returned_to_customer"].map((x) => <option key={x} value={x}>{x.replace(/_/g, " ")}</option>)}</select></L>
      <L l="Recovered on"><input type="date" className={inp} value={f.recoveredOn} onChange={(e) => set("recoveredOn", e.target.value)} /></L>
      <L l="Mileage"><input className={inp} value={f.mileage ?? ""} onChange={(e) => set("mileage", e.target.value)} /></L>
      <L l="Valuation £"><input className={inp} value={f.valuation} onChange={(e) => set("valuation", e.target.value)} /></L>
      <L l="Recovery costs £"><input className={inp} value={f.costs} onChange={(e) => set("costs", e.target.value)} /></L>
      <L l="Sale proceeds £"><input className={inp} value={f.sale} onChange={(e) => set("sale", e.target.value)} /></L>
      <L l="Sold on"><input type="date" className={inp} value={f.soldOn ?? ""} onChange={(e) => set("soldOn", e.target.value || null)} /></L>
      <L l={`Court order ref${protectedGoods && f.kind === "repossession" ? " (required)" : ""}`}><input className={inp} value={f.courtOrderRef ?? ""} onChange={(e) => set("courtOrderRef", e.target.value)} /></L>
      <div className="col-span-2 sm:col-span-3"><L l="Condition / notes"><input className={inp} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></L></div>
      <p className="col-span-2 text-xs sm:col-span-4">Balance outstanding {gbp(outstanding)} · {shortfall >= 0 ? `shortfall to write off/recover ${gbp(shortfall)}` : `surplus due to customer ${gbp(-shortfall)}`} (posted when marked sold)</p>
      <FinanceConfirmation confirmation={confirmation} identity="Vehicle recovery" onClose={() => setConfirmation(null)} busy={saving} onConfirm={() => { confirmation?.onConfirm(); setConfirmation(null); }} />
      <div className="col-span-2 flex gap-2 sm:col-span-4">
        <Button className={pbtn} disabled={saving} onClick={() => setConfirmation({ title: f.id ? "Save recovery changes" : "Confirm vehicle recovery", purpose: "Save these vehicle recovery details to the agreement.", impact: [
          `Type: ${f.kind.replace(/_/g, " ")} · status: ${f.status.replace(/_/g, " ")} · recovered on: ${ukDate(f.recoveredOn)}.`,
          `Valuation ${gbp(toP(f.valuation))} · recovery costs ${gbp(toP(f.costs))} · sale proceeds ${gbp(toP(f.sale))}.`,
          protectedGoods && f.kind === "repossession" ? `Protected goods: court-order reference required. Entered reference: ${f.courtOrderRef || "NOT PROVIDED — saving will be rejected"}.` : "Ensure the return/recovery was lawful and the details reflect what actually happened.",
          f.status === "sold" ? `This marks the agreement CLOSED and remaining due instalments RECOVERED. It posts sale proceeds and recovery costs, plus ${shortfall >= 0 ? `a shortfall/write-off of ${gbp(shortfall)}` : `a surplus owed to the customer of ${gbp(-shortfall)}`}. Confirm the sale and amounts before saving.` : f.id ? "This updates the existing recovery record. It does not collect money or record a sale unless the status is SOLD." : "This marks an active, defaulted or terminated agreement RECOVERED; the remaining instalments are not cleared until the recovery is marked SOLD.",
          "No card is charged and no automatic recovery email is sent. Undo restores records only, not physical recovery, a sale, or real payments.",
        ], onConfirm: () => onSave({ id: f.id, agreementId: f.agreementId, kind: f.kind, status: f.status, recoveredOn: f.recoveredOn, mileage: f.mileage || null, condition: null, valuationPence: toP(f.valuation), costsPence: toP(f.costs), salePence: toP(f.sale), soldOn: f.soldOn || null, courtOrderRef: f.courtOrderRef || null, notes: f.notes || null }) })}>Save</Button>
        <button className={btn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}


type Confirmation = { title: string; purpose: string; impact: string[]; onConfirm: () => void; amountInput?: boolean };

function FinanceConfirmation({ confirmation, identity, onClose, onConfirm, busy, amount = "", onAmountChange }: {
  confirmation: Confirmation | null; identity: string; onClose: () => void; onConfirm: () => void; busy: boolean;
  amount?: string; onAmountChange?: (value: string) => void;
}) {
  const invalidAmount = confirmation?.amountInput && (amount.trim() === "" || !Number.isFinite(Number(amount)) || Number(amount) < 0);
  return <Dialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent overlayClassName="z-[95]" className="z-[100] max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-md">
      <DialogHeader>
        <DialogTitle className="pr-6 tracking-normal">{confirmation?.title}</DialogTitle>
        <DialogDescription>{confirmation?.purpose}</DialogDescription>
      </DialogHeader>
      <p className="text-sm font-semibold text-primary">{identity}</p>
      <div className="space-y-3 text-sm leading-relaxed">
        <h4 className="font-bold">What confirming means</h4>
        <ul className="list-disc space-y-3 pl-5">{confirmation?.impact.map((text, i) => <li key={i}>{text}</li>)}</ul>
      </div>
      {confirmation?.amountInput && <label className="grid gap-1.5 text-sm font-semibold">Amount actually collected now (£)
        <input type="number" min="0" step="0.01" className={inp} value={amount} onChange={(e) => onAmountChange?.(e.target.value)} />
        {invalidAmount && <span className="text-xs text-destructive">Enter zero or a positive amount.</span>}
      </label>}
      <DialogFooter className="gap-2">
        <Button className="h-auto min-h-9 whitespace-normal" variant="outline" onClick={onClose}>Cancel — make no changes</Button>
        <Button className="h-auto min-h-9 whitespace-normal" disabled={busy || Boolean(invalidAmount)} onClick={onConfirm}>Confirm {confirmation?.title.toLowerCase()}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
