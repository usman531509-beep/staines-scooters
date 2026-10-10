import { useSyncExternalStore } from "react";

const KEY = "nav:hidden";
type Listener = () => void;
const listeners = new Set<Listener>();

function read(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(KEY) === "1"; } catch { return false; }
}

let current = read();

function emit() { for (const l of listeners) l(); }

function subscribe(l: Listener) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) { current = read(); emit(); }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() { return current; }
function getServerSnapshot() { return false; }

export function setSidebarHidden(hidden: boolean) {
  current = hidden;
  try { window.localStorage.setItem(KEY, current ? "1" : "0"); } catch { /* noop */ }
  emit();
}

export function toggleSidebarHidden() {
  setSidebarHidden(!current);
}

export function useSidebarHidden() {
  const hidden = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { hidden, toggle: toggleSidebarHidden };
}
