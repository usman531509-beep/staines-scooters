import { StaffGuard } from "@/components/StaffGuard";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { AccountShell } from "@/components/AccountShell";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PosCustomerForm } from "@/components/PosCustomerPicker";
import { deletePosCustomer, listPosCustomers, type PosCustomer } from "@/lib/pos-customers.functions";
import { useAuth } from "@/lib/auth-client";
import { ukDate } from "@/lib/format-date";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/staff/customers")({
  head: () => ({ meta: [{ title: `Customers — ${BRAND.name} Staff` }] }),
  component: () => (<StaffGuard perm="pos"><CustomersPage /></StaffGuard>),
  errorComponent: ({ error }) => <AccountShell title="Customers"><p className="text-sm text-primary">{error.message}</p></AccountShell>,
});

function CustomersPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const listFn = useServerFn(listPosCustomers);
  const deleteFn = useServerFn(deletePosCustomer);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  // null = closed, "new" = add form, otherwise the customer being edited.
  const [editing, setEditing] = useState<PosCustomer | "new" | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["pos-customers", "list", term],
    queryFn: () => listFn({ data: { search: term, limit: 500 } }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-customers"] }),
    onError: (e: any) => alert(e?.message ?? "Could not delete the customer"),
  });

  return (
    <AccountShell title="Customers">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone or email"
            className="w-full rounded-sm border border-border bg-surface py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Add customer
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-ink-muted">
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Phone</th>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Added</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="py-6 text-center text-ink-muted">Loading…</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-ink-muted">{term ? "No customers match." : "No customers yet."}</td></tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 font-semibold">
                    {c.name}
                    {!c.created_by && (
                      <span
                        title="Registered on the website"
                        className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-[var(--primary-ink)]"
                      >
                        Website
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{c.phone}</td>
                  <td className="px-3 py-2">{c.email ?? <span className="text-ink-muted">—</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-ink-muted">{ukDate(c.created_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" onClick={() => setEditing(c)} title="Edit" className="grid h-8 w-8 place-items-center rounded-sm border border-border hover:border-primary">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          title="Delete"
                          disabled={remove.isPending}
                          onClick={() => { if (confirm(`Delete ${c.name}? Past receipts keep their details.`)) remove.mutate(c.id); }}
                          className="grid h-8 w-8 place-items-center rounded-sm border border-border text-primary hover:border-primary disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-md">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add customer" : "Edit customer"}</DialogTitle>
            <DialogDescription>Name and phone number are required; email is optional.</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <PosCustomerForm
              key={editing === "new" ? "new" : editing.id}
              initial={editing === "new" ? null : editing}
              onSaved={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AccountShell>
  );
}
