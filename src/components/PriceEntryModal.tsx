import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTitlePresets } from "@/lib/title-presets.functions";

export function PriceEntryModal({
  productId,
  productName,
  initialPence,
  onCancel,
  onConfirm,
}: {
  productId?: string | null;
  productName: string;
  initialPence?: number | null;
  onCancel: () => void;
  onConfirm: (pence: number, nameOverride?: string, mileage?: number | null) => void;
}) {
  const [value, setValue] = useState(
    initialPence != null && initialPence > 0 ? (initialPence / 100).toFixed(2) : ""
  );
  const [suffix, setSuffix] = useState("");
  const [mileage, setMileage] = useState("");
  const parsed = Number(value.replace(/[£,\s]/g, ""));
  const valid = Number.isFinite(parsed) && parsed >= 0 && value.trim() !== "";

  const listFn = useServerFn(listTitlePresets);
  const { data: presets = [] } = useQuery({
    queryKey: ["title-presets", productId],
    queryFn: () => listFn({ data: { productId: productId! } }),
    enabled: !!productId,
    staleTime: 60_000,
  });

  const suggestions = useMemo(() => {
    const q = suffix.trim().toLowerCase();
    if (!q) return [];
    return (presets as { id: string; title: string }[])
      .filter((p) => p.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [presets, suffix]);

  const fullName = `${productName} ${suffix.trim()}`.trim();
  const submit = () => {
    if (!valid) return;
    onConfirm(
      Math.round(parsed * 100),
      fullName && fullName !== productName ? fullName : undefined,
      Number(mileage.replace(/[^0-9]/g, "")) || null,
    );
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-5 sm:pt-8" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[640px] overflow-hidden rounded-lg border-2 border-primary bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border bg-primary px-5 py-3 text-primary-foreground">
          <h2 className="font-display text-xl uppercase tracking-widest">Enter price</h2>
          <button onClick={onCancel} aria-label="Close" className="rounded-sm p-1 hover:bg-primary-foreground/20">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Product title
            </span>
          </div>
          <div className="relative mt-1">
            <div className="flex items-center gap-2 rounded-md border-2 border-border bg-input px-3 py-2 focus-within:border-primary">
              <span className="whitespace-nowrap text-base font-bold">{productName}</span>
              <input
                type="text"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                placeholder="optional extra detail…"
                className="w-full bg-transparent text-base font-semibold outline-none"
              />
            </div>
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-surface shadow-xl">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSuffix(s.title)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-elevated"
                    >
                      {productName} <span className="font-semibold">{s.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-4 flex items-end gap-3">
          <label className="block flex-1">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Price in £ (e.g. 12.50)
            </span>
            <input
              autoFocus
              inputMode="decimal"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") onCancel();
              }}
              placeholder="0.00"
              className="mt-2 w-full rounded-md border-2 border-border bg-input px-4 text-center font-bold tracking-wide focus:border-primary focus:outline-none"
              style={{ height: "1in", minHeight: "96px", fontSize: "36px", lineHeight: "1.1" }}
            />
          </label>
          <label className="block shrink-0" style={{ width: "1in" }}>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Milagge</span>
            <input
              inputMode="numeric"
              type="text"
              value={mileage}
              onChange={(e) => setMileage(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="0"
              className="mt-2 w-full rounded-md border-2 border-border bg-input px-1 text-center text-sm font-bold focus:border-primary focus:outline-none"
              style={{ height: "1in", minHeight: "96px" }}
            />
          </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-surface-elevated px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded-sm border border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest hover:border-primary"
          >
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={submit}
            className="rounded-sm bg-primary px-6 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >
            Add to cart
          </button>
        </div>
      </div>

    </div>
  );
}
