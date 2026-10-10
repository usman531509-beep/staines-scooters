import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { normalizePassword } from "./password";

// Sign in with any identifier a staff member might know: their email or the
// phone number stored on their profile.
//
// The password is normalised ONCE (same normalisation used at registration and
// password reset) and tried exactly once per resolved account. Trying many
// variants produced dozens of failed logins per attempt and tripped the auth
// service's rate limit, which rejected even correct passwords.


export const identifierSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        identifier: z.string().trim().min(1).max(200),
        password: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL!;
    const pubKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const raw = data.identifier.trim();
    const lower = raw.toLowerCase();
    const digits = raw.replace(/\D/g, "");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const candidates: string[] = [];
    const push = (e?: string | null) => {
      const v = String(e ?? "").trim().toLowerCase();
      if (v && v.includes("@") && !candidates.includes(v)) candidates.push(v);
    };

    if (lower.includes("@")) push(lower);

    // Phone number → profile email (match on the last 9 digits so ±44 / 0
    // prefixes still resolve, without loading every profile).
    if (digits.length >= 5) {
      const { data: profiles } = await (supabaseAdmin as any)
        .from("profiles")
        .select("email, phone")
        .ilike("phone", `%${digits.slice(-9)}%`)
        .limit(20);
      for (const p of profiles ?? []) {
        if (String(p.phone ?? "").replace(/\D/g, "").endsWith(digits.slice(-9))) push(p.email);
      }
    }

    if (!candidates.length) return { ok: false as const, reason: "not_found" };

    const publicClient = createClient(url, pubKey, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });

    // Normalise once (identical to registration / password reset) instead of
    // trying a dozen guesses per account.
    const password = normalizePassword(data.password) || data.password;

    // Resolve the auth user id for an email straight from auth.users (the
    // profiles table can be missing/stale for admin-created accounts).
    const findAuthUserId = async (email: string): Promise<string | null> => {
      for (let page = 1; page <= 10; page++) {
        const { data: list, error } = await (supabaseAdmin as any).auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (error) return null;
        const users = list?.users ?? [];
        const found = users.find((u: any) => String(u.email ?? "").toLowerCase() === email);
        if (found) return found.id as string;
        if (users.length < 200) return null;
      }
      return null;
    };

    let sawUnconfirmed = false;

    for (const email of candidates) {
      const { data: signIn, error: signInError } = await publicClient.auth.signInWithPassword({
        email,
        password,
      });
      if (signIn?.session) {
        return {
          ok: true as const,
          access_token: signIn.session.access_token,
          refresh_token: signIn.session.refresh_token,
        };
      }
      // Some legacy/admin-created accounts have a valid password but their
      // auth email was never confirmed. The auth service only returns this
      // error after validating the submitted credentials, so confirm that
      // exact account and retry once instead of misreporting a bad password.
      if (signInError?.code === "email_not_confirmed") {
        sawUnconfirmed = true;
        const targetId = await findAuthUserId(email);
        if (targetId) {
          const { error: confirmError } = await (supabaseAdmin as any).auth.admin.updateUserById(
            targetId,
            { email_confirm: true },
          );
          if (!confirmError) {
            const { data: retried } = await publicClient.auth.signInWithPassword({
              email,
              password,
            });
            if (retried?.session) {
              return {
                ok: true as const,
                access_token: retried.session.access_token,
                refresh_token: retried.session.refresh_token,
              };
            }
          }
        }
      }
      // Rate limited — stop hammering the auth service and report it clearly.
      if (signInError?.status === 429) {
        return { ok: false as const, reason: "rate_limited" };
      }
    }

    return {
      ok: false as const,
      reason: sawUnconfirmed ? "email_not_confirmed" : "invalid_credentials",
    };
  });
