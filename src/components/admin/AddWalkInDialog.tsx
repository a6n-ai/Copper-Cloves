import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Check, Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  applyPassConfig,
  PassConfigSection,
  PaymentSection,
  priceBreakdown,
  recordPayment,
  selectedPackageOf,
  usePassPaymentState,
  validateConfig,
  validatePayment,
} from "@/components/admin/managePass";

/* ────────────────────────────────────────────────────────────────────────
 * Add walk-in wizard. A studio attendee with no booking is registered from
 * the class roster: (1) find or create the member, (2) deduct from an active
 * package or assign + pay for a new one, (3) book the class + mark attended.
 * Works on past / completed / locked classes (rosters stay editable).
 * ──────────────────────────────────────────────────────────────────────── */

interface MemberLite {
  id: string;
  name: string;
  email: string;
}
interface ExistingPkg {
  id: string;
  name: string;
  credits: number | null; // null = unlimited
  passType: string;
}
interface SearchRow {
  id: string;
  full_name: string | null;
  email: string;
}

async function loadMemberPackages(memberId: string): Promise<ExistingPkg[]> {
  const r = await fetch(`/api/admin/members?id=${memberId}`, { credentials: "include" });
  if (!r.ok) return [];
  const d = await r.json().catch(() => ({}));
  const now = Date.now();
  const ups = Array.isArray(d.user_packages) ? d.user_packages : [];
  // Ordered purchase_date desc by the endpoint, so index 0 is the newest pass.
  return ups
    .filter(
      (p: Record<string, unknown>) =>
        p.is_active === true &&
        (!p.expiration_date || new Date(String(p.expiration_date)).getTime() > now) &&
        (p.credits_remaining == null || Number(p.credits_remaining) > 0),
    )
    .map((p: Record<string, unknown>) => {
      const pt = p.package_type as Record<string, unknown> | null;
      return {
        id: String(p.id),
        name: String(pt?.name ?? "Package"),
        credits: p.credits_remaining == null ? null : Number(p.credits_remaining),
        passType: String(p.pass_type ?? pt?.type ?? "class_pass"),
      };
    });
}

