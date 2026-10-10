// Server-only DVSA MOT History lookup for rental bikes (expiry dates for the fleet).
//
// Credentials live in server env vars only (DVSA_CLIENT_ID / DVSA_CLIENT_SECRET /
// DVSA_API_KEY / DVSA_TOKEN_URL / DVSA_SCOPE_URL) and are never sent to the browser.
//
// Auth: OAuth2 client-credentials against Microsoft Entra, plus the X-API-Key header.
// Endpoint: GET https://history.mot.api.gov.uk/v1/trade/vehicles/registration/{reg}

const API_BASE = "https://history.mot.api.gov.uk/v1/trade/vehicles/registration";

let tokenCache: { token: string; expiresAt: number } | null = null;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

/** Strip spaces/punctuation and upper-case: "ab12 cde" -> "AB12CDE". */
function normalizeReg(input: string | null | undefined): string | null {
  const n = (input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return n.length >= 2 ? n : null;
}

function dvsaConfigured(): boolean {
  return !!(process.env["DVSA_CLIENT_ID"] && process.env["DVSA_CLIENT_SECRET"] && process.env["DVSA_API_KEY"]);
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env("DVSA_CLIENT_ID"),
    client_secret: env("DVSA_CLIENT_SECRET"),
    scope: process.env["DVSA_SCOPE_URL"] || "https://tapi.dvsa.gov.uk/.default",
  });
  const res = await fetch(env("DVSA_TOKEN_URL"), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`DVSA token request failed (${res.status})`);
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("DVSA token response had no token");
  tokenCache = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3000) * 1000 };
  return tokenCache.token;
}

export type RentalMotLookup =
  | { outcome: "ok"; vehicle: { motExpiryDate: string | null; motTestDueDate: string | null } }
  | { outcome: "not_found" | "invalid_registration" | "auth_error" | "rate_limited" | "unavailable"; message: string };

/** Expiry of the most recent passed MOT, or null when there is none. */
function latestPassedExpiry(tests: any[]): string | null {
  const sorted = [...tests].sort((a, b) => Date.parse(b?.completedDate ?? 0) - Date.parse(a?.completedDate ?? 0));
  const passed = sorted.find((t) => /pass/i.test(String(t?.testResult ?? "")) && t?.expiryDate);
  return passed?.expiryDate ? String(passed.expiryDate).slice(0, 10) : null;
}

/** Look up one registration. Never throws — every failure maps to an outcome. */
export async function lookupMot(registration: string): Promise<RentalMotLookup> {
  const reg = normalizeReg(registration);
  if (!reg) return { outcome: "invalid_registration", message: "Registration is not usable" };
  if (!dvsaConfigured()) return { outcome: "unavailable", message: "DVSA credentials are not configured" };

  let token: string;
  try {
    token = await getAccessToken();
  } catch (e: any) {
    tokenCache = null;
    return { outcome: "auth_error", message: String(e?.message ?? e) };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${encodeURIComponent(reg)}`, {
      headers: { Authorization: `Bearer ${token}`, "X-API-Key": env("DVSA_API_KEY"), accept: "application/json" },
    });
  } catch (e: any) {
    return { outcome: "unavailable", message: `Network error: ${String(e?.message ?? e)}` };
  }

  if (res.status === 404) return { outcome: "not_found", message: "DVSA has no record for this registration" };
  if (res.status === 400) return { outcome: "invalid_registration", message: "DVSA rejected this registration" };
  if (res.status === 401 || res.status === 403) {
    tokenCache = null;
    return { outcome: "auth_error", message: `DVSA authentication failed (${res.status})` };
  }
  if (res.status === 429) return { outcome: "rate_limited", message: "DVSA rate limit reached" };
  if (!res.ok) return { outcome: "unavailable", message: `DVSA responded ${res.status}` };

  let json: any;
  try {
    json = await res.json();
  } catch {
    return { outcome: "unavailable", message: "DVSA response was not readable" };
  }

  const tests = Array.isArray(json?.motTests) ? json.motTests : [];
  const dueDate = json?.motTestDueDate ? String(json.motTestDueDate).slice(0, 10) : null;
  // A never-tested bike has no test expiry — its first-MOT due date is what matters.
  return { outcome: "ok", vehicle: { motExpiryDate: latestPassedExpiry(tests) ?? dueDate, motTestDueDate: dueDate } };
}
