import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { isValidPhoneNumber } from "react-phone-number-input";
import { Input } from "@/components/ui/input";
import { PhoneInput, type PhoneValue } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
} from "@/components/ui/command";
import { X, UserPlus, Users } from "lucide-react";
import { cdnUrl } from "@/lib/cdnUrl";
import { suggestEmailCorrection } from "@/lib/emailTypo";

export type AddedMember = {
  profile_id?: string;
  name: string;
  email: string;
  phone?: string;
};

interface SearchResult {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A query of mostly digits (optionally +, spaces, dashes) reads as a phone number.
const PHONE_RE = /^[+\d][\d\s-]{5,}$/;

interface MemberSearchProps {
  value: AddedMember[];
  onChange: (members: AddedMember[]) => void;
  maxMembers?: number;
  /** Booker's own email — they can't add themselves as a guest. */
  currentEmail?: string;
  /** Booker's own phone — a guest must have their own number, not the booker's. */
  currentPhone?: string;
}

/** Last-10-digit comparison so +91/spacing variants of the same number match. */
function samePhone(a?: string | null, b?: string | null): boolean {
  const da = (a ?? "").replace(/\D/g, "");
  const db = (b ?? "").replace(/\D/g, "");
  if (da.length < 7 || db.length < 7) return false;
  return da === db || da.slice(-10) === db.slice(-10);
}

function Avatar({ name, avatarUrl, size = 28 }: { name: string; avatarUrl: string | null; size?: number }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const dim = size === 28 ? "size-7" : "size-9";

  if (avatarUrl) {
    return (
      <Image
        src={cdnUrl(avatarUrl)}
        alt={name}
        width={size}
        height={size}
        unoptimized
        className={`${dim} shrink-0 rounded-full object-cover`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-sage text-xs font-semibold text-cream`}>
      {initials}
    </div>
  );
}

export function MemberSearch({ value, onChange, maxMembers = 5, currentEmail, currentPhone }: MemberSearchProps) {
  const selfEmail = currentEmail?.trim().toLowerCase() ?? "";
  const selfPhone = currentPhone?.trim() ?? "";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState<PhoneValue>("" as PhoneValue);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  // A member picked from the list/friends who has no phone on file — we collect
  // one before adding them.
  const [pendingPhoneMember, setPendingPhoneMember] = useState<AddedMember | null>(null);
  const [phoneDraft, setPhoneDraft] = useState<PhoneValue>("" as PhoneValue);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [friends, setFriends] = useState<SearchResult[]>([]);
  useEffect(() => {
    let cancelled = false;
    import("@/services/friends").then(({ getFriends }) =>
      getFriends().then((fs) => {
        if (!cancelled) setFriends(fs.map((f) => ({ id: f.id, name: f.name, email: f.email, phone: null, avatar_url: f.avatar_url })));
      }),
    );
    return () => { cancelled = true; };
  }, []);

  const search = useCallback((q: string) => {
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError(false);
      return;
    }
    setSearching(true);
    setSearchError(false);
    fetch(`/api/members/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data: SearchResult[]) => setResults(Array.isArray(data) ? data : []))
      .catch(() => { setResults([]); setSearchError(true); })
      .finally(() => setSearching(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function isAlreadyAdded(profileId?: string, email?: string) {
    return value.some(
      (m) => (profileId && m.profile_id === profileId) || (email && m.email === email),
    );
  }

  function addMember(member: AddedMember) {
    if (isAlreadyAdded(member.profile_id, member.email)) return;
    onChange([...value, member]);
    setQuery("");
    setResults([]);
    setShowDropdown(false);
  }

  function removeMember(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  // Add a member picked from search results / friends. If they have no phone on
  // file we collect one first (phone is mandatory for every attendee).
  function addExistingMember(m: { profile_id?: string; name: string; email: string; phone?: string | null }) {
    if (isAlreadyAdded(m.profile_id, m.email)) return;
    // Booker can't add themselves as a guest (search/friends path had no guard).
    if (selfEmail && m.email.trim().toLowerCase() === selfEmail) {
      setInviteError("You're the booker — you can't add yourself as a guest.");
      return;
    }
    const phone = m.phone?.trim();
    if (phone) {
      addMember({ profile_id: m.profile_id, name: m.name, email: m.email, phone });
      return;
    }
    setShowInviteForm(false);
    setPendingPhoneMember({ profile_id: m.profile_id, name: m.name, email: m.email });
    setPhoneDraft("" as PhoneValue);
    setPhoneError(null);
    setQuery("");
    setResults([]);
    setShowDropdown(false);
  }

  function handlePendingPhoneSubmit() {
    if (!pendingPhoneMember) return;
    const phone = (phoneDraft ?? "").trim();
    if (!phone || !isValidPhoneNumber(phone)) {
      setPhoneError("Enter a valid phone number.");
      return;
    }
    if (samePhone(phone, selfPhone)) {
      setPhoneError("That's your own number — enter the guest's own mobile.");
      return;
    }
    addMember({ ...pendingPhoneMember, phone });
    setPendingPhoneMember(null);
    setPhoneDraft("" as PhoneValue);
    setPhoneError(null);
  }

  function handleInviteSubmit() {
    const email = inviteEmail.trim().toLowerCase();
    const name = inviteName.trim();
    // Account is created from the email, so it is mandatory — block (don't
    // silently no-op) when it's missing or malformed.
    if (!email) {
      setInviteError("Email is required — we create the guest's account from it.");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setInviteError("Enter a valid email address.");
      return;
    }
    if (selfEmail && email === selfEmail) {
      setInviteError("You're already the booker — you can't add yourself as a guest.");
      return;
    }
    if (!name) {
      setInviteError("Add the guest's name.");
      return;
    }
    // Catch likely email typos (gmail.comm, gmial.com…) before we create an
    // account from a misspelled address. Suggest a fix once; a second submit of
    // the same address goes through (override for genuinely unusual domains).
    const suggestion = suggestEmailCorrection(email);
    if (suggestion && emailSuggestion !== suggestion) {
      setEmailSuggestion(suggestion);
      setInviteError(null);
      return;
    }
    const phone = (invitePhone ?? "").trim();
    if (!phone || !isValidPhoneNumber(phone)) {
      setInviteError("Enter a valid phone number.");
      return;
    }
    if (samePhone(phone, selfPhone)) {
      setInviteError("That's your own number — each guest needs their own mobile.");
      return;
    }
    addMember({ email, name, phone });
    setInviteEmail("");
    setInviteName("");
    setInvitePhone("" as PhoneValue);
    setInviteError(null);
    setEmailSuggestion(null);
    setShowInviteForm(false);
  }

  function openInviteFromQuery() {
    const q = query.trim();
    setInviteError(null);
    // Route the typed query into the right field: an email into email, a
    // phone-like string into phone, otherwise name.
    if (EMAIL_RE.test(q) || q.includes("@")) {
      setInviteEmail(q);
    } else if (PHONE_RE.test(q)) {
      setInvitePhone(q as PhoneValue);
    } else {
      setInviteName(q);
    }
    setShowInviteForm(true);
    setShowDropdown(false);
    setQuery("");
  }

  const atMax = value.length >= maxMembers;

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((m, idx) => (
            <li
              key={idx}
              className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2"
            >
              <Avatar name={m.name} avatarUrl={null} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-charcoal">{m.name}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeMember(idx)}
                aria-label={`Remove ${m.name}`}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {!atMax && (
        <>
          {query.length < 2 && friends.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Users className="size-3.5" aria-hidden />
                Your friends
              </p>
              <div className="flex flex-wrap gap-1.5">
                {friends
                  .filter((f) => !isAlreadyAdded(f.id, f.email))
                  .slice(0, 8)
                  .map((f) => (
                    <Button
                      key={f.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto gap-1.5 rounded-full py-1 pl-1 pr-3"
                      onClick={() => addExistingMember({ profile_id: f.id, name: f.name, email: f.email, phone: f.phone })}
                    >
                      <Avatar name={f.name} avatarUrl={f.avatar_url} />
                      <span>{f.name}</span>
                    </Button>
                  ))}
              </div>
            </div>
          )}

          <div ref={containerRef} className="relative">
            <Command
              shouldFilter={false}
              className="overflow-visible rounded-lg border border-input bg-card focus-within:border-sage focus-within:ring-2 focus-within:ring-sage"
            >
              <CommandInput
                value={query}
                onValueChange={(v) => {
                  setQuery(v);
                  setShowDropdown(true);
                  setShowInviteForm(false);
                }}
                onFocus={() => query.length >= 2 && setShowDropdown(true)}
                placeholder="Search members by name, email or mobile…"
              />

              {showDropdown && query.length >= 2 && (
                <CommandList className="max-h-64 py-1">
                  {searching && results.length === 0 && (
                    <p className="px-3 py-3 text-sm text-muted-foreground">Searching…</p>
                  )}

                  {!searching && searchError && (
                    <p className="px-3 py-3 text-sm text-destructive">
                      Couldn&apos;t search right now. You can still invite by email below.
                    </p>
                  )}

                  {!searching && results.length === 0 && (
                    <CommandItem
                      value={`invite-${query}`}
                      onSelect={openInviteFromQuery}
                      className="gap-2 text-sage data-[selected=true]:text-sage"
                    >
                      <UserPlus className="size-4" aria-hidden />
                      <span>Invite &ldquo;{query}&rdquo;</span>
                    </CommandItem>
                  )}

                  {results.map((r) => {
                    const added = isAlreadyAdded(r.id, r.email);
                    return (
                      <CommandItem
                        key={r.id}
                        value={r.id}
                        disabled={added}
                        onSelect={() =>
                          addExistingMember({ profile_id: r.id, name: r.name, email: r.email, phone: r.phone })
                        }
                        className="gap-2.5"
                      >
                        <Avatar name={r.name} avatarUrl={r.avatar_url} />
                        <div className="min-w-0 flex-1 text-left">
                          <div className="truncate text-sm font-medium text-charcoal">{r.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {r.email}{r.phone ? ` · ${r.phone}` : ""}
                          </div>
                        </div>
                        {added && <Pill tone="success" size="sm">Added</Pill>}
                      </CommandItem>
                    );
                  })}
                </CommandList>
              )}
            </Command>
          </div>
        </>
      )}

      {showInviteForm && (
        <div className="space-y-2 rounded-lg border border-border bg-sand/30 p-3">
          <p className="text-xs font-semibold text-charcoal">Add a new person</p>
          <p className="text-xs text-muted-foreground">
            No match found. We&apos;ll create their account from their email.
          </p>
          <Input
            placeholder="Their name"
            value={inviteName}
            onChange={(e) => { setInviteName(e.target.value); setInviteError(null); }}
          />
          <Input
            placeholder="Email address (required)"
            type="email"
            value={inviteEmail}
            onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); setEmailSuggestion(null); }}
          />
          {emailSuggestion && (
            <p className="text-xs text-muted-foreground">
              Did you mean{" "}
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs font-medium text-sage underline underline-offset-2"
                onClick={() => { setInviteEmail(emailSuggestion); setEmailSuggestion(null); }}
              >
                {emailSuggestion}
              </Button>
              ? Or tap Add again to keep what you typed.
            </p>
          )}
          <PhoneInput
            placeholder="Mobile number (required)"
            value={invitePhone}
            onChange={(v) => { setInvitePhone(v); setInviteError(null); }}
          />
          {inviteError && (
            <p className="text-xs text-destructive">{inviteError}</p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="sage"
              onClick={handleInviteSubmit}
              disabled={!inviteEmail.trim() || !inviteName.trim() || !(invitePhone ?? "").trim()}
            >
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowInviteForm(false);
                setInviteEmail("");
                setInviteName("");
                setInvitePhone("" as PhoneValue);
                setInviteError(null);
                setEmailSuggestion(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {pendingPhoneMember && (
        <div className="space-y-2 rounded-lg border border-border bg-sand/30 p-3">
          <p className="text-xs font-semibold text-charcoal">Add phone for {pendingPhoneMember.name}</p>
          <p className="text-xs text-muted-foreground">
            We need a mobile number for every attendee. {pendingPhoneMember.email}
          </p>
          <PhoneInput
            placeholder="Mobile number (required)"
            value={phoneDraft}
            onChange={(v) => { setPhoneDraft(v); setPhoneError(null); }}
          />
          {phoneError && (
            <p className="text-xs text-destructive">{phoneError}</p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="sage"
              onClick={handlePendingPhoneSubmit}
              disabled={!(phoneDraft ?? "").trim()}
            >
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setPendingPhoneMember(null);
                setPhoneDraft("" as PhoneValue);
                setPhoneError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {atMax && (
        <p className="text-xs text-muted-foreground tabular-nums">
          Maximum {maxMembers} additional members per booking.
        </p>
      )}
    </div>
  );
}
