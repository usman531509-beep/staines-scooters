import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listTitlePresets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ productId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: rows, error } = await supabase
      .from("product_title_presets")
      .select("id,title")
      .eq("product_id", data.productId)
      .order("title");
    if (error) throw error;
    return (rows ?? []) as { id: string; title: string }[];
  });

export const addTitlePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ productId: z.string().uuid(), title: z.string().trim().min(1).max(120) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase
      .from("product_title_presets")
      .insert({ product_id: data.productId, title: data.title });
    if (error && error.code !== "23505") throw error;
    return { ok: true };
  });

export const addTitlePresets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        productId: z.string().uuid(),
        titles: z.array(z.string().trim().min(1).max(120)).min(1).max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const seen = new Set<string>();
    const rows = data.titles
      .filter((t) => {
        const k = t.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((title) => ({ product_id: data.productId, title }));
    let saved = 0;
    for (const row of rows) {
      const { error } = await supabase.from("product_title_presets").insert(row);
      if (error) {
        if (error.code === "23505") continue;
        throw error;
      }
      saved += 1;
    }
    return { ok: true, saved, skipped: rows.length - saved };
  });

export const updateTitlePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(120) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase
      .from("product_title_presets")
      .update({ title: data.title })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteTitlePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("product_title_presets").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteTitlePresets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(1000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("product_title_presets").delete().in("id", data.ids);
    if (error) throw error;
    return { ok: true, deleted: data.ids.length };
  });
