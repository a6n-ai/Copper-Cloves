import { useEffect, useState } from "react";
import Image from "next/image";
import { Gift } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { cdnUrl } from "@/lib/cdnUrl";
import { getReceivedShares, type ReceivedShare } from "@/services/sharedCredits";

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (avatarUrl)
    return <Image src={cdnUrl(avatarUrl)} alt={name} width={36} height={36} unoptimized className="size-9 shrink-0 rounded-full object-cover" />;
  return <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-semibold text-cream">{initials || "?"}</div>;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function SharedWithYouCard() {
  const [items, setItems] = useState<ReceivedShare[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReceivedShares().then(setItems).finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="space-y-3" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="size-9 animate-pulse rounded-full bg-muted" />
            <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  if (items.length === 0)
    return <EmptyState icon={Gift} title="Nothing shared yet" description="Classes a friend shares with you show up here." />;

  return (
    <ul className="space-y-2">
      {items.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={s.ownerName} avatarUrl={s.ownerAvatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-charcoal">{s.ownerName}</p>
              <p className="truncate text-xs text-muted-foreground">expires {fmtDate(s.expiresAt)}</p>
            </div>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-charcoal">
            {s.creditsRemaining} of {s.creditsTotal} left
          </span>
        </li>
      ))}
    </ul>
  );
}
