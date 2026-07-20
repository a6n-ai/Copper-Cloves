import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Gift } from "lucide-react";
import { cdnUrl } from "@/lib/cdnUrl";
import { getShareablePasses, sharePass, type SharablePass } from "@/services/sharedCredits";
import type { Friend } from "@/services/friends";

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (avatarUrl)
    return <Image src={cdnUrl(avatarUrl)} alt={name} width={40} height={40} unoptimized className="size-10 shrink-0 rounded-full object-cover" />;
  return <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage text-sm font-semibold text-cream">{initials}</div>;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function SharePassDialog({
  friend,
  open,
  onOpenChange,
  onShared,
}: {
  friend: Friend | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onShared: () => void;
}) {
  const [passes, setPasses] = useState<SharablePass[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [credits, setCredits] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("form");
    setCredits("");
    setError(null);
    setLoading(true);
    getShareablePasses()
      .then((list) => {
        setPasses(list);
        setSelectedId(list.length > 0 ? list[0].id : "");
      })
      .finally(() => setLoading(false));
  }, [open]);

  const selected = passes.find((p) => p.id === selectedId) ?? null;
  const shareableCap = selected ? Math.max(0, selected.maxShareable - selected.alreadyShared) : 0;
  const upTo = selected ? Math.min(selected.creditsRemaining, shareableCap) : 0;

  function goToConfirm() {
    const n = Number(credits);
    if (!Number.isInteger(n) || n < 1) return setError("Enter a valid number of classes");
    if (n > upTo) return setError(`You can share up to ${upTo} classes from this pass`);
    setError(null);
    setStep("confirm");
  }

  async function confirm() {
    if (!friend || !selected) return;
    setSubmitting(true);
    const n = Number(credits);
    const result = await sharePass({ recipientId: friend.id, userPackageId: selected.id, credits: n });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Could not share");
      setStep("form");
      getShareablePasses().then(setPasses).catch(() => {});
      return;
    }
    toast.success(`Shared ${n} class${n === 1 ? "" : "es"} with ${friend.name}`);
    onShared();
    onOpenChange(false);
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[440px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Share a pass with {friend?.name}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {step === "form" ? "Pick a pass and how many classes to share." : "Review and confirm."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {friend && (
          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2">
            <Avatar name={friend.name} avatarUrl={friend.avatar_url} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-charcoal">{friend.name}</p>
              <p className="truncate text-xs text-muted-foreground">{friend.email}</p>
            </div>
          </div>
        )}

        {loading ? (
          <p className="py-4 text-sm text-muted-foreground">Loading your passes…</p>
        ) : passes.length === 0 ? (
          <EmptyState icon={Gift} title="Nothing to share" description="You don't have a shareable pass right now." />
        ) : step === "form" ? (
          <div className="space-y-4 py-2">
            {passes.length === 1 ? (
              <p className="text-sm text-charcoal">{passes[0].name} — expires {fmtDate(passes[0].expiresAt)}</p>
            ) : (
              <div className="space-y-1.5">
                <Label>Pass</Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {passes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — expires {fmtDate(p.expiresAt)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Classes to share</Label>
              <Input type="number" min={1} max={upTo} step={1} value={credits} onChange={(e) => { setCredits(e.target.value); setError(null); }} />
              <p className="text-xs text-muted-foreground">Up to {upTo} shareable from this pass</p>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="space-y-2 py-2 text-sm">
            <div className="flex justify-between border-b border-sage/10 py-2">
              <span className="text-charcoal/55">Friend</span>
              <span className="text-charcoal">{friend?.name}</span>
            </div>
            <div className="flex justify-between border-b border-sage/10 py-2">
              <span className="text-charcoal/55">Pass</span>
              <span className="text-charcoal">{selected?.name}</span>
            </div>
            <div className="flex justify-between border-b border-sage/10 py-2">
              <span className="text-charcoal/55">Classes shared</span>
              <span className="font-semibold text-charcoal">{credits}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-charcoal/55">Your remaining after</span>
              <span className="text-charcoal">{(selected?.creditsRemaining ?? 0) - Number(credits)}</span>
            </div>
          </div>
        )}

        <ResponsiveDialogFooter>
          {step === "form" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="sage" onClick={goToConfirm} disabled={passes.length === 0 || !credits}>Review →</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("form")} disabled={submitting}>Back</Button>
              <Button variant="sage" onClick={() => void confirm()} disabled={submitting}>
                {submitting ? "Sharing…" : "Confirm & share"}
              </Button>
            </>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
