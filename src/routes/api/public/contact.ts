import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().min(5).max(30),
  bike: z.string().trim().max(80).optional().default(""),
  reg: z.string().trim().max(20).optional().default(""),
  service: z.string().trim().max(80).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
  // Hidden honeypot field: people never see it, form-filling bots do.
  website: z.string().max(200).optional().default(""),
});

// Saves the public contact form as an enquiry for staff to follow up in /admin/enquiries.
export const Route = createFileRoute("/api/public/contact")({
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
          return Response.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
        }
        const { website, ...data } = parsed.data;
        if (website) return Response.json({ success: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("contact_enquiries").insert({
          name: data.name,
          email: data.email.toLowerCase(),
          phone: data.phone,
          bike: data.bike || null,
          reg: data.reg ? data.reg.toUpperCase() : null,
          service: data.service || null,
          message: data.message || null,
        });
        if (error) {
          console.error("contact enquiry save failed", error);
          return Response.json({ error: "Could not send enquiry" }, { status: 500 });
        }
        const { notifyStaff } = await import("@/lib/notify.server");
        void notifyStaff(
          `New website enquiry from ${data.name}`,
          [
            ["Name", data.name],
            ["Phone", data.phone],
            ["Email", data.email],
            ["Service", data.service],
            ["Bike", data.bike],
            ["Registration", data.reg ? data.reg.toUpperCase() : null],
            ["Message", data.message],
          ],
          { replyTo: data.email },
        );
        return Response.json({ success: true });
      },
    },
  },
});
