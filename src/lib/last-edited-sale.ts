/**
 * Tracks the most recently edited sale for the current page session only.
 * Deliberately in-memory: a page refresh clears it, so the yellow highlight
 * on the sales list disappears after a reload.
 */
let lastEditedSaleId: string | null = null;
const listeners = new Set<() => void>();

export function markSaleEdited(id: string) {
  lastEditedSaleId = id;
  listeners.forEach((l) => l());
}

export function getLastEditedSaleId() {
  return lastEditedSaleId;
}

export function subscribeLastEditedSale(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
