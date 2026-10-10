import { useEffect, useRef, useState } from "react";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code", "data_matrix"];

/** Camera barcode scanner: native BarcodeDetector first, @zxing/browser fallback. */
export function BarcodeScanner({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const doneRef = useRef(false);
  const cbRef = useRef(onDetected);
  cbRef.current = onDetected;

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let zxControls: { stop: () => void } | null = null;
    let raf = 0;
    const hit = (code: string) => {
      if (doneRef.current || !code) return;
      doneRef.current = true;
      cbRef.current(code);
    };
    (async () => {
      try {
        const video = videoRef.current!;
        const constraints: MediaStreamConstraints = {
          video: camId ? { deviceId: { exact: camId } } : { facingMode: { ideal: "environment" } },
          audio: false,
        };
        const BD = (window as any).BarcodeDetector;
        let supported: string[] = [];
        if (BD?.getSupportedFormats) supported = await BD.getSupportedFormats().catch(() => []);
        if (BD && supported.length) {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stopped) return;
          video.srcObject = stream;
          await video.play();
          const det = new BD({ formats: FORMATS.filter((f) => supported.includes(f)) });
          const tick = async () => {
            if (stopped || doneRef.current) return;
            try {
              const r = await det.detect(video);
              if (r?.[0]?.rawValue) return hit(r[0].rawValue);
            } catch { /* keep scanning */ }
            raf = requestAnimationFrame(tick);
          };
          tick();
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const reader = new BrowserMultiFormatReader();
          zxControls = await reader.decodeFromConstraints(constraints, video, (res) => {
            if (res) hit(res.getText());
          });
          if (stopped) zxControls.stop();
        }
        const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        if (!stopped) setCams(devs);
      } catch (e: any) {
        if (!stopped) setErr(e?.message ?? "Camera not available");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      zxControls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camId]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/70 p-3" onClick={onClose}>
      <div className="w-full max-w-md rounded-md bg-background p-3" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-semibold">Scan barcode</p>
          <button onClick={onClose} className="rounded-sm border border-border px-3 py-2 text-sm">Close</button>
        </div>
        {err ? (
          <p className="text-sm text-primary">{err}</p>
        ) : (
          <video ref={videoRef} className="aspect-[4/3] w-full rounded-sm bg-muted object-cover" muted playsInline />
        )}
        {cams.length > 1 && (
          <select value={camId} onChange={(e) => { doneRef.current = false; setCamId(e.target.value); }} className="mt-2 w-full rounded-sm border border-border bg-background p-2 text-sm">
            <option value="">Rear camera (default)</option>
            {cams.map((c, i) => <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${i + 1}`}</option>)}
          </select>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Point the camera at the barcode. EAN, UPC, Code 128/39, ITF, QR and Data Matrix supported.</p>
      </div>
    </div>
  );
}
