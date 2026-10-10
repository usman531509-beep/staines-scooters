import { createFileRoute, redirect } from "@tanstack/react-router";
import { setAppMode } from "@/lib/app-mode";

// Legacy app sign-in URL. Consolidated with the website /auth page so the
// mobile / installed app and the website share a single staff sign-in
// screen. Preserve any query string (e.g. ?app=1) on the way.
export const Route = createFileRoute("/appsign")({
  beforeLoad: ({ location }) => {
    if (typeof window !== "undefined") {
      try { setAppMode(true); } catch { /* ignore */ }
    }
    throw redirect({ to: "/auth", search: location.search as any });
  },
  component: () => null,
});
