import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const checkEmailExists = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ email: z.string().trim().email() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (error) {
      // On error, don't block — let reset proceed silently.
      return { exists: true };
    }
    return { exists: !!profile };
  });
