// Keeps the installed app (Windows PWA, Android, iOS, macOS, native shell)
// on the newest build without the user reinstalling or clearing caches.
//
// Two independent signals:
//  1) Service-worker update check (reg.update()) — a waiting worker means a
//     new build is ready.
//  2) Build fingerprint poll — fetch the app HTML with cache:"no-store" and
//     compare the hashed entry script URLs. A different fingerprint means a
//     new deploy (new navigation modules, new pages, new content).
//
// A sale in progress is never interrupted: the reload waits until it finishes.

const saleInProgress = () =>
  typeof window !== "undefined" && (window as unknown as { __hmSaleInProgress?: boolean }).__hmSaleInProgress === true;

let reloading = false;

// Wipes every cache this app controls and unregisters service workers, then
// reloads — used by the "Update app now" button so a stuck installed app can
// never keep serving an old build.
export async function hardReloadForUpdate(): Promise<void> {
  if (typeof window === "undefined") return;
  reloading = true;
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(
        regs.map(async (reg) => {
          if (reg.waiting) {
            try { reg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch { /* ignore */ }
          }
          await reg.update().catch(() => {});
        }),
      );
    }
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.allSettled(keys.filter((k) => k.startsWith("hm-")).map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  const url = new URL(window.location.href);
  url.searchParams.set("v", String(Date.now()));
  window.location.replace(url.toString());
}

function reloadWhenSafe(onBlocked?: () => void) {
  if (reloading) return;
  if (saleInProgress()) {
    onBlocked?.();
    const retry = window.setInterval(() => {
      if (reloading) { window.clearInterval(retry); return; }
      if (!saleInProgress()) { window.clearInterval(retry); reloadWhenSafe(onBlocked); }
    }, 5000);
    return;
  }
  reloading = true;
  window.location.reload();
}

// Fingerprint of the build currently running in this tab.
export function localFingerprint(): string | null {
  if (typeof document === "undefined") return null;
  const srcs = Array.from(document.querySelectorAll("script[src]")).map((s) => s.getAttribute("src") ?? "");
  const mods = Array.from(document.querySelectorAll('link[rel="modulepreload"][href]')).map(
    (l) => l.getAttribute("href") ?? "",
  );
  const all = [...srcs, ...mods].filter(Boolean).sort();
  return all.length ? all.join("|") : null;
}

export async function fetchFingerprint(): Promise<string | null> {
  try {
    const res = await fetch(`/?v=${Date.now()}`, {
      cache: "no-store",
      headers: { "cache-control": "no-cache", "x-hm-version-check": "1" },
    });

    if (!res.ok) return null;
    const html = await res.text();
    const srcs = Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g)).map((m) => m[1]);
    const modules = Array.from(html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)).map((m) => m[1]);
    const all = [...srcs, ...modules].filter(Boolean).sort();
    return all.length ? all.join("|") : null;
  } catch {
    return null;
  }
}

type UpdaterOptions = {
  intervalMs?: number;
  // Called as soon as a newer build is detected. Receives a function that
  // performs the safe automatic reload.
  onUpdateAvailable?: () => void;
  // Called when the automatic reload could not happen (sale in progress, or
  // it simply didn't take effect) so the UI can offer a manual button.
  onUpdateBlocked?: () => void;
};

// Set by startAppUpdater so any part of the app (e.g. every route change) can
// force a fresh version check — the equivalent of Ctrl+F5 on every page.
let activeCheck: (() => Promise<void>) | null = null;
let lastCheckAt = 0;

export function checkForUpdateNow(minGapMs = 3000): void {
  if (typeof window === "undefined" || !activeCheck) return;
  const now = Date.now();
  if (now - lastCheckAt < minGapMs) return;
  lastCheckAt = now;
  void activeCheck();
}

export function startAppUpdater(options: number | UpdaterOptions = 60_000): () => void {
  if (typeof window === "undefined") return () => {};
  const opts: UpdaterOptions = typeof options === "number" ? { intervalMs: options } : options;
  const intervalMs = opts.intervalMs ?? 60_000;


  let baseline: string | null = null;
  let checking = false;
  let announced = false;

  const announce = () => {
    if (announced) return;
    announced = true;
    opts.onUpdateAvailable?.();
  };

  const check = async () => {
    if (checking || reloading) return;
    checking = true;
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update().catch(() => {});
          if (reg.waiting && navigator.serviceWorker.controller) {
            announce();
            try { reg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch { /* ignore */ }
          }
        }
      }
      const fp = await fetchFingerprint();
      if (!fp) return;
      if (baseline === null) { baseline = fp; return; }
      if (fp !== baseline) {
        baseline = fp;
        announce();
        // Give the app a moment to settle, then reload; if that can't happen
        // the UI shows the manual "Update app now" button.
        window.setTimeout(() => reloadWhenSafe(opts.onUpdateBlocked), 1200);
        window.setTimeout(() => { if (!reloading) opts.onUpdateBlocked?.(); }, 8000);
      }
    } finally {
      checking = false;
    }
  };

  activeCheck = check;
  void check();
  const timer = window.setInterval(() => { void check(); }, intervalMs);

  const onVisible = () => { if (document.visibilityState === "visible") void check(); };
  const onFocus = () => { void check(); };
  const onOnline = () => { void check(); };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onFocus);
  window.addEventListener("online", onOnline);
  window.addEventListener("pageshow", onFocus);

  return () => {
    if (activeCheck === check) activeCheck = null;
    window.clearInterval(timer);

    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("pageshow", onFocus);
  };
}
