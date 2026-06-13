import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, UserPlus } from "lucide-react";
import { cdnUrl } from "@/lib/cdnUrl";

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
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={cdnUrl(avatarUrl)}
        alt={name}
        className="w-7 h-7 rounded-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-[#8f9779] text-white flex items-center justify-center text-xs font-semibold">
      {initials}
    </div>
  );
}

export function MemberSearch({ value, onChange, maxMembers = 5, currentEmail }: MemberSearchProps) {
  const selfEmail = currentEmail?.trim().toLowerCase() ?? "";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
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
      return;
    }
    fetch(`/api/members/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data: SearchResult[]) => setResults(Array.isArray(data) ? data : []));
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
    addMember({ email, name, phone: invitePhone.trim() || undefined });
    setInviteEmail("");
    setInviteName("");
    setInvitePhone("");
    setInviteError(null);
    setShowInviteForm(false);
  }

  const atMax = value.length >= maxMembers;

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((m, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 bg-[#e8e4d9] rounded-lg px-2.5 py-1.5 text-sm text-[#333333]"
            >
              <span className="font-medium">{m.name}</span>
              <button
                type="button"
                onClick={() => removeMember(idx)}
                className="text-[#333333]/40 hover:text-[#333333] ml-0.5"
                aria-label={`Remove ${m.name}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!atMax && (
        <>
          {query.length < 2 && friends.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-[#6b6b6b] font-medium mb-1.5">Your friends</p>
              <div className="flex flex-wrap gap-1.5">
                {friends
                  .filter((f) => !isAlreadyAdded(f.id, f.email))
                  .slice(0, 8)
                  .map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => addMember({ profile_id: f.id, name: f.name, email: f.email })}
                      className="flex items-center gap-1.5 bg-[#e8e4d9]/60 hover:bg-[#e8e4d9] rounded-lg px-2.5 py-1 text-sm text-[#333333] transition-colors"
                    >
                      <Avatar name={f.name} avatarUrl={f.avatar_url} />
                      <span>{f.name}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
          <div ref={containerRef} className="relative">
          <Input
            placeholder="Search members by name, email or mobile…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
              setShowInviteForm(false);
            }}
            onFocus={() => query.length >= 2 && setShowDropdown(true)}
          />

          {showDropdown && query.length >= 2 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-[#e5e4dc] rounded-lg shadow-md overflow-hidden">
              {results.length === 0 && (
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[#8f9779] hover:bg-[#e8e4d9]/50 transition-colors"
                  onClick={() => {
                    const q = query.trim();
                    setInviteError(null);
                    // Route the typed query into the right field: an email into
                    // email, a phone-like string into phone, otherwise name.
                    if (EMAIL_RE.test(q) || q.includes("@")) {
                      setInviteEmail(q);
                    } else if (PHONE_RE.test(q)) {
                      setInvitePhone(q);
                    } else {
                      setInviteName(q);
                    }
                    setShowInviteForm(true);
                    setShowDropdown(false);
                    setQuery("");
                  }}
                >
                  <UserPlus size={14} />
                  <span>Invite &ldquo;{query}&rdquo;</span>
                </button>
              )}
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={isAlreadyAdded(r.id, r.email)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[#e8e4d9]/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() =>
                    addMember({ profile_id: r.id, name: r.name, email: r.email, phone: r.phone ?? undefined })
                  }
                >
                  <Avatar name={r.name} avatarUrl={r.avatar_url} />
                  <div className="text-left min-w-0">
                    <div className="font-medium text-[#333333] truncate">{r.name}</div>
                    <div className="text-xs text-[#6b6b6b] truncate">
                      {r.email}{r.phone ? ` · ${r.phone}` : ""}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          </div>
        </>
      )}

      {showInviteForm && (
        <div className="border border-[#e5e4dc] rounded-lg p-3 space-y-2 bg-[#e8e4d9]/30">
          <p className="text-xs text-[#6b6b6b] font-medium">Add new person</p>
          <p className="text-xs text-[#6b6b6b]">
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
            onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); }}
          />
          <Input
            placeholder="Mobile number (optional)"
            type="tel"
            value={invitePhone}
            onChange={(e) => { setInvitePhone(e.target.value); setInviteError(null); }}
          />
          {inviteError && (
            <p className="text-xs text-[#cf5b48]">{inviteError}</p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-[#8f9779] text-white hover:bg-[#7a8b6c]"
              onClick={handleInviteSubmit}
              disabled={!inviteEmail.trim() || !inviteName.trim()}
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
                setInvitePhone("");
                setInviteError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {atMax && (
        <p className="text-xs text-[#6b6b6b]">
          Maximum {maxMembers} additional members per booking.
        </p>
      )}
    </div>
  );
}
