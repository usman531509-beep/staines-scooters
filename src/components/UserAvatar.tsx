import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAvatarUrl, uploadMyAvatar } from "@/lib/avatar.functions";
import { compressImage } from "@/lib/image-compress";

export function UserAvatarImg({
  url,
  name,
  size = 40,
  className = "",
}: {
  url?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  const dim = { width: size, height: size };
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? "Profile picture"}
        style={dim}
        className={`shrink-0 rounded-full object-cover ring-1 ring-border ${className}`}
      />
    );
  }
  return (
    <div
      style={dim}
      className={`grid shrink-0 place-items-center rounded-full bg-primary/10 font-display text-primary ring-1 ring-primary/30 ${className}`}
    >
      {initial}
    </div>
  );
}

export function useMyAvatarUrl(enabled = true) {
  const fn = useServerFn(getMyAvatarUrl);
  return useQuery({
    queryKey: ["my-avatar-url"],
    queryFn: async () => (await fn({ data: {} })).url,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

async function fileToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

export function UserAvatarUploader({
  currentUrl,
  name,
  size = 96,
}: {
  currentUrl?: string | null;
  name?: string | null;
  size?: number;
}) {
  const qc = useQueryClient();
  const upload = useServerFn(uploadMyAvatar);
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const compressed = await compressImage(file, { maxDim: 256, quality: 0.75, targetBytes: 25 * 1024, minQuality: 0.4 });
      const dataUrl = await fileToDataUrl(compressed);
      const res = await upload({ data: { dataUrl } });
      setPreview(res.url);
      await qc.invalidateQueries({ queryKey: ["my-avatar-url"] });
      await qc.invalidateQueries({ queryKey: ["my-account"] });
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatarImg url={preview ?? currentUrl} name={name} size={size} />
      <div className="min-w-0 space-y-1">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="rounded-sm border border-border bg-surface-elevated px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-foreground hover:bg-muted disabled:opacity-50"
        >
          {busy ? "Uploading…" : currentUrl ? "Change photo" : "Upload photo"}
        </button>
        <p className="text-[10px] text-ink-muted">JPG, PNG or WEBP. Max 3MB.</p>
        {err && <p className="text-[11px] text-primary">{err}</p>}
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onPick} />
      </div>
    </div>
  );
}
