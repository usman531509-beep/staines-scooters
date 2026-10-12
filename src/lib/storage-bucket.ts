/**
 * Every upload (product and category images, rental and claim documents,
 * stock evidence, profile photos) lives in this one private Supabase Storage
 * bucket, each in its own top-level folder. Files are read through signed URLs.
 */
export const STORAGE_BUCKET = "uploads";

/** A storage-safe file name; keeps the extension in step when an image was re-encoded. */
export function safeName(original: string, body: Blob): string {
  const base = original.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "_").slice(0, 60) || "file";
  const ext =
    body.type === "image/webp" ? "webp" : body.type === "image/jpeg" ? "jpg" : (original.split(".").pop() ?? "bin").toLowerCase();
  return `${base}.${ext}`;
}
