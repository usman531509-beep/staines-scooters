import { createFileRoute } from "@tanstack/react-router";

// The customer's copy of a till receipt, opened from the WhatsApp message.
// Read-only and only with the signed key; ?pdf=1 downloads it as a PDF.
export const Route = createFileRoute("/api/public/receipt/$saleId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const { receiptLinkValid, loadReceiptDoc, receiptPdfBuffer } = await import("@/lib/receipt-link.server");
        const notFound = () => new Response("Receipt not found", { status: 404, headers: { "Content-Type": "text/plain" } });
        if (!/^[0-9a-f-]{36}$/i.test(params.saleId) || !receiptLinkValid(params.saleId, url.searchParams.get("k"))) {
          return notFound();
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const loaded = await loadReceiptDoc(supabaseAdmin, params.saleId);
        if (!loaded) return notFound();
        const { doc } = loaded;
        const { receiptEmailHtml, receiptFileName, RECEIPT_LOGO } = await import("@/lib/receipt-doc");
        const { BRAND } = await import("@/lib/brand");
        const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

        if (url.searchParams.get("pdf")) {
          return new Response(new Uint8Array(await receiptPdfBuffer(doc)), {
            headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${receiptFileName(doc)}"` },
          });
        }
        url.searchParams.set("pdf", "1");
        const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Receipt #${doc.receiptNo} — ${BRAND.name}</title></head>
<body style="margin:0;background:#f3f3f3">${receiptEmailHtml(doc, RECEIPT_LOGO.path)}
<p style="text-align:center;margin:0 0 32px"><a href="${url.pathname}${url.search}" style="display:inline-block;background:#111;color:#fff;font:600 13px Arial,Helvetica,sans-serif;padding:10px 18px;border-radius:4px;text-decoration:none">Download PDF</a></p>
</body></html>`;
        return new Response(html, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
      },
    },
  },
});
