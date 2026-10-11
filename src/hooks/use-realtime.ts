import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Live-patch the POS product & category caches from Supabase Realtime so
// two cashiers on different tills see stock/price changes instantly and
// the local IndexedDB cache stays fresh in the background.
export function useCatalogueRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("pos-catalogue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        (payload) => {
          const row: any = payload.new ?? payload.old;
          if (!row) return;
          qc.setQueriesData({ queryKey: ["pos-products"] }, (prev: any) => {
            if (!Array.isArray(prev)) return prev;
            if (payload.eventType === "DELETE") {
              return prev.filter((p: any) => p.id !== row.id);
            }
            const idx = prev.findIndex((p: any) => p.id === row.id);
            if (idx === -1) {
              // Insert if it matches the currently-loaded category, else skip.
              return [...prev, payload.new];
            }
            const next = [...prev];
            next[idx] = { ...next[idx], ...payload.new };
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        () => {
          qc.invalidateQueries({ queryKey: ["pos-cats"] });
          qc.invalidateQueries({ queryKey: ["cats-all"] });
          qc.invalidateQueries({ queryKey: ["all-cats"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

// Live sales feed — used by the sales list to auto-refresh on new sales.
export function useSalesRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("sales-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => {
          qc.invalidateQueries({ queryKey: ["sales"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);
}
