import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

// Sign in with phone number + password. Resolves phone → email server-side
// (never returning the email to the client) then performs a normal password
// sign-in and returns the session for the client to set.
export const phoneSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      phone: z.string().trim().min(5).max(30),
      password: z.string().min(1).max(200),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL!;
    const pubKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const normalized = data.phone.replace(/\D/g, "");
    if (!normalized) return { ok: false as const, reason: "invalid_phone" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Resolve phone → email using the service role (kept server-side only).
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("email, phone")
      .not("phone", "is", null);
    const match = (profiles ?? []).find(
      (p: any) => String(p.phone ?? "").replace(/\D/g, "") === normalized,
    );
    if (!match?.email) return { ok: false as const, reason: "not_found" };

    const publicClient = createClient(url, pubKey, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data: signIn, error } = await publicClient.auth.signInWithPassword({
      email: match.email,
      password: data.password,
    });
    if (error || !signIn?.session) return { ok: false as const, reason: "invalid_credentials" };
    return {
      ok: true as const,
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    };
  });
