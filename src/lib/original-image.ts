// Remembers the untouched original for each processed (background-removed) image
// so admins can revert a product / category image back to what they uploaded.

const KEY = "hmc-image-originals";
const MAX = 300;

type Map = Record<string, string>;

function read(): Map {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Map;
  } catch {
    return {};
  }
}

function write(map: Map) {
  try {
    const keys = Object.keys(map);
    if (keys.length > MAX) for (const k of keys.slice(0, keys.length - MAX)) delete map[k];
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* storage full or unavailable — reverting simply won't be offered */
  }
}

/** Store the original image reference (URL or storage path) for a processed image. */
export function rememberOriginal(processed: string | null | undefined, original: string) {
  if (!processed || !original || processed === original) return;
  const map = read();
  map[processed] = original;
  write(map);
}

/** Get the original image reference for a processed image, if we still have it. */
export function getOriginal(processed: string | null | undefined): string | null {
  if (!processed) return null;
  return read()[processed] ?? null;
}
