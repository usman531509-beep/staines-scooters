import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AccountShell } from "@/components/AccountShell";
import { clearSystemCache } from "@/lib/loyalty.functions";
import { getPosDisplayMode, setPosDisplayMode } from "@/lib/pos.functions";
import { useAuth } from "@/lib/auth-client";
import { keys, del } from "idb-keyval";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: `Settings — ${BRAND.name} Admin` },
      { name: "description", content: "Manage admin shortcuts and system maintenance." },
      { property: "og:title", content: `Settings — ${BRAND.name} Admin` },
      { property: "og:description", content: "Grouped admin settings for shortcuts and system maintenance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Settings,
  errorComponent: ({ error }) => <AccountShell title="Settings"><p className="text-sm text-primary">{error.message}</p></AccountShell>,
  notFoundComponent: () => <AccountShell title="Settings"><p>Not found</p></AccountShell>,
});

type TabKey = "pos" | "shortcuts" | "system";

const TABS: Array<[TabKey, string]> = [
  ["pos", "POS Settings"],
  ["shortcuts", "Other Settings"],
  ["system", "System"],
];

function Settings() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const clearFn = useServerFn(clearSystemCache);
  const [tab, setTab] = useState<TabKey>("pos");

  const clearMut = useMutation({
    mutationFn: async () => {
      // Frontend: clear persisted query cache + stale search caches from IndexedDB,
      // preserve auth session (localStorage sb-* keys) and offline queues.
      try {
        const allKeys = await keys();
        for (const k of allKeys) {
          const key = String(k);
          if (
            key.startsWith("hm-rq-cache-") ||
            key.startsWith("search-index-") ||
            key.startsWith("tmp-") ||
            key.startsWith("cache-")
          ) {
            await del(k);
          }
        }
        // Clear volatile sessionStorage but leave localStorage auth intact.
        if (typeof sessionStorage !== "undefined") sessionStorage.clear();
      } catch {
        // non-fatal
      }
      // Backend purge of old logs (>14 days)
      const res = await clearFn();
      return res;
    },
    onSuccess: (res: any) => {
      const total = Object.values(res?.purged ?? {}).reduce((a: number, b: any) => a + Number(b || 0), 0);
      toast.success(`System cache cleared — ${total} old log rows removed.`);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to clear cache"),
  });

  const tabs = (
    <div className="mb-5 flex flex-wrap gap-2">
      {TABS.map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => setTab(k)}
          className={`rounded-sm border px-4 py-2.5 text-xs font-semibold uppercase tracking-widest ${
            tab === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:border-primary hover:text-primary"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (tab === "pos") {
    return (
      <AccountShell title="Settings">
        {tabs}
        <PosDisplayToggle canChange={isAdmin} />
      </AccountShell>
    );
  }

  if (tab === "system") {
    return (
      <AccountShell title="Settings">
        {tabs}
        <div className="grid max-w-2xl gap-4 rounded-md border border-border bg-surface-elevated p-6">
          <p className="eyebrow">System maintenance</p>
          {isAdmin ? (
            <>
              <p className="text-xs text-ink-muted">
                Clears cached catalogue data in this browser and purges log rows older than 14 days
                (audit log and historical message logs). Does not touch sales,
                rentals, stock or any business data.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (confirm("Clear system cache and purge logs older than 14 days?")) clearMut.mutate();
                }}
                disabled={clearMut.isPending}
                className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-surface px-4 py-2.5 text-xs font-semibold uppercase tracking-widest hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {clearMut.isPending && (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                {clearMut.isPending ? "Processing…" : "Clear System Cache"}
              </button>
            </>
          ) : (
            <p className="text-xs text-ink-muted">Only admins can run system maintenance.</p>
          )}
        </div>
      </AccountShell>
    );
  }

  return (
    <AccountShell title="Settings">
      {tabs}
      <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
        {([
          ["/admin/team", "Team & Roles", "Staff accounts, roles and permissions"],
          ["/admin/recycle", "Recycle Bin", "Restore deleted records"],
        ] as const).map(([to, title, desc]) => (
          <Link
            key={to}
            to={to}
            className="rounded-md border border-border bg-surface-elevated p-4 transition hover:border-primary"
          >
            <p className="text-sm font-bold uppercase tracking-widest text-foreground">{title}</p>
            <p className="mt-1 text-xs text-ink-muted">{desc}</p>
          </Link>
        ))}
      </div>
    </AccountShell>
  );
}

/** Till display for every account: category tiles first, or every product (original view). */
function PosDisplayToggle({ canChange }: { canChange: boolean }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getPosDisplayMode);
  const setFn = useServerFn(setPosDisplayMode);
  const { data } = useQuery({ queryKey: ["pos-display-mode"], queryFn: () => getFn() });
  const on = (data?.mode ?? "all_products") === "categories";
  const mut = useMutation({
    mutationFn: (mode: "categories" | "all_products") => setFn({ data: { mode } }),
    onSuccess: (r) => {
      qc.setQueryData(["pos-display-mode"], r);
      toast.success("Till display updated for all accounts");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  return (
    <div className="flex max-w-3xl items-center justify-between gap-4 rounded-md border border-border bg-surface-elevated p-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-foreground">Till display: categories first</p>
        <p className="mt-1 text-xs text-ink-muted">
          {on
            ? "ON — the till opens with category tiles; tap a category to see its products."
            : "OFF — the till shows every product with pictures (original view)."}{" "}
          Applies to all accounts.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Till display categories first"
        disabled={!data || mut.isPending || !canChange}
        onClick={() => mut.mutate(on ? "all_products" : "categories")}
        className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-primary" : "bg-border"}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-background shadow transition-all ${on ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
