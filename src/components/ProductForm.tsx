import { useState } from "react";
import { Upload, ImageIcon, Crop, Undo2, Eraser, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ImageEditor } from "@/components/ImageEditor";
import { rememberOriginal, getOriginal } from "@/lib/original-image";
import { BarcodeScanner } from "@/components/BarcodeScanner";



export function ProductForm({
  initial,
  categories,
  onCancel,
  onSave,
  onDelete,
  saving,
  defaultCategoryId,
}: {
  initial: any;
  categories: any[];
  onCancel: () => void;
  onSave: (p: any) => void;
  onDelete?: () => void;
  saving: boolean;
  defaultCategoryId?: string | null;
}) {
  const [scanOpen, setScanOpen] = useState(false);
  const [form, setForm] = useState({
    id: initial?.id,
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    sku: initial?.sku ?? "",
    barcode: initial?.barcode ?? "",
    category_id: initial?.category_id ?? defaultCategoryId ?? "",
    cost_price_pence: initial?.cost_price_pence ?? 0,
    retail_price_pence: initial?.retail_price_pence ?? 0,
    vat_rate: initial?.vat_rate ?? 0,
    stock_qty: initial?.stock_qty ?? 0,
    min_stock: initial?.min_stock ?? 0,
    is_service: initial?.is_service ?? false,
    is_active: initial?.is_active ?? true,
    image_url: initial?.image_url ?? "",
  });
  const penceToStr = (p: number) => (p ? String(p / 100) : "");
  const [costStr, setCostStr] = useState(penceToStr(form.cost_price_pence));
  const [retailStr, setRetailStr] = useState(penceToStr(form.retail_price_pence));
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [editing, setEditing] = useState<string | null>(null);

  async function uploadBlob(blob: Blob, ext: string) {
    const contentType = blob.type || (ext === "png" ? "image/png" : "image/jpeg");
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("product-images").upload(path, blob, { contentType, upsert: false });
    if (upErr) throw upErr;
    const { data, error } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (error) throw error;
    return data.signedUrl;
  }

  async function handleImageUpload(file: File) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { alert("Image must be under 15MB."); return; }
    setUploading(true);
    try {
      const { compressImage } = await import("@/lib/image-compress");
      setStatus("Uploading…");
      // Upload exactly what was picked — the background is only removed on request.
      const compressed = await compressImage(file, { maxDim: 1200, quality: 0.82, targetBytes: 120 * 1024, minQuality: 0.55 });
      const url = await uploadBlob(compressed, "jpg");
      setForm((f) => ({ ...f, image_url: url }));
    } catch (e: any) {
      alert(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      setStatus("");
    }
  }

  async function handleRemoveBackground() {
    if (!form.image_url) return;
    setUploading(true);
    try {
      setStatus("Removing background…");
      const res = await fetch(form.image_url);
      if (!res.ok) throw new Error("Could not load that image");
      const source = await removeBg(await res.blob());
      setStatus("Uploading…");
      const { compressImage } = await import("@/lib/image-compress");
      const asFile = new File([source], "product.jpg", { type: source.type || "image/jpeg" });
      const compressed = await compressImage(asFile, { maxDim: 1200, quality: 0.82, targetBytes: 120 * 1024, minQuality: 0.55 });
      const url = await uploadBlob(compressed, "jpg");
      const previous = getOriginal(form.image_url) || form.image_url;
      rememberOriginal(url, previous);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (e: any) {
      alert(e?.message ?? "Background removal failed");
    } finally {
      setUploading(false);
      setStatus("");
    }
  }

  async function removeBg(blob: Blob) {
    const { removeBackgroundToWhite } = await import("@/lib/bgRemove");
    return await removeBackgroundToWhite(blob);
  }



  const wrapperCls = "fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-2 sm:p-4";
  const panelCls = "relative max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-md border border-border bg-surface px-5 pb-5";
  return (
    <div className={wrapperCls}>
      <div className={panelCls}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface py-4">
          <h2 className="font-display text-2xl uppercase">{initial ? "Edit product" : "New product"}</h2>
          <Button variant="outline" size="icon" aria-label="Close product popup" title="Close" onClick={onCancel}><X /></Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Name" full>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" />
          </Field>
          <Field label="SKU">
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" />
          </Field>
          <Field label="Barcode">
            <div className="flex gap-2">
              <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" />
              <button type="button" onClick={() => setScanOpen(true)} className="rounded-sm border border-border px-3 text-sm">Scan</button>
            </div>
            {scanOpen && <BarcodeScanner onClose={() => setScanOpen(false)} onDetected={(code) => { setScanOpen(false); setForm((f: any) => ({ ...f, barcode: code })); }} />}
          </Field>
          <Field label="Category">
            <select value={form.category_id ?? ""} onChange={(e) => setForm({ ...form, category_id: e.target.value || null })} className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm">
              <option value="">— none —</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Cost price (£)">
            <input type="text" inputMode="decimal" placeholder="0" value={costStr} onChange={(e) => setCostStr(e.target.value)} className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" />
          </Field>
          <Field label="Retail price (£)">
            <input type="text" inputMode="decimal" placeholder="0" value={retailStr} onChange={(e) => setRetailStr(e.target.value)} className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" />
          </Field>
          <Field label="Stock qty">
            <div className="rounded-sm border border-dashed border-border bg-surface-elevated px-3 py-2 text-sm text-ink-muted">
              {form.is_service ? "—" : <span className="font-semibold text-ink">{form.stock_qty}</span>}
              <span className="ml-2 text-[10px] uppercase tracking-widest">Managed in Stock/Inventory</span>
            </div>
          </Field>
          <Field label="Min stock alert">
            <input type="number" min={0} value={form.min_stock} disabled={form.is_service} onChange={(e) => setForm({ ...form, min_stock: +e.target.value })} className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" />
          </Field>
          <Field label="Description" full>
            <textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded-sm border border-border bg-input px-3 py-2 text-sm" />
          </Field>
          <Field label="Product image" full>
            <div className="flex flex-wrap items-center gap-3">
              {form.image_url ? (
                <img src={form.image_url} alt="Product" loading="lazy" decoding="async" className="h-16 w-16 rounded-sm border border-border bg-white object-contain" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-sm border border-dashed border-border text-ink-muted">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-border bg-input px-3 py-2 text-xs uppercase tracking-widest hover:bg-surface-elevated">
                <Upload className="h-3.5 w-3.5" />
                {uploading ? (status || "Uploading…") : form.image_url ? "Replace image" : "Upload image"}
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.currentTarget.value = ""; }} />
              </label>
              {form.image_url && (
                <button type="button" disabled={uploading} onClick={handleRemoveBackground} className="inline-flex items-center gap-2 rounded-sm border border-border bg-input px-3 py-2 text-xs uppercase tracking-widest hover:bg-surface-elevated disabled:opacity-40">
                  <Eraser className="h-3.5 w-3.5" /> Remove background
                </button>
              )}
              {form.image_url && (
                <button type="button" onClick={() => setEditing(form.image_url)} className="inline-flex items-center gap-2 rounded-sm border border-border bg-input px-3 py-2 text-xs uppercase tracking-widest hover:bg-surface-elevated">
                  <Crop className="h-3.5 w-3.5" /> Crop / erase
                </button>
              )}
              {form.image_url && getOriginal(form.image_url) && (
                <button type="button" onClick={() => setForm({ ...form, image_url: getOriginal(form.image_url) || form.image_url })} className="inline-flex items-center gap-2 rounded-sm border border-border bg-input px-3 py-2 text-xs uppercase tracking-widest hover:bg-surface-elevated">
                  <Undo2 className="h-3.5 w-3.5" /> Revert to original
                </button>
              )}
              {form.image_url && (
                <button type="button" onClick={() => setForm({ ...form, image_url: "" })} className="text-xs uppercase tracking-widest text-primary">Remove</button>
              )}
              <p className="w-full text-[10px] uppercase tracking-widest text-ink-muted">Images upload exactly as you took them. Tap Remove background to place the product on pure white.</p>


            </div>
          </Field>

          <label className="flex items-center gap-2 text-xs uppercase tracking-widest">
            <input type="checkbox" checked={form.is_service} onChange={(e) => setForm({ ...form, is_service: e.target.checked })} /> Service (no stock)
          </label>
          <label className="flex items-center gap-2 text-xs uppercase tracking-widest">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
          </label>
        </div>
        <div className="mt-5 flex flex-wrap justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            {onDelete && (
              <button onClick={() => { if (confirm("Move this product to the Recycle Bin?")) onDelete(); }} className="text-xs uppercase tracking-widest text-primary">Move to Recycle Bin</button>
            )}
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={onCancel} className="rounded-sm border border-border px-4 py-2 text-xs uppercase tracking-widest">Cancel</button>
            <button
              disabled={saving || uploading || !form.name || form.retail_price_pence < 0}
              onClick={() => onSave({
                id: form.id,
                name: form.name,
                description: form.description || undefined,
                sku: form.sku || null,
                barcode: form.barcode || null,
                category_id: form.category_id || null,
                image_url: form.image_url || null,
                cost_price_pence: Math.round(parseFloat(costStr || "0") * 100) || 0,
                retail_price_pence: Math.round(parseFloat(retailStr || "0") * 100) || 0,
                vat_rate: 0,
                min_stock: form.min_stock,
                is_service: form.is_service,
                is_active: form.is_active,
              })}
              className="rounded-sm bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
            >{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </div>
      <ImageEditor
        open={!!editing}
        source={editing}
        onClose={() => setEditing(null)}
        onSave={async (blob, ext) => {
          const url = await uploadBlob(blob, ext);
          const prevOriginal = getOriginal(form.image_url) || form.image_url;
          if (prevOriginal) rememberOriginal(url, prevOriginal);
          setForm((f) => ({ ...f, image_url: url }));
        }}

      />
    </div>

  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-ink-muted">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
