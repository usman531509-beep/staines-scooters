import { useIsFetching } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/**
 * Thin top bar shown while a route or its data is loading. It waits 150ms
 * before appearing, so quick navigations and cached data show nothing.
 */
export function RouteProgress() {
  const routing = useRouterState({ select: (s) => s.isLoading || s.status === "pending" });
  const fetching = useIsFetching() > 0;
  const busy = routing || fetching;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return;
    }
    const id = window.setTimeout(() => setVisible(true), 150);
    return () => window.clearTimeout(id);
  }, [busy]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="route-progress-bar h-full w-1/3 rounded-full bg-primary" />
    </div>
  );
}
