import { ukDate, isoDay } from "@/lib/format-date";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Trash2,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Lock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { AccountShell } from "@/components/AccountShell";
import { RecycleBinLink } from "@/components/RecycleBinLink";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-client";
import {
  listClaims,
  createClaim,
  updateClaim,
  updateClaimStatus,
  setClaimFinancials,
  deleteClaim,
  addClaimDocument,
  deleteClaimDocument,
  getClaimDocumentSignedUrl,
} from "@/lib/claims.functions";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/admin/claims")({
  head: () => ({ meta: [{ title: `Claims — ${BRAND.name}` }] }),
  component: ClaimsPage,
  errorComponent: ({ error }) => (
    <AccountShell title="Claims">
      <p className="text-sm text-primary">{error.message}</p>
    </AccountShell>
  ),
  notFoundComponent: () => (
    <AccountShell title="Claims">
      <p>Not found</p>
    </AccountShell>
  ),
});

const STATUSES = [
  { v: "draft", label: "Draft", icon: Clock, cls: "bg-muted text-muted-foreground" },
  { v: "submitted", label: "Submitted", icon: Upload, cls: "bg-blue-500/15 text-blue-600" },
  { v: "accepted", label: "Accepted", icon: CheckCircle2, cls: "bg-green-500/15 text-green-600" },
  { v: "rejected", label: "Rejected", icon: XCircle, cls: "bg-red-500/15 text-red-600" },
  { v: "closed", label: "Closed", icon: Lock, cls: "bg-neutral-500/15 text-neutral-600" },
] as const;

const DOC_TYPES = [
  { v: "commission_invoice", label: "Commission invoice" },
  { v: "storage_invoice", label: "Storage invoice" },
  { v: "claim_form", label: "Claim form" },
  { v: "other", label: "Other" },
] as const;

const fmtGBP = (p?: number | null) =>
  p == null ? "—" : `£${(p / 100).toFixed(2)}`;
const todayIso = () => isoDay();

