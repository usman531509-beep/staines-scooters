import { supabase } from "@/integrations/supabase/client";

// Long-lived session backup.
//
// iOS Safari (and the WKWebView used by the installed app) evicts
// script-written localStorage after ~7 days of inactivity, which silently signs
// staff out. We keep our own copy of the refresh token in a second place
// (a long-life cookie plus a separate localStorage key) and restore it on app
// start whenever the Supabase client has no session. Staff then stay
// signed in on iPhone, iPad and Mac without retyping their password.

const KEY = "hmc-session-backup";
const COOKIE = "hmc_rt";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

type Backup = { access_token: string; refresh_token: string };

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

// Native (installed app) storage — Capacitor Preferences writes to iOS
// UserDefaults / Android SharedPreferences, which survives app exit, phone
// restart and Safari's 7-day script-storage eviction. Loaded lazily so the
// web build never depends on it.
async function nativeStore(): Promise<any | null> {
  try {
    const cap = (window as any).Capacitor;
    if (!cap?.isNativePlatform?.()) return null;
    const { Preferences } = await import("@capacitor/preferences");
    return Preferences;
  } catch {
    return null;
  }
}

async function nativeSet(value: string) {
  const p = await nativeStore();
  if (p) await p.set({ key: KEY, value });
}

async function nativeGet(): Promise<string | null> {
  const p = await nativeStore();
  if (!p) return null;
  const { value } = await p.get({ key: KEY });
  return value ?? null;
}

async function nativeRemove() {
  const p = await nativeStore();
  if (p) await p.remove({ key: KEY });
}

export function saveSessionBackup(session: { access_token?: string; refresh_token?: string } | null) {
  if (typeof window === "undefined") return;
  try {
    if (session?.access_token && session.refresh_token) {
      const payload: Backup = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      };
      const raw = JSON.stringify(payload);
      window.localStorage.setItem(KEY, raw);
      writeCookie(COOKIE, session.refresh_token);
      void nativeSet(raw);
    }
  } catch {
    /* storage unavailable (private mode) — ignore */
  }
}

export function clearSessionBackup() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  clearCookie(COOKIE);
  void nativeRemove();
}

async function restore(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    saveSessionBackup(data.session);
    return;
  }

  let backup: Backup | null = null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) backup = JSON.parse(raw) as Backup;
  } catch {
    /* ignore */
  }
  if (!backup) {
    // Installed app: fall back to native storage, which is never evicted.
    try {
      const raw = await nativeGet();
      if (raw) backup = JSON.parse(raw) as Backup;
    } catch {
      /* ignore */
    }
  }
  const refresh = backup?.refresh_token ?? readCookie(COOKIE);
  if (!refresh) return;

  const { data: restored, error } = await supabase.auth.setSession({
    access_token: backup?.access_token ?? "",
    refresh_token: refresh,
  });
  if (error || !restored.session) {
    // Only drop the backup when the token was definitively rejected; keep it
    // through offline/network failures so the user stays signed in.
    const msg = String((error as any)?.message ?? "").toLowerCase();
    const status = (error as any)?.status as number | undefined;
    if (status === 400 || status === 401 || msg.includes("invalid") || msg.includes("expired")) {
      clearSessionBackup();
    }
    return;
  }
  saveSessionBackup(restored.session);
}

let started = false;

// Call once on app start (client only).
export function initSessionPersistence() {
  if (typeof window === "undefined" || started) return;
  started = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      clearSessionBackup();
      return;
    }
    if (session) saveSessionBackup(session);
  });

  void restore();

  // Re-check when the app comes back to the foreground (installed app resume).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void restore();
  });
  window.addEventListener("focus", () => void restore());
  window.addEventListener("online", () => void restore());
  document.addEventListener("resume", () => void restore());

  // Keep the refresh token fresh so it never ages out while the app sits idle.
  window.setInterval(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) saveSessionBackup(data.session);
      else await restore();
    })();
  }, 30 * 60 * 1000);
}

