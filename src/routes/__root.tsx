import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { UpdateAppPrompt } from "../components/UpdateAppPrompt";
import { BRAND } from "@/lib/brand";
import { publicEnvScript } from "@/lib/public-env";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-3 font-display text-7xl text-foreground">Wrong Turn</h1>
        <p className="mt-3 text-sm text-ink-muted">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-sm bg-primary px-5 py-3 text-xs font-semibold uppercase tracking-widest text-primary-foreground hover:-translate-y-0.5 transition-transform"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl tracking-wide text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Something went wrong on our end. You can try again or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-sm bg-primary px-5 py-3 text-xs font-semibold uppercase tracking-widest text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-sm border border-border px-5 py-3 text-xs font-semibold uppercase tracking-widest text-foreground hover:border-primary"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover" },
      { title: `${BRAND.name} — Scooter Sales, Rental, Repairs & Accident Claims` },
      { name: "description", content: "Scooter sales, weekly rental, repairs and accident claim support in Staines-upon-Thames. Honda Vision, SH Mode, PCX and Yamaha NMAX." },
      { name: "author", content: BRAND.name },
      { property: "og:title", content: `${BRAND.name} — Scooter Sales, Rental, Repairs & Accident Claims` },
      { property: "og:description", content: "Scooter sales, weekly rental, repairs and accident claim support in Staines-upon-Thames. Honda Vision, SH Mode, PCX and Yamaha NMAX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: `${BRAND.name} — Scooter Sales, Rental, Repairs & Accident Claims` },
      { name: "twitter:description", content: "Scooter sales, weekly rental, repairs and accident claim support in Staines-upon-Thames. Honda Vision, SH Mode, PCX and Yamaha NMAX." },
      { name: "apple-mobile-web-app-title", content: BRAND.name },
      { name: "application-name", content: BRAND.name },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/app-icon.png" },
      { rel: "apple-touch-icon", href: "/app-icon.png" },

      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    // Browser extensions (zoom, dark mode) add classes to <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before the app bundle, so the Supabase client can start on hosts that set env vars only at runtime. */}
        <script dangerouslySetInnerHTML={{ __html: publicEnvScript() }} suppressHydrationWarning />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Check for a newer build once on start. Further checks run on a timer and
  // when the tab regains focus (UpdateAppPrompt), not on every navigation:
  // each check fetches a full page, which made switching sections slow.
  useEffect(() => {
    import("../lib/app-updater")
      .then(({ checkForUpdateNow }) => checkForUpdateNow(0))
      .catch(() => {});
  }, []);

  useEffect(() => {

    // Dev serves unbundled modules; a service worker there only gets in the way.
    if (import.meta.env.PROD && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      // Register, then keep the installed app (phone / tablet / Surface) up to
      // date automatically: check for a new build on start, on resume and every
      // 15 minutes, and reload once the new service worker takes control.
      let reloading = false;
      const hadController = !!navigator.serviceWorker.controller;
      const saleInProgress = () => (window as any).__hmSaleInProgress === true;
      const doReload = () => {
        if (reloading) return;
        if (saleInProgress()) return; // retry later — never interrupt a sale
        reloading = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // First-ever install claims the page; no new version to load.
        if (!hadController) return;
        doReload();
        // If a sale was in progress, apply the update once it's finished.
        const retry = window.setInterval(() => {
          if (reloading) { window.clearInterval(retry); return; }
          if (!saleInProgress()) { window.clearInterval(retry); doReload(); }
        }, 5000);
      });
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          const check = () => { void reg.update().catch(() => {}); };
          check();
          const onVis = () => { if (document.visibilityState === "visible") check(); };
          document.addEventListener("visibilitychange", onVis);
          window.addEventListener("online", check);
          window.setInterval(check, 15 * 60 * 1000);
        })
        .catch(() => {});
    }

    // The update checker itself runs inside <UpdateAppPrompt />, which also
    // shows the manual "Update app now" button if the auto reload is blocked.

    // Keep staff signed in across app restarts / iOS storage eviction.
    import("../lib/session-persist").then(({ initSessionPersistence }) => {
      initSessionPersistence();
    }).catch(() => {});

    // Restore & persist the product catalogue cache to IndexedDB so the
    // POS/products screens paint instantly on reload.
    import("../lib/query-persist").then(({ installQueryPersistence }) => {
      installQueryPersistence(queryClient);
    }).catch(() => {});
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <UpdateAppPrompt />
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}
