// Loud beep using WebAudio — no asset needed.
let ctx: AudioContext | null = null;

export function beep(opts?: { frequency?: number; durationMs?: number; volume?: number }) {
  if (typeof window === "undefined") return;
  const frequency = opts?.frequency ?? 1000;
  const durationMs = opts?.durationMs ?? 160;
  const volume = opts?.volume ?? 1.0;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    // quick attack, hold, quick release to avoid clicks but stay loud
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.setValueAtTime(volume, now + durationMs / 1000 - 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.start(now);
    osc.stop(now + durationMs / 1000);
  } catch {
    // ignore
  }
}
