import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { landingNav } from "./LandingBrand";

type Entry = { label: string; section: string; to: string; hash?: string; search?: { service: string } };

// Every page and page section from the navigation, searchable by name.
const ENTRIES: Entry[] = landingNav.flatMap((item) => [
  { label: item.label, section: "Page", to: item.to },
  ...(item.children ?? []).map((c) => ({ ...c, section: item.label })),
]);

/** Search popup for the public site's pages and services. */
export function SiteSearch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ENTRIES;
    return ENTRIES.filter((e) => `${e.label} ${e.section}`.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function go(entry: Entry) {
    onClose();
    navigate({ to: entry.to, hash: entry.hash, search: entry.search ?? {} });
  }

  return (
    <div className="lnav-search" role="dialog" aria-modal="true" aria-label="Search the site" onClick={onClose}>
      <div className="lnav-search-box" onClick={(e) => e.stopPropagation()}>
        <form
          className="lnav-search-field"
          onSubmit={(e) => {
            e.preventDefault();
            if (results[0]) go(results[0]);
          }}
        >
          <Search aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services, rentals, sales…"
            aria-label="Search"
          />
          <button type="button" onClick={onClose} aria-label="Close search">
            <X />
          </button>
        </form>
        <ul className="lnav-search-results">
          {results.length === 0 && <li className="lnav-search-empty">No matches. Try "service" or "rental".</li>}
          {results.map((e) => (
            <li key={`${e.section}-${e.label}`}>
              <button type="button" onClick={() => go(e)}>
                <span>
                  <strong>{e.label}</strong>
                  <small>{e.section}</small>
                </span>
                <ArrowRight aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
