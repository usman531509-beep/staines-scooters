import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, RefreshCw, X } from "lucide-react";
import { APP_CHANGELOG, APP_VERSION } from "@/lib/app-changelog";

const BTN =
  "inline-flex h-7 items-center rounded-sm border border-border bg-surface-elevated px-2.5 text-[10px] font-semibold uppercase tracking-wider text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50";
const BTN_RED =
  "inline-flex h-7 items-center rounded-sm border border-primary bg-primary px-2.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";

const FLAG = "hm-update-applied";

type Phase = "idle" | "checking" | "updating" | "uptodate" | "done";

export function UpdateAppButton() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");

  // After the reload triggered by an update, show what changed.
  useEffect(() => {
    try {
      if (localStorage.getItem(FLAG)) {
        localStorage.removeItem(FLAG);
        setPhase("done");
        setProgress(100);
        setStep("Update complete");
        setOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const run = async () => {
    setOpen(true);
    setPhase("checking");
    setProgress(10);
    setStep("Checking for a newer version…");
    const { fetchFingerprint, localFingerprint, hardReloadForUpdate } = await import("@/lib/app-updater");

    setProgress(30);
    const remote = await fetchFingerprint();
    const local = localFingerprint();

    let waiting = false;
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update().catch(() => {});
          waiting = Boolean(reg.waiting || reg.installing);
        }
      }
    } catch {
      /* ignore */
    }

    setProgress(55);
    const newer = waiting || (Boolean(remote) && Boolean(local) && remote !== local);

    if (!newer) {
      setPhase("uptodate");
      setProgress(100);
      setStep("You have the updated version");
      return;
    }

    setPhase("updating");
    setStep("Downloading the new version…");
    setProgress(70);
    try {
      localStorage.setItem(FLAG, JSON.stringify({ at: Date.now(), version: APP_VERSION }));
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 400));
    setStep("Clearing old files and reinstalling…");
    setProgress(90);
    await hardReloadForUpdate();
  };

  const latest = APP_CHANGELOG[0];

  return (
    <>
      <button onClick={run} className={BTN} title="Update the installed app to the newest version">
        Update app
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-sm border border-border bg-card p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Update app</h3>
                <p className="text-[10px] uppercase tracking-widest text-ink-muted">Version {APP_VERSION}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-ink-muted hover:text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              {phase === "checking" || phase === "updating" ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              )}
              <span>{step}</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            {phase === "uptodate" && (
              <p className="mt-3 text-xs text-ink-muted">
                This device is already running the latest version — nothing to install.
              </p>
            )}

            {(phase === "done" || phase === "uptodate") && latest && (
              <div className="mt-4 rounded-sm border border-border bg-surface-elevated p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
                  What&apos;s in version {latest.version} · {latest.date}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-foreground">
                  {latest.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              {phase === "uptodate" && (
                <button onClick={run} className={BTN}>
                  <RefreshCw className="mr-1 h-3 w-3" /> Check again
                </button>
              )}
              <button onClick={() => setOpen(false)} className={BTN_RED}>
                {phase === "updating" || phase === "checking" ? "Hide" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
