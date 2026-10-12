// Client-side image compression using canvas. Returns a WebP Blob (JPEG on browsers
// that can't encode WebP) sized down to `maxDim` and iteratively re-encoded until it
// fits `targetBytes`. Storage is on Supabase's free tier, so uploads are kept small.
export async function compressImage(
  file: File,
  opts: { maxDim?: number; quality?: number; targetBytes?: number; minQuality?: number } = {}
): Promise<Blob> {
  const { maxDim = 1400, quality = 0.82, targetBytes, minQuality = 0.4 } = opts;
  if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  let scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  let w = Math.round(bitmap.width * scale);
  let h = Math.round(bitmap.height * scale);

  const render = (width: number, height: number, q: number): Promise<Blob | null> => {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    // White behind transparent PNGs, so JPEG output doesn't turn them black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    return new Promise((res) =>
      canvas.toBlob((blob) => {
        // Browsers without a WebP encoder silently return PNG; use JPEG instead.
        if (blob && blob.type === "image/webp") return res(blob);
        canvas.toBlob(res, "image/jpeg", q);
      }, "image/webp", q),
    );
  };

  let q = quality;
  let out = await render(w, h, q);
  if (!out) return file;

  // Iteratively reduce quality/dimensions until targetBytes is met.
  if (targetBytes) {
    let guard = 0;
    while (out && out.size > targetBytes && guard < 10) {
      if (q > minQuality) {
        q = Math.max(minQuality, q - 0.12);
      } else {
        w = Math.round(w * 0.8);
        h = Math.round(h * 0.8);
        if (w < 64 || h < 64) break;
      }
      out = await render(w, h, q);
      guard++;
    }
  }

  if (!out) return file;
  return out.size < file.size ? out : file;
}

/** File extension matching a compressed blob's format. */
export function imageExt(blob: Blob): string {
  if (blob.type === "image/webp") return "webp";
  if (blob.type === "image/png") return "png";
  return "jpg";
}

// Product photos: about 50KB each, plenty for till tiles and the product form.
export async function compressProductImage(file: File): Promise<Blob> {
  return compressImage(file, { maxDim: 900, quality: 0.72, targetBytes: 50 * 1024, minQuality: 0.4 });
}

// Photos of documents (licences, receipts, damage): readable but small (~150KB).
// Anything that isn't an image (PDFs) uploads as it is.
export async function compressDocument(file: File): Promise<Blob> {
  return compressImage(file, { maxDim: 1600, quality: 0.7, targetBytes: 150 * 1024, minQuality: 0.4 });
}

// Aggressive thumbnail compression (target ~10KB) for tiny UI thumbnails like category icons.
export async function compressThumbnail(file: File): Promise<Blob> {
  return compressImage(file, { maxDim: 256, quality: 0.72, targetBytes: 10 * 1024, minQuality: 0.35 });
}
