import { useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AgreementDocument, printElement } from "./AgreementDocument";

export function AgreementPopup({ a, s, open, onClose }: { a: any; s: any; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const download = async () => {
    const el = ref.current;
    if (!el) return;
    setBusy(true);
    try {
      const { downloadAgreementPdf } = await import("@/lib/agreement-pdf");
      await downloadAgreementPdf(el, `Finance agreement FA-${a.ref_no}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not download agreement"); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}><DialogContent overlayClassName="z-[105]" className="z-[110] flex max-h-[90dvh] w-[calc(100%-1rem)] max-w-4xl flex-col rounded-md">
    <DialogHeader><DialogTitle>Finance agreement FA-{a.ref_no}</DialogTitle><DialogDescription>{a.customer_snapshot?.full_name}</DialogDescription></DialogHeader>
    <div className="flex flex-wrap gap-2"><Button onClick={download} disabled={busy}><Download />{busy ? "Preparing PDF…" : "Download PDF"}</Button><Button variant="outline" onClick={() => printElement(ref.current, `Finance agreement FA-${a.ref_no}`)}><Printer />Print agreement</Button></div>
    <div className="min-h-0 overflow-auto border border-border"><AgreementDocument ref={ref} a={a} s={s} /></div>
  </DialogContent></Dialog>;
}