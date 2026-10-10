import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Search, UserRound, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listPosCustomers, savePosCustomer, type PosCustomer } from "@/lib/pos-customers.functions";

export type PosCustomerRef = Pick<PosCustomer, "id" | "name" | "phone" | "email">;

const inputCls = "w-full rounded-sm border border-border bg-input px-3 py-2 text-sm";

/** Name / phone / email form used by the till picker and the Customers page. */
export function PosCustomerForm({
  initial,
  submitLabel,
  onSaved,
  onCancel,
}: {
  initial?: Partial<PosCustomerRef> | null;
  submitLabel?: string;
  onSaved: (c: PosCustomer) => void;
  onCancel?: () => void;
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(savePosCustomer);
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const save = useMutation({
    mutationFn: () => saveFn({ data: { id: initial?.id, name, phone, email: email || null } }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["pos-customers"] });
      onSaved(c);
    },
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <label className="block text-xs font-medium">
        Name
        <input className={`mt-1 ${inputCls}`} value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
      </label>
      <label className="block text-xs font-medium">
        Phone number
        <input className={`mt-1 ${inputCls}`} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      </label>
      <label className="block text-xs font-medium">
        Email <span className="text-ink-muted">(optional)</span>
        <input className={`mt-1 ${inputCls}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {save.error && <p className="text-xs text-destructive">{(save.error as Error).message}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-sm border border-border px-3 py-2 text-xs font-semibold uppercase tracking-widest">
            Cancel
          </button>
        )}
        <button type="submit" disabled={save.isPending} className="rounded-sm bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50">
          {save.isPending ? "Saving…" : (submitLabel ?? "Save customer")}
        </button>
      </div>
    </form>
  );
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Customer attached to the current till sale: pick an existing one or add a new one. */
export function PosCustomerPicker({
  value,
  onChange,
  disabled,
}: {
  value: PosCustomerRef | null;
  onChange: (c: PosCustomerRef | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"search" | "new">("search");
  const [search, setSearch] = useState("");
  const term = useDebounced(search.trim(), 250);
  const listFn = useServerFn(listPosCustomers);
  const { data: results = [], isFetching } = useQuery({
    queryKey: ["pos-customers", "picker", term],
    queryFn: () => listFn({ data: { search: term, limit: 30 } }),
    enabled: open && mode === "search",
  });

  function openPicker() {
    setMode("search");
    setSearch("");
    setOpen(true);
  }
  function pick(c: PosCustomerRef) {
    onChange({ id: c.id, name: c.name, phone: c.phone, email: c.email });
    setOpen(false);
  }

  return (
    <>
      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2">
          <UserRound className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{value.name}</p>
            <p className="truncate text-[11px] text-ink-muted">{[value.phone, value.email].filter(Boolean).join(" · ")}</p>
          </div>
          <button type="button" disabled={disabled} onClick={openPicker} title="Change customer" className="grid h-7 w-7 place-items-center rounded-sm border border-border disabled:opacity-50">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" disabled={disabled} onClick={() => onChange(null)} title="Remove customer" className="grid h-7 w-7 place-items-center rounded-sm border border-border disabled:opacity-50">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-primary/60 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-primary disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add customer
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-md">
          <DialogHeader>
            <DialogTitle>{mode === "new" ? "New customer" : "Customer"}</DialogTitle>
            <DialogDescription>
              {mode === "new" ? "Saved to the customer list and added to this sale." : "Find a customer by name, phone or email."}
            </DialogDescription>
          </DialogHeader>
          {mode === "new" ? (
            <PosCustomerForm
              initial={/^[\d\s+()-]+$/.test(search) ? { phone: search } : { name: search }}
              submitLabel="Save & add to sale"
              onSaved={pick}
              onCancel={() => setMode("search")}
            />
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input className={`${inputCls} pl-9`} placeholder="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
              </div>
              <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-sm border border-border">
                {results.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => pick(c)} className="w-full px-3 py-2 text-left hover:bg-muted">
                      <p className="text-sm font-semibold">{c.name}</p>
                      <p className="text-[11px] text-ink-muted">{[c.phone, c.email].filter(Boolean).join(" · ")}</p>
                    </button>
                  </li>
                ))}
                {results.length === 0 && (
                  <li className="px-3 py-6 text-center text-xs text-ink-muted">{isFetching ? "Searching…" : "No customers found."}</li>
                )}
              </ul>
              <button
                type="button"
                onClick={() => setMode("new")}
                className="flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground"
              >
                <Plus className="h-4 w-4" /> New customer
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
