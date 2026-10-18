/**
 * Public Supabase settings (URL + publishable key) for the browser.
 *
 * VITE_* variables are baked into the bundle at build time, but some hosts only
 * provide environment variables to the running server. The server therefore
 * writes these two public values into the page (see RootShell), and the
 * browser reads them from there when the build-time values are missing.
 */
export type PublicSupabaseEnv = { url?: string; key?: string };

declare global {
  interface Window {
    __SUPABASE_PUBLIC_ENV__?: PublicSupabaseEnv;
  }
}

export function publicSupabaseEnv(): PublicSupabaseEnv {
  if (typeof window !== "undefined") return window.__SUPABASE_PUBLIC_ENV__ ?? {};
  return {
    url: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY,
  };
}

/** Inline script that hands the server's public Supabase settings to the browser. */
export function publicEnvScript(): string {
  return `window.__SUPABASE_PUBLIC_ENV__=${JSON.stringify(publicSupabaseEnv()).replace(/</g, "\\u003c")};`;
}
