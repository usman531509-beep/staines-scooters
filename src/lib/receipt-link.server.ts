// Server side of the customer's receipt: the PDF (shared by email and the
// WhatsApp link) and the signed, read-only link /api/public/receipt/<saleId>?k=…
// that WhatsApp messages carry. The signature stops anyone guessing other sales.
import { createHmac, timingSafeEqual } from "node:crypto";
import { BRAND } from "@/lib/brand";
import { buildReceiptDoc, receiptPdf, RECEIPT_LOGO, type ReceiptDoc } from "@/lib/receipt-doc";

function secret() {
  const s = process.env.RECEIPT_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Receipt links aren't set up on the server.");
  return s;
}

const sign = (saleId: string) =>
  createHmac("sha256", secret()).update(`receipt:${saleId}`).digest("base64url").slice(0, 22);

export function receiptLinkValid(saleId: string, key: string | null) {
  if (!key) return false;
  const a = Buffer.from(sign(saleId));
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The customer-facing receipt page for a sale. Always on the public site: a
 * local or preview address in the link would not open on the customer's phone.
 */
export function receiptLink(saleId: string) {
  const site = /localhost|127\.0\.0\.1|vercel\.app/.test(BRAND.siteUrl) ? "https://stainesscooter.com" : BRAND.siteUrl;
  return `${site}/api/public/receipt/${saleId}?k=${sign(saleId)}`;
}

/** Loads a sale with its items as the receipt document. */
export async function loadReceiptDoc(supabase: any, saleId: string): Promise<{ doc: ReceiptDoc; sale: any } | null> {
  const [saleRes, itemsRes] = await Promise.all([
    supabase.from("sales").select("*, pos_customer:pos_customers(id, name, phone, email)").eq("id", saleId).maybeSingle(),
    supabase.from("sale_items").select("*").eq("sale_id", saleId).order("created_at"),
  ]);
  if (!saleRes.data) return null;
  return { doc: buildReceiptDoc(saleRes.data, itemsRes.data ?? []), sale: saleRes.data };
}

/** The receipt as a PDF; the logo comes from the site itself and is skipped if that fails. */
export async function receiptPdfBuffer(doc: ReceiptDoc) {
  let logo: { dataUrl: string; width: number; height: number } | null = null;
  try {
    const res = await fetch(`${BRAND.siteUrl}${RECEIPT_LOGO.path}`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
      logo = { dataUrl: `data:image/png;base64,${b64}`, width: RECEIPT_LOGO.width, height: RECEIPT_LOGO.height };
    }
  } catch {}
  const pdf = await receiptPdf(doc, logo);
  return Buffer.from(pdf.output("arraybuffer"));
}
