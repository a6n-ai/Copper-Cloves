// src/components/dashboard/GlobalSearch.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Command as CommandPrimitive } from "cmdk";
import { Search, CornerDownLeft } from "lucide-react";
import {
  Command, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";
import { useGlobalSearchData } from "./useGlobalSearchData";
import { presentation } from "./searchPresentation";
import { INNER_PAGES } from "./searchInnerPages";
import type { PortalConfig } from "@/components/dashboard/dashboardNav";
import type { SearchItem } from "@/lib/search/types";

const RECENTS_MAX = 5;

function loadRecents(kind: string): SearchItem[] {
  try {
    const raw = localStorage.getItem(`gsearch:recents:${kind}`);
    return raw ? (JSON.parse(raw) as SearchItem[]).slice(0, RECENTS_MAX) : [];
  } catch { return []; }
}
function saveRecent(kind: string, item: SearchItem) {
  try {
    const cur = loadRecents(kind).filter((r) => r.id !== item.id || r.type !== item.type);
    localStorage.setItem(`gsearch:recents:${kind}`, JSON.stringify([item, ...cur].slice(0, RECENTS_MAX)));
  } catch { /* ignore quota */ }
}

function ResultRow({ item, onSelect }: { item: SearchItem; onSelect: (i: SearchItem) => void }) {
  const p = presentation(item.type);
  const Icon = p.icon;
  return (
    <CommandItem
      value={`${item.type}-${item.id}`}
      onSelect={() => onSelect(item)}
      className="cursor-pointer gap-0 rounded-lg px-2 py-2 data-[selected=true]:bg-sage/10 data-[selected=true]:text-charcoal"
    >
      <span className="mr-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sage/10">
        <Icon className="h-4 w-4 text-sage" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-body text-sm text-charcoal">{item.title}</span>
        {item.subtitle ? <span className="truncate font-body text-xs text-charcoal/50">{item.subtitle}</span> : null}
      </span>
      <Pill tone={p.tone} noIcon size="sm" className="ml-2 shrink-0">{p.pillLabel}</Pill>
    </CommandItem>
  );
}

export function GlobalSearch({ config }: { config: PortalConfig }) {
  const router = useRouter();
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [recents, setRecents] = useState<SearchItem[]>([]);
  const { groups, loading, error } = useGlobalSearchData(query);

  // ⌘K / Ctrl+K focuses the inline bar (does not open a modal).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the dropdown on a click outside the search bar.
  useEffect(() => {
    if (!focused) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [focused]);

  useEffect(() => { if (focused) setRecents(loadRecents(config.kind)); }, [focused, config.kind]);

  const pageItems: SearchItem[] = useMemo(() => {
    const navPages: SearchItem[] = config.sections.flatMap((s) =>
      s.items.map((it) => ({ id: it.href, type: "page", title: it.label, subtitle: it.href, href: it.href }))
    );
    const innerPages: SearchItem[] = (INNER_PAGES[config.kind] ?? []).map((p) => ({
      id: p.href, type: "page", title: p.label, subtitle: p.href, href: p.href,
    }));
    const all = [...navPages, ...innerPages];
    const q = query.trim().toLowerCase();
    // Inner pages only show when actively searching, to keep the empty/recent view clean.
    return q
      ? all.filter((p) => p.title.toLowerCase().includes(q) || p.href.toLowerCase().includes(q))
      : navPages;
  }, [config.sections, config.kind, query]);

  const go = (item: SearchItem) => {
    if (item.type !== "page") saveRecent(config.kind, item);
    setFocused(false);
    setQuery("");
    inputRef.current?.blur();
    void router.push(item.href);
  };

  const hasQuery = query.trim().length >= 2;
  const showRecents = query.trim().length === 0 && recents.length > 0;
  const noResults = hasQuery && !loading && !error && groups.length === 0 && pageItems.length === 0;
  // Dropdown opens on focus once there's something to show (recents, pages, or query).
  const open = focused && (query.trim().length > 0 || recents.length > 0 || pageItems.length > 0);

  return (
    <Command
      ref={rootRef}
      shouldFilter={false}
      className="relative h-auto w-full overflow-visible rounded-none bg-transparent text-charcoal"
    >
      {/* Inline search bar — always visible in the top bar */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border bg-card px-3.5 py-2 transition-colors",
          focused ? "border-sage/60 ring-2 ring-sage/25" : "border-sage/20 hover:border-sage/40"
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-sage/70" aria-hidden />
        <CommandPrimitive.Input
          ref={inputRef}
          value={query}
          onValueChange={setQuery}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => { if (e.key === "Escape") { setQuery(""); setFocused(false); inputRef.current?.blur(); } }}
          placeholder="Search members, classes, payments, pages…"
          aria-label="Global search"
          className="h-5 flex-1 bg-transparent font-body text-sm font-semibold text-charcoal outline-none placeholder:font-medium placeholder:text-charcoal/40"
        />
        <kbd className="hidden shrink-0 rounded border border-sage/20 bg-cream/60 px-1.5 py-0.5 font-body text-[10px] text-charcoal/50 sm:inline">
          ⌘K
        </kbd>
      </div>

      {/* Anchored results dropdown — not a modal */}
      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-warm-border bg-white-warm shadow-[0_4px_24px_rgba(51,51,51,0.08)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1">
          <CommandList className="max-h-[min(60vh,420px)] p-1.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-body [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-charcoal/40">
            {error ? <CommandEmpty className="py-6 text-center font-body text-sm text-charcoal/60">Search is unavailable right now.</CommandEmpty> : null}
            {noResults ? (
              <CommandEmpty className="py-6 text-center font-body text-sm text-charcoal/60">
                No matches for “{query.trim()}”. Try a name, class, or amount.
              </CommandEmpty>
            ) : null}

            {showRecents ? (
              <CommandGroup heading="Recent">
                {recents.map((item) => <ResultRow key={`r-${item.type}-${item.id}`} item={item} onSelect={go} />)}
              </CommandGroup>
            ) : null}

            {loading ? (
              <div className="px-2 py-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="my-1 h-10 animate-pulse rounded-lg bg-[#f4f3ec]" />
                ))}
              </div>
            ) : null}

            {groups.map((g) => (
              <CommandGroup key={g.type} heading={g.label}>
                {g.items.map((item) => <ResultRow key={`${g.type}-${item.id}`} item={item} onSelect={go} />)}
              </CommandGroup>
            ))}

            {pageItems.length ? (
              <CommandGroup heading="Pages">
                {pageItems.map((item) => <ResultRow key={`p-${item.href}`} item={item} onSelect={go} />)}
              </CommandGroup>
            ) : null}
          </CommandList>

          {/* Footer keyboard hints */}
          <div className="flex items-center gap-4 border-t border-warm-border bg-cream/40 px-3 py-2 font-body text-[11px] text-charcoal/50">
            <span className="flex items-center gap-1"><kbd className="rounded border border-sage/20 bg-white-warm px-1">↑</kbd><kbd className="rounded border border-sage/20 bg-white-warm px-1">↓</kbd> navigate</span>
            <span className="flex items-center gap-1"><kbd className="rounded border border-sage/20 bg-white-warm px-1"><CornerDownLeft className="h-2.5 w-2.5" /></kbd> open</span>
            <span className="flex items-center gap-1"><kbd className="rounded border border-sage/20 bg-white-warm px-1">esc</kbd> close</span>
          </div>
        </div>
      ) : null}
    </Command>
  );
}
