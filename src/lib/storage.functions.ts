import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Signs a product-images bucket path (product OR category thumbnails) for the
// caller. Uses the service-role client so signing can't be blocked by a
// transient RLS/auth hiccup — the caller is already an authenticated staff
// member (middleware) and the objects are private assets of the shop.
export const getSignedProductImageUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ path: z.string().trim().min(1).max(1000) }).parse(i))
  .handler(async ({ data }) => {
    // Already an absolute / data / blob / root-relative URL — nothing to sign.
    if (/^(https?:|data:|blob:|\/)/i.test(data.path)) return data.path;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin
      .storage
      .from("product-images")
      .createSignedUrl(data.path, 60 * 60 * 24 * 365);
    if (error || !signed?.signedUrl) {
      // Fall back to the public URL — if the bucket is private the browser
      // shows the tile's "No image" fallback instead of erroring out.
      const { data: pub } = supabaseAdmin.storage.from("product-images").getPublicUrl(data.path);
      return pub?.publicUrl ?? "";
    }
    return signed.signedUrl;
  });
