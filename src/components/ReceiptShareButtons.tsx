import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Mail, MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import { emailSaleReceipt, getReceiptWhatsApp } from "@/lib/pos.functions";

/** UK mobile as wa.me digits: 07471 109963 → 447471109963. */
function waNumber(phone?: string | null) {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("44")) return d;
  if (d.startsWith("0")) return `44${d.slice(1)}`;
  return d;
}

/**
 * Sends a sale's receipt to the customer, the same receipt as the printed one.
 * WhatsApp opens the customer's chat with the receipt and its link already
 * written; Email sends it (with the PDF) from the shop mailbox.
 */
export function ReceiptShareButtons({ saleId, className }: { saleId: string; className: string }) {
  const waFn = useServerFn(getReceiptWhatsApp);
  const emailFn = useServerFn(emailSaleReceipt);
  // Fetched up front so the tap opens WhatsApp straight away (a window opened
  // after waiting on the server would be popup-blocked).
  const { data: wa } = useQuery({
    queryKey: ["receipt-whatsapp", saleId],
    queryFn: () => waFn({ data: { saleId } }),
    staleTime: 60_000,
  });
  const [emailOpen, setEmailOpen] = useState(false);
  const [to, setTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function whatsapp() {
    if (!wa) return toast.info("Preparing the receipt… try again in a moment.");
    window.open(`https://wa.me/${waNumber(wa.phone)}?text=${encodeURIComponent(wa.text)}`, "_blank", "noopener");
  }

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    const address = (to ?? wa?.email ?? "").trim();
    if (!address) return;
    setSending(true);
    try {
      await emailFn({ data: { saleId, to: address } });
      toast.success(`Receipt emailed to ${address}`);
      setEmailOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't send the email");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={whatsapp} className={className}>
        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
      </button>
      {!emailOpen ? (
        <button type="button" onClick={() => setEmailOpen(true)} className={className}>
          <Mail className="h-3.5 w-3.5" /> Email
        </button>
      ) : (
        <form onSubmit={sendEmail} className="flex items-center gap-1">
          <input
            type="email"
            required
            autoFocus
            placeholder="customer@email.com"
            value={to ?? wa?.email ?? ""}
            onChange={(e) => setTo(e.target.value)}
            className="h-8 w-48 rounded-sm border border-border bg-background px-2 text-xs text-foreground"
          />
          <button type="submit" disabled={sending} className={className}>
            <Send className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Send"}
          </button>
          <button type="button" onClick={() => setEmailOpen(false)} aria-label="Cancel" className="p-1 opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </form>
      )}
    </>
  );
}
