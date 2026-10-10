import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Mail, Phone, RotateCcw, Trash2 } from "lucide-react";
import { AccountShell } from "@/components/AccountShell";
import { deleteEnquiry, listEnquiries, setEnquiryStatus, type Enquiry } from "@/lib/enquiries.functions";
import { useAuth } from "@/lib/auth-client";
import { ukDateTime } from "@/lib/format-date";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/admin/enquiries")({
  head: () => ({ meta: [{ title: `Enquiries — ${BRAND.name}` }] }),
  component: EnquiriesPage,
  errorComponent: ({ error }) => (
    <AccountShell title="Enquiries"><p className="text-sm text-primary">{error.message}</p></AccountShell>
  ),
});

const FILTERS = [
  { key: "new", label: "New" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
] as const;

function EnquiriesPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const listFn = useServerFn(listEnquiries);
  const statusFn = useServerFn(setEnquiryStatus);
  const deleteFn = useServerFn(deleteEnquiry);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("new");

  const { data: enquiries = [], isLoading } = useQuery({
    queryKey: ["enquiries", filter],
    queryFn: () => listFn({ data: { status: filter } }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["enquiries"] });
  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: "new" | "done" }) => statusFn({ data: v }),
    onSuccess: refresh,
    onError: (e: any) => alert(e?.message ?? "Could not update the enquiry"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: refresh,
    onError: (e: any) => alert(e?.message ?? "Could not delete the enquiry"),
  });

  return (
    <AccountShell title="Enquiries">
      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-sm border px-4 py-2 text-xs font-semibold uppercase tracking-widest ${filter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : enquiries.length === 0 ? (
        <p className="rounded-md border border-border bg-surface p-8 text-center text-sm text-ink-muted">
          {filter === "new" ? "No new enquiries." : "No enquiries."}
        </p>
      ) : (
        <ul className="space-y-3">
          {enquiries.map((e) => (
            <EnquiryCard
              key={e.id}
              enquiry={e}
              busy={setStatus.isPending || remove.isPending}
              canDelete={isAdmin}
              onStatus={(status) => setStatus.mutate({ id: e.id, status })}
              onDelete={() => { if (confirm(`Delete the enquiry from ${e.name}?`)) remove.mutate(e.id); }}
            />
          ))}
        </ul>
      )}
    </AccountShell>
  );
}

function EnquiryCard({
  enquiry: e,
  busy,
  canDelete,
  onStatus,
  onDelete,
}: {
  enquiry: Enquiry;
  busy: boolean;
  canDelete: boolean;
  onStatus: (status: "new" | "done") => void;
  onDelete: () => void;
}) {
  const btn = "inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest hover:border-primary disabled:opacity-50";
  return (
    <li className={`rounded-md border bg-surface p-4 ${e.status === "new" ? "border-primary/50" : "border-border"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            {e.name}
            {e.service && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">{e.service}</span>}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <a href={`tel:${e.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 hover:text-primary"><Phone className="h-3 w-3" />{e.phone}</a>
            <a href={`mailto:${e.email}`} className="inline-flex items-center gap-1 break-all hover:text-primary"><Mail className="h-3 w-3" />{e.email}</a>
          </p>
        </div>
        <p className="text-xs text-ink-muted">{ukDateTime(e.created_at)}</p>
      </div>
      {(e.bike || e.reg) && (
        <p className="mt-2 text-xs text-ink-muted">{[e.bike, e.reg].filter(Boolean).join(" · ")}</p>
      )}
      {e.message && <p className="mt-2 whitespace-pre-wrap text-sm">{e.message}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {e.status === "new" ? (
          <button type="button" disabled={busy} onClick={() => onStatus("done")} className={btn}><Check className="h-3 w-3" /> Mark done</button>
        ) : (
          <>
            <span className="text-[11px] text-ink-muted">Done{e.handled_at ? ` · ${ukDateTime(e.handled_at)}` : ""}</span>
            <button type="button" disabled={busy} onClick={() => onStatus("new")} className={btn}><RotateCcw className="h-3 w-3" /> Reopen</button>
          </>
        )}
        {canDelete && (
          <button type="button" disabled={busy} onClick={onDelete} className={`${btn} text-primary`}><Trash2 className="h-3 w-3" /> Delete</button>
        )}
      </div>
    </li>
  );
}
