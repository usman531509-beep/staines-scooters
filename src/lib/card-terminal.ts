/**
 * Talks to the card machine over the shop's own network.
 * The POS runs in the browser on the same Wi‑Fi as the terminal, so the
 * request goes straight from this device to the terminal's IP address.
 */
export type TerminalResult = {
  status: "approved" | "declined" | "cancelled" | "error";
  message?: string;
  authCode?: string | null;
  cardScheme?: string | null;
  cardLast4?: string | null;
  raw?: any;
};

const APPROVED = ["approved", "authorised", "authorized", "success", "ok", "accepted", "00"];
const DECLINED = ["declined", "decline", "refused", "failed", "not_authorised"];
const CANCELLED = ["cancelled", "canceled", "aborted", "timeout", "voided"];

function classify(text: string): TerminalResult["status"] {
  const t = text.toLowerCase();
  if (APPROVED.some((k) => t.includes(k))) return "approved";
  if (DECLINED.some((k) => t.includes(k))) return "declined";
  if (CANCELLED.some((k) => t.includes(k))) return "cancelled";
  return "error";
}

/** Push an amount to the terminal and wait for the customer to tap / insert. */
export async function sendToTerminal(
  endpoint: string,
  payload: Record<string, unknown>,
  timeoutMs = 120_000,
): Promise<TerminalResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      mode: "cors",
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* terminal replied in plain text */
    }
    if (!res.ok && !json) return { status: "error", message: `Terminal replied ${res.status}`, raw: text };
    const statusText = String(json?.status ?? json?.result ?? json?.responseCode ?? text ?? "");
    return {
      status: classify(statusText),
      message: json?.message ?? json?.displayMessage ?? statusText.slice(0, 200),
      authCode: json?.authCode ?? json?.authorisationCode ?? null,
      cardScheme: json?.cardScheme ?? json?.scheme ?? json?.cardType ?? null,
      cardLast4: json?.cardLast4 ?? json?.last4 ?? json?.pan?.slice?.(-4) ?? null,
      raw: json ?? text,
    };
  } catch (e: any) {
    const aborted = e?.name === "AbortError";
    return {
      status: aborted ? "cancelled" : "error",
      message: aborted
        ? "The card machine did not respond in time."
        : "Could not reach the card machine. Check it is switched on and on the same Wi‑Fi as this device.",
    };
  } finally {
    clearTimeout(timer);
  }
}
