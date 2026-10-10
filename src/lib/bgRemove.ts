// Background remover — 100% free and on-device (WASM, no API keys, no server cost).
// The whole background is removed and replaced with pure studio white.

export type BgOptions = {
  /** Extra instructions (free text). Recognised keywords tweak the result. */
  instructions?: string;
};

type Settings = {
  keepShadow: boolean;
  transparent: boolean;
  trim: boolean;
  brighten: boolean;
};

function parseInstructions(text?: string): Settings {
  const t = (text ?? "").toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  return {
    keepShadow: has("keep shadow", "with shadow", "keep the shadow"),
    transparent: has("transparent", "no background", "alpha", "png cutout"),
    trim: has("crop", "trim", "tight", "zoom"),
    brighten: true,
  };
}

async function shrink(file: File | Blob, max = 1600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file as Blob);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? (file as Blob)), "image/jpeg", 0.95),
    );
  } catch {
    return file;
  }
}

function toBlob(canvas: HTMLCanvasElement, png: boolean): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not render the image"))),
      png ? "image/png" : "image/jpeg",
      0.95,
    ),
  );
}

async function composite(original: Blob, cutout: Blob, s: Settings): Promise<Blob> {
  const [origBmp, cutBmp] = await Promise.all([createImageBitmap(original), createImageBitmap(cutout)]);
  const w = cutBmp.width;
  const h = cutBmp.height;

  const cut = document.createElement("canvas");
  cut.width = w; cut.height = h;
  const cutCtx = cut.getContext("2d")!;
  cutCtx.drawImage(cutBmp, 0, 0);
  const cutData = cutCtx.getImageData(0, 0, w, h);

  // De-fringe: kill faint matting leftovers, pull semi-transparent edges towards white.
  {
    const d = cutData.data;
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      const a = d[i + 3];
      if (a < 40) { d[i + 3] = 0; continue; }
      if (a < 235) {
        const k = a / 255;
        d[i] = Math.min(255, Math.round(d[i] + (255 - d[i]) * (1 - k) * 0.5));
        d[i + 1] = Math.min(255, Math.round(d[i + 1] + (255 - d[i + 1]) * (1 - k) * 0.5));
        d[i + 2] = Math.min(255, Math.round(d[i + 2] + (255 - d[i + 2]) * (1 - k) * 0.5));
      }
    }
    cutCtx.putImageData(cutData, 0, 0);
  }

  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const ctx = out.getContext("2d")!;

  if (s.transparent) {
    ctx.putImageData(cutData, 0, 0);
    origBmp.close?.(); cutBmp.close?.();
    return await toBlob(out, true);
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  let bMinX = w, bMinY = h, bMaxX = 0, bMaxY = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (cutData.data[(y * w + x) * 4 + 3] > 24) {
      if (x < bMinX) bMinX = x; if (x > bMaxX) bMaxX = x;
      if (y < bMinY) bMinY = y; if (y > bMaxY) bMaxY = y;
    }
  }
  const hasProduct = bMaxX > bMinX && bMaxY > bMinY;
  const nearPad = hasProduct ? Math.round(Math.max(bMaxX - bMinX, bMaxY - bMinY) * 0.14) : 0;

  if (s.keepShadow && hasProduct) {
    const src = document.createElement("canvas");
    src.width = w; src.height = h;
    const sctx = src.getContext("2d")!;
    sctx.drawImage(origBmp, 0, 0, w, h);
    const od = sctx.getImageData(0, 0, w, h).data;

    let sum = 0, count = 0;
    const edge = Math.max(2, Math.round(Math.min(w, h) * 0.02));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const onEdge = x < edge || y < edge || x >= w - edge || y >= h - edge;
        if (!onEdge) continue;
        const i = (y * w + x) * 4;
        sum += 0.299 * od[i] + 0.587 * od[i + 1] + 0.114 * od[i + 2];
        count++;
      }
    }
    const bg = count ? sum / count : 255;

    const shadow = ctx.createImageData(w, h);
    const sd = shadow.data;
    let any = false;
    for (let y = 0; y < h; y++) {
      if (y < bMinY - nearPad || y > bMaxY + nearPad) continue;
      for (let x = 0; x < w; x++) {
        if (x < bMinX - nearPad || x > bMaxX + nearPad) continue;
        const i = (y * w + x) * 4;
        if (cutData.data[i + 3] > 24) continue;
        const lum = 0.299 * od[i] + 0.587 * od[i + 1] + 0.114 * od[i + 2];
        const drop = bg - lum;
        if (drop < 16) continue;
        const strength = Math.min(1, drop / Math.max(40, bg * 0.45));
        const a = Math.round(strength * (s.brighten ? 70 : 105));
        if (a <= 6) continue;
        any = true;
        sd[i] = 140; sd[i + 1] = 140; sd[i + 2] = 140; sd[i + 3] = a;
      }
    }
    if (any) {
      const layer = document.createElement("canvas");
      layer.width = w; layer.height = h;
      layer.getContext("2d")!.putImageData(shadow, 0, 0);
      ctx.save();
      ctx.filter = "blur(4px)";
      ctx.globalAlpha = 0.85;
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
    }
  }

  ctx.drawImage(cut, 0, 0);
  origBmp.close?.(); cutBmp.close?.();

  // Snap near-white backdrop pixels to exact #fff so no grey cast/halo survives.
  {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      if (cutData.data[i + 3] > 8) continue;
      if (d[i] >= 225 && d[i + 1] >= 225 && d[i + 2] >= 225) {
        d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  if (s.trim) {
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (cutData.data[(y * w + x) * 4 + 3] > 24) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    if (maxX > minX && maxY > minY) {
      const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.06);
      const x0 = Math.max(0, minX - pad), y0 = Math.max(0, minY - pad);
      const x1 = Math.min(w, maxX + pad), y1 = Math.min(h, maxY + pad);
      const cropped = document.createElement("canvas");
      cropped.width = x1 - x0; cropped.height = y1 - y0;
      const cc = cropped.getContext("2d")!;
      cc.fillStyle = "#ffffff";
      cc.fillRect(0, 0, cropped.width, cropped.height);
      cc.drawImage(out, x0, y0, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
      return await toBlob(cropped, false);
    }
  }

  return await toBlob(out, false);
}

/** Removes the background of `file` and returns the product on a studio-white backdrop. */
export async function removeBackgroundToWhite(file: File | Blob, opts: BgOptions = {}): Promise<Blob> {
  const settings = parseInstructions(opts.instructions);
  const { removeBackground } = await import("@imgly/background-removal");
  const input = await shrink(file);

  const cutout = await removeBackground(input, {
    output: { format: "image/png", quality: 0.9 },
    model: "isnet",
  });

  return await composite(input, cutout, settings);
}
