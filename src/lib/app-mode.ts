import { useSyncExternalStore } from "react";

// "App mode" = running inside the Capacitor native shell or installed PWA.
//
// Detection order (per render):
//   1) `window.Capacitor?.isNativePlatform?.()` — injected by the native shell.
//   2) `display-mode: standalone` — Microsoft Surface / Windows installed PWA.
//   3) Current URL contains `?app=1` — Capacitor's server.url uses this, and
//      we persist it to sessionStorage so client-side navigation keeps it for
//      the lifetime of the tab only (NOT localStorage — a one-time visit to
//      `?app=1` in a regular browser must not permanently hide site chrome).
//
// Plain mobile Safari / Chrome / desktop browser tabs are NEVER in app mode,
// so SiteLayout always renders the site header and footer for them.

const KEY = "hmc:app-mode";

function readInitial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // 1) Real Capacitor runtime
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) return true;

    // 2) Installed PWA / Add to Home Screen app window (Surface Pro, Android, iOS)
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return true;

    // 3) URL flag + per-tab persistence
    const url = new URL(window.location.href);
    if (url.searchParams.get("app") === "1") {
      window.sessionStorage.setItem(KEY, "1");
      return true;
    }
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

let cached: boolean | null = null;
function getSnapshot(): boolean {
  if (cached === null) cached = readInitial();
  return cached;
}
function getServerSnapshot(): boolean {
  return false;
}
function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    cached = readInitial();
    cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export function useAppMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function isAppMode(): boolean {
  return getSnapshot();
}

export function setAppMode(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.sessionStorage.setItem(KEY, "1");
    else window.sessionStorage.removeItem(KEY);
    // Clean up the legacy localStorage flag so previous visitors who ever
    // opened `?app=1` in their browser stop seeing the app-only chrome.
    window.localStorage.removeItem(KEY);
    cached = on;
  } catch {
    /* ignore */
  }
}

// One-time cleanup of the legacy persistent flag on module load in the browser.
if (typeof window !== "undefined") {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}
