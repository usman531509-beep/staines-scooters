import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { getAgreementForSigning, signAgreement } from "@/lib/finance.functions";
import { AgreementDocument, printElement } from "@/components/finance/AgreementDocument";
import { BRAND } from "@/lib/brand";
import { FEATURES } from "@/lib/features";

export const Route = createFileRoute("/fa/$token")({
  head: () => ({
    meta: [
      { title: `Sign your finance agreement — ${BRAND.name}` },
      { name: "description", content: "Read and sign your motorcycle finance agreement securely online." },
      { property: "og:title", content: `Sign your finance agreement — ${BRAND.name}` },
      { property: "og:description", content: "Read and sign your motorcycle finance agreement securely online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (FEATURES.finance ? <SignPage /> : <LinkUnavailable />),
});

function LinkUnavailable() {
  return (
    <div className="min-h-screen bg-surface px-3 py-6 text-ink">
      <p className="mx-auto max-w-3xl rounded-md border border-border bg-surface-elevated p-6 text-center">This link is not available. Please contact {BRAND.name} on {BRAND.phone}.</p>
    </div>
  );
}

function SignPage() {
  const { token } = Route.useParams();
  const getFn = useServerFn(getAgreementForSigning);
  const signFn = useServerFn(signAgreement);
  const q = useQuery({ queryKey: ["fa", token], queryFn: () => getFn({ data: { token } }) });
  const docRef = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [drawn, setDrawn] = useState(false);
  const [name, setName] = useState("");
  const [accept, setAccept] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#111";
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height)]; };
    const down = (e: PointerEvent) => { drawing.current = true; const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); c.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (!drawing.current) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); setDrawn(true); };
    const up = () => { drawing.current = false; };
    c.addEventListener("pointerdown", down); c.addEventListener("pointermove", move); c.addEventListener("pointerup", up);
    return () => { c.removeEventListener("pointerdown", down); c.removeEventListener("pointermove", move); c.removeEventListener("pointerup", up); };
  }, [q.data?.agreement?.status]);

  const sign = useMutation({
    mutationFn: () => signFn({ data: { token, name, signature: canvas.current!.toDataURL("image/png"), accept: true } }),
    onSuccess: () => q.refetch(),
    onError: (e: any) => setErr(e.message),
  });

  const a = q.data?.agreement;
  const clear = () => { const c = canvas.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height); setDrawn(false); };

  return (
    <div className="min-h-screen bg-surface px-3 py-6 text-ink">
      <div className="mx-auto max-w-3xl space-y-4">
        {q.isLoading && <p className="text-sm text-ink-muted">Loading agreement…</p>}
        {!q.isLoading && !a && <p className="rounded-md border border-border bg-surface-elevated p-6 text-center">This agreement link is not valid or is no longer available. Please contact {BRAND.name} on {BRAND.phone}.</p>}
        {a && (
          <>
            <div className="flex justify-end">
              <button onClick={() => printElement(docRef.current, `Finance agreement FA-${a.ref_no}`)} className="rounded-sm border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-widest">Print / Save PDF</button>
            </div>
            <div className="overflow-x-auto rounded-md border border-border"><AgreementDocument ref={docRef} a={a} s={q.data?.settings} /></div>
            {a.status === "sent" ? (
              <div className="space-y-3 rounded-md border border-primary/50 bg-surface-elevated p-4">
                <p className="font-display text-xl">Sign this agreement</p>
                <label className="block text-xs uppercase tracking-widest text-ink-muted">Your full legal name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-sm border border-border bg-input px-3 py-2" />
                <div>
                  <div className="flex items-center justify-between text-xs uppercase tracking-widest text-ink-muted"><span>Draw your signature *</span><button onClick={clear} className="underline">Clear</button></div>
                  <canvas ref={canvas} width={600} height={160} className="mt-1 w-full touch-none rounded-sm border border-border bg-card" style={{ background: "#fff" }} />
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1" />
                  <span>I have read the whole agreement, including the key financial information, payment schedule, my right to withdraw within 14 days and the consequences of missing payments, and I agree to be legally bound by it.</span>
                </label>
                {err && <p className="text-sm text-primary">{err}</p>}
                <button disabled={!accept || !drawn || name.trim().length < 3 || sign.isPending} onClick={() => { setErr(null); sign.mutate(); }} className="w-full rounded-sm bg-primary px-4 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50">
                  {sign.isPending ? "Signing…" : "Sign agreement"}
                </button>
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-md border border-border bg-surface-elevated p-4"><CheckCircle2 className="h-5 w-5 text-primary" /> This agreement has been signed. Use Print / Save PDF above to keep a copy.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
