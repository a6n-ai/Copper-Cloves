import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { UserPlus } from "lucide-react";
import { isValidPhoneNumber } from "react-phone-number-input";
import { toast } from "sonner";
import { Command, CommandInput, CommandList, CommandItem } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { PhoneInput, type PhoneValue } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { cdnUrl } from "@/lib/cdnUrl";
import { sendFriendRequest, inviteFriend } from "@/services/friends";

type Result = { id: string; name: string; email: string; phone: string | null; avatar_url: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s-]{5,}$/;

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

  // Invite-by-email form (non-member friends) — mirrors the booking guest flow.
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState<PhoneValue>("" as PhoneValue);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

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

  function openInvite() {
    const q = query.trim();
    setInviteError(null);
    setInviteName(""); setInviteEmail(""); setInvitePhone("" as PhoneValue);
    // Route the typed query into the field it looks like.
    if (EMAIL_RE.test(q) || q.includes("@")) setInviteEmail(q);
    else if (PHONE_RE.test(q)) setInvitePhone(q as PhoneValue);
    else setInviteName(q);
    setShowInvite(true);
  }

  async function submitInvite() {
    const email = inviteEmail.trim().toLowerCase();
    const name = inviteName.trim();
    const phone = (invitePhone ?? "").trim();
    if (!name) return setInviteError("Add their name.");
    if (!EMAIL_RE.test(email)) return setInviteError("Enter a valid email address.");
    if (!phone || !isValidPhoneNumber(phone)) return setInviteError("Enter a valid mobile number.");
    setInviting(true);
    setInviteError(null);
    const r = await inviteFriend({ name, email, phone });
    setInviting(false);
    if (!r.ok) return setInviteError(r.error ?? "Could not send invite.");
    toast.success(r.isNew ? "Invite sent — they'll get an email to join." : "Friend request sent.");
    setShowInvite(false);
    setQuery("");
    setResults([]);
    onSent();
  }

  if (showInvite) {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-sand/30 p-3">
        <p className="text-xs font-semibold text-charcoal">Invite a friend</p>
        <p className="text-xs text-muted-foreground">
          Not a member yet? We&apos;ll email them to set up their account and connect with you.
        </p>
        <Input placeholder="Their name" value={inviteName} onChange={(e) => { setInviteName(e.target.value); setInviteError(null); }} />
        <Input placeholder="Email address" type="email" value={inviteEmail} onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); }} />
        <PhoneInput placeholder="Mobile number" value={invitePhone} onChange={(v) => { setInvitePhone(v); setInviteError(null); }} />
        {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="sage" onClick={submitInvite} disabled={inviting || !inviteName.trim() || !inviteEmail.trim() || !(invitePhone ?? "").trim()}>
            {inviting ? "Sending…" : "Send invite"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setShowInvite(false); setInviteError(null); }}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <Command shouldFilter={false} className="overflow-visible rounded-lg border border-input bg-card focus-within:border-sage focus-within:ring-2 focus-within:ring-sage">
      <CommandInput value={query} onValueChange={setQuery} placeholder="Search members by name, email or mobile…" />
      {query.length >= 2 && (
        <CommandList className="max-h-72 py-1">
          {searching && results.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">Searching…</p>}
          {!searching && error && <p className="px-3 py-3 text-sm text-destructive">Couldn&apos;t search right now.</p>}
          {!searching && !error && results.length === 0 && (
            <CommandItem value={`invite-${query}`} onSelect={openInvite} className="gap-2 text-sage data-[selected=true]:text-sage">
              <UserPlus className="size-4" aria-hidden />
              <span>Invite &ldquo;{query}&rdquo; by email</span>
            </CommandItem>
          )}
          {results.map((r) => {
            const connected = existingIds.has(r.id);
            const sent = requested.has(r.id);
            return (
              <CommandItem key={r.id} value={r.id} className="gap-2.5">
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
          {!searching && !error && results.length > 0 && (
            <CommandItem value={`invite-fallback-${query}`} onSelect={openInvite} className="gap-2 text-muted-foreground">
              <UserPlus className="size-4" aria-hidden />
              <span>Not here? Invite by email</span>
            </CommandItem>
          )}
        </CommandList>
      )}
    </Command>
  );
}
