import { createServerFn } from "@tanstack/react-start";
import { STORAGE_BUCKET } from "@/lib/storage-bucket";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Upload a profile avatar for the current user. Accepts a base64 data URL
// (client-compressed), stores it in the private `user-avatars` bucket under
// the user's own folder, and saves the storage path on public.profiles.
export const uploadMyAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      dataUrl: z.string().min(20).max(6_000_000),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId as string;
    const m = data.dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/);
    if (!m) throw new Error("Invalid image data");
    const ext = m[2] === "jpg" ? "jpeg" : m[2];
    const bytes = Buffer.from(m[3], "base64");
    if (bytes.byteLength > 3_000_000) throw new Error("Image too large (max 3MB)");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `avatars/${userId}/${Date.now()}.${ext}`;
    const up = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(path, bytes, { contentType: m[1], upsert: true });
    if (up.error) throw new Error(up.error.message);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    const signed = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    return { ok: true, path, url: signed.data?.signedUrl ?? "" };
  });

// Return a signed URL for the current user's avatar (or a specified user's,
// if the caller is staff). Returns empty string when no avatar is set.
export const getMyAvatarUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ userId: z.string().uuid().optional() }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    const callerId = (context as any).userId as string;
    const targetId = data.userId ?? callerId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (targetId !== callerId) {
      const { data: role } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId)
        .in("role", ["owner", "admin", "staff"])
        .maybeSingle();
      if (!role) throw new Error("Forbidden");
    }
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("avatar_url")
      .eq("id", targetId)
      .maybeSingle();
    const path = profile?.avatar_url;
    if (!path) return { url: "" };
    if (/^https?:/i.test(path)) return { url: path };
    const signed = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    return { url: signed.data?.signedUrl ?? "" };
  });
