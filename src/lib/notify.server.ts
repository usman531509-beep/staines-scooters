// App emails, sent as the shop's own Microsoft 365 mailbox (support@stainesscooter.com):
//  - staff notifications to the shop inbox (sale, website enquiry, registration)
//  - a till receipt to a customer, when staff press Email on a sale
// Staff notifications are best-effort: a missing setting or a mail error is logged
// and never fails the sale, enquiry or registration that triggered it.
//
// Transport, first configured wins:
//  1. Microsoft Graph over HTTPS (works on GoDaddy Airo, which blocks SMTP ports):
//     MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET (app registration with the
//     Mail.Send application permission), MAIL_FROM = the mailbox to send as.
//  2. SMTP: SMTP_HOST, SMTP_PORT (465 = SSL, 587 = STARTTLS), SMTP_USER, SMTP_PASS,
//     optional SMTP_FROM.
// NOTIFY_EMAIL overrides where staff notifications go.
import nodemailer from "nodemailer";
import { BRAND } from "@/lib/brand";

export const SHOP_MAILBOX = "support@stainesscooter.com";

type Attachment = { filename: string; contentType: string; content: Buffer };
type Email = { to: string; subject: string; html: string; text: string; replyTo?: string; attachments?: Attachment[] };

// ---------- Microsoft Graph ----------

function graphConfig() {
  const tenant = process.env.MS_TENANT_ID;
  const clientId = process.env.MS_CLIENT_ID;
  const secret = process.env.MS_CLIENT_SECRET;
  if (!tenant || !clientId || !secret) return null;
  return { tenant, clientId, secret, from: process.env.MAIL_FROM || SHOP_MAILBOX };
}

let graphToken: { value: string; expires: number } | null = null;

async function getGraphToken(cfg: NonNullable<ReturnType<typeof graphConfig>>) {
  if (graphToken && graphToken.expires > Date.now() + 60_000) return graphToken.value;
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.secret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(`Microsoft sign-in failed (${res.status}): ${json.error_description ?? json.error ?? "no token"}`);
  }
  graphToken = { value: json.access_token, expires: Date.now() + Number(json.expires_in ?? 3600) * 1000 };
  return graphToken.value;
}

async function sendViaGraph(cfg: NonNullable<ReturnType<typeof graphConfig>>, m: Email) {
  const token = await getGraphToken(cfg);
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.from)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: m.subject,
        body: { contentType: "HTML", content: m.html },
        toRecipients: [{ emailAddress: { address: m.to } }],
        ...(m.replyTo ? { replyTo: [{ emailAddress: { address: m.replyTo } }] } : {}),
        ...(m.attachments?.length
          ? {
              attachments: m.attachments.map((a) => ({
                "@odata.type": "#microsoft.graph.fileAttachment",
                name: a.filename,
                contentType: a.contentType,
                contentBytes: a.content.toString("base64"),
              })),
            }
          : {}),
      },
      saveToSentItems: true,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status !== 202) {
    const body = await res.text().catch(() => "");
    throw new Error(`Microsoft Graph sendMail failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

// ---------- SMTP ----------

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

/** Send one email by whichever transport is configured; throws on failure. */
export async function sendEmailOrThrow(m: Email): Promise<void> {
  const graph = graphConfig();
  if (graph) return sendViaGraph(graph, m);
  const t = getTransport();
  if (!t) throw new Error("Email isn't set up on the server.");
  await t.sendMail({
    from: { name: BRAND.name, address: process.env.SMTP_FROM || process.env.SMTP_USER! },
    to: m.to,
    replyTo: m.replyTo,
    subject: m.subject,
    text: m.text,
    html: m.html,
    attachments: m.attachments,
  });
}

/** Send one email by whichever transport is configured; logs and swallows failures. */
export async function sendEmail(m: Email): Promise<boolean> {
  if (!graphConfig() && !getTransport()) {
    console.warn(`[notify] email not configured; skipped "${m.subject}"`);
    return false;
  }
  try {
    await sendEmailOrThrow(m);
    return true;
  } catch (err) {
    console.error(`[notify] could not send "${m.subject}"`, err);
    return false;
  }
}

// ---------- Messages ----------

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Rows = Array<[string, string | null | undefined]>;

function rowsTable(rows: Rows) {
  const filled = rows.filter(([, v]) => v != null && String(v).trim() !== "") as Array<[string, string]>;
  return {
    text: filled.map(([k, v]) => `${k}: ${v}`).join("\n"),
    html: `<table style="border-collapse:collapse;font-size:14px">${filled
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 16px 4px 0;color:#555;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0;white-space:pre-wrap">${esc(v)}</td></tr>`,
      )
      .join("")}</table>`,
  };
}

const wrap = (inner: string) =>
  `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111;max-width:560px">${inner}</div>`;

/** Staff notification to the shop inbox: a subject plus label/value rows. */
export async function notifyStaff(subject: string, rows: Rows, opts?: { replyTo?: string }) {
  const t = rowsTable(rows);
  await sendEmail({
    to: process.env.NOTIFY_EMAIL || SHOP_MAILBOX,
    subject: `[${BRAND.name}] ${subject}`,
    replyTo: opts?.replyTo,
    text: t.text,
    html: wrap(
      `<h2 style="margin:0 0 12px;font-size:18px">${esc(subject)}</h2>${t.html}<p style="margin-top:16px;font-size:12px;color:#888">Sent automatically by the ${esc(BRAND.name)} website.</p>`,
    ),
  });
}

export const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;
