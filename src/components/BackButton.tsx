import { ChevronLeft } from "lucide-react";
import { useRouter, useRouterState } from "@tanstack/react-router";

// Paths that are top-level "home" surfaces per role — no back button needed there.
const ROOT_PATHS = new Set<string>([
  "/",
  "/admin",
  "/staff/pos",
  "/auth",
]);

export function BackButton({
  className = "",
  fallback = "/staff/pos",
  label = "Back",
  compact = false,
}: {
  className?: string;
  fallback?: string;
  label?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (ROOT_PATHS.has(pathname)) return null;

  function goBack() {
    const hasHistory =
      typeof window !== "undefined" && window.history.length > 1;
    if (hasHistory) {
      router.history.back();
    } else {
      router.navigate({ to: fallback });
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Go back"
      className={
        "inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface-elevated text-[10px] font-semibold uppercase tracking-widest text-foreground hover:border-primary hover:text-primary active:scale-95 " +
        (compact ? "px-2 py-1.5" : "px-3 py-2 ") +
        className
      }
    >
      <ChevronLeft className={compact ? "h-4 w-4" : "h-4 w-4"} />
      {!compact && <span>{label}</span>}
    </button>
  );
}