export function AddWalkInDialog({
  open,
  onOpenChange,
  scheduleId,
  className,
  classStartTime,
  allowOverCapacity,
  capacityNote,
  onAdded,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: string;
  className: string;
  /** ISO start time — check-in only auto-defaults on once the class is live/past. */
  classStartTime: string;
  /** Past/completed classes let the booking exceed capacity. */
  allowOverCapacity: boolean;
  /** Shown on the confirm step when the class is full + past. */
  capacityNote?: string;
  onAdded: () => void;
}>) {
  // A walk-in is only an "attended" record once the class has actually started.
  // For upcoming classes the check-in box stays off (and disabled) so attendance,
  // streaks and payouts aren't polluted by a class that hasn't happened.
  const classStarted = new Date(classStartTime).getTime() <= Date.now();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [member, setMember] = useState<MemberLite | null>(null);

  // Step 1 — find or create
  const [mode, setMode] = useState<"search" | "create">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", phone: "" });
  const [creating, setCreating] = useState(false);

  // Step 2 — package
  const [existingPkgs, setExistingPkgs] = useState<ExistingPkg[]>([]);
  const [pkgMode, setPkgMode] = useState<"existing" | "new">("existing");
  const [chosenExistingId, setChosenExistingId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  // Once a new pass is created for this wizard session we remember its id, so a
  // failed-payment retry re-attempts only the payment — it never re-assigns the
  // pass (which would create a second package / grant credits without payment).
  const [assignedPkgId, setAssignedPkgId] = useState<string | null>(null);
  const pass = usePassPaymentState();

  // Step 3 — confirm
  const [packageId, setPackageId] = useState<string | null>(null);
  const [markCheckedIn, setMarkCheckedIn] = useState(classStarted);
  const [submitting, setSubmitting] = useState(false);

  function resetAll() {
    setStep(1);
    setMember(null);
    setMode("search");
    setQuery("");
    setResults([]);
    setCreateForm({ name: "", email: "", phone: "" });
    setExistingPkgs([]);
    setPkgMode("existing");
    setChosenExistingId(null);
    setAssignedPkgId(null);
    setPackageId(null);
    setMarkCheckedIn(classStarted);
    pass.reset();
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetAll();
    onOpenChange(next);
  }

  async function selectMember(m: MemberLite) {
    setMember(m);
    const pkgs = await loadMemberPackages(m.id);
    setExistingPkgs(pkgs);
    setPkgMode(pkgs.length > 0 ? "existing" : "new");
    setChosenExistingId(pkgs[0]?.id ?? null);
    setAssignedPkgId(null);
    pass.loadDefaults();
    setStep(2);
  }

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const r = await fetch(`/api/admin/members-search?q=${encodeURIComponent(q)}`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json().catch(() => []);
        setResults(Array.isArray(d) ? d : []);
      }
    } finally {
      setSearching(false);
    }
  }

  async function createMember() {
    if (!createForm.name.trim() || !createForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ full_name: createForm.name, email: createForm.email, phone: createForm.phone || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error ?? "Could not create member");
        return;
      }
      toast.success("Member created — welcome email sent");
      await selectMember({ id: String(d.id), name: d.full_name || createForm.name, email: d.email || createForm.email });
    } finally {
      setCreating(false);
    }
  }

  async function proceedFromPackage() {
    if (!member) return;
    if (pkgMode === "existing") {
      if (!chosenExistingId) {
        toast.error("Pick a package to deduct from");
        return;
      }
      setPackageId(chosenExistingId);
      setStep(3);
      return;
    }
    // Assign a new package, then resolve its id to deduct from in step 3.
    const cfgErr = validateConfig(pass);
    if (cfgErr) {
      toast.error(cfgErr);
      return;
    }
    const payErr = validatePayment(pass);
    if (payErr) {
      toast.error(payErr);
      return;
    }
    setAssigning(true);
    try {
      // Assign the pass at most once per session. On a payment-failure retry the
      // stored id is reused so we never create a second package.
      let pkgId = assignedPkgId;
      if (!pkgId) {
        const { createdUserPackageId } = await applyPassConfig(member.id, pass, { forceNewPackage: true });
        if (!createdUserPackageId) throw new Error("Package was not created");
        pkgId = createdUserPackageId;
        setAssignedPkgId(pkgId);
      }
      if (!priceBreakdown(pass).isFree) {
        await recordPayment(member.id, pass, pkgId);
      }
      // Surface the just-assigned pass in step 3 without re-fetching/guessing.
      const sel = selectedPackageOf(pass);
      setExistingPkgs((prev) => [
        {
          id: pkgId as string,
          name: sel?.name ?? "New pass",
          credits: sel?.type === "class_pass" ? sel.class_count : null,
          passType: sel?.type ?? "class_pass",
        },
        ...prev.filter((p) => p.id !== pkgId),
      ]);
      setPackageId(pkgId);
      setStep(3);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not assign package",
        assignedPkgId ? { description: "Pass already assigned — press Continue to retry the payment." } : undefined,
      );
    } finally {
      setAssigning(false);
    }
  }

  async function confirm() {
    if (!member || !packageId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/add-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scheduleId, userId: member.id, packageId, markCheckedIn, allowOverCapacity }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error ?? "Could not add walk-in");
        return;
      }
      toast.success("Walk-in added to the class");
      onAdded();
      handleOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  const targetPkg = existingPkgs.find((p) => p.id === packageId) ?? null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white-warm">
        <DialogHeader>
          <DialogTitle className="font-body font-semibold text-2xl text-charcoal">
            Add walk-in · step {step} of 3
          </DialogTitle>
          <DialogDescription className="font-body text-charcoal/60">
            {step === 1 && "Find an existing member or create a new one."}
            {step === 2 && "Deduct from an active package or assign a new one."}
            {step === 3 && `Confirm the walk-in for ${className}.`}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-sage/20 bg-sage/5 p-1">
              {(["search", "create"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={[
                    "rounded-lg py-2 text-sm font-body font-medium transition-colors duration-200 cursor-pointer",
                    mode === m ? "bg-sage text-cream" : "text-charcoal/70 hover:text-charcoal",
                  ].join(" ")}
                >
                  {m === "search" ? "Existing member" : "New member"}
                </button>
              ))}
            </div>

            {mode === "search" ? (
              <div className="relative">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-charcoal/40" />
                  <Input
                    value={query}
                    onChange={(e) => search(e.target.value)}
                    placeholder="Search by name or email…"
                    className="border-sage/20"
                  />
                  {searching && <Loader2 className="h-4 w-4 animate-spin text-sage" />}
                </div>
                {results.length > 0 && (
                  <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-sage/20 bg-white-warm">
                    {results.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectMember({ id: m.id, name: m.full_name ?? m.email, email: m.email })}
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-sage/5"
                      >
                        <span className="font-body text-sm text-charcoal">{m.full_name ?? m.email}</span>
                        <span className="font-body text-xs text-charcoal/50">{m.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                {query.trim().length >= 2 && !searching && results.length === 0 && (
                  <p className="mt-2 font-body text-sm text-charcoal/50">
                    No member found. Switch to “New member” to create one.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal/80">Name</Label>
                  <Input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Full name"
                    className="border-sage/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal/80">Email</Label>
                  <Input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="member@email.com"
                    className="border-sage/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal/80">Phone (optional)</Label>
                  <Input
                    value={createForm.phone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="Phone number"
                    className="border-sage/20"
                  />
                </div>
                <p className="font-body text-xs text-charcoal/50">
                  Creates the member and emails them a set-password link to access their portal.
                </p>
                <Button onClick={createMember} disabled={creating} variant="sage" className="w-full">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {creating ? "Creating…" : "Create member & continue"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && member && (
          <div className="space-y-5">
            <div className="rounded-lg border border-sage/20 bg-sage/5 px-3 py-2 font-body text-sm text-charcoal">
              {member.name} <span className="text-charcoal/50">· {member.email}</span>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-xl border border-sage/20 bg-sage/5 p-1">
              {(["existing", "new"] as const).map((m) => {
                const disabled = m === "existing" && existingPkgs.length === 0;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={disabled}
                    onClick={() => setPkgMode(m)}
                    className={[
                      "rounded-lg py-2 text-sm font-body font-medium transition-colors duration-200",
                      disabled
                        ? "cursor-not-allowed text-charcoal/30"
                        : pkgMode === m
                          ? "bg-sage text-cream cursor-pointer"
                          : "text-charcoal/70 hover:text-charcoal cursor-pointer",
                    ].join(" ")}
                  >
                    {m === "existing" ? "Use existing pass" : "Assign new pass"}
                  </button>
                );
              })}
            </div>

            {pkgMode === "existing" ? (
              existingPkgs.length === 0 ? (
                <p className="font-body text-sm text-charcoal/50">
                  No active pass with credits. Switch to “Assign new pass”.
                </p>
              ) : (
                <div className="space-y-2">
                  {existingPkgs.map((p) => {
                    const active = chosenExistingId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setChosenExistingId(p.id)}
                        className={[
                          "relative flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors duration-200 cursor-pointer",
                          active ? "border-sage bg-sage/10" : "border-sage/20 bg-sage/[0.03] hover:bg-sage/[0.07]",
                        ].join(" ")}
                      >
                        <span className="font-body text-sm text-charcoal">{p.name}</span>
                        <span className="font-body text-xs text-charcoal/55">
                          {p.credits == null ? "Unlimited" : `${p.credits} left`}
                        </span>
                        {active && <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-sage" />}
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="space-y-6">
                <PassConfigSection state={pass} />
                <PaymentSection state={pass} />
              </div>
            )}
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && member && (
          <div className="space-y-4">
            <div className="rounded-xl border border-sage/20 bg-sage/5 p-4 font-body text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-charcoal/60">Member</span>
                <span className="text-charcoal">{member.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-charcoal/60">Class</span>
                <span className="text-charcoal">{className}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-charcoal/60">Deducting from</span>
                <span className="text-charcoal">
                  {targetPkg ? `${targetPkg.name} (${targetPkg.credits == null ? "unlimited" : `${targetPkg.credits} left`})` : "Selected package"}
                </span>
              </div>
            </div>

            <label
              className={[
                "flex items-center gap-3 rounded-lg border border-sage/20 bg-white-warm px-3 py-2.5",
                classStarted ? "cursor-pointer" : "cursor-not-allowed opacity-60",
              ].join(" ")}
            >
              <Checkbox
                checked={markCheckedIn}
                disabled={!classStarted}
                onCheckedChange={(v) => setMarkCheckedIn(v === true)}
              />
              <span className="font-body text-sm text-charcoal">Mark as checked in (attended)</span>
            </label>
            {!classStarted && (
              <p className="font-body text-xs text-charcoal/50">
                Check-in becomes available once the class starts — the member is booked in for now.
              </p>
            )}

            {capacityNote && (
              <p className="font-body text-xs text-terracotta">{capacityNote}</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep((s) => (s === 3 ? 2 : 1) as 1 | 2 | 3)}
              disabled={creating || assigning || submitting}
              className="font-body"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          )}
          {step === 2 && (
            <Button onClick={proceedFromPackage} disabled={assigning} variant="sage">
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {assigning ? "Assigning…" : "Continue"}
            </Button>
          )}
          {step === 3 && (
            <Button onClick={confirm} disabled={submitting} variant="sage">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? "Adding…" : "Add walk-in"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
