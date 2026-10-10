import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Storage included in the current Lovable Cloud database package (Tiny instance).
const TOTAL_DISK_BYTES = 8 * 1024 * 1024 * 1024; // 8 GB

export const getDbStorage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data, error } = await supabase.rpc("db_storage_usage");
    if (error) throw new Error(error.message);
    const usedBytes = Number((data as any)?.database_bytes ?? 0);
    const topTables = ((data as any)?.top_tables ?? []) as Array<{ name: string; bytes: number }>;
    return {
      usedBytes,
      totalBytes: TOTAL_DISK_BYTES,
      freeBytes: Math.max(TOTAL_DISK_BYTES - usedBytes, 0),
      topTables,
    };
  });
