// Staff notification emails, sent from the shop's own GoDaddy mailbox over SMTP
// to the shop inbox (support@stainesscooter.com by default). Notifications are
// best-effort: a missing SMTP setting or a mail error is logged and never fails
// the sale, enquiry or registration that triggered it.
//
// Env: SMTP_HOST, SMTP_PORT (465 = SSL, 587 = STARTTLS), SMTP_USER, SMTP_PASS,
// optional NOTIFY_EMAIL (recipient) and SMTP_FROM (sender, defaults to SMTP_USER).
import nodemailer from "nodemailer";
import { BRAND } from "@/lib/brand";

const DEFAULT_TO = "support@stainesscooter.com";

let transport: nodemailer.Transporter | null | undefined;

function getTransport() {
  if (transport !== undefined) return transport;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    transport = null;
    return transport;
  }
  const port = Number(process.env.SMTP_PORT || 465);
  transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transport;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** One notification: a subject plus label/value rows, rendered as a small table. */
export async function notifyStaff(subject: string, rows: Array<[string, string | null | undefined]>, opts?: { replyTo?: string }) {
  const t = getTransport();
  if (!t) {
    console.warn(`[notify] SMTP not configured; skipped "${subject}"`);
    return;
  }
  const filled = rows.filter(([, v]) => v != null && String(v).trim() !== "") as Array<[string, string]>;
  const text = filled.map(([k, v]) => `${k}: ${v}`).join("\n");
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111">
  <h2 style="margin:0 0 12px;font-size:18px">${esc(subject)}</h2>
  <table style="border-collapse:collapse;font-size:14px">${filled
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#555;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0;white-space:pre-wrap">${esc(v)}</td></tr>`,
    )
    .join("")}</table>
  <p style="margin-top:16px;font-size:12px;color:#888">Sent automatically by the ${esc(BRAND.name)} website.</p>
</div>`;
  try {
    await t.sendMail({
      from: { name: BRAND.name, address: process.env.SMTP_FROM || process.env.SMTP_USER! },
      to: process.env.NOTIFY_EMAIL || DEFAULT_TO,
      replyTo: opts?.replyTo,
      subject: `[${BRAND.name}] ${subject}`,
      text,
      html,
    });
  } catch (err) {
    console.error(`[notify] could not send "${subject}"`, err);
  }
}

export const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;
