// Client-only persistence for TanStack Query. Restores catalogue queries
// from IndexedDB on boot so the POS/products show instantly, then
// background-refetches. Safe to import from client code; the actual
// persist calls are guarded so SSR is a no-op.
import type { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";

const CACHE_VERSION = "v1";
const CACHE_KEY = `hm-rq-cache-${CACHE_VERSION}`;

// Only persist these query key roots — anything user-scoped or sensitive
// (sales rows, credit, receipts, admin lists) is deliberately excluded.
const PERSISTABLE_ROOTS = new Set([
  "pos-cats",
  "pos-products",
  "pos-top-sold",
  "products",
  "categories",
]);

let installed = false;

export function installQueryPersistence(queryClient: QueryClient) {
  if (installed) return;
  if (typeof window === "undefined") return;
  installed = true;

  const persister = createAsyncStoragePersister({
    storage: {
      getItem: (k) => get<string>(k).then((v) => v ?? null),
      setItem: (k, v) => set(k, v),
      removeItem: (k) => del(k),
    },
    key: CACHE_KEY,
    throttleTime: 1500,
  });

  persistQueryClient({
    queryClient: queryClient as any,
    persister,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    buster: CACHE_VERSION,
    dehydrateOptions: {
      shouldDehydrateQuery: (q: any) => {
        const root = Array.isArray(q.queryKey) ? String(q.queryKey[0] ?? "") : "";
        return PERSISTABLE_ROOTS.has(root) && q.state.status === "success";
      },
    },
  });
}
