import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AccountShell } from "@/components/AccountShell";
import { listActivity } from "@/lib/activity.functions";
import { ACTIVITY_LABELS, DESTRUCTIVE_ACTIONS, timeAgo, type ActivityAction } from "@/lib/activity-log";
import { ukDateTime } from "@/lib/format-date";
import { useAuth } from "@/lib/auth-client";
import { isActivityBlocked, ACTIVITY_BLOCKED_MESSAGE } from "@/lib/activity-access";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/admin/activity")({
  head: () => ({
    meta: [
      { title: `Activity Log — ${BRAND.name} Admin` },
      { name: "description", content: "Every sales and expenses action taken by staff and admins, newest first." },
    ],
  }),
  component: ActivityPage,
  errorComponent: ({ error }) => (
    <AccountShell title="Activity"><p className="text-sm text-primary">{error.message}</p></AccountShell>
  ),
  notFoundComponent: () => <AccountShell title="Activity"><p>Not found</p></AccountShell>,
});

type Mod = "all" | "sales" | "expenses";

function ActivityPage() {
  const { user } = useAuth();
  const blocked = isActivityBlocked(user?.email);
  const fn = useServerFn(listActivity);
  const [mod, setMod] = useState<Mod>("all");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["activity-log", mod],
    queryFn: () => fn({ data: { module: mod, limit: 300 } }),
    refetchOnWindowFocus: true,
    enabled: !blocked,
  });

  const rows = useMemo(() => {
    const all: any[] = data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) =>
      `${r.label ?? ""} ${r.action} ${r.module} ${r.actor_name ?? ""}`.toLowerCase().includes(q),
    );
  }, [data, search]);

  if (blocked) {
    return (
      <AccountShell title="Activity">
        <p className="text-sm text-primary">{ACTIVITY_BLOCKED_MESSAGE}</p>
      </AccountShell>
    );
  }


  return (
    <AccountShell title="Activity">
      <div className="mb-4 grid gap-2 rounded-md border border-border bg-surface-elevated p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reference, expense name, email, staff member…"
          className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          {([
            ["all", "Everything"],
            ["sales", "Sales"],
            ["expenses", "Expenses"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setMod(k)}
              className={`rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-widest ${mod === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}
            >{label}</button>
          ))}
        </div>
        <p className="text-xs text-ink-muted">{rows.length} recorded action{rows.length === 1 ? "" : "s"}</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-muted">No activity recorded yet.</p>
      ) : (
        <ol className="relative ml-2 border-l border-border pl-5">
          {rows.map((r: any) => {
            const action = r.action as ActivityAction;
            const destructive = DESTRUCTIVE_ACTIONS.includes(action);
            const wording = ACTIVITY_LABELS[action] ?? r.action.replace(/_/g, " ");
            const isEmail = typeof r.label === "string" && r.label.includes("@");
            return (
              <li key={r.id} className="relative pb-6">
                <span
                  className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 ${destructive ? "border-primary bg-surface" : "border-primary/50 bg-surface"}`}
                  aria-hidden
                />
                <p className="eyebrow text-ink-muted">{timeAgo(r.created_at)}</p>
                <p className="mt-1 text-base leading-snug">
                  <span
                    className={`font-display italic ${isEmail ? "text-sky-700" : destructive ? "text-primary" : "text-emerald-700"}`}
                  >
                    &quot;{r.label ?? "—"}&quot;
                  </span>{" "}
                  <span className={destructive ? "text-primary" : "text-ink"}>{wording}</span>
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {r.actor_name} · {ukDateTime(r.created_at)}
                  {r.details?.amountPence != null && ` · £${(r.details.amountPence / 100).toFixed(2)}`}
                  {r.details?.totalPence != null && ` · £${(r.details.totalPence / 100).toFixed(2)}`}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </AccountShell>
  );
}
