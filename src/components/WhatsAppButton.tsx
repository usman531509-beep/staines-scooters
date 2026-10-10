import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/brand";

const STORAGE_KEY = "wa-fab-pos:v1";
const SIZE = 56;

export function WhatsAppButton() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  // Load saved position; fallback to bottom-right.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const p = JSON.parse(raw);
        if (typeof p.x === "number" && typeof p.y === "number") { setPos(p); return; }
      } catch { /* ignore */ }
    }
    setPos({ x: window.innerWidth - SIZE - 20, y: window.innerHeight - SIZE - 20 });
  }, []);

  // Keep on-screen on resize.
  useEffect(() => {
    if (!pos) return;
    function onResize() {
      setPos((p) => {
        if (!p) return p;
        return {
          x: Math.min(Math.max(0, p.x), window.innerWidth - SIZE),
          y: Math.min(Math.max(0, p.y), window.innerHeight - SIZE),
        };
      });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos]);

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!pos) return;
    draggingRef.current = true;
    movedRef.current = false;
    offsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current) return;
    const nx = e.clientX - offsetRef.current.x;
    const ny = e.clientY - offsetRef.current.y;
    if (Math.abs(nx - (pos?.x ?? 0)) + Math.abs(ny - (pos?.y ?? 0)) > 4) movedRef.current = true;
    setPos({
      x: Math.min(Math.max(0, nx), window.innerWidth - SIZE),
      y: Math.min(Math.max(0, ny), window.innerHeight - SIZE),
    });
  }
  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (pos) {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch { /* noop */ }
    }
  }
  function onClick(e: React.MouseEvent) {
    if (movedRef.current) { e.preventDefault(); return; }
    window.open(whatsappLink(), "_blank", "noopener,noreferrer");
  }

  if (!pos) return null;
  return (
    <button
      type="button"
      aria-label="Chat on WhatsApp — drag to move"
      title="Chat on WhatsApp (drag to move)"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
      style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE, touchAction: "none" }}
      className="fixed z-50 inline-flex items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_20px_rgba(37,211,102,0.5)] transition-transform hover:scale-105 active:cursor-grabbing cursor-grab"
    >
      <MessageCircle className="h-7 w-7" fill="currentColor" strokeWidth={0} />
    </button>
  );
}
