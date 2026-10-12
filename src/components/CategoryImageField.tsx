import { useState } from "react";
import { STORAGE_BUCKET } from "@/lib/storage-bucket";
import { Upload, ImageIcon, Crop, Undo2, Eraser } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { CloudImage } from "@/components/CloudImage";
import { ImageEditor } from "@/components/ImageEditor";
import { getSignedProductImageUrl } from "@/lib/storage.functions";
import { rememberOriginal, getOriginal } from "@/lib/original-image";

/**
 * Category / subcategory image control: uploads with automatic background removal
 * onto pure studio white, plus crop / erase editing and revert-to-original.
 */
export function CategoryImageField({
  imageUrl,
  alt,
  pathPrefix,
  onChange,
  saving,
  size = "sm",
}: {
  imageUrl?: string | null;
  alt: string;
  pathPrefix: string;
  onChange: (path: string | null) => void;
  saving?: boolean;
  size?: "sm" | "md";
}) {
  const signImage = useServerFn(getSignedProductImageUrl);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const box = size === "sm" ? "h-8 w-8" : "h-12 w-12";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const btn = size === "sm"
    ? "inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
    : "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground";

  async function uploadBlob(blob: Blob) {
    const { imageExt } = await import("@/lib/image-compress");
    const path = `${pathPrefix}/${crypto.randomUUID()}.${imageExt(blob)}`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
    if (error) throw error;
    return path;
  }

  async function handleUpload(file: File) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { alert("Image must be under 15MB."); return; }
    setBusy(true);
    try {
      const { compressThumbnail } = await import("@/lib/image-compress");
      setStatus("Uploading…");
      // Upload the photo untouched — background removal is a deliberate action.
      const path = await uploadBlob(await compressThumbnail(file));
      onChange(path);
    } catch (e: any) {
      alert(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function handleRemoveBackground() {
    if (!imageUrl) return;
    setBusy(true);
    try {
      setStatus("Removing background…");
      const needsSigning = !/^(https?:|data:|blob:|\/)/i.test(imageUrl);
      const url = needsSigning ? await signImage({ data: { path: imageUrl } }) : imageUrl;
      const res = await fetch(typeof url === "string" ? url : imageUrl);
      if (!res.ok) throw new Error("Could not load that image");
      const { removeBackgroundToWhite } = await import("@/lib/bgRemove");
      const source = await removeBackgroundToWhite(await res.blob());
      setStatus("Uploading…");
      const { compressThumbnail } = await import("@/lib/image-compress");
      const asFile = new File([source], "category.jpg", { type: source.type || "image/jpeg" });
      const path = await uploadBlob(await compressThumbnail(asFile));
      rememberOriginal(path, getOriginal(imageUrl) || imageUrl);
      onChange(path);
    } catch (e: any) {
      alert(e?.message ?? "Background removal failed");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }


  async function openEditor() {
    if (!imageUrl) return;
    try {
      const needsSigning = !/^(https?:|data:|blob:|\/)/i.test(imageUrl);
      const url = needsSigning ? await signImage({ data: { path: imageUrl } }) : imageUrl;
      setEditing(typeof url === "string" ? url : imageUrl);
    } catch (e: any) {
      alert(e?.message ?? "Could not open that image");
    }
  }

  const original = imageUrl ? getOriginal(imageUrl) : null;
  const working = busy || !!saving;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CloudImage
        src={imageUrl}
        alt={alt}
        className={`${box} rounded-sm border border-border bg-white object-cover`}
        fallback={
          <div className={`${box} flex items-center justify-center rounded-sm border border-dashed border-border text-ink-muted`}>
            <ImageIcon className={icon} />
          </div>
        }
      />
      <label className={btn} title="Upload the photo as it is — use Remove background when you want it on white">
        <Upload className="h-3 w-3" />
        {working ? (status || "Saving…") : imageUrl ? "Replace" : "Image"}
        <input type="file" accept="image/*" className="hidden" disabled={working}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.currentTarget.value = ""; }} />
      </label>
      {imageUrl && (
        <button type="button" disabled={working} onClick={handleRemoveBackground} className={btn}>
          <Eraser className="h-3 w-3" /> Remove background
        </button>
      )}
      {imageUrl && (
        <button type="button" onClick={openEditor} className={btn}>
          <Crop className="h-3 w-3" /> Crop / erase
        </button>
      )}

      {imageUrl && original && (
        <button type="button" onClick={() => onChange(original)} className={btn}>
          <Undo2 className="h-3 w-3" /> Revert
        </button>
      )}
      {imageUrl && (
        <button type="button" onClick={() => onChange(null)} className="text-[10px] uppercase tracking-widest text-primary">Clear</button>
      )}
      <ImageEditor
        open={!!editing}
        source={editing}
        onClose={() => setEditing(null)}
        onSave={async (blob) => {
          const path = await uploadBlob(blob);
          const prev = (imageUrl && getOriginal(imageUrl)) || imageUrl;
          if (prev) rememberOriginal(path, prev);
          onChange(path);
        }}
      />
    </div>
  );
}
