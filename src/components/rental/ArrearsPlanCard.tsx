import { ukDate } from "@/lib/format-date";
import { CalendarClock } from "lucide-react";

type Installment = {
  id: string;
  seq: number;
  due_date: string;
  amount_pence: number;
  status: string;
  paid_at?: string | null;
};

type Plan = {
  id: string;
  title: string;
  total_pence: number;
  weekly_pence: number;
  final_pence: number;
  start_date: string;
  vehicles?: { vehicle?: string; registration?: string; start?: string; end?: string }[] | null;
  notes?: string | null;
};

const fmt = (p?: number | null) => (p == null ? "—" : `£${(p / 100).toFixed(2)}`);

export function ArrearsPlanCard({
  plan,
  installments,
  hidePaid,
}: {
  plan: Plan | null;
  installments: Installment[];
  hidePaid?: boolean;
}) {
  if (!plan) return null;
  const paid = installments.filter((i) => i.status === "paid");
  const paidPence = paid.reduce((s, i) => s + (i.amount_pence ?? 0), 0);
  const outstanding = Math.max(0, (plan.total_pence ?? 0) - paidPence);
  const next = installments.find((i) => i.status !== "paid");

  return (
    <section className="rounded-md border-2 border-primary/40 bg-surface-elevated p-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-widest">{plan.title}</h2>
      </div>

      <div className={`mt-3 grid gap-3 ${hidePaid ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
        <Stat label="Total agreed" value={fmt(plan.total_pence)} />
        {!hidePaid && <Stat label="Paid so far" value={fmt(paidPence)} />}
        <Stat label="Outstanding" value={fmt(outstanding)} strong />
        <Stat
          label="Next payment"
          value={next ? `${fmt(next.amount_pence)} · ${ukDate(next.due_date)}` : "Complete"}
        />
      </div>


      <p className="mt-3 text-xs text-ink-muted">
        {installments.length} weekly payments — {installments.filter((i) => i.amount_pence === plan.weekly_pence).length}{" "}
        of {fmt(plan.weekly_pence)} plus a final payment of {fmt(plan.final_pence)}. First payment due{" "}
        {ukDate(plan.start_date)}.
      </p>
      {plan.notes && <p className="mt-1 text-xs text-ink-muted">{plan.notes}</p>}

      {!!plan.vehicles?.length && (
        <ul className="mt-2 space-y-1 text-xs text-ink-muted">
          {plan.vehicles.map((v, i) => (
            <li key={i}>
              {v.vehicle} {v.registration ? `(${v.registration})` : ""}
              {v.start ? ` — ${ukDate(v.start)}` : ""}
              {v.end ? ` → ${ukDate(v.end)}` : ""}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-[10px] uppercase tracking-widest text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Due</th>
              <th className="px-3 py-2 text-left">Amount</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {installments.map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="px-3 py-2">{i.seq}</td>
                <td className="px-3 py-2">{ukDate(i.due_date)}</td>
                <td className="px-3 py-2">{fmt(i.amount_pence)}</td>
                <td className="px-3 py-2 text-xs uppercase tracking-widest">
                  {i.status === "paid" ? (
                    <span className="text-emerald-700">Paid{i.paid_at ? ` · ${ukDate(i.paid_at)}` : ""}</span>
                  ) : (
                    <span className="text-ink-muted">Unpaid</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-[10px] uppercase tracking-widest text-ink-muted">{label}</p>
      <p className={`mt-1 text-sm ${strong ? "font-bold text-primary" : "font-semibold"}`}>{value}</p>
    </div>
  );
}
