// Pure finance maths, shared by server (authoritative) and browser (preview).
// All money is integer pence; rounding happens once per instalment.

export type FinanceMethod = "reducing" | "flat" | "zero";
export type Frequency = "weekly" | "monthly";

export interface FinanceInput {
  cashPricePence: number;
  accessoriesPence?: number;
  feesPence?: number;
  depositPence?: number;
  partExPence?: number;
  partExSettlementPence?: number;
  method: FinanceMethod;
  ratePct: number; // nominal annual (reducing) or flat annual rate
  frequency: Frequency;
  termCount: number;
  firstPaymentDate: string; // yyyy-mm-dd
  /** Optional fixed final payment (balloon). Other payments are recalculated around it. */
  finalPaymentPence?: number | null;
}

export interface ScheduleRow {
  seq: number;
  dueDate: string;
  openingPence: number;
  amountPence: number;
  interestPence: number;
  principalPence: number;
  closingPence: number;
}

export interface FinanceResult {
  totalCashPricePence: number;
  creditPence: number;
  interestPence: number;
  totalInstalmentsPence: number;
  totalPayablePence: number;
  instalmentPence: number;
  finalInstalmentPence: number;
  aprPct: number;
  schedule: ScheduleRow[];
}

export function addPeriod(start: string, freq: Frequency, n: number): string {
  const [y, m, d] = start.split("-").map(Number);
  if (freq === "weekly") {
    const dt = new Date(Date.UTC(y, m - 1, d + 7 * n));
    return dt.toISOString().slice(0, 10);
  }
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400000;

/** APR per the UK consumer-credit total-charge-for-credit method (annual compounding, years = days/365). */
export function computeApr(creditPence: number, startDate: string, payments: { date: string; pence: number }[]): number {
  if (creditPence <= 0 || !payments.length) return 0;
  const total = payments.reduce((s, p) => s + p.pence, 0);
  if (total <= creditPence) return 0;
  const pv = (i: number) => payments.reduce((s, p) => s + p.pence / Math.pow(1 + i, days(startDate, p.date) / 365), 0);
  let lo = 0, hi = 100;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > creditPence) lo = mid; else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 1000) / 10; // one decimal place, e.g. 12.7
}

export function calculateFinance(i: FinanceInput): FinanceResult {
  const n = Math.max(1, Math.floor(i.termCount));
  const totalCash = (i.cashPricePence || 0) + (i.accessoriesPence || 0);
  const credit = Math.max(
    0,
    totalCash + (i.feesPence || 0) + (i.partExSettlementPence || 0) - (i.depositPence || 0) - (i.partExPence || 0),
  );
  const perYear = i.frequency === "weekly" ? 52 : 12;
  const rate = Math.max(0, i.ratePct || 0) / 100;
  const schedule: ScheduleRow[] = [];
  let bal = credit;
  const B = n > 1 && i.finalPaymentPence && i.finalPaymentPence > 0 ? Math.round(i.finalPaymentPence) : 0;

  if (i.method === "reducing" && rate > 0) {
    const r = rate / perYear;
    const pay = B
      ? Math.max(0, Math.round(((credit - B * Math.pow(1 + r, -n)) * r) / (1 - Math.pow(1 + r, -(n - 1)))))
      : Math.round((credit * r) / (1 - Math.pow(1 + r, -n)));
    for (let s = 1; s <= n; s++) {
      const interest = Math.round(bal * r);
      let principal = pay - interest;
      if (s === n) principal = bal;
      const amount = principal + interest;
      schedule.push(row(s, i, bal, amount, interest, principal));
      bal -= principal;
    }
  } else {
    const totalInterest = i.method === "flat" ? Math.round(credit * rate * (n / perYear)) : 0;
    const total = credit + totalInterest;
    const fin = B ? Math.min(B, total) : 0;
    const pay = B ? Math.floor((total - fin) / (n - 1)) : Math.floor(total / n);
    let intLeft = totalInterest;
    for (let s = 1; s <= n; s++) {
      const amount = s === n ? total - pay * (n - 1) : pay;
      const interest = s === n ? intLeft : total > 0 ? Math.floor((totalInterest * amount) / total) : 0;
      const principal = amount - interest;
      schedule.push(row(s, i, bal, amount, interest, principal));
      bal -= principal;
      intLeft -= interest;
    }
  }

  const totalInst = schedule.reduce((s, r) => s + r.amountPence, 0);
  const interest = schedule.reduce((s, r) => s + r.interestPence, 0);
  // Credit is advanced at the agreement date — one period before the first payment.
  const start = addPeriod(i.firstPaymentDate, i.frequency, -1);
  return {
    totalCashPricePence: totalCash,
    creditPence: credit,
    interestPence: interest,
    totalInstalmentsPence: totalInst,
    totalPayablePence: totalInst + (i.depositPence || 0) + (i.partExPence || 0),
    instalmentPence: schedule[0]?.amountPence ?? 0,
    finalInstalmentPence: schedule[schedule.length - 1]?.amountPence ?? 0,
    aprPct: computeApr(credit, start, schedule.map((r) => ({ date: r.dueDate, pence: r.amountPence }))),
    schedule,
  };
}

