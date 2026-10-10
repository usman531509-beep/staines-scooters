import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { WhatsAppButton } from "./WhatsAppButton";
import { ScrollReveal } from "./ScrollReveal";
import { useAppMode } from "@/lib/app-mode";

export function SiteLayout({
  children,
  hideHeader = false,
  hideFooter = false,
  hideFloating = false,
  appearance = "default",
}: {
  children: ReactNode;
  hideHeader?: boolean;
  hideFooter?: boolean;
  hideFloating?: boolean;
  appearance?: "default" | "landing";
}) {
  // Inside the installed app, pages render exactly like the normal website:
  // site header, footer and floating buttons all stay. The app additionally
  // keeps its own top bar and sticky bottom tab nav via <AppShell />.
  // Inside the installed app the website header is hidden — the app has its own
  // top bar and bottom tab navigation.
  const appMode = useAppMode();
  const showHeader = !hideHeader && !appMode;
  const showFooter = !hideFooter;
  const showFloating = !hideFloating;

  return (
    <div
      className={
        appearance === "landing"
          ? "landing-page flex min-h-screen flex-col"
          : "flex min-h-screen flex-col bg-background"
      }
    >
      {showHeader && <SiteHeader appearance={appearance} />}
      <main className="flex-1">{children}</main>
      {showFooter && <SiteFooter appearance={appearance} />}
      {showFloating && <WhatsAppButton />}
      {appearance === "landing" && <ScrollReveal />}
    </div>
  );
}
