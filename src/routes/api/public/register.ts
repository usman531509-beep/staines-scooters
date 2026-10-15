import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your full name").max(120, "That name is too long"),
  phone: z.string().trim().min(7, "Please enter a valid phone number").max(30, "Please enter a valid phone number"),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .default("")
    .refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email address"),
  // Hidden honeypot field: people never see it, form-filling bots do.
  website: z.string().max(200).optional().default(""),
});

const digits = (s: string) => s.replace(/\D/g, "");

/**
 * Public customer registration. Adds the person to the till's customer list
 * (pos_customers, shown in the admin Customers page) — a contact record only,
 * with no password or sign-in. Registrations from the website have no
 * `created_by`, which is how the admin list tells them apart from till entries.
 */
export const Route = createFileRoute("/api/public/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
        }
        const { website, ...data } = parsed.data;
        if (website) return Response.json({ success: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Same phone number already on file: don't create a duplicate.
        const { data: existing, error: findError } = await supabaseAdmin
          .from("pos_customers")
          .select("id, phone")
          .is("deleted_at", null)
          .ilike("phone", `%${digits(data.phone).slice(-6)}%`)
          .limit(50);
        if (findError) {
          console.error("registration lookup failed", findError);
          return Response.json({ error: "Could not register right now" }, { status: 500 });
        }
        if ((existing ?? []).some((c) => digits(c.phone).slice(-10) === digits(data.phone).slice(-10))) {
          return Response.json({ success: true, alreadyRegistered: true });
        }

        const { error } = await supabaseAdmin.from("pos_customers").insert({
          name: data.name,
          phone: data.phone,
          email: data.email ? data.email.toLowerCase() : null,
        });
        if (error) {
          console.error("registration save failed", error);
          return Response.json({ error: "Could not register right now" }, { status: 500 });
        }
        return Response.json({ success: true });
      },
    },
  },
});
