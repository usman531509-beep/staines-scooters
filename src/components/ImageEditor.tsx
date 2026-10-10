import { useEffect, useRef, useState } from "react";
import { Crop, Eraser, Undo2, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  /** Source image: a File/Blob or an http(s) URL. */
  source: Blob | string | null;
  onClose: () => void;
  onSave: (blob: Blob, ext: string) => void | Promise<void>;
};

const MAX_VIEW = 620;

/**
 * Free, on-device image editor: crop a region and erase unwanted objects
 * (the eraser paints pure studio white so it blends with the product backdrop).
 */
export function ImageEditor({ open, source, onClose, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<"crop" | "erase">("crop");
  const [brush, setBrush] = useState(40);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const historyRef = useRef<ImageData[]>([]);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [viewScale, setViewScale] = useState(1);

  useEffect(() => {
    if (!open || !source) return;
    let cancelled = false;
    setReady(false);
    setRect(null);
    historyRef.current = [];
    (async () => {
      try {
        const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
        const bmp = await createImageBitmap(blob);
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bmp, 0, 0);
        bmp.close?.();
        setViewScale(Math.min(1, MAX_VIEW / Math.max(canvas.width, canvas.height)));
        setReady(true);
      } catch {
        toast.error("Could not open that image");
        onClose();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source]);

  if (!open) return null;

  const snapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (historyRef.current.length > 15) historyRef.current.shift();
  };

  const undo = () => {
    const prev = historyRef.current.pop();
    const canvas = canvasRef.current;
    if (!prev || !canvas) return;
    canvas.width = prev.width;
    canvas.height = prev.height;
    canvas.getContext("2d")!.putImageData(prev, 0, 0);
    setViewScale(Math.min(1, MAX_VIEW / Math.max(canvas.width, canvas.height)));
    setRect(null);
  };

  const toImageCoords = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const box = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - box.left) / box.width) * canvas.width,
      y: ((e.clientY - box.top) / box.height) * canvas.height,
    };
  };

  const paint = (x: number, y: number) => {
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, brush / 2 / viewScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!ready) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = toImageCoords(e);
    dragRef.current = p;
    if (mode === "erase") { snapshot(); paint(p.x, p.y); }
    else setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const p = toImageCoords(e);
    if (mode === "erase") paint(p.x, p.y);
    else {
      const s = dragRef.current;
      setRect({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
    }
  };

  const onPointerUp = () => { dragRef.current = null; };

  const cropTo = (r: { x: number; y: number; w: number; h: number } | null) => {
    const canvas = canvasRef.current;
    if (!canvas || !r || r.w < 8 || r.h < 8) return false;
    snapshot();
    const sx = Math.max(0, Math.round(r.x));
    const sy = Math.max(0, Math.round(r.y));
    const sw = Math.min(canvas.width - sx, Math.round(r.w));
    const sh = Math.min(canvas.height - sy, Math.round(r.h));
    if (sw < 8 || sh < 8) return false;
    const cropped = document.createElement("canvas");
    cropped.width = sw;
    cropped.height = sh;
    cropped.getContext("2d")!.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    canvas.width = sw;
    canvas.height = sh;
    canvas.getContext("2d")!.drawImage(cropped, 0, 0);
    setViewScale(Math.min(1, MAX_VIEW / Math.max(sw, sh)));
    setRect(null);
    return true;
  };

  const applyCrop = () => {
    if (!cropTo(rect)) { toast.error("Drag a crop area on the image first"); return; }
    toast.success("Cropped");
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    try {
      cropTo(rect);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.95));
      if (!blob) throw new Error("Could not render the image");
      await onSave(blob, "jpg");
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save the image");
    } finally { setBusy(false); }
  };

  const btn = "inline-flex items-center gap-2 rounded-sm border border-border px-3 py-2 text-xs uppercase tracking-widest";
  const activeBtn = `${btn} bg-primary text-primary-foreground`;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-3">
      <div className="w-full max-w-3xl rounded-md border border-border bg-surface p-4">
        <h2 className="font-display text-xl uppercase">Crop &amp; erase image</h2>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className={mode === "crop" ? activeBtn : btn} onClick={() => setMode("crop")}>
            <Crop className="h-3.5 w-3.5" /> Crop
          </button>
          <button type="button" className={mode === "erase" ? activeBtn : btn} onClick={() => setMode("erase")}>
            <Eraser className="h-3.5 w-3.5" /> Erase objects
          </button>
          {mode === "crop" && (
            <button type="button" className={btn} onClick={applyCrop}>Apply crop</button>
          )}
          {mode === "erase" && (
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-ink-muted">
              Brush
              <input type="range" min={8} max={120} value={brush} onChange={(e) => setBrush(Number(e.target.value))} />
              <span>{brush}</span>
            </div>
          )}
          <button type="button" className={btn} onClick={undo}><Undo2 className="h-3.5 w-3.5" /> Undo</button>
          <button type="button" className={btn} onClick={() => setRect(null)}><RotateCcw className="h-3.5 w-3.5" /> Clear selection</button>
        </div>

        <div className="mt-3 flex justify-center">
          <div className="relative inline-block">
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="max-w-full touch-none select-none rounded-sm border border-border bg-white"
              style={{ maxHeight: MAX_VIEW, cursor: mode === "erase" ? "crosshair" : "crosshair" }}
            />
            {mode === "crop" && rect && rect.w > 2 && (
              <div
                className="pointer-events-none absolute border-2 border-primary bg-primary/10"
                style={{
                  left: `${(rect.x / (canvasRef.current?.width || 1)) * 100}%`,
                  top: `${(rect.y / (canvasRef.current?.height || 1)) * 100}%`,
                  width: `${(rect.w / (canvasRef.current?.width || 1)) * 100}%`,
                  height: `${(rect.h / (canvasRef.current?.height || 1)) * 100}%`,
                }}
              />
            )}
          </div>
        </div>

        <p className="mt-2 text-xs text-ink-muted">
          {mode === "crop"
            ? "Drag on the image to draw the area you want to keep, then press Apply crop."
            : "Paint over anything you want gone — the eraser fills with pure studio white."}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btn}>Cancel</button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !ready}
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{busy ? "Saving…" : "Save image"}
          </button>
        </div>
      </div>
    </div>
  );
}
