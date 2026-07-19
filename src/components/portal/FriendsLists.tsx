import Image from "next/image";
import { Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";
import { cdnUrl } from "@/lib/cdnUrl";
import type { useFriendsGraph } from "@/hooks/useFriendsGraph";

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (avatarUrl)
    return (
      <Image
        src={cdnUrl(avatarUrl)}
        alt={name}
        width={36}
        height={36}
        unoptimized
        className="size-9 shrink-0 rounded-full object-cover"
      />
    );
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-semibold text-cream">
      {initials}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </p>
  );
}

function PersonName({ name }: { name: string }) {
  return <span className="truncate text-sm font-medium text-charcoal">{name}</span>;
}

export function FriendsLists({ graph }: { graph: ReturnType<typeof useFriendsGraph> }) {
  const { friends, requests, suggestions, requested, loading, isEmpty, onAdd, onRespond, onCancel } = graph;

  if (loading)
    return (
      <div className="space-y-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  if (isEmpty)
    return (
      <EmptyState
        icon={Users}
        title="No friends yet"
        description="Invite a friend to a class and they'll show up here once they join."
      />
    );

  return (
    <>
      {requests.incoming.length > 0 && (
        <div className="space-y-2.5">
          <SectionLabel>Friend requests</SectionLabel>
          <ul className="space-y-2">
            {requests.incoming.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={r.name} avatarUrl={r.avatar_url} />
                  <PersonName name={r.name} />
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="sage" onClick={() => onRespond(r.id, "accept")}>Accept</Button>
                  <Button size="sm" variant="ghost" onClick={() => onRespond(r.id, "decline")}>Decline</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {requests.outgoing.length > 0 && (
        <div className="space-y-2.5">
          <SectionLabel>Sent requests</SectionLabel>
          <ul className="space-y-2">
            {requests.outgoing.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={r.name} avatarUrl={r.avatar_url} />
                  <PersonName name={r.name} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Pill tone="warning">Pending</Pill>
                  <Button size="sm" variant="ghost" onClick={() => onCancel(r.id)}>Cancel</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {friends.length > 0 && (
        <div className="space-y-2.5">
          <SectionLabel>Your circle</SectionLabel>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {friends.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2"
              >
                <Avatar name={f.name} avatarUrl={f.avatar_url} />
                <PersonName name={f.name} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2.5">
          <SectionLabel>People you may know</SectionLabel>
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={s.name} avatarUrl={s.avatar_url} />
                  <div className="min-w-0">
                    <PersonName name={s.name} />
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {s.mutualCount} mutual
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={requested.has(s.id) ? "ghost" : "sage-outline"}
                  disabled={requested.has(s.id)}
                  onClick={() => onAdd(s.id)}
                  className="shrink-0"
                >
                  {requested.has(s.id) ? "Requested" : (<><UserPlus />Add</>)}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
