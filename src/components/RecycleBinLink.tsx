import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import type { RecycleType } from "@/lib/recycle-bin.functions";

export function RecycleBinLink({ type, label }: { type: RecycleType; label?: string }) {
  return (
    <Link
      to="/admin/recycle"
      search={{ tab: type }}
      className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-2 text-xs font-semibold uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
    >
      <Trash2 className="h-3.5 w-3.5" /> {label ?? "Recycle Bin"}
    </Link>
  );
}