function ClaimsPage() {
  const qc = useQueryClient();
  const { isOwner, isAdmin } = useAuth();

  const listFn = useServerFn(listClaims);
  const createFn = useServerFn(createClaim);
  const updateFn = useServerFn(updateClaim);
  const statusFn = useServerFn(updateClaimStatus);
  const finFn = useServerFn(setClaimFinancials);
  const deleteFn = useServerFn(deleteClaim);
  const addDocFn = useServerFn(addClaimDocument);
  const delDocFn = useServerFn(deleteClaimDocument);
  const signFn = useServerFn(getClaimDocumentSignedUrl);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["claims", statusFilter, search],
    queryFn: () =>
      listFn({ data: { status: (statusFilter as any) || undefined, search: search || undefined } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["claims"] });

  const totals = useMemo(() => {
    const t = { count: rows.length, commission: 0, storage: 0, open: 0, closed: 0 };
    for (const r of rows as any[]) {
      if (r.commission_received) t.commission += r.commission_amount_pence ?? 0;
      if (r.storage_received) t.storage += r.storage_amount_pence ?? 0;
      if (r.status === "closed") t.closed++;
      else t.open++;
    }
    return t;
  }, [rows]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <AccountShell title="Claims" fullWidth compact>
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <div>
          <h1 className="font-display text-2xl uppercase text-foreground">Accident Claims (MCAMS)</h1>
          <p className="mt-1 text-xs text-ink-muted">
            Track claims managed with MCAMS LTD — customer details, status, commission &amp; storage payments, and PDF invoices.
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Total" value={String(totals.count)} />
          <StatTile label="Open" value={String(totals.open)} />
          <StatTile label="Commission recd" value={fmtGBP(totals.commission)} />
          <StatTile label="Storage recd" value={fmtGBP(totals.storage)} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, mobile, email, address, reg, claim reference…"
              className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-sm border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s.v} value={s.v}>{s.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowNew((v) => !v)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-sm bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> New claim
          </button>
          {isAdmin && <RecycleBinLink type="claims" />}
        </div>

        {showNew && (
          <NewClaimForm
            onCancel={() => setShowNew(false)}
            onCreate={async (input) => {
              try {
                await createFn({ data: input });
                toast.success("Claim created");
                setShowNew(false);
                invalidate();
              } catch (e: any) {
                toast.error(e.message ?? "Failed");
              }
            }}
          />
        )}

        {isLoading ? (
          <p className="text-xs text-ink-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-sm border border-dashed border-border px-4 py-8 text-center text-xs text-ink-muted">
            No claims yet.
          </p>
        ) : (
          <div className="space-y-2">
            {(rows as any[]).map((claim) => {
              const st = STATUSES.find((s) => s.v === claim.status) ?? STATUSES[0];
              const StIcon = st.icon;
              const isOpen = expanded.has(claim.id);
              return (
                <div key={claim.id} className="rounded-sm border border-border bg-surface-elevated">
                  <button
                    onClick={() => toggle(claim.id)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{claim.customer_full_name}</span>
                        {claim.vehicle_reg && (
                          <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] font-mono uppercase">{claim.vehicle_reg}</span>
                        )}
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${st.cls}`}>
                          <StIcon className="h-3 w-3" /> {st.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${claim.commission_received ? "bg-green-500/15 text-green-600" : "bg-amber-500/15 text-amber-600"}`}>
                          Comm {claim.commission_received ? "Paid" : "Unpaid"}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${claim.storage_received ? "bg-green-500/15 text-green-600" : "bg-amber-500/15 text-amber-600"}`}>
                          Storage {claim.storage_received ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-ink-muted">
                        Accident {ukDate(claim.accident_date)}
                        {claim.claim_submitted_date && ` · Submitted ${ukDate(claim.claim_submitted_date)}`}
                        {claim.closed_date && ` · Closed ${ukDate(claim.closed_date)}`}
                      </div>
                    </div>
                    <div className="hidden text-right text-[11px] text-ink-muted sm:block">
                      <div>Comm: {claim.commission_received ? fmtGBP(claim.commission_amount_pence) : "—"}</div>
                      <div>Storage: {claim.storage_received ? fmtGBP(claim.storage_amount_pence) : "—"}</div>
                    </div>
                  </button>

                  {isOpen && (
                    <ClaimDetail
                      claim={claim}
                      isOwner={isOwner}
                      isAdmin={isAdmin}
                      onUpdate={async (patch) => {
                        try {
                          await updateFn({ data: { id: claim.id, ...patch } });
                          toast.success("Saved");
                          invalidate();
                        } catch (e: any) {
                          toast.error(e.message ?? "Failed");
                        }
                      }}
                      onStatus={async (status) => {
                        try {
                          await statusFn({ data: { id: claim.id, status: status as any } });
                          toast.success(`Marked ${status}`);
                          invalidate();
                        } catch (e: any) {
                          toast.error(e.message ?? "Failed");
                        }
                      }}
                      onFinancial={async (field, received, amount_pence, received_date) => {
                        try {
                          await finFn({
                            data: {
                              id: claim.id,
                              field,
                              received,
                              amount_pence: amount_pence ?? null,
                              received_date: received_date ?? null,
                            },
                          });
                          toast.success("Saved");
                          invalidate();
                        } catch (e: any) {
                          toast.error(e.message ?? "Failed");
                        }
                      }}
                      onDelete={async () => {
                        if (!confirm(`Delete claim for ${claim.customer_full_name}?`)) return;
                        try {
                          await deleteFn({ data: { id: claim.id } });
                          toast.success("Deleted");
                          invalidate();
                        } catch (e: any) {
                          toast.error(e.message ?? "Failed");
                        }
                      }}
                      onUpload={async (doc_type, file) => {
                        const ext = file.name.split(".").pop() || "pdf";
                        const path = `${claim.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
                        const { error } = await supabase.storage
                          .from("claim-documents")
                          .upload(path, file, { contentType: file.type || "application/pdf" });
                        if (error) {
                          toast.error(error.message);
                          return;
                        }
                        try {
                          await addDocFn({
                            data: {
                              claim_id: claim.id,
                              doc_type: doc_type as any,
                              file_path: path,
                              file_name: file.name,
                              file_size_bytes: file.size,
                            },
                          });
                          toast.success("Uploaded");
                          invalidate();
                        } catch (e: any) {
                          toast.error(e.message ?? "Failed");
                        }
                      }}
                      onOpenDoc={async (file_path) => {
                        try {
                          const { url } = await signFn({ data: { file_path } });
                          if (url) window.open(url, "_blank");
                        } catch (e: any) {
                          toast.error(e.message ?? "Failed");
                        }
                      }}
                      onDeleteDoc={async (id) => {
                        if (!confirm("Delete this document?")) return;
                        try {
                          await delDocFn({ data: { id } });
                          toast.success("Deleted");
                          invalidate();
                        } catch (e: any) {
                          toast.error(e.message ?? "Failed");
                        }
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AccountShell>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-surface-elevated px-3 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-widest text-ink-muted">{label}</div>
      <div className="font-display text-lg leading-tight text-foreground">{value}</div>
    </div>
  );
}

function NewClaimForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (v: any) => void | Promise<void>;
}) {
  const [f, setF] = useState({
    customer_full_name: "",
    customer_email: "",
    customer_phone: "",
    customer_address: "",
    accident_date: todayIso(),
    claim_submitted_date: "",
    vehicle_reg: "",
    claim_reference: "",
    commission_amount_pence: 85000,
    storage_amount_pence: 0,
    notes: "",
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!f.customer_full_name.trim()) return;
        onCreate({
          ...f,
          customer_email: f.customer_email || null,
          customer_phone: f.customer_phone || null,
          customer_address: f.customer_address || null,
          claim_submitted_date: f.claim_submitted_date || null,
          vehicle_reg: f.vehicle_reg || null,
          claim_reference: f.claim_reference || null,
          notes: f.notes || null,
          storage_amount_pence: f.storage_amount_pence || null,
        });
      }}
      className="grid gap-3 rounded-sm border border-border bg-surface-elevated p-3 sm:grid-cols-2"
    >
      <Field label="Customer full name *">
        <input
          required
          value={f.customer_full_name}
          onChange={(e) => setF({ ...f, customer_full_name: e.target.value })}
          className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Vehicle registration">
        <input
          value={f.vehicle_reg}
          onChange={(e) => setF({ ...f, vehicle_reg: e.target.value.toUpperCase() })}
          className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm uppercase"
        />
      </Field>
      <Field label="Claim Reference (MCAMS)">
        <input
          value={f.claim_reference}
          onChange={(e) => setF({ ...f, claim_reference: e.target.value })}
          placeholder="e.g. MCAMS/2026/12345"
          className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Email">
        <input
          type="email"
          value={f.customer_email}
          onChange={(e) => setF({ ...f, customer_email: e.target.value })}
          className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Mobile number">
        <input
          value={f.customer_phone}
          onChange={(e) => setF({ ...f, customer_phone: e.target.value })}
          className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Address" className="sm:col-span-2">
        <textarea
          rows={2}
          value={f.customer_address}
          onChange={(e) => setF({ ...f, customer_address: e.target.value })}
          className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Date of accident *">
        <input
          type="date"
          required
          value={f.accident_date}
          onChange={(e) => setF({ ...f, accident_date: e.target.value })}
          className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Date claim submitted to MCAMS">
        <input
          type="date"
          value={f.claim_submitted_date}
          onChange={(e) => setF({ ...f, claim_submitted_date: e.target.value })}
          className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Commission (£)">
        <input
          type="number"
          step="0.01"
          value={(f.commission_amount_pence / 100).toString()}
          onChange={(e) =>
            setF({ ...f, commission_amount_pence: Math.round(parseFloat(e.target.value || "0") * 100) })
          }
          className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Storage payable (£)">
        <input
          type="number"
          step="0.01"
          value={(f.storage_amount_pence / 100).toString()}
          onChange={(e) =>
            setF({ ...f, storage_amount_pence: Math.round(parseFloat(e.target.value || "0") * 100) })
          }
          className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <textarea
          rows={2}
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
          className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm"
        />
      </Field>
      <div className="sm:col-span-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-sm border border-border px-3 py-2 text-xs font-semibold uppercase tracking-widest"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-sm bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground"
        >
          Create claim
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function ClaimDetail({
  claim,
  isOwner,
  isAdmin,
  onUpdate,
  onStatus,
  onFinancial,
  onDelete,
  onUpload,
  onOpenDoc,
  onDeleteDoc,
}: {
  claim: any;
  isOwner: boolean;
  isAdmin: boolean;
  onUpdate: (patch: any) => void;
  onStatus: (status: string) => void;
  onFinancial: (field: "commission" | "storage", received: boolean, amount_pence?: number, received_date?: string | null) => void;
  onDelete: () => void;
  onUpload: (doc_type: string, file: File) => void;
  onOpenDoc: (file_path: string) => void;
  onDeleteDoc: (id: string) => void;
}) {
  const [edit, setEdit] = useState({
    customer_full_name: claim.customer_full_name ?? "",
    customer_email: claim.customer_email ?? "",
    customer_phone: claim.customer_phone ?? "",
    customer_address: claim.customer_address ?? "",
    accident_date: claim.accident_date ?? "",
    claim_submitted_date: claim.claim_submitted_date ?? "",
    vehicle_reg: claim.vehicle_reg ?? "",
    claim_reference: claim.claim_reference ?? "",
    notes: claim.notes ?? "",
  });
  const [uploadType, setUploadType] = useState<string>("commission_invoice");

  const changed =
    JSON.stringify(edit) !==
    JSON.stringify({
      customer_full_name: claim.customer_full_name ?? "",
      customer_email: claim.customer_email ?? "",
      customer_phone: claim.customer_phone ?? "",
      customer_address: claim.customer_address ?? "",
      accident_date: claim.accident_date ?? "",
      claim_submitted_date: claim.claim_submitted_date ?? "",
      vehicle_reg: claim.vehicle_reg ?? "",
      claim_reference: claim.claim_reference ?? "",
      notes: claim.notes ?? "",
    });

  return (
    <div className="border-t border-border px-3 py-3 space-y-4">
      {/* Status actions */}
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Status</div>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => {
            const active = s.v === claim.status;
            return (
              <button
                key={s.v}
                onClick={() => !active && onStatus(s.v)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${
                  active ? s.cls : "border border-border text-ink-muted hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Financials */}
      <div className="grid gap-3 sm:grid-cols-2">
        <FinancialRow
          label="Commission"
          received={claim.commission_received}
          receivedDate={claim.commission_received_date}
          amountPence={claim.commission_amount_pence}
          onSave={(received, amt, date) => onFinancial("commission", received, amt, date)}
        />
        <FinancialRow
          label="Storage (28 days)"
          received={claim.storage_received}
          receivedDate={claim.storage_received_date}
          amountPence={claim.storage_amount_pence}
          onSave={(received, amt, date) => onFinancial("storage", received, amt, date)}
        />
      </div>

      {/* Edit customer */}
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Details</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Full name">
            <input value={edit.customer_full_name} onChange={(e) => setEdit({ ...edit, customer_full_name: e.target.value })} className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm" />
          </Field>
          <Field label="Vehicle reg">
            <input value={edit.vehicle_reg} onChange={(e) => setEdit({ ...edit, vehicle_reg: e.target.value.toUpperCase() })} className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm uppercase" />
          </Field>
          <Field label="Email">
            <input value={edit.customer_email} onChange={(e) => setEdit({ ...edit, customer_email: e.target.value })} className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm" />
          </Field>
          <Field label="Mobile">
            <input value={edit.customer_phone} onChange={(e) => setEdit({ ...edit, customer_phone: e.target.value })} className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm" />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <textarea rows={2} value={edit.customer_address} onChange={(e) => setEdit({ ...edit, customer_address: e.target.value })} className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm" />
          </Field>
          <Field label="Date of accident">
            <input type="date" value={edit.accident_date} onChange={(e) => setEdit({ ...edit, accident_date: e.target.value })} className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm" />
          </Field>
          <Field label="Claim submitted date">
            <input type="date" value={edit.claim_submitted_date} onChange={(e) => setEdit({ ...edit, claim_submitted_date: e.target.value })} className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm" />
          </Field>
          <Field label="Claim reference (MCAMS)">
            <input value={edit.claim_reference} onChange={(e) => setEdit({ ...edit, claim_reference: e.target.value })} className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm" />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <textarea rows={2} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm" />
          </Field>
        </div>
        {changed && (
          <div className="mt-2 flex justify-end">
            <button
              onClick={() =>
                onUpdate({
                  ...edit,
                  customer_email: edit.customer_email || null,
                  customer_phone: edit.customer_phone || null,
                  customer_address: edit.customer_address || null,
                  claim_submitted_date: edit.claim_submitted_date || null,
                  vehicle_reg: edit.vehicle_reg || null,
                  claim_reference: edit.claim_reference || null,
                  notes: edit.notes || null,
                })
              }
              className="rounded-sm bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground"
            >
              Save changes
            </button>
          </div>
        )}
      </div>

      {/* Documents */}
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Documents / PDF invoices</div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value)}
            className="rounded-sm border border-border bg-surface px-2 py-1.5 text-xs"
          >
            {DOC_TYPES.map((d) => (
              <option key={d.v} value={d.v}>{d.label}</option>
            ))}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-border bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-widest hover:border-primary">
            <Upload className="h-3.5 w-3.5" /> Upload PDF
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onUpload(uploadType, file);
              }}
            />
          </label>
        </div>
        {(claim.documents ?? []).length === 0 ? (
          <p className="text-[11px] text-ink-muted">No documents uploaded.</p>
        ) : (
          <ul className="space-y-1">
            {(claim.documents ?? []).map((d: any) => (
              <li key={d.id} className="flex items-center gap-2 rounded-sm border border-border bg-surface px-2 py-1.5 text-xs">
                <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase text-ink-muted">
                  {DOC_TYPES.find((t) => t.v === d.doc_type)?.label ?? d.doc_type}
                </span>
                <span className="min-w-0 flex-1 truncate">{d.file_name}</span>
                <button onClick={() => onOpenDoc(d.file_path)} className="inline-flex items-center gap-1 text-primary hover:underline">
                  <Download className="h-3.5 w-3.5" /> Open
                </button>
                {isOwner && (
                  <button onClick={() => onDeleteDoc(d.id)} className="text-red-600 hover:underline">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isAdmin && (
        <div className="flex justify-end border-t border-border pt-3">
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-sm border border-red-500/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-red-600 hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Move to Recycle Bin
          </button>
        </div>
      )}
    </div>
  );
}

function FinancialRow({
  label,
  received,
  receivedDate,
  amountPence,
  onSave,
}: {
  label: string;
  received: boolean;
  receivedDate?: string | null;
  amountPence?: number | null;
  onSave: (received: boolean, amount_pence: number, received_date: string | null) => void;
}) {
  const [amount, setAmount] = useState(
    amountPence == null || amountPence === 0 ? "" : (amountPence / 100).toString(),
  );
  const [date, setDate] = useState(receivedDate ?? "");

  const commit = (nextAmountStr: string, nextDate: string) => {
    const parsed = parseFloat(nextAmountStr);
    const hasAmount = !Number.isNaN(parsed) && parsed > 0;
    const pence = hasAmount ? Math.round(parsed * 100) : 0;
    const rcvDate = hasAmount ? (nextDate || todayIso()) : null;
    if (hasAmount && !nextDate) setDate(rcvDate!);
    const changed =
      hasAmount !== !!received ||
      pence !== (amountPence ?? 0) ||
      (rcvDate ?? "") !== (receivedDate ?? "");
    if (changed) onSave(hasAmount, pence, rcvDate);
  };

  return (
    <div className="rounded-sm border border-border bg-surface p-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-foreground">{label}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            received ? "bg-green-500/15 text-green-600" : "bg-muted text-ink-muted"
          }`}
        >
          {received ? "Paid" : "Unpaid"}
        </span>
      </div>
      <label className="block">
        <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-widest text-ink-muted">Amount (£)</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-ink-muted">£</span>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => commit(amount, date)}
            className="w-full rounded-sm border border-border bg-surface-elevated px-2 py-1 text-sm"
          />
        </div>
      </label>
      <label className="block">
        <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-widest text-ink-muted">Date received</span>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            commit(amount, e.target.value);
          }}
          className="w-full rounded-sm border border-border bg-surface-elevated px-2 py-1 text-sm"
        />
      </label>
    </div>
  );
}
