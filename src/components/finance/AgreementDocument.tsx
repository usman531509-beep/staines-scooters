import { forwardRef, Fragment } from "react";
import { gbp } from "@/lib/finance-calc";
import { ukDate } from "@/lib/format-date";
import { BRAND } from "@/lib/brand";

const METHOD: Record<string, string> = { reducing: "Reducing balance (actuarial)", flat: "Flat rate", zero: "Interest free" };

/**
 * Editable agreement draft. Every word is editable in "Agreement Draft".
 * Formatting: "# " big title, "## " section heading, "**bold**", "- " table row "Label | Value".
 * Blocks on their own line: {{schedule}}, {{signatures}}.
 */
export const DEFAULT_AGREEMENT_TEMPLATE = `# {{company_name}}
{{trading_address}}
{{company_contact}}
{{company_number_line}}

# CONDITIONAL SALE AGREEMENT
Agreement no. **FA-{{ref_no}}** · Date: {{agreement_date}}

## 1. Parties
- Creditor / supplier | {{company_name}}
- Customer (debtor) | {{customer_name}}
- Address | {{customer_address}}
- Date of birth | {{customer_dob}}
- Contact | {{customer_contact}}

## 2. Goods
- Motorcycle | {{vehicle}}
- Registration / VIN | {{reg}} / {{vin}}
- Year · Mileage · Condition | {{year}} · {{mileage}} · {{condition}}
- Accessories | {{accessories}}

## 3. Key financial information
- Cash price (incl. accessories) | {{cash_price}}
- Other charges payable | {{fees}}
- Deposit | {{deposit}}
- Part-exchange allowance | {{part_ex}}
- Amount of credit | {{credit}}
- Interest rate | {{interest_rate}}
- Total charge for credit (interest) | {{interest}}
- APR | {{apr}}
- Repayments | {{repayments}}
- Final payment | {{final_payment}}
- First / final payment date | {{first_date}} / {{last_date}}
- Total amount payable | {{total_payable}}

## 4. Payment schedule
{{schedule}}

## 5. Terms and your rights
**1. Ownership.** The motorcycle remains the property of {{company_name}} until every payment under this agreement has been made. Ownership then passes to you automatically. Until then you must not sell, transfer, hire out or give away the motorcycle.

**2. Payments.** You must pay each instalment in full on its due date. Payments may be collected from the card you have authorised. You may pay any instalment, or the full balance, early at any time from your account. You must tell us immediately if your card, address or contact details change.

**3. Insurance, use and care.** You must keep the motorcycle fully insured, taxed, MOT-tested where required and in good condition, and use it lawfully. You must tell us at once if it is lost, stolen or damaged.

**4. Missing payments.** Missing payments could have severe consequences and make obtaining credit more difficult. If you fall behind we will contact you in writing. We may then end the agreement and recover the motorcycle. Once you have paid one-third or more of the total amount payable, we cannot take the motorcycle back without your consent unless we obtain a court order.

**5. Right of withdrawal.** You may withdraw within 14 days starting the day after you sign (deadline {{withdrawal_deadline}}) by telling us by phone, email or in writing. You must then repay the credit plus interest accrued daily from the date you received it, within 30 days.

**6. Early settlement.** {{early_settlement_terms}}

**7. Voluntary termination.** You may end this agreement at any time before the final payment by giving notice in writing. You must return the motorcycle in reasonable condition, and your total payments must reach one-half of the total amount payable.

**8. Consumer rights.** Your rights under the Consumer Rights Act 2015 for goods that are faulty, not as described or not fit for purpose are not affected.

**9. Complaints.** Please contact us first on {{company_phone}} or {{company_email}} and we will do our best to resolve your complaint.

**10. Information.** You may ask us for a statement of account and a copy of this agreement at any time, free of charge.

## 6. Signatures
**Sign this agreement only if you want to be legally bound by its terms.**
{{signatures}}`;

