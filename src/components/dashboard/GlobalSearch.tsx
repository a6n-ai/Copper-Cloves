// src/components/dashboard/GlobalSearch.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Search } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { Pill } from "@/components/ui/pill";
import { useGlobalSearchData } from "./useGlobalSearchData";
import { presentation } from "./searchPresentation";
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
    <CommandItem value={`${item.type}-${item.id}`} onSelect={() => onSelect(item)} className="cursor-pointer">
      <span className="mr-3 flex h-7 w-7 items-center justify-center rounded-lg bg-sage/10">
        <Icon className="h-4 w-4 text-sage" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-body text-sm text-charcoal">{item.title}</span>
        {item.subtitle ? <span className="truncate font-body text-xs text-charcoal/50">{item.subtitle}</span> : null}
      </span>
      <Pill tone={p.tone} noIcon className="ml-2 shrink-0">{p.pillLabel}</Pill>
    </CommandItem>
  );
}

export function GlobalSearch({ config }: { config: PortalConfig }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [recents, setRecents] = useState<SearchItem[]>([]);
  const { groups, loading, error } = useGlobalSearchData(query);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) setRecents(loadRecents(config.kind)); }, [open, config.kind]);

  const pageItems: SearchItem[] = useMemo(() => {
    const all = config.sections.flatMap((s) =>
      s.items.map((it) => ({ id: it.href, type: "page", title: it.label, subtitle: it.href, href: it.href }))
    );
    const q = query.trim().toLowerCase();
    return q ? all.filter((p) => p.title.toLowerCase().includes(q) || p.href.toLowerCase().includes(q)) : all;
  }, [config.sections, query]);

  const go = (item: SearchItem) => {
    if (item.type !== "page") saveRecent(config.kind, item);
    setOpen(false);
    setQuery("");
    void router.push(item.href);
  };

  const showRecents = query.trim().length === 0 && recents.length > 0;
  const noResults = query.trim().length >= 2 && !loading && groups.length === 0 && pageItems.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full max-w-xs rounded-full border border-sage/20 bg-[#fafaf8]/70 px-3 py-1.5 text-left text-sm text-charcoal/50 hover:border-sage/40 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 truncate font-body">Search…</span>
        <kbd className="hidden sm:inline rounded border border-sage/20 bg-cream/50 px-1.5 text-[10px] font-body text-charcoal/50">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0">
          <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
            <CommandInput ref={inputRef} placeholder="Search members, classes, payments, pages…" value={query} onValueChange={setQuery} />
            <CommandList>
              {error ? <CommandEmpty>Search is unavailable right now.</CommandEmpty> : null}
              {noResults ? <CommandEmpty>No matches for "{query.trim()}".</CommandEmpty> : null}

              {showRecents ? (
                <CommandGroup heading="Recent">
                  {recents.map((item) => <ResultRow key={`r-${item.type}-${item.id}`} item={item} onSelect={go} />)}
                </CommandGroup>
              ) : null}

              {loading ? (
                <CommandGroup heading="Searching…">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="mx-2 my-1 h-9 animate-pulse rounded-lg bg-[#f4f3ec]" />
                  ))}
                </CommandGroup>
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
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
