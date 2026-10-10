import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

// Shown to every user (staff, admins and site visitors) on any device when a newer
// build of the app exists but the automatic reload could not take effect.
export function UpdateAppPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    import("@/lib/app-updater")
      .then(({ startAppUpdater }) => {
        if (cancelled) return;
        stop = startAppUpdater({
          intervalMs: 60_000,
          onUpdateBlocked: () => setShow(true),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-lg">
        <p className="text-sm font-semibold text-foreground">A new version is available</p>
        <p className="mt-1 text-xs text-ink-muted">
          Update now to see the latest pages, prices and details.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const { hardReloadForUpdate } = await import("@/lib/app-updater");
            await hardReloadForUpdate();
          }}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 py-3 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {busy ? "Updating…" : "Update app now"}
        </button>
      </div>
    </div>
  );
}