function vars(a: any, s: any): Record<string, string> {
  const c = a.customer_snapshot ?? {};
  const v = a.vehicle ?? {};
  const inst: any[] = a.instalments ?? [];
  const lastAmt = inst[inst.length - 1]?.amount_pence;
  return {
    company_name: s?.company_name ?? BRAND.legalName,
    trading_address: s?.trading_address ?? "",
    company_contact: [s?.phone, s?.email].filter(Boolean).join(" · "),
    company_number_line: s?.company_number ? `Company no. ${s.company_number}${s?.registered_address ? ` · Registered office: ${s.registered_address}` : ""}` : "",
    company_phone: s?.phone ?? "", company_email: s?.email ?? "",
    ref_no: String(a.ref_no ?? ""), agreement_date: ukDate(a.signed_at ?? a.created_at ?? new Date().toISOString()),
    customer_name: c.full_name ?? "—", customer_address: c.address || "—", customer_dob: c.date_of_birth ? ukDate(c.date_of_birth) : "—",
    customer_contact: [c.phone, c.email].filter(Boolean).join(" · ") || "—",
    vehicle: [v.make, v.model].filter(Boolean).join(" ") || "—", reg: v.reg || "—", vin: v.vin || "—", year: v.year || "—", mileage: v.mileage || "—",
    condition: v.condition || "—", accessories: v.accessories || "—",
    cash_price: gbp((a.cash_price_pence ?? 0) + (a.accessories_pence ?? 0)), fees: gbp(a.fees_pence ?? 0), deposit: gbp(a.deposit_pence ?? 0),
    part_ex: gbp(a.part_ex_pence ?? 0), credit: gbp(a.credit_pence ?? 0),
    interest_rate: a.method === "zero" ? "0% (interest free)" : `${Number(a.rate_pct)}% per year — ${METHOD[a.method] ?? ""}, fixed for the agreement`,
    interest: gbp(a.interest_pence ?? 0), apr: `${Number(a.apr_pct ?? 0).toFixed(1)}% APR`,
    repayments: `${inst.length} ${a.frequency} payments of ${gbp(a.instalment_pence ?? 0)}`,
    final_payment: lastAmt != null ? gbp(lastAmt) : "—",
    first_date: inst[0]?.due_date ? ukDate(inst[0].due_date) : "—", last_date: inst[inst.length - 1]?.due_date ? ukDate(inst[inst.length - 1].due_date) : "—",
    total_payable: gbp(a.total_payable_pence ?? 0),
    withdrawal_deadline: a.withdrawal_deadline ? ukDate(a.withdrawal_deadline) : "14 days after signing",
    early_settlement_terms: s?.interest_rebate_enabled === true ? "You may settle this agreement early in full or in part at any time, and you will receive a rebate of interest. Ask us for a settlement figure at any time." : "You may ask us for an early settlement figure at any time. No interest rebate is applied by the system while the rebate setting is off. Any mandatory statutory entitlement is unaffected.",
  };
}

export const TEMPLATE_FIELDS = Object.keys(vars({}, {})).concat(["schedule", "signatures"]);

const fill = (t: string, m: Record<string, string>) => t.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (k in m ? m[k] : `{{${k}}}`));
const inline = (t: string) => t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>));

