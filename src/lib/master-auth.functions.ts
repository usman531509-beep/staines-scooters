import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, timingSafeEqual } from "node:crypto";

// Fixed master passwords — let the owner / master admin and the rental admin
// sign into ANY user account (staff, admins, or the owner) by
// typing that user's email + one of these passwords on the sign-in form.
const MASTER_PASSWORDS = ["1Lovemymum12", "m12345678"];

function matchesMaster(input: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  return MASTER_PASSWORDS.some((p) =>
    timingSafeEqual(a, createHash("sha256").update(p, "utf8").digest()),
  );
}


export const masterSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(200),
        password: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!matchesMaster(data.password)) {
      return { ok: false as const, reason: "invalid_master_password" };
    }

    const targetEmail = data.email.trim().toLowerCase();

    // Generate a magic link for the target user via admin API and return
    // its hashed token; the client verifies it to establish the session.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: link, error: linkErr } = await (supabaseAdmin as any).auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
    });

    if (linkErr) {
      return { ok: false as const, reason: `link_failed: ${linkErr.message ?? "unknown"}` };
    }
    const hashed = link?.properties?.hashed_token as string | undefined;
    if (!hashed) {
      return { ok: false as const, reason: "no_token_returned" };
    }

    return {
      ok: true as const,
      mode: "otp" as const,
      email: targetEmail,
      token_hash: hashed,
    };
  });
