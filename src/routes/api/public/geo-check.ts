import { createFileRoute } from "@tanstack/react-router";

// Blocks logins/registrations from India only. VPN/proxy/hosting is NOT
// checked — visitors on a VPN are allowed. Country is read from Cloudflare's
// `cf-ipcountry` header (the app runs on Cloudflare Workers).

const BLOCKED_COUNTRIES = new Set(["IN"]);

export const Route = createFileRoute("/api/public/geo-check")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cfCountry = (request.headers.get("cf-ipcountry") ?? "").toUpperCase();

        if (BLOCKED_COUNTRIES.has(cfCountry)) {
          return Response.json({ allowed: false, reason: "country", country: cfCountry });
        }

        return Response.json({ allowed: true });
      },
    },
  },
});
