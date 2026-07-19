import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { UserPlus } from "lucide-react";
import { Command, CommandInput, CommandList, CommandItem } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { cdnUrl } from "@/lib/cdnUrl";
import { sendFriendRequest } from "@/services/friends";

type Result = { id: string; name: string; email: string; phone: string | null; avatar_url: string | null };

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (avatarUrl)
    return <Image src={cdnUrl(avatarUrl)} alt={name} width={28} height={28} unoptimized className="size-7 shrink-0 rounded-full object-cover" />;
  return <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-semibold text-cream">{initials}</div>;
}

export function AddFriendSearch({ existingIds, onSent }: { existingIds: Set<string>; onSent: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(false);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (q.length < 2) { setResults([]); setSearching(false); setError(false); return; }
    setSearching(true); setError(false);
    fetch(`/api/members/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d: Result[]) => setResults(Array.isArray(d) ? d : []))
      .catch(() => { setResults([]); setError(true); })
      .finally(() => setSearching(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  async function onAdd(id: string) {
    if (await sendFriendRequest(id)) { setRequested((s) => new Set([...s, id])); onSent(); }
  }

  return (
    <Command shouldFilter={false} className="overflow-visible rounded-lg border border-input bg-card focus-within:border-sage focus-within:ring-2 focus-within:ring-sage">
      <CommandInput value={query} onValueChange={setQuery} placeholder="Search members by name, email or mobile…" />
      {query.length >= 2 && (
        <CommandList className="max-h-72 py-1">
          {searching && results.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">Searching…</p>}
          {!searching && error && <p className="px-3 py-3 text-sm text-destructive">Couldn&apos;t search right now.</p>}
          {!searching && !error && results.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">No members found.</p>}
          {results.map((r) => {
            const connected = existingIds.has(r.id);
            const sent = requested.has(r.id);
            return (
              <CommandItem key={r.id} value={r.id} disabled={connected || sent} className="gap-2.5">
                <Avatar name={r.name} avatarUrl={r.avatar_url} />
                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-medium text-charcoal">{r.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                </div>
                {connected ? <Pill tone="success" size="sm">Connected</Pill>
                  : sent ? <Pill tone="warning" size="sm">Requested</Pill>
                  : <Button size="sm" variant="sage-outline" className="shrink-0" onClick={() => onAdd(r.id)}><UserPlus />Add</Button>}
              </CommandItem>
            );
          })}
        </CommandList>
      )}
    </Command>
  );
}