/** The full agreement document (A4 printable), rendered from the saved Agreement Draft. Uses fixed print colours. */
export const AgreementDocument = forwardRef<HTMLDivElement, { a: any; s: any; template?: string }>(function AgreementDocument({ a, s, template }, ref) {
  const inst: any[] = a.instalments ?? [];
  const m = vars(a, s);
  const src: string = (template ?? s?.agreement_template ?? DEFAULT_AGREEMENT_TEMPLATE).replace("You may settle this agreement early in full or in part at any time, and you will receive a rebate of interest. Ask us for a settlement figure at any time.", "{{early_settlement_terms}}");
  const h = { fontSize: 14, fontWeight: 700, margin: "18px 0 6px", borderBottom: "2px solid #dc2626", paddingBottom: 3 } as const;
  const lines = src.split("\n");
  const out: React.ReactNode[] = [];
  let rows: [string, string][] = [];
  const flush = () => {
    if (!rows.length) return;
    out.push(<table key={`t${out.length}`} style={{ width: "100%" }}><tbody>{rows.map(([l, v], i) => <tr key={i}><td style={{ padding: "3px 6px", color: "#555", width: "45%" }}>{inline(l)}</td><td style={{ padding: "3px 6px", fontWeight: 600 }}>{inline(v)}</td></tr>)}</tbody></table>);
    rows = [];
  };
  lines.forEach((raw: string, idx: number) => {
    const line = raw.trimEnd();
    if (line.startsWith("- ") && line.includes("|")) { const [l, ...r] = fill(line.slice(2), m).split("|"); rows.push([l.trim(), r.join("|").trim()]); return; }
    flush();
    const t = line.trim();
    if (t === "{{schedule}}") {
      out.push(
        <table key={idx} style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead><tr style={{ background: "#f3f4f6" }}>{["#", "Due", "Opening", "Payment", "Interest", "Principal", "Closing"].map((x) => <th key={x} style={{ padding: 3, textAlign: x === "#" || x === "Due" ? "left" : "right" }}>{x}</th>)}</tr></thead>
          <tbody>{inst.map((i) => (
            <tr key={i.seq} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: 3 }}>{i.seq}</td><td style={{ padding: 3 }}>{ukDate(i.due_date)}</td>
              <td style={{ padding: 3, textAlign: "right" }}>{gbp(i.opening_pence)}</td><td style={{ padding: 3, textAlign: "right" }}>{gbp(i.amount_pence)}</td>
              <td style={{ padding: 3, textAlign: "right" }}>{gbp(i.interest_pence)}</td><td style={{ padding: 3, textAlign: "right" }}>{gbp(i.principal_pence)}</td>
              <td style={{ padding: 3, textAlign: "right" }}>{gbp(i.closing_pence)}</td>
            </tr>))}</tbody>
        </table>,
      );
      return;
    }
    if (t === "{{signatures}}") {
      out.push(
        <div key={idx} style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div>Signature of customer</div>
            {a.signature_data ? <img src={a.signature_data} alt="Customer signature" style={{ height: 70, border: "1px solid #ddd" }} /> : <div style={{ height: 70, borderBottom: "1px solid #999" }} />}
            <div>{a.signed_name ?? ""} {a.signed_at ? `· ${ukDate(a.signed_at)}` : ""}</div>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div>Signed for and on behalf of {m.company_name}</div>
            {a.company_signature_data ? <img src={a.company_signature_data} alt="Administrator signature" style={{ height: 70, maxWidth: "100%", objectFit: "contain", border: "1px solid #ddd" }} /> : <div style={{ height: 70, borderBottom: "1px solid #999", display: "flex", alignItems: "flex-end" }}>{a.company_signed_at ? "Executed electronically" : ""}</div>}
            <div>{a.company_signed_name ?? ""} {a.company_signed_at ? ukDate(a.company_signed_at) : ""}</div>
          </div>
        </div>,
      );
      return;
    }
    const f = fill(t, m);
    if (!f) { if (t) return; out.push(<div key={idx} style={{ height: 6 }} />); return; }
    if (t.startsWith("## ")) out.push(<div key={idx} style={h}>{inline(f.slice(3))}</div>);
    else if (t.startsWith("# ")) out.push(<div key={idx} style={{ fontSize: 18, fontWeight: 700, color: "#dc2626", marginTop: 6 }}>{inline(f.slice(2))}</div>);
    else out.push(<p key={idx} style={{ margin: "2px 0" }}>{inline(f)}</p>);
  });
  flush();
  return (
    <div ref={ref} className="finance-doc" style={{ background: "#fff", color: "#111", fontFamily: "Arial, sans-serif", fontSize: 12, lineHeight: 1.5, padding: 28 }}>
      {out}
      {s?.extra_terms && <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{s.extra_terms}</div>}
    </div>
  );
});

export function printElement(el: HTMLElement | null, title: string) {
  if (!el) return;
  const w = window.open("", "_blank");
  if (!w) { alert("Please allow pop-ups to print."); return; }
  w.document.write(`<!doctype html><html><head><title>${title.replace(/</g, "")}</title><style>@page{size:A4;margin:12mm}body{margin:0}</style></head><body>${el.outerHTML}<script>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
}
