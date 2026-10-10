import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export function SignaturePad({ onChange }: { onChange: (signature: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [drawn, setDrawn] = useState(false);
  const position = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * e.currentTarget.width / rect.width, y: (e.clientY - rect.top) * e.currentTarget.height / rect.height };
  };
  return <div className="space-y-2">
    <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase">Draw signature</span><Button type="button" variant="outline" size="sm" onClick={() => { const c = canvas.current; if (!c) return; c.getContext("2d")?.clearRect(0, 0, c.width, c.height); setDrawn(false); onChange(null); }}><Eraser />Clear</Button></div>
    <canvas ref={canvas} width={800} height={200} aria-label="Draw administrator signature" className="signature-pad w-full touch-none rounded-sm border border-border"
      onPointerDown={(e) => { const ctx = e.currentTarget.getContext("2d"); if (!ctx) return; drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); const p = position(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.strokeStyle = getComputedStyle(e.currentTarget).color; }}
      onPointerMove={(e) => { if (!drawing.current) return; const ctx = e.currentTarget.getContext("2d"); if (!ctx) return; const p = position(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setDrawn(true); }}
      onPointerUp={(e) => { drawing.current = false; if (drawn) onChange(e.currentTarget.toDataURL("image/png")); }}
      onPointerCancel={() => { drawing.current = false; }} />
  </div>;
}