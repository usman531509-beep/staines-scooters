import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useMemo, useState, useEffect, type ReactNode } from "react";
import { ChevronDown, ChevronRight, SlidersHorizontal, X, Plus, Minus, Trash2, ScanLine, Search, Upload, Link, ImageIcon, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AccountShell } from "@/components/AccountShell";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { ProductForm } from "@/components/ProductForm";
import { useAuth } from "@/lib/auth-client";
import { isCostHidden } from "@/lib/cost-visibility";
import { ukDate, ukDateTime, isoDay } from "@/lib/format-date";
import { listCategories, upsertProduct } from "@/lib/pos.functions";
import { getProfitLoss } from "@/lib/profit-loss.functions";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/admin/inventory")({
  head: () => ({
    meta: [
      { title: `Stock/Inventory — ${BRAND.name}` },
      { name: "description", content: "Stock batches, deliveries, adjustments, waste, stock counts and audit history." },
      { property: "og:title", content: `Stock/Inventory — ${BRAND.name}` },
      { property: "og:description", content: "Stock batches, deliveries, adjustments, waste, stock counts and audit history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InventoryPage,
  errorComponent: ({ error }) => <AccountShell title="Stock/Inventory"><p className="text-sm text-primary">{error.message}</p></AccountShell>,
  notFoundComponent: () => <AccountShell title="Stock/Inventory"><p>Not found</p></AccountShell>,
});

const sb = supabase as any;
const gbp = (p: number | null | undefined) => `£${((p ?? 0) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const n = (v: any) => Number(v ?? 0);

const REASON_TYPES: { name: string; help: string }[] = [
  { name: "Damage", help: "Items broken or damaged so they can no longer be sold. Valued at cost." },
  { name: "Waste / Spoilage", help: "Items that have gone off, leaked or been spoilt. Valued at cost." },
  { name: "Expired Stock", help: "Items past their use-by or best-before date. Valued at cost." },
  { name: "Shortage / Shrinkage", help: "Items missing for an unknown reason. Valued at cost." },
  { name: "Theft", help: "Items known or suspected to have been stolen. Valued at cost." },
  { name: "Stock Count Correction", help: "Fixes the system figure to match a physical count." },
  { name: "Internal Business Use", help: "Used by the business itself (workshop, repairs, own bikes)." },
  { name: "Promotional / Free Samples", help: "Given away free as a promotion or sample." },
  { name: "Supplier Damage / Supplier Return", help: "Returned to the supplier or arrived damaged." },
  { name: "Customer Return – Unsellable", help: "Returned by a customer and can't be resold." },
  { name: "Other Adjustment", help: "Any other reason — please explain in the reason box." },
];
const WASTE_TYPES = ["Waste / Spoilage", "Damage", "Expired Stock", "Internal Business Use", "Promotional / Free Samples", "Customer Return – Unsellable", "Theft"];

/* ---------- date filter ---------- */
type Range = { key: string; from?: string; to?: string };
const RANGES = [["all", "All time"], ["today", "Today"], ["yesterday", "Yesterday"], ["this_week", "This week"], ["last_week", "Last week"], ["this_month", "This month"], ["last_month", "Last month"], ["this_year", "This year"], ["custom", "Custom"]] as const;
function inRange(iso: string, r: Range) {
  const now = new Date(); const y = now.getFullYear(), m = now.getMonth(), dd = now.getDate();
  const d = (a: number, b: number, c: number) => new Date(a, b, c);
  const mon = dd - ((now.getDay() + 6) % 7);
  let from: Date | undefined, to: Date | undefined;
  switch (r.key) {
    case "today": from = d(y, m, dd); to = d(y, m, dd + 1); break;
    case "yesterday": from = d(y, m, dd - 1); to = d(y, m, dd); break;
    case "this_week": from = d(y, m, mon); to = d(y, m, mon + 7); break;
    case "last_week": from = d(y, m, mon - 7); to = d(y, m, mon); break;
    case "this_month": from = d(y, m, 1); to = d(y, m + 1, 1); break;
    case "last_month": from = d(y, m - 1, 1); to = d(y, m, 1); break;
    case "this_year": from = d(y, 0, 1); to = d(y + 1, 0, 1); break;
    case "custom":
      from = r.from ? new Date(r.from + "T00:00:00") : undefined;
      if (r.to) { to = new Date(r.to + "T00:00:00"); to.setDate(to.getDate() + 1); }
      break;
  }
  const t = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return (!from || t >= from) && (!to || t < to);
}
function DateFilter({ value, onChange, alwaysDates = false }: { value: Range; onChange: (r: Range) => void; alwaysDates?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</span>
      <select value={value.key} onChange={(e) => onChange({ ...value, key: e.target.value })} className="h-11 rounded-sm border border-border bg-background px-2 text-sm">
        {RANGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {(alwaysDates || value.key === "custom") && (<>
        <input aria-label="From" type="date" value={value.from ?? ""} onChange={(e) => onChange({ ...value, key: "custom", from: e.target.value })} className="h-11 rounded-sm border border-border bg-background px-2 text-sm" />
        <input aria-label="To" type="date" value={value.to ?? ""} onChange={(e) => onChange({ ...value, key: "custom", to: e.target.value })} className="h-11 rounded-sm border border-border bg-background px-2 text-sm" />
      </>)}
    </div>
  );
}
const SearchBox = ({ value, onChange, placeholder = "Search by name, SKU or barcode" }: { value: string; onChange: (v: string) => void; placeholder?: string }) =>
  <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 min-w-0 flex-1 rounded-sm border border-border bg-background px-3 text-sm" />;

function Modal({ title, sub, onClose, children, wide }: { title: string; sub?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}><DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-foreground/60" />
    <DialogPrimitive.Content className="inventory-popup fixed inset-0 z-[101] overflow-y-auto bg-background outline-none" aria-describedby={sub ? "inventory-popup-description" : undefined}>
      <div className={`mx-auto w-full ${wide ? "max-w-5xl" : "max-w-[848px]"} px-6 pb-12 pt-8`}>
        <header className="mb-12 pr-12"><DialogPrimitive.Title className="font-sans text-base font-semibold leading-normal">{title}</DialogPrimitive.Title>{sub && <DialogPrimitive.Description id="inventory-popup-description" className="mt-1 text-sm text-muted-foreground">{sub}</DialogPrimitive.Description>}</header>
        {children}
      </div>
      <DialogPrimitive.Close asChild><Button variant="outline" size="icon" aria-label="Close popup" title="Close" className="fixed right-4 top-4 z-[102] bg-background"><X /></Button></DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal></DialogPrimitive.Root>;
}
const btn = "h-11 rounded-sm px-4 text-sm font-semibold";
const btnPrimary = `${btn} bg-primary text-primary-foreground disabled:opacity-50`;
const btnOutline = `${btn} border border-border bg-background disabled:opacity-50`;
const btnSm = "h-9 rounded-sm border border-border px-3 text-xs font-semibold";
const field = "h-11 w-full rounded-sm border border-border bg-background px-3 text-sm";
const Label = ({ children }: { children: ReactNode }) => <label className="mb-1 block text-sm font-semibold">{children}</label>;
const tabCls = (on: boolean) => `h-9 shrink-0 rounded-md px-3 text-sm font-semibold ${on ? "bg-stock-action text-stock-badge-foreground hover:bg-stock-action/90 hover:text-stock-badge-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`;

/* ---------- data ---------- */
type Product = { id: string; name: string; sku: string | null; barcode: string | null; retail_price_pence: number; cost_price_pence: number; stock_qty: number; min_stock: number; category_id: string | null; is_active: boolean; deleted_at: string | null; is_service: boolean; image_url: string | null };
type Batch = { id: string; product_id: string; batch_code: string; received_at: string; opening_qty: number; remaining_qty: number; cost_pence: number; sale_price_pence: number | null; supplier: string | null; reference: string | null; notes: string | null; status: string; created_at: string };
type Movement = { id: string; product_id: string; batch_id: string | null; movement_type: string; quantity: number; qty_before: number | null; qty_after: number | null; reason_type: string | null; reason: string | null; cost_value_pence: number | null; retail_value_pence: number | null; evidence_path: string | null; created_at: string };
type Undo = { movement_id: string; reason: string | null; undone_at: string };

function useStockData() {
  return useQuery({
    queryKey: ["inventory-module"],
    queryFn: async () => {
      const [p, b, m, u] = await Promise.all([
        sb.from("products").select("id,name,sku,barcode,retail_price_pence,cost_price_pence,stock_qty,min_stock,category_id,is_active,deleted_at,is_service,image_url").order("name").limit(5000),
        sb.from("stock_batches").select("*").order("received_at", { ascending: true }).order("created_at", { ascending: true }).limit(10000),
        sb.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(5000),
        sb.from("stock_movement_undos").select("movement_id,reason,undone_at").limit(5000),
      ]);
      for (const x of [p, b, m, u]) if (x.error) throw x.error;
      return { products: (p.data ?? []) as Product[], batches: (b.data ?? []) as Batch[], movements: (m.data ?? []) as Movement[], undos: (u.data ?? []) as Undo[] };
    },
  });
}
type Data = NonNullable<ReturnType<typeof useStockData>["data"]>;
const matches = (p: Product | undefined, q: string) => {
  if (!q.trim()) return true; if (!p) return false;
  const s = q.toLowerCase(); return [p.name, p.sku, p.barcode].some((v) => v?.toLowerCase().includes(s));
};
const stockProducts = (d: Data) => d.products.filter((p) => !p.is_service && !p.deleted_at);
const batchesOf = (d: Data, pid: string) => d.batches.filter((b) => b.product_id === pid && b.status !== "archived");
const unitsOf = (d: Data, pid: string) => batchesOf(d, pid).reduce((s, b) => s + n(b.remaining_qty), 0);

async function uploadEvidence(file: File | null): Promise<string | null> {
  if (!file) return null;
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name.replace(/[^\w.]+/g, "_")}`;
  const { error } = await supabase.storage.from("stock-evidence").upload(path, file);
  if (error) throw error;
  return path;
}
async function linkBarcode(productId: string, code: string | null) {
  if (code && productId) await sb.from("products").update({ barcode: code }).eq("id", productId);
}

function ProductPicker({ products, value, onChange, onUnknownBarcode, placeholder, mode = "dropdown" }: { products: Product[]; value: string; onChange: (id: string) => void; onUnknownBarcode?: (code: string) => void; placeholder?: string; mode?: "dropdown" | "search" }) {
  const [q, setQ] = useState(""); const [scan, setScan] = useState(false); const [open, setOpen] = useState(false);
  const selected = products.find((p) => p.id === value);
  const list = useMemo(() => products.filter((p) => matches(p, q)), [products, q]);
  const options = <div className="max-h-64 overflow-y-auto">{list.length === 0 && <p className="p-3 text-sm text-muted-foreground">No products found</p>}{list.map((p) => <Button variant="ghost" key={p.id} role="option" aria-selected={p.id === value} onClick={() => { onChange(p.id); setQ(""); setOpen(false); }} className="h-auto w-full justify-between whitespace-normal rounded-none px-3 py-3 text-left"><span>{p.name}</span><span className="text-xs text-muted-foreground">{p.sku ?? p.barcode ?? ""}</span></Button>)}</div>;
  return <div className="relative">
    {mode === "dropdown" ? <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="outline" role="combobox" aria-expanded={open} className="h-10 w-full justify-between font-normal"><span className="truncate">{selected?.name ?? placeholder ?? "Choose a stock product"}</span><ChevronDown /></Button></PopoverTrigger><PopoverContent align="start" className="z-[110] w-[var(--radix-popover-trigger-width)] p-0"><input autoFocus aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, SKU or barcode" className={field} /><div role="listbox">{options}</div></PopoverContent></Popover> : <><div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input aria-label="Search stock products" value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} placeholder="Search name, SKU or barcode" className={`${field} pl-8`} /></div><Button onClick={() => setScan(true)} className="h-11 bg-stock-action text-stock-badge-foreground hover:bg-stock-action/90"><ScanLine />Scan</Button></div>{open && q && <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-border bg-background shadow-md">{options}</div>}</>}
    {scan && <BarcodeScanner onClose={() => setScan(false)} onDetected={(code) => { setScan(false); const hit = products.find((p) => p.barcode === code); if (hit) onChange(hit.id); else { onUnknownBarcode?.(code); toast.message(`Barcode ${code} isn't linked to a product. Search and pick it.`); } }} />}
  </div>;
}
/* ---------- page ---------- */
function InventoryPage() {
  const { isAdmin, isStaff, user } = useAuth();
  const showCost = !isCostHidden(user?.email);
  const qc = useQueryClient();
  const { data, isLoading, error } = useStockData();
  const catsFn = useServerFn(listCategories);
  const upsertFn = useServerFn(upsertProduct);
  const { data: categories = [] } = useQuery({ queryKey: ["all-cats"], queryFn: () => catsFn({ data: { includeHidden: true } }) });
  const [tab, setTab] = useState<"active" | "adjust" | "audit" | "bin">("active");
  const [modal, setModal] = useState<null | "history" | "receive" | "waste" | "count" | "product">(null);
  const [adjustFor, setAdjustFor] = useState<string | null>(null);
  const [adjustBatch, setAdjustBatch] = useState<string | undefined>();
  const [receiveFor, setReceiveFor] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [stockLevel, setStockLevel] = useState("all");
  const [metric, setMetric] = useState<string | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["inventory-module"] }); qc.invalidateQueries({ queryKey: ["all-products"] }); qc.invalidateQueries({ queryKey: ["profit-loss"] }); };

  if (!isStaff) return <AccountShell title="Stock/Inventory"><p className="text-sm text-muted-foreground">Checking access…</p></AccountShell>;

  const catName = (id: string | null) => (categories as any[]).find((c) => c.id === id)?.name ?? "—";
  const prods = data ? stockProducts(data) : [];
  const stats = data ? (() => {
    const active = data.batches.filter((b) => b.status !== "archived" && n(b.remaining_qty) > 0);
    const units = active.reduce((s, b) => s + n(b.remaining_qty), 0);
    const cost = active.reduce((s, b) => s + n(b.remaining_qty) * b.cost_pence, 0);
    const retail = prods.reduce((s, p) => s + unitsOf(data, p.id) * p.retail_price_pence, 0);
    return { products: prods.length, units, batches: active.length, cost, retail, margin: retail - cost, low: prods.filter((p) => unitsOf(data, p.id) <= n(p.min_stock)).length };
  })() : null;

  return (
    <AccountShell title="Stock/Inventory">
      <div className="inventory-workspace">
      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button variant="ghost" onClick={() => setModal("history")} className={btnOutline}>Batch history</Button>
        <Button variant="ghost" onClick={() => { setReceiveFor(null); setModal("receive"); }} className={btnPrimary}>Receive stock</Button>
        <Button variant="ghost" onClick={() => setModal("waste")} className={btnOutline}>Record Waste</Button>
        <Button variant="ghost" onClick={() => setModal("count")} className={btnOutline}>Stock Count</Button>
        <Button variant="ghost" onClick={() => setModal("product")} className={btnOutline}>Add new product</Button>
      </div>
      {error && <p className="text-sm text-primary">{(error as Error).message}</p>}
      {isLoading || !data || !stats ? <p className="text-sm text-muted-foreground">Loading stock…</p> : (<>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {([["Total products", stats.products], ["Total units", stats.units], ["Active batches", stats.batches],
            ...(showCost ? [["Stock value (cost)", gbp(stats.cost)]] : []), ["Retail value", gbp(stats.retail)],
            ...(showCost ? [["Gross margin", gbp(stats.margin)]] : []), ["Low stock", stats.low]] as [string, ReactNode][]).map(([l, v]) => (
            <Button key={l} variant="outline" onClick={() => { if (l === "Active batches") setModal("history"); else setMetric(l); }} className="h-auto min-h-20 flex-col items-start gap-1 whitespace-normal border-border p-3 text-left hover:bg-muted hover:text-foreground"><span className="text-xs font-normal text-muted-foreground">{l}</span><span className="text-lg font-semibold">{v}</span></Button>
          ))}
        </div>
        <div className="mb-3 flex gap-1 overflow-x-auto border-b border-border">
          <Button variant="ghost" onClick={() => setTab("active")} className={tabCls(tab === "active")}>Active stock ({prods.length})</Button>
          <Button variant="ghost" onClick={() => setTab("adjust")} className={tabCls(tab === "adjust")}>Stock Adjustments & Waste</Button>
          <Button variant="ghost" onClick={() => setTab("audit")} className={tabCls(tab === "audit")}>Stock movement audits/activity ({data.movements.length})</Button>
          <Button variant="ghost" onClick={() => setTab("bin")} className={tabCls(tab === "bin")}>Recycle bin ({data.batches.filter((b) => b.status === "archived").length})</Button>
        </div>
        {tab === "active" && <ActiveStock level={stockLevel} onLevelChange={setStockLevel} data={data} showCost={showCost} catName={catName} onAdjust={(id, batchId) => { setAdjustBatch(batchId); setAdjustFor(id); }} onReceive={(id) => { setReceiveFor(id); setModal("receive"); }} />}
        {tab === "adjust" && <AdjustmentsTab data={data} showCost={showCost} />}
        {tab === "audit" && <AuditTab data={data} showCost={showCost} isAdmin={isAdmin} onDone={refresh} />}
        {tab === "bin" && <RecycleBin data={data} isAdmin={isAdmin} onDone={refresh} />}
        {modal === "history" && <BatchHistory data={data} showCost={showCost} isAdmin={isAdmin} onDone={refresh} onClose={() => setModal(null)} />}
        {modal === "receive" && <ReceiveStock data={data} fixed={receiveFor} onClose={() => setModal(null)} onDone={refresh} />}
        {modal === "waste" && <RecordWaste data={data} showCost={showCost} onClose={() => setModal(null)} onDone={refresh} />}
        {modal === "count" && <StockCount data={data} onClose={() => setModal(null)} onDone={refresh} showCost={showCost} />}
        {adjustFor && <AdjustStock productId={adjustFor} initialBatch={adjustBatch} data={data} showCost={showCost} onClose={() => setAdjustFor(null)} onDone={refresh} />}
      </>)}
      {metric && data && <CardDetail metric={metric} data={data} catName={catName} showCost={showCost} onClose={() => setMetric(null)} />}
      {modal === "product" && (
        <ProductForm initial={null} categories={categories as any[]} saving={savingProduct}
          onCancel={() => setModal(null)}
          onSave={async (p) => {
            setSavingProduct(true);
            try { await upsertFn({ data: p }); toast.success(`"${p.name}" added to Products`); refresh(); setModal(null); }
            catch (e: any) { toast.error(e?.message ?? "Save failed"); } finally { setSavingProduct(false); }
          }} />
      )}
    </div></AccountShell>
  );
}

/* ---------- active stock ---------- */
function ActiveStock({ level, onLevelChange, data, showCost, catName, onAdjust, onReceive }: { level: string; onLevelChange: (v: string) => void; data: Data; showCost: boolean; catName: (id: string | null) => string; onAdjust: (id: string, batchId?: string) => void; onReceive: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleProduct = (id: string) => setExpanded((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const columnCount = showCost ? 10 : 8;
  const rows = stockProducts(data).filter((p) => { const units = unitsOf(data, p.id); const search = [p.name, p.sku, p.barcode, catName(p.category_id), ...batchesOf(data, p.id).flatMap((b) => [b.batch_code, b.supplier, b.reference])].some((v) => v?.toLowerCase().includes(q.toLowerCase())); return search && (level === "all" || (level === "low" && units <= n(p.min_stock)) || (level === "out" && units <= 0) || (level === "in" && units > 0)); });
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2"><SearchBox value={q} onChange={setQ} placeholder="Search stock (name, SKU, barcode, category, batch code, supplier)" /><select aria-label="Stock level" value={level} onChange={(e) => onLevelChange(e.target.value)} className="h-11 rounded-md border border-border bg-background px-3 text-sm"><option value="all">All stock levels</option><option value="in">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select></div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="inventory-stock-table w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>{["Product", "Category", ...(showCost ? ["Cost"] : []), "Price", "Units", "Low level", ...(showCost ? ["Cost value"] : []), "Batches", "Status", ""].map((h, i) => <th key={i} className="px-3 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const bs = batchesOf(data, p.id).filter((b) => n(b.remaining_qty) > 0);
              const units = bs.reduce((s, b) => s + n(b.remaining_qty), 0);
              const value = bs.reduce((s, b) => s + n(b.remaining_qty) * b.cost_pence, 0);
              const cost = bs[0]?.cost_pence ?? p.cost_price_pence;
              const status = units <= 0 ? "Out" : units <= n(p.min_stock) ? "Low" : "OK";
              const isExpanded = expanded.has(p.id);
              return (
                <Fragment key={p.id}>
                <tr onClick={() => toggleProduct(p.id)} className="cursor-pointer border-t border-border hover:bg-muted/50">
                  <td className="px-3 py-2 font-semibold"><Button variant="ghost" aria-expanded={isExpanded} aria-controls={`product-batches-${p.id}`} onClick={(e) => { e.stopPropagation(); toggleProduct(p.id); }} className="h-auto justify-start px-0 py-1 text-left hover:bg-transparent hover:text-foreground">{isExpanded ? <ChevronDown /> : <ChevronRight />}<>{p.image_url ? <img src={p.image_url} alt="" className="h-8 w-8 shrink-0 rounded-sm object-contain" /> : <Package className="h-8 w-8 text-muted-foreground" />}<span>{p.name}<span className="block text-xs font-normal text-muted-foreground">{p.sku ?? p.barcode ?? "—"}</span></span></></Button></td>
                  <td className="px-3 py-2">{catName(p.category_id)}</td>
                  {showCost && <td className="px-3 py-2">{gbp(cost)}</td>}
                  <td className="px-3 py-2">{gbp(p.retail_price_pence)}</td>
                  <td className="px-3 py-2 font-semibold">{units}</td>
                  <td className="px-3 py-2">{n(p.min_stock)}</td>
                  {showCost && <td className="px-3 py-2">{gbp(value)}</td>}
                  <td className="px-3 py-2">{bs.length}</td>
                  <td className="px-3 py-2"><span className={`rounded-sm px-2 py-1 text-xs font-bold ${status === "OK" ? "bg-muted" : "bg-primary text-primary-foreground"}`}>{status}</span></td>
                  <td className="px-3 py-2"><div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="sm" onClick={() => onAdjust(p.id)}>Adjust Stock</Button>
                    <Button variant="outline" size="sm" onClick={() => onReceive(p.id)} className="border-primary text-primary">Receive</Button>
                  </div></td>
                </tr>
                {isExpanded && <tr id={`product-batches-${p.id}`}><td colSpan={columnCount} className="bg-surface-elevated px-4 pb-3 pt-1">
                  <table aria-label={`Received batches for ${p.name}`} className="w-full whitespace-nowrap text-xs">
                    <thead className="text-left text-muted-foreground"><tr>
                      {["Batch", "Received", "Opening", "Remaining", ...(showCost ? ["Unit cost"] : []), "Price at delivery", ...(showCost ? ["Margin / unit", "Value left"] : []), "Supplier / ref", "FIFO", ""].map((heading, index) => <th key={index} className="px-2 py-2 font-semibold">{heading}</th>)}
                    </tr></thead>
                    <tbody>{bs.map((batch, index) => {
                      const price = batch.sale_price_pence ?? p.retail_price_pence;
                      return <tr key={batch.id} className="border-t border-border">
                        <td className="px-2 py-3 font-medium">{batch.batch_code}</td>
                        <td className="px-2 py-3">{ukDate(batch.received_at)}</td>
                        <td className="px-2 py-3">{n(batch.opening_qty)}</td>
                        <td className="px-2 py-3 font-semibold">{n(batch.remaining_qty)}</td>
                        {showCost && <td className="px-2 py-3">{gbp(batch.cost_pence)}</td>}
                        <td className="px-2 py-3">{gbp(price)}</td>
                        {showCost && <><td className="px-2 py-3 text-stock-current">{gbp(price - batch.cost_pence)}</td><td className="px-2 py-3">{gbp(n(batch.remaining_qty) * batch.cost_pence)}</td></>}
                        <td className="max-w-48 whitespace-normal px-2 py-3 text-muted-foreground">{[batch.supplier, batch.reference].filter(Boolean).join(" / ") || "—"}</td>
                        <td className="px-2 py-3"><span className={`inline-flex rounded-full px-2 py-1 font-semibold ${index === 0 ? "bg-stock-current text-stock-badge-foreground" : index === 1 ? "bg-stock-next text-stock-badge-foreground" : "bg-stock-later text-foreground"}`}>{index === 0 ? "Selling now" : index === 1 ? "Next batch" : `Later (#${index + 1})`}</span></td>
                        <td className="px-2 py-3"><Button variant="ghost" size="sm" onClick={() => onAdjust(p.id, batch.id)}><SlidersHorizontal /> Adjust Stock</Button></td>
                      </tr>;
                    })}</tbody>
                  </table>
                  {bs.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">No received batches with stock remaining.</p>}
                </td></tr>}
                </Fragment>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={columnCount} className="p-6 text-center text-muted-foreground">No stock products.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- adjustments & waste ---------- */
function AdjustmentsTab({ data, showCost }: { data: Data; showCost: boolean }) {
  const [sub, setSub] = useState(REASON_TYPES[0].name);
  const [q, setQ] = useState("");
  const [range, setRange] = useState<Range>({ key: "all" });
  const undone = new Set(data.undos.map((u) => u.movement_id));
  const adj = data.movements.filter((m) => !undone.has(m.id) && REASON_TYPES.some((r) => r.name === m.reason_type));
  const rows = adj.filter((m) => m.reason_type === sub && inRange(m.created_at, range) && matches(data.products.find((p) => p.id === m.product_id), q));
  return (
    <div>
      <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
        {REASON_TYPES.map((r) => <Button variant="ghost" key={r.name} onClick={() => setSub(r.name)} className={`h-10 shrink-0 rounded-sm px-3 text-xs font-semibold ${sub === r.name ? "bg-primary text-primary-foreground" : "border border-border"}`}>{r.name} ({adj.filter((m) => m.reason_type === r.name).length})</Button>)}
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{REASON_TYPES.find((r) => r.name === sub)?.help}</p>
      <div className="mb-3 flex flex-wrap gap-2"><SearchBox value={q} onChange={setQ} /><DateFilter value={range} onChange={setRange} /></div>
      <MovementTable rows={rows} data={data} showCost={showCost} />
    </div>
  );
}
function MovementTable({ rows, data, showCost }: { rows: Movement[]; data: Data; showCost: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No entries.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="py-2 pr-2">When</th><th className="pr-2">Product</th><th className="pr-2">Change</th><th className="pr-2">Before</th><th className="pr-2">After</th>{showCost && <th className="pr-2">Value</th>}<th>Reason</th></tr></thead>
        <tbody>{rows.map((m) => (
          <tr key={m.id} className="border-t border-border">
            <td className="py-2 pr-2">{ukDateTime(m.created_at)}</td>
            <td className="pr-2">{data.products.find((p) => p.id === m.product_id)?.name ?? "—"}</td>
            <td className={`pr-2 font-semibold ${n(m.quantity) < 0 ? "text-primary" : ""}`}>{n(m.quantity) > 0 ? "+" : ""}{n(m.quantity)}</td>
            <td className="pr-2">{n(m.qty_before)}</td><td className="pr-2">{n(m.qty_after)}</td>
            {showCost && <td className="pr-2">{gbp(m.cost_value_pence)}</td>}
            <td>{m.reason}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/* ---------- audit ---------- */
const typeLabel = (m: Movement) => {
  if (m.movement_type === "receive") return "Receipt";
  if (m.movement_type === "sale") return "Sale";
  if (m.movement_type === "count") return "Stocktake";
  if (m.movement_type === "undo") return "Undo";
  return ({ "Waste / Spoilage": "Waste", "Expired Stock": "Expired", "Stock Count Correction": "Stocktake" } as Record<string, string>)[m.reason_type ?? ""] ?? m.reason_type ?? m.movement_type;
};
function AuditTab({ data, showCost, isAdmin, onDone }: { data: Data; showCost: boolean; isAdmin: boolean; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [range, setRange] = useState<Range>({ key: "all" });
  const [busy, setBusy] = useState<string | null>(null);
  const undoMap = new Map(data.undos.map((u) => [u.movement_id, u]));
  const rows = data.movements.filter((m) => inRange(m.created_at, range) && matches(data.products.find((p) => p.id === m.product_id), q));
  const undo = async (m: Movement) => {
    const name = data.products.find((p) => p.id === m.product_id)?.name;
    const reason = prompt(`Undo this activity?\n\n${typeLabel(m)} · ${name} · ${n(m.quantity) > 0 ? "+" : ""}${n(m.quantity)}\n\nStock will be put back to how it was before and the original line stays here crossed out. Enter a reason:`);
    if (reason === null) return;
    setBusy(m.id);
    const { error } = await sb.rpc("undo_stock_movement", { _movement: m.id, _reason: reason });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Activity undone"); onDone();
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2"><SearchBox value={q} onChange={setQ} /><DateFilter value={range} onChange={setRange} /></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground"><tr>{["When", "Product", "Type", "Change", "Before", "After", ...(showCost ? ["Value"] : []), "Reason", ""].map((h, i) => <th key={i} className="py-2 pr-2">{h}</th>)}</tr></thead>
          <tbody>{rows.map((m) => {
            const u = undoMap.get(m.id);
            const canUndo = isAdmin && !u && m.movement_type !== "sale" && m.movement_type !== "undo" && !!m.batch_id;
            return (
              <tr key={m.id} className={`border-t border-border ${u ? "text-muted-foreground" : ""}`}>
                <td className={`py-2 pr-2 ${u ? "line-through" : ""}`}>{ukDateTime(m.created_at)}</td>
                <td className={`pr-2 ${u ? "line-through" : ""}`}>{data.products.find((p) => p.id === m.product_id)?.name ?? "—"}</td>
                <td className="pr-2">{typeLabel(m)}</td>
                <td className={`pr-2 font-semibold ${u ? "line-through" : n(m.quantity) < 0 ? "text-primary" : ""}`}>{n(m.quantity) > 0 ? "+" : ""}{n(m.quantity)}</td>
                <td className="pr-2">{n(m.qty_before)}</td><td className="pr-2">{n(m.qty_after)}</td>
                {showCost && <td className="pr-2">{gbp(m.cost_value_pence)}</td>}
                <td className="pr-2">{m.reason}{u && <div className="text-xs font-semibold text-primary">Undone {ukDateTime(u.undone_at)}{u.reason ? ` — Reason: ${u.reason}` : ""}</div>}</td>
                <td>{canUndo && <Button variant="ghost" disabled={busy === m.id} onClick={() => undo(m)} className={btnSm}>{busy === m.id ? "…" : "Undo"}</Button>}</td>
              </tr>
            );
          })}</tbody>
        </table>
        {rows.length === 0 && <p className="p-3 text-sm text-muted-foreground">No activity.</p>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">History is a permanent record. Undoing an activity puts stock back; the original line stays here crossed out.</p>
    </div>
  );
}

/* ---------- recycle bin ---------- */
function RecycleBin({ data, isAdmin, onDone }: { data: Data; isAdmin: boolean; onDone: () => void }) {
  const rows = data.batches.filter((b) => b.status === "archived");
  const restore = async (id: string) => {
    const { error } = await sb.rpc("set_stock_batch_archived", { _batch: id, _archived: false });
    if (error) return toast.error(error.message); toast.success("Batch restored"); onDone();
  };
  if (rows.length === 0) return <p className="p-6 text-center text-sm text-muted-foreground">Recycle bin is empty</p>;
  return (
    <div className="space-y-2">{rows.map((b) => (
      <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
        <span><b>{data.products.find((p) => p.id === b.product_id)?.name ?? "—"}</b> · {b.batch_code} · received {ukDate(b.received_at)}</span>
        {isAdmin && <Button variant="ghost" onClick={() => restore(b.id)} className={btnSm}>Restore</Button>}
      </div>
    ))}</div>
  );
}

/* ---------- summary card detail ---------- */
function CardDetail({ metric, data, catName, showCost, onClose }: { metric: string; data: Data; catName: (id: string | null) => string; showCost: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [range, setRange] = useState<Range>({ key: "all" });
  const [level, setLevel] = useState(metric === "Low stock" ? "low" : metric === "Total units" ? "in" : "all");
  const [open, setOpen] = useState<string | null>(null);
  const products = stockProducts(data);
  const needle = q.trim().toLowerCase().replace(/[£,]/g, "");
  const rows = products.map((p) => {
    const batches = batchesOf(data, p.id).filter((b) => range.key === "all" || inRange(b.received_at, range));
    const units = batches.reduce((s, b) => s + n(b.remaining_qty), 0);
    const cost = batches.reduce((s, b) => s + n(b.remaining_qty) * b.cost_pence, 0);
    const retail = units * p.retail_price_pence;
    const totalUnits = unitsOf(data, p.id);
    return { p, batches, units, cost, retail, margin: retail - cost, totalUnits };
  }).filter((r) => {
    if (range.key !== "all" && r.batches.length === 0) return false;
    if (level === "low" && !(r.totalUnits <= n(r.p.min_stock))) return false;
    if (level === "in" && !(r.totalUnits > 0)) return false;
    if (level === "out" && r.totalUnits > 0) return false;
    if (!needle) return true;
    const hay = [r.p.name, r.p.sku, r.p.barcode, catName(r.p.category_id), String(r.units), String(r.totalUnits), (r.p.retail_price_pence / 100).toFixed(2), (r.retail / 100).toFixed(2),
      ...(showCost ? [(r.p.cost_price_pence / 100).toFixed(2), (r.cost / 100).toFixed(2), (r.margin / 100).toFixed(2)] : []),
      ...r.batches.flatMap((b) => [b.batch_code, b.supplier, b.reference, b.notes, ukDate(b.received_at)])];
    return hay.some((v) => String(v ?? "").toLowerCase().includes(needle));
  });
  const sum = (k: "units" | "cost" | "retail" | "margin") => rows.reduce((s, r) => s + r[k], 0);
  return (
    <Modal title={metric} sub="Filter by received date, stock level or search any product, SKU, barcode, category, batch, supplier, reference, note or amount." onClose={onClose} wide>
      <div className="mb-3 flex flex-wrap gap-2"><SearchBox value={q} onChange={setQ} placeholder="Search name, SKU, barcode, category, batch, supplier, reference, notes, amount" /><DateFilter value={range} onChange={setRange} />
        <select aria-label="Stock level" value={level} onChange={(e) => setLevel(e.target.value)} className="h-11 rounded-sm border border-border bg-background px-2 text-sm"><option value="all">All stock levels</option><option value="in">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select></div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5 text-sm">
        <div className="rounded-md border border-border p-2"><span className="block text-xs text-muted-foreground">Products</span><b>{rows.length}</b></div>
        <div className="rounded-md border border-border p-2"><span className="block text-xs text-muted-foreground">Units</span><b>{sum("units")}</b></div>
        {showCost && <div className="rounded-md border border-border p-2"><span className="block text-xs text-muted-foreground">Stock value (cost)</span><b>{gbp(sum("cost"))}</b></div>}
        <div className="rounded-md border border-border p-2"><span className="block text-xs text-muted-foreground">Retail value</span><b>{gbp(sum("retail"))}</b></div>
        {showCost && <div className="rounded-md border border-border p-2"><span className="block text-xs text-muted-foreground">Gross margin</span><b>{gbp(sum("margin"))}</b></div>}
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th className="py-3 pr-2">Product</th><th className="pr-2">SKU / barcode</th><th className="pr-2">Category</th><th className="pr-2">Batches</th><th className="pr-2">Units</th><th className="pr-2">Min</th>{showCost && <th className="pr-2">Cost</th>}<th className="pr-2">Retail</th>{showCost && <th>Margin</th>}</tr></thead>
        <tbody>{rows.map((r) => (
          <Fragment key={r.p.id}>
            <tr onClick={() => setOpen(open === r.p.id ? null : r.p.id)} className="cursor-pointer border-t border-border hover:bg-muted/50" aria-expanded={open === r.p.id}>
              <td className="py-3 pr-2"><span className="inline-flex items-center gap-1">{open === r.p.id ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}{r.p.name}</span></td><td className="pr-2 text-muted-foreground">{r.p.sku ?? r.p.barcode ?? "—"}</td><td className="pr-2">{catName(r.p.category_id)}</td><td className="pr-2">{r.batches.length}</td><td className="pr-2">{r.units}</td><td className="pr-2">{n(r.p.min_stock)}</td>{showCost && <td className="pr-2">{gbp(r.cost)}</td>}<td className="pr-2">{gbp(r.retail)}</td>{showCost && <td>{gbp(r.margin)}</td>}
            </tr>
            {open === r.p.id && (
              <tr className="border-t border-border bg-muted/30"><td colSpan={9} className="p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Batches behind this product</p>
                {r.batches.length === 0 ? <p className="text-xs text-muted-foreground">No batches in this date range.</p> : (
                  <table className="w-full text-xs"><thead className="text-left uppercase tracking-wider text-muted-foreground"><tr>{["Received", "Batch", "Opening", "Remaining", ...(showCost ? ["Unit cost"] : []), "Sale price", "Supplier", "Reference", "Notes", "Status"].map((h, i) => <th key={i} className="py-1 pr-2">{h}</th>)}</tr></thead>
                    <tbody>{r.batches.map((b) => (
                      <tr key={b.id} className="border-t border-border">
                        <td className="py-1.5 pr-2">{ukDate(b.received_at)}</td><td className="pr-2">{b.batch_code}</td>
                        <td className="pr-2">{n(b.opening_qty)}</td><td className="pr-2">{n(b.remaining_qty)}</td>
                        {showCost && <td className="pr-2">{gbp(b.cost_pence)}</td>}
                        <td className="pr-2">{gbp(b.sale_price_pence ?? r.p.retail_price_pence)}</td>
                        <td className="pr-2">{b.supplier ?? "—"}</td><td className="pr-2">{b.reference ?? "—"}</td><td className="pr-2">{b.notes ?? "—"}</td>
                        <td className="pr-2">{b.status === "archived" ? "archived" : n(b.remaining_qty) <= 0 ? "sold out" : "active"}</td>
                      </tr>
                    ))}</tbody></table>
                )}
              </td></tr>
            )}
          </Fragment>
        ))}
        {rows.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">No products match.</td></tr>}</tbody></table></div>
      <p className="mt-2 text-[11px] text-muted-foreground">Click any product row to see the batches behind it.</p>
    </Modal>
  );
}

/* ---------- batch history ---------- */
function BatchHistory({ data, showCost, isAdmin, onDone, onClose }: { data: Data; showCost: boolean; isAdmin: boolean; onDone: () => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [range, setRange] = useState<Range>({ key: "all" });
  const rows = [...data.batches].reverse().filter((b) => inRange(b.received_at, range) && (matches(data.products.find((p) => p.id === b.product_id), q) || b.batch_code.toLowerCase().includes(q.toLowerCase())));
  const archive = async (id: string) => {
    if (!confirm("Move this sold-out batch to the Recycle bin? It can be restored later.")) return;
    const { error } = await sb.rpc("set_stock_batch_archived", { _batch: id, _archived: true });
    if (error) return toast.error(error.message); toast.success("Moved to Recycle bin"); onDone();
  };
  return (
    <Modal title="Batch history" sub="Every stock delivery, including sold-out and archived batches." onClose={onClose} wide>
      <div className="mb-3 flex flex-wrap gap-2"><SearchBox value={q} onChange={setQ} /><DateFilter value={range} onChange={setRange} /></div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left uppercase tracking-wider text-muted-foreground"><tr>{["Received", "Product", "Batch", "Opening", "Remaining", ...(showCost ? ["Unit cost"] : []), "Sale price", "Supplier", "Reference", "Notes", "Status", ""].map((h, i) => <th key={i} className="py-2 pr-2">{h}</th>)}</tr></thead>
          <tbody>{rows.map((b) => {
            const p = data.products.find((x) => x.id === b.product_id);
            const status = b.status === "archived" ? "archived" : n(b.remaining_qty) <= 0 ? "sold out" : "active";
            return (
              <tr key={b.id} className="border-t border-border">
                <td className="py-2 pr-2">{ukDate(b.received_at)}</td><td className="pr-2">{p?.name ?? "—"}</td><td className="pr-2">{b.batch_code}</td>
                <td className="pr-2">{n(b.opening_qty)}</td><td className="pr-2">{n(b.remaining_qty)}</td>
                {showCost && <td className="pr-2">{gbp(b.cost_pence)}</td>}
                <td className="pr-2">{gbp(b.sale_price_pence ?? p?.retail_price_pence)}</td>
                <td className="pr-2">{b.supplier ?? "—"}</td><td className="pr-2">{b.reference ?? "—"}</td><td className="pr-2">{b.notes ?? "—"}</td>
                <td className="pr-2">{status}</td>
                <td>{isAdmin && status === "sold out" && <Button variant="ghost" onClick={() => archive(b.id)} className={btnSm}>Archive</Button>}</td>
              </tr>
            );
          })}</tbody>
        </table>
        {rows.length === 0 && <p className="p-3 text-sm text-muted-foreground">No batches.</p>}
      </div>
    </Modal>
  );
}

/* ---------- receive stock ---------- */
function ReceiveStock({ data, fixed, onClose, onDone }: { data: Data; fixed: string | null; onClose: () => void; onDone: () => void }) {
  const init = fixed ? data.products.find((p) => p.id === fixed) : undefined;
  const [pid, setPid] = useState(fixed ?? "");
  const [unknown, setUnknown] = useState<string | null>(null);
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState(init ? (init.cost_price_pence / 100).toFixed(2) : "");
  const [price, setPrice] = useState(init ? (init.retail_price_pence / 100).toFixed(2) : "");
  const [supplier, setSupplier] = useState("");
  const { data: suppliers = [] } = useQuery({ queryKey: ["inventory-suppliers"], queryFn: async () => { const { data, error } = await sb.from("suppliers").select("id,name").order("name"); if (error) throw error; return data ?? []; } });
  const [reference, setReference] = useState("");
  const [received, setReceived] = useState(isoDay());
  const [notes, setNotes] = useState("");
  const [makeLive, setMakeLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<0 | 1 | 2>(0);
  const [firstQuantity, setFirstQuantity] = useState("");
  const pick = (id: string) => {
    setPid(id);
    const p = data.products.find((x) => x.id === id);
    if (p) { setCost((p.cost_price_pence / 100).toFixed(2)); setPrice((p.retail_price_pence / 100).toFixed(2)); }
  };
  const save = async () => {
    if (!pid) return toast.error("Choose a stock product");
    if (!Number.isFinite(Number(qty)) || !(Number(qty) > 0)) return toast.error("Enter the quantity received");
    if (confirmation === 0) { setConfirmation(1); return; }
    if (confirmation === 1 || firstQuantity !== qty) { setFirstQuantity(qty); setConfirmation(2); return; }
    setBusy(true);
    await linkBarcode(pid, unknown);
    const { error } = await sb.rpc("receive_stock_v2", { _product: pid, _qty: Number(qty), _cost_pence: Math.round(Number(cost || 0) * 100), _sale_price_pence: price ? Math.round(Number(price) * 100) : null, _make_live: makeLive, _supplier: supplier, _reference: reference, _received: received, _notes: notes });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Delivery saved"); onDone(); onClose();
  };
  return (
    <Modal title={init ? `Receive stock · ${init.name}` : "Receive stock"} onClose={onClose}>
      <div className="space-y-3">
        {!fixed && <div><Label>Product</Label><ProductPicker products={stockProducts(data)} value={pid} onChange={pick} onUnknownBarcode={setUnknown} /></div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><Label>Quantity received</Label><input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className={field} /></div>
          <div><Label>Cost per unit (£)</Label><input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" className={field} /></div>
          <div><Label>Selling price for this delivery (£)</Label><input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={field} /></div>
          <div><Label>Date received</Label><input type="date" value={received} onChange={(e) => setReceived(e.target.value)} className={field} /></div>
          <div><Label>Supplier</Label><select aria-label="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} className={field}><option value="">Optional</option>{suppliers.map((x: { id: string; name: string }) => <option key={x.id} value={x.name}>{x.name}</option>)}</select></div>
          <div><Label>Invoice / reference</Label><input value={reference} onChange={(e) => setReference(e.target.value)} className={field} /></div>
        </div>
        <div><Label>Notes</Label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-sm border border-border bg-background p-3 text-sm" rows={2} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={makeLive} onChange={(e) => setMakeLive(e.target.checked)} className="h-5 w-5" /> Also make this the product's live selling price</label>
        <p className="text-xs text-muted-foreground">A new batch is created with its own cost. Earlier deliveries keep the cost they were bought at, and sales always come out of the oldest delivery first.</p>
        <div className="mt-12 flex justify-end gap-3"><Button variant="ghost" onClick={onClose} className={btnOutline}>Cancel</Button><Button variant="ghost" onClick={save} disabled={busy} className={`${btn} bg-stock-action text-stock-badge-foreground hover:bg-stock-action/90`}>{busy ? "Saving…" : "Save delivery"}</Button></div>
        {confirmation > 0 && <DialogPrimitive.Root open onOpenChange={(open) => { if (!open && !busy) setConfirmation(0); }}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-[110] bg-foreground/60" /><DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[111] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-background p-6" aria-describedby="delivery-confirm-description"><DialogPrimitive.Title className="text-lg font-semibold">Quantity confirmation {confirmation} of 2</DialogPrimitive.Title><DialogPrimitive.Description id="delivery-confirm-description" className="mt-3 text-sm">Are you sure you entered the correct quantity of stock?</DialogPrimitive.Description><p className="mt-3 font-semibold">{data.products.find((p) => p.id === pid)?.name}</p><label className="mt-4 block text-sm font-semibold">Quantity entered<input aria-label="Confirm delivery quantity" type="number" min="0" value={qty} disabled={busy} onChange={(e) => setQty(e.target.value)} className={`${field} mt-2`} /></label><div className="mt-6 flex justify-end gap-3"><Button variant="outline" disabled={busy} onClick={() => setConfirmation(0)}>Back</Button><Button disabled={busy} onClick={save}>{busy ? "Saving…" : confirmation === 1 || firstQuantity !== qty ? "Confirm quantity" : "Confirm and save delivery"}</Button></div></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>}
      </div>
    </Modal>
  );
}

/* ---------- adjust stock ---------- */
function AdjustStock({ productId, initialBatch, data, showCost, onClose, onDone }: { productId: string; initialBatch?: string; data: Data; showCost: boolean; onClose: () => void; onDone: () => void }) {
  const p = data.products.find((x) => x.id === productId);
  const batches = batchesOf(data, productId);
  const withStock = batches.filter((b) => n(b.remaining_qty) > 0);
  const [tab, setTab] = useState<"adjust" | "history">("adjust");
  const [batch, setBatch] = useState<string>(initialBatch ?? withStock[0]?.id ?? batches[batches.length - 1]?.id ?? "");
  const [dir, setDir] = useState<"remove" | "add">("remove");
  const [qty, setQty] = useState("");
  const [type, setType] = useState(REASON_TYPES[0].name);
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [preview, setPreview] = useState("");
  useEffect(() => { if (!file) { setPreview(""); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState<Range>({ key: "all" });
  const b = batches.find((x) => x.id === batch);
  const q = Number(qty || 0);
  const delta = (dir === "remove" ? -1 : 1) * q;
  const before = unitsOf(data, productId);
  const tooMuch = dir === "remove" && b && q > n(b.remaining_qty);
  const undone = new Set(data.undos.map((u) => u.movement_id));
  const history = data.movements.filter((m) => m.product_id === productId && (!initialBatch || m.batch_id === batch) && !undone.has(m.id) && REASON_TYPES.some((r) => r.name === m.reason_type) && inRange(m.created_at, range));

  const save = async () => {
    if (!b) return toast.error("This product has never had a delivery. Use Receive stock first.");
    if (!(q > 0)) return toast.error("Enter a quantity");
    if (tooMuch) return toast.error(`Only ${n(b.remaining_qty)} left in this batch. Stock can never go below zero.`);
    setBusy(true);
    try {
      if (evidenceUrl && !/^https:\/\//i.test(evidenceUrl)) throw new Error("Evidence link must start with https://");
      const ev = file ? await uploadEvidence(file) : evidenceUrl || null;
      const { error } = await sb.rpc("adjust_stock", { _product: productId, _batch: batch, _delta: delta, _reason_type: type, _reason: reason, _evidence: ev, _movement_type: "adjustment" });
      if (error) throw error;
      toast.success("Stock adjusted"); onDone(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  if (!p) return null;
  return (
    <Modal title={`Adjust stock · ${p.name}`} sub="Update this batch or review its permanent adjustment record." onClose={onClose} >
      <div className="mb-3 flex gap-1 rounded-md bg-muted w-fit">
        <Button variant="ghost" onClick={() => setTab("adjust")} className={tabCls(tab === "adjust")}>Adjust stock</Button>
        <Button variant="ghost" onClick={() => setTab("history")} className={tabCls(tab === "history")}>Adjustments history</Button>
      </div>
      {tab === "history" ? (<><div className="mb-3 mt-16"><DateFilter value={range} onChange={setRange} alwaysDates /></div><div className="overflow-x-auto rounded-md border border-border"><table className="w-full text-sm"><thead className="text-left text-muted-foreground"><tr>{["When", "Type", "Change", "Before", "After", "Reason"].map((h) => <th key={h} className="px-2 py-2">{h}</th>)}</tr></thead><tbody>{history.map((m) => <tr key={m.id} className="border-t border-border"><td className="px-2 py-2">{ukDateTime(m.created_at)}</td><td className="px-2 py-2">{typeLabel(m)}</td><td className={`px-2 py-2 ${m.quantity < 0 ? "text-primary" : "text-stock-current"}`}>{m.quantity > 0 ? "+" : ""}{m.quantity}</td><td className="px-2 py-2">{n(m.qty_before)}</td><td className="px-2 py-2">{n(m.qty_after)}</td><td className="px-2 py-2">{m.reason}</td></tr>)}</tbody></table>{!history.length && <p className="p-4 text-sm text-muted-foreground">No adjustments in this period.</p>}</div></>) : batches.length === 0 ? (
        <p className="text-sm text-muted-foreground">This product has never had a delivery. Use Receive stock first.</p>
      ) : (
        <div className="space-y-3">
          {b && <p className="text-xs text-muted-foreground">Batch <b>{b.batch_code}</b> currently holds <b>{n(b.remaining_qty)}</b> units.</p>}
          <div className="grid gap-3 sm:grid-cols-2"><div><Label>Reason type</Label><select aria-label="Reason type" value={type} onChange={(e) => setType(e.target.value)} className={field}>{REASON_TYPES.map((r) => <option key={r.name}>{r.name}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">{REASON_TYPES.find((r) => r.name === type)?.help}</p></div><div><Label>Direction</Label><select aria-label="Direction" value={dir} onChange={(e) => setDir(e.target.value === "add" ? "add" : "remove")} className={field}><option value="remove">Remove from stock</option><option value="add">Add to stock</option></select></div></div>
          <div><Label>Quantity</Label><input aria-label="Adjustment quantity" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className={field} /></div>
          <div><Label>Reason (optional)</Label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. 2 bottles cracked in transit" className={field} /></div>
          <div className="grid gap-3 sm:grid-cols-2"><div><Label>Batch</Label>
            <select value={batch} onChange={(e) => setBatch(e.target.value)} className={field}>
              {batches.map((x) => <option key={x.id} value={x.id}>{x.batch_code} · {n(x.remaining_qty)}{showCost ? ` @ ${gbp(x.cost_pence)}` : ""}</option>)}
            </select>
          </div>
          <div><Label>Photo evidence (optional)</Label><div className="flex gap-3"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted">{preview || evidenceUrl ? <img src={preview || evidenceUrl} alt="Evidence preview" className="h-full w-full rounded-md object-cover" /> : <span className="text-xs text-muted-foreground">No image</span>}</div><div className="min-w-0 flex-1"><Button variant="outline" asChild><label className="cursor-pointer"><Upload />Upload<input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setEvidenceUrl(""); }} className="hidden" /></label></Button><div className="mt-2 flex gap-2"><input aria-label="Photo evidence URL" value={evidenceUrl} onChange={(e) => { setEvidenceUrl(e.target.value); setFile(null); }} placeholder="…or paste image URL" className={field} /><Button variant="outline" size="icon" title="Use image link" aria-label="Use image link" disabled={!evidenceUrl} onClick={() => { if (!/^https:\/\//i.test(evidenceUrl)) toast.error("Evidence link must start with https://"); else toast.success("Image link selected"); }}><Link /></Button></div></div></div></div></div>
          <div className="rounded-md border border-border p-3 text-sm grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col text-xs text-muted-foreground"><span>Product quantity before → after</span><b className={tooMuch ? "text-primary" : ""}>{before} → {Math.max(0, before + delta)}</b></div>
            {showCost && <div className="flex flex-col text-xs text-muted-foreground"><span>Inventory value (accounting, at cost)</span><b>{gbp(q * (b?.cost_pence ?? 0))}</b></div>}
            <div className="flex flex-col text-xs text-muted-foreground"><span>Potential retail value (info only)</span><b>{gbp(q * p.retail_price_pence)}</b></div>
            <p className="text-xs text-muted-foreground sm:col-span-3">No sale or sales VAT is created.</p>
          </div>
          <p className="text-xs text-muted-foreground">Stock can never go below zero. The change is saved permanently with the time and balances before and after.</p><div className="mt-4 flex justify-end gap-3"><Button variant="ghost" onClick={onClose} className={btnOutline}>Cancel</Button><Button variant="ghost" onClick={save} disabled={busy || !q || !!tooMuch} className={`${btn} bg-stock-action text-stock-badge-foreground hover:bg-stock-action/90`}>{busy ? "Saving…" : "Save adjustment"}</Button></div>
        </div>
      )}
    </Modal>
  );
}

/* ---------- record waste ---------- */
function RecordWaste({ data, showCost, onClose, onDone }: { data: Data; showCost: boolean; onClose: () => void; onDone: () => void }) {
  const [pid, setPid] = useState(""); const [changing, setChanging] = useState(true);
  const [qty, setQty] = useState(1); const [type, setType] = useState(WASTE_TYPES[0]); const [notes, setNotes] = useState(""); const [busy, setBusy] = useState(false);
  const product = data.products.find((p) => p.id === pid);
  let need = qty, estimate = 0;
  for (const b of batchesOf(data, pid).filter((b) => n(b.remaining_qty) > 0)) { const take = Math.min(need, n(b.remaining_qty)); estimate += take * b.cost_pence; need -= take; if (need <= 0) break; }
  const save = async () => {
    if (!product || !(qty > 0)) return toast.error("Choose a product and quantity");
    if (qty > unitsOf(data, pid)) return toast.error(`Only ${unitsOf(data, pid)} in stock.`);
    setBusy(true);
    const { error } = await sb.rpc("adjust_stock", { _product: pid, _batch: null, _delta: -qty, _reason_type: type, _reason: notes, _evidence: null, _movement_type: "waste" });
    setBusy(false); if (error) return toast.error(error.message);
    toast.success("Waste recorded"); onDone(); onClose();
  };
  return <Modal title="Record Waste" sub="Remove spoiled, damaged, expired or given-away items. Taken from the oldest batch first and valued at cost." onClose={onClose}>
    {changing ? <div className="mb-5"><ProductPicker products={stockProducts(data)} value={pid} onChange={(id) => { setPid(id); setQty(1); setChanging(false); }} /></div> : <div className="mb-5 flex items-center justify-between rounded-md border border-border p-3"><div className="text-sm font-semibold">{product?.name}<span className="block text-xs font-normal text-muted-foreground">{unitsOf(data, pid)} in stock</span></div><Button variant="ghost" onClick={() => setChanging(true)}>Change</Button></div>}
    <div className="space-y-5">
      <div><Label>Quantity wasted</Label><div className="flex gap-2"><Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))}><Minus /></Button><input aria-label="Quantity wasted" type="number" min="1" value={qty} onChange={(e) => setQty(Number(e.target.value))} className={`${field} text-center`} /><Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Increase quantity" onClick={() => setQty(qty + 1)}><Plus /></Button></div></div>
      <div><Label>Type of waste</Label><select aria-label="Type of waste" value={type} onChange={(e) => setType(e.target.value)} className={field}>{WASTE_TYPES.map((w) => <option key={w}>{w}</option>)}</select></div>
      <div><Label>Notes (optional)</Label><textarea aria-label="Waste notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. damaged packaging, end of day leftovers" rows={3} className="w-full rounded-md border border-border bg-background p-3 text-sm" /></div>
      {showCost && <p className="text-sm text-muted-foreground">Estimated cost: <b>{gbp(estimate)}</b></p>}
    </div>
    <div className="mt-12 flex justify-end gap-3"><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={save} disabled={busy || !pid || !(qty > 0)}>{busy ? "Saving…" : "Record waste"}</Button></div>
  </Modal>;
}

/* ---------- stock count ---------- */
function StockCount({ data, showCost, onClose, onDone }: { data: Data; showCost: boolean; onClose: () => void; onDone: () => void }) {
  const [lines, setLines] = useState<{ pid: string; counted: number; batch: string }[]>([]);
  const [unknown, setUnknown] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [exclude, setExclude] = useState(false);
  const sys = (pid: string) => unitsOf(data, pid);
  const add = async (pid: string) => {
    if (unknown) { await linkBarcode(pid, unknown); setUnknown(null); }
    setLines((ls) => ls.some((l) => l.pid === pid) ? ls.map((l) => l.pid === pid ? { ...l, counted: l.counted + 1 } : l) : [...ls, { pid, counted: 1, batch: "" }]);
  };
  const diffs = lines.filter((l) => l.counted !== sys(l.pid));
  const post = async () => {
    if (diffs.some((l) => !l.batch)) return toast.error("Choose a received batch for each correction");
    // Missing items come from the chosen batch first, then the other batches (oldest first).
    const plans = diffs.map((l) => {
      const delta = l.counted - sys(l.pid);
      if (delta >= 0) return { l, steps: [{ batch: l.batch, delta }] };
      const all = batchesOf(data, l.pid).filter((b) => n(b.remaining_qty) > 0);
      const order = [...all.filter((b) => b.id === l.batch), ...all.filter((b) => b.id !== l.batch)];
      let need = -delta; const steps: { batch: string; delta: number }[] = [];
      for (const b of order) { if (need <= 0) break; const take = Math.min(need, n(b.remaining_qty)); steps.push({ batch: b.id, delta: -take }); need -= take; }
      return { l, steps, short: need > 0 };
    });
    if (plans.some((p) => p.short)) return toast.error("There are not enough units across all batches for this correction. Check the count.");
    const spread = plans.filter((p) => p.steps.length > 1);
    const note = spread.length ? `\n\nThe chosen batch does not hold enough units, so the remaining missing items will also be removed from the other batches (oldest first).` : "";
    if (!confirm(`Post ${diffs.length} correction(s)? Extra items found are added to stock; missing items are removed.${note}`)) return;
    setBusy(true); let ok = 0;
    for (const { l, steps } of plans) {
      let running = sys(l.pid); let failed = false; let pending = false;
      for (const s of steps) {
        const { data: result, error } = await sb.rpc("post_stock_count", { _product: l.pid, _batch: s.batch, _counted: running + s.delta, _expected: running, _exclude_financial: exclude });
        if (error) { toast.error(error.message); failed = true; break; }
        if (result?.pending) pending = true; else running += s.delta;
      }
      if (!failed) { ok++; if (pending) toast.info("Correction submitted for administrator approval"); }
    }
    setBusy(false); onDone(); if (ok === diffs.length) { toast.success(`${ok} correction(s) posted`); onClose(); }
  };
  return <Modal title="Stock Count" sub="Scan or search each product and enter how many you physically counted. Scanning the same item again adds 1. Extra items found are added to stock; missing items are removed." onClose={onClose}>
    <ProductPicker mode="search" products={stockProducts(data)} value="" onChange={add} onUnknownBarcode={setUnknown} />
    <div className="mt-12 space-y-3">{lines.map((l) => { const d = l.counted - sys(l.pid); return <div key={l.pid} className="rounded-md border border-border p-3"><div className="flex items-center gap-4"><div className="flex-1 text-sm font-semibold">{data.products.find((p) => p.id === l.pid)?.name}<span className="block text-xs font-normal text-muted-foreground">System: {sys(l.pid)}<span className="block">In the box, enter the number of items you physically have in stock</span></span></div><input aria-label={`Counted ${data.products.find((p) => p.id === l.pid)?.name}`} type="number" min="0" value={l.counted} onChange={(e) => setLines((ls) => ls.map((x) => x.pid === l.pid ? { ...x, counted: Math.max(0, Number(e.target.value)) } : x))} className="h-10 w-20 rounded-md border border-border bg-background text-center text-sm" /><span className={`w-16 text-right text-sm font-semibold ${d < 0 ? "text-primary" : "text-stock-current"}`}>{d > 0 ? "+" : ""}{d}</span><Button variant="ghost" size="icon" aria-label="Remove counted product" title="Remove" onClick={() => setLines((ls) => ls.filter((x) => x.pid !== l.pid))}><Trash2 /></Button></div><div className="mt-4"><Label>Which received batch should this change apply to?</Label><select aria-label={`Batch for ${data.products.find((p) => p.id === l.pid)?.name}`} value={l.batch} onChange={(e) => setLines((ls) => ls.map((x) => x.pid === l.pid ? { ...x, batch: e.target.value } : x))} className={field}><option value="">Choose batch</option>{batchesOf(data, l.pid).map((b) => <option key={b.id} value={b.id}>{b.batch_code} · {n(b.remaining_qty)}{showCost ? ` @ ${gbp(b.cost_pence)}` : ""}</option>)}</select></div></div>; })}</div>
    {lines.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">No items counted yet.</p>}
    {showCost && <CountFinancialPreview data={data} lines={lines} sys={sys} exclude={exclude} />}
    <label className="mt-12 flex min-h-28 items-start gap-3 rounded-md border border-border px-3 py-4 text-sm"><input type="checkbox" checked={exclude} onChange={(e) => setExclude(e.target.checked)} disabled={busy} className="mt-0.5 h-4 w-4" /><span><b>Change does not apply to financial report</b><span className="block text-xs text-muted-foreground">Stock figures change, but no profit or loss is posted to Profit &amp; Loss, Balance Sheet or the ledger.</span><span className="mt-2 block text-xs text-muted-foreground">This is to help the business correct the stock entry if the stock controller made an error when receiving the batch/stock. If this box is unchecked, stock increases or decreases will be reflected in the Profit &amp; Loss statement, Balance Sheet and ledger. Stock count corrections do not move cash.</span></span></label>
    <div className="mt-4 flex justify-end gap-3"><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={post} disabled={busy || !diffs.length} className="bg-stock-action text-stock-badge-foreground hover:bg-stock-action/90">{busy ? "Posting…" : `Post ${diffs.length} correction(s)`}</Button></div>
  </Modal>;
}

/* ---------- stock count: financial impact preview ---------- */
function countValuePence(data: Data, l: { pid: string; counted: number; batch: string }, system: number) {
  const delta = l.counted - system;
  if (delta === 0) return 0;
  const all = batchesOf(data, l.pid);
  const chosen = all.find((b) => b.id === l.batch) ?? all[0];
  if (delta > 0) return Math.round(delta * (chosen?.cost_pence ?? 0));
  const order = [...all.filter((b) => b.id === chosen?.id), ...all.filter((b) => b.id !== chosen?.id)].filter((b) => n(b.remaining_qty) > 0);
  let need = -delta; let value = 0;
  for (const b of order) { if (need <= 0) break; const take = Math.min(need, n(b.remaining_qty)); value -= take * b.cost_pence; need -= take; }
  return Math.round(value);
}

function CountFinancialPreview({ data, lines, sys, exclude }: { data: Data; lines: { pid: string; counted: number; batch: string }[]; sys: (pid: string) => number; exclude: boolean }) {
  const now = new Date();
  const [from, setFrom] = useState(isoDay(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(isoDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const plFn = useServerFn(getProfitLoss);
  const pl = useQuery({ queryKey: ["profit-loss", from, to], queryFn: () => plFn({ data: { fromDate: from, toDate: to } }), enabled: !!from && !!to && from <= to });
  const impact = lines.reduce((s, l) => s + countValuePence(data, l, sys(l.pid)), 0);
  const applied = exclude ? 0 : impact;
  const net = pl.data?.netProfitPence ?? 0;
  const gross = pl.data?.grossProfitPence ?? 0;
  const cogs = pl.data?.cogsPence ?? 0;
  const inv = pl.data?.stockInventoryAssetPence ?? 0;
  const tone = (v: number) => (v < 0 ? "text-destructive" : v > 0 ? "text-stock-current" : "text-muted-foreground");
  const signed = (v: number) => `${v > 0 ? "+" : ""}${gbp(v)}`;
  const Row = ({ label, before, after }: { label: string; before: number; after: number }) => (
    <tr className="border-t border-border"><td className="py-2 pr-3">{label}</td><td className="py-2 pr-3 text-right">{gbp(before)}</td><td className={`py-2 pr-3 text-right font-semibold ${tone(after - before)}`}>{gbp(after)}</td><td className={`py-2 text-right font-semibold ${tone(after - before)}`}>{signed(after - before)}</td></tr>
  );
  return <div className="mt-8 rounded-md border border-border p-4 text-sm">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><b className="text-base">Net profit</b><span className="block text-xs text-muted-foreground">{ukDate(from)} – {ukDate(to)}</span></div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block h-10 rounded-md border border-border bg-background px-2 text-sm" /></label>
        <label className="text-xs">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block h-10 rounded-md border border-border bg-background px-2 text-sm" /></label>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-6">
      <div><span className="block text-xs text-muted-foreground">Current net profit</span><span className="text-2xl font-bold">{pl.isLoading ? "…" : gbp(net)}</span></div>
      {lines.length > 0 && <div><span className="block text-xs text-muted-foreground">Net profit once saved</span><span className={`text-2xl font-bold ${tone(applied)}`}>{pl.isLoading ? "…" : gbp(net + applied)}</span></div>}
    </div>
    {pl.error && <p className="mt-2 text-xs text-destructive">Could not load profit figures.</p>}
    {lines.length > 0 && <>
      <p className="mt-4 font-semibold">What saving this count will do</p>
      <p className={`text-xs ${tone(impact)}`}>Stock value change: {signed(impact)} (valued at batch cost).</p>
      {exclude
        ? <p className="mt-2 text-xs text-muted-foreground">"Change does not apply to financial report" is ticked: only stock quantities change. Profit &amp; Loss, Balance Sheet, Cash Flow, ledger and sales are not affected.</p>
        : <>
          <table className="mt-3 w-full text-xs"><thead><tr className="text-muted-foreground"><th className="pb-1 text-left font-normal">Figure</th><th className="pb-1 text-right font-normal">Now</th><th className="pb-1 text-right font-normal">Once saved</th><th className="pb-1 text-right font-normal">Change</th></tr></thead><tbody>
            <Row label="Profit & Loss · Cost of goods" before={cogs} after={cogs - applied} />
            <Row label="Profit & Loss · Gross profit" before={gross} after={gross + applied} />
            <Row label="Profit & Loss · Net profit" before={net} after={net + applied} />
            <Row label="Balance Sheet · Stock (inventory) adjustment" before={inv} after={inv + applied} />
          </tbody></table>
          <ul className="mt-3 space-y-1 text-xs">
            <li><b>Affected:</b> Profit &amp; Loss, Balance Sheet (stock value and retained profit), ledger.</li>
            <li><b>Not affected:</b> Cash Flow (no money moves) and Sales (no sale is created).</li>
          </ul>
        </>}
    </>}
  </div>;
}