function row(seq: number, i: FinanceInput, opening: number, amount: number, interest: number, principal: number): ScheduleRow {
  return {
    seq,
    dueDate: addPeriod(i.firstPaymentDate, i.frequency, seq - 1),
    openingPence: opening,
    amountPence: amount,
    interestPence: interest,
    principalPence: principal,
    closingPence: opening - principal,
  };
}

export const gbp = (p = 0) => `£${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dayMs = 86400000;
const isoAdd = (iso: string, d: number) => new Date(new Date(iso + "T00:00:00Z").getTime() + d * dayMs).toISOString().slice(0, 10);

/**
 * Early settlement figure under the Consumer Credit (Early Settlement) Regulations 2004.
 * Settlement date = request date + 28 days, deferred by a further 30 days when more than
 * one month remains. Remaining instalments are discounted to that date at the APR;
 * instalments falling due before the settlement date are payable in full.
 */
export function earlySettlement(due: { dueDate: string; pence: number }[], aprPct: number, requestDate: string, interestRebateEnabled = false) {
  const settlementDate = isoAdd(requestDate, 28);
  const gross = due.reduce((s, d) => s + d.pence, 0);
  if (!interestRebateEnabled) return { settlementDate, grossPence: gross, rebatePence: 0, figurePence: gross };
  const lastDue = due.reduce((m, d) => (d.dueDate > m ? d.dueDate : m), settlementDate);
  const deferred = (Date.parse(lastDue) - Date.parse(settlementDate)) / dayMs > 31 ? isoAdd(settlementDate, 30) : settlementDate;
  const i = Math.max(0, aprPct) / 100;
  let figure = 0;
  for (const d of due) {
    const t = (Date.parse(d.dueDate) - Date.parse(deferred)) / dayMs / 365;
    figure += t <= 0 ? d.pence : d.pence / Math.pow(1 + i, t);
  }
  figure = Math.min(gross, Math.round(figure));
  return { settlementDate, grossPence: gross, rebatePence: gross - figure, figurePence: figure };
}

/** Voluntary termination (CCA s.99/100): customer must have paid half the total amount payable. */
export function voluntaryTermination(totalPayablePence: number, paidIncludingDepositPence: number) {
  const half = Math.ceil(totalPayablePence / 2);
  return { halfPence: half, toPayPence: Math.max(0, half - paidIncludingDepositPence) };
}

/** Protected goods (CCA s.90): once one third is paid, repossession needs a court order. */
export const isProtectedGoods = (totalPayablePence: number, paidIncludingDepositPence: number) =>
  totalPayablePence > 0 && paidIncludingDepositPence * 3 >= totalPayablePence;
