import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { SectionRecycleBin } from "@/components/SectionRecycleBin";
import type { RecycleType } from "@/lib/recycle-bin.functions";

// Two-tab wrapper: main page content vs. Recycle Bin. Used everywhere the
// old inline SectionRecycleBin banner used to live so admins can flip to the
// bin from a tab next to the section's own primary tab.
export function RecycleTabs({
  type,
  mainLabel = "Active",
  invalidateKeys = [],
  children,
}: {
  type: RecycleType;
  mainLabel?: string;
  invalidateKeys?: Array<readonly unknown[]>;
  children: ReactNode;
}) {
  const [tab, setTab] = useState<"main" | "bin">("main");
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("main")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-widest ${tab === "main" ? "bg-emerald-700 text-white" : "bg-surface text-ink-muted hover:text-foreground"}`}
        >
          {mainLabel}
        </button>
        <button
          type="button"
          onClick={() => setTab("bin")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-widest ${tab === "bin" ? "bg-primary text-primary-foreground" : "bg-surface text-ink-muted hover:text-foreground"}`}
        >
          <Trash2 className="h-3.5 w-3.5" /> Recycle Bin
        </button>
      </div>
      {tab === "main" ? children : (
        <SectionRecycleBin type={type} invalidateKeys={invalidateKeys} initiallyOpen />
      )}
    </div>
  );
}
