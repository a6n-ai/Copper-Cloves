import { useEffect, useState } from "react";
import { DatePicker } from "@/components/filters";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Banknote, Check, Gift, Loader2, Upload } from "lucide-react";
import { paymentMethodPill } from "@/lib/pillMaps";
import { toast } from "sonner";

/* ────────────────────────────────────────────────────────────────────────
 * Shared "manage pass + payment" engine.
 *
 * One source of truth for the pass-configuration + payment-recording UI so
 * the member-detail "Manage pass" dialog and the members-list "Add member"
 * flow stay identical (same fields, same rules, same API calls). Divergence
 * between those two surfaces was the original complaint — this prevents it.
 * ──────────────────────────────────────────────────────────────────────── */

export const PAYMENT_METHODS = [
  { v: "razorpay_online", l: "Razorpay (Online)" },
  { v: "pine_lab_card", l: "Pine Lab Card" },
  { v: "pine_lab_upi", l: "Pine Lab UPI" },
  { v: "direct_upi", l: "Direct UPI" },
  { v: "razorpay_completed", l: "Razorpay Completed" },
  { v: "cash", l: "Cash" },
] as const;

const CLASS_OPTIONS = [1, 4, 8, 12] as const;
const DAY_OPTIONS = [30, 90, 180, 365] as const;

export type PassType = "class_pass" | "studio_pass";

/** Existing-member context the engine adapts to. Omit for a brand-new member. */
export interface PassMemberContext {
  id: string;
  name: string;
  passCategory: PassType | "none";
  activePackageId: string | null;
  credits: number;
  startDate: string | null;
}

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ──────────────────────────  State hook  ────────────────────────── */

export function usePassPaymentState(member?: PassMemberContext) {
  const [passType, setPassType] = useState<PassType>(
    member?.passCategory === "studio_pass" ? "studio_pass" : "class_pass",
  );
  const [credits, setCredits] = useState<number | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [expiry, setExpiry] = useState("");
  const [isComp, setIsComp] = useState(false);
  const [grantNote, setGrantNote] = useState("");
  const [startDate, setStartDate] = useState(member?.startDate ? member.startDate.slice(0, 10) : "");
  const [method, setMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofUploading, setProofUploading] = useState(false);
  const [defaultValidityDays, setDefaultValidityDays] = useState(30);

  // An active unlimited (studio) pass blocks stacking a class pass on top.
  const studioBlocksClass = member?.passCategory === "studio_pass" && member?.activePackageId != null;

  function reset() {
    setPassType(member?.passCategory === "studio_pass" ? "studio_pass" : "class_pass");
    setCredits(null);
    setDays(null);
    setIsComp(false);
    setGrantNote("");
    setStartDate(member?.startDate ? member.startDate.slice(0, 10) : "");
    setMethod("");
    setAmount("");
    setReference("");
    setProofUrl("");
  }

  // Pull the global default validity once (fallback when a pass has no own duration).
  function loadDefaults() {
    fetch("/api/admin/studio-settings", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const v = d?.settings?.default_package_validity_days;
        if (typeof v === "number" && v > 0) setDefaultValidityDays(v);
      })
      .catch(() => {});
  }

  // Default the (editable) expiry from the selected studio duration or the
  // global default validity.
  useEffect(() => {
    setExpiry(passType === "studio_pass" && days ? isoPlusDays(days) : isoPlusDays(defaultValidityDays));
  }, [passType, days, defaultValidityDays]);

  async function uploadProof(file: File) {
    setProofUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", "payment_proof");
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
      setProofUrl(json.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProofUploading(false);
    }
  }

  return {
    passType, setPassType,
    credits, setCredits,
    days, setDays,
    expiry, setExpiry,
    isComp, setIsComp,
    grantNote, setGrantNote,
    startDate, setStartDate,
    method, setMethod,
    amount, setAmount,
    reference, setReference,
    proofUrl, setProofUrl,
    proofUploading,
    defaultValidityDays,
    studioBlocksClass,
    reset, loadDefaults, uploadProof,
  };
}

export type PassPaymentState = ReturnType<typeof usePassPaymentState>;

/* ──────────────────────────  Validation  ────────────────────────── */

/** True when the config step has a complete, valid pass selection. */
export function passConfigSelected(s: PassPaymentState): boolean {
  if (s.passType === "class_pass") return s.credits !== null;
  return s.days !== null;
}

export function validateConfig(s: PassPaymentState): string | null {
  if (s.passType === "class_pass" && s.credits === null) return "Select number of classes first";
  if (s.passType === "studio_pass" && s.days === null) return "Select number of days first";
  if (s.isComp && !s.grantNote.trim()) return "A grant note is required for a comp pass";
  return null;
}

export function validatePayment(s: PassPaymentState): string | null {
  if (!s.method) return "Select a payment method";
  const v = Number(s.amount);
  if (!Number.isFinite(v) || v <= 0) return "Enter a valid amount in INR";
  if (!s.proofUrl) return "Upload proof of payment before assigning the pass";
  return null;
}

/* ──────────────────────────  API helpers  ────────────────────────── */

async function patchMember(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/members", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Update failed");
  }
}

/** Create/top-up the pass. A comp grant always mints a fresh package. */
export async function applyPassConfig(
  profileId: string,
  s: PassPaymentState,
  existingPackageId: string | null,
) {
  const body: Record<string, unknown> = {
    profile_id: profileId,
    pass_type: s.passType,
    is_comp: s.isComp,
    grant_note: s.grantNote.trim() || undefined,
    expiration_date: s.expiry || undefined,
  };
  if (!s.isComp && existingPackageId) body.user_package_id = existingPackageId;
  if (s.passType === "class_pass" && s.credits !== null) body.class_count = s.credits;
  await patchMember(body);
}

export async function persistStartDate(profileId: string, s: PassPaymentState, originalStartDate: string | null) {
  const original = originalStartDate ? originalStartDate.slice(0, 10) : "";
  if (s.startDate && s.startDate !== original) {
    await patchMember({ profile_id: profileId, start_date: s.startDate });
  }
}

export async function recordPayment(profileId: string, s: PassPaymentState, existingPackageId: string | null) {
  const res = await fetch("/api/admin/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      user_id: profileId,
      user_package_id: existingPackageId ?? undefined,
      method: s.method,
      amount_paise: Math.round(Number(s.amount) * 100),
      reference: s.reference || undefined,
      proof_url: s.proofUrl,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to record payment");
  }
}

/* ──────────────────────────  Atomic onboarding (Add Member)  ────────────────────────── */

export interface OnboardAccount {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
}

/**
 * Create a member and (optionally) assign a pass + record payment in ONE
 * transactional call. Either everything lands or nothing does — no orphan
 * account. Builds its body from the same shared state the detail-page Manage
 * dialog uses, so the two surfaces stay identical.
 */
export async function onboardMember(
  account: OnboardAccount,
  s: PassPaymentState,
  assignPass: boolean,
): Promise<{ id: string }> {
  const body: Record<string, unknown> = {
    email: account.email,
    password: account.password,
    full_name: account.full_name?.trim() || undefined,
    phone: account.phone?.trim() || undefined,
    assign_pass: assignPass,
  };
  if (assignPass) {
    body.pass = {
      pass_type: s.passType,
      class_count: s.passType === "class_pass" && s.credits !== null ? s.credits : undefined,
      expiration_date: s.expiry || undefined,
      is_comp: s.isComp,
      grant_note: s.isComp ? s.grantNote.trim() : undefined,
      start_date: s.startDate || undefined,
    };
    if (!s.isComp) {
      body.payment = {
        method: s.method,
        amount_paise: Math.round(Number(s.amount) * 100),
        reference: s.reference || undefined,
        proof_url: s.proofUrl,
      };
    }
  }
  const res = await fetch("/api/admin/members/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Failed to create member (HTTP ${res.status})`);
  return { id: String((json as { id?: string }).id ?? "") };
}

/* ──────────────────────────  Pass summary string  ────────────────────────── */

export function passSummary(s: PassPaymentState): string {
  if (s.passType === "class_pass") return `Class pass · ${s.credits ?? "—"} classes`;
  return `Studio pass · ${s.days ?? "—"} days`;
}

/* ──────────────────────────  UI: config section  ────────────────────────── */

function OptionCard({
  active,
  disabled,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "relative flex items-center justify-center rounded-xl border font-display text-base transition-colors duration-200 cursor-pointer",
        disabled
          ? "cursor-not-allowed border-charcoal/10 bg-charcoal/5 text-charcoal/30"
          : active
            ? "border-sage bg-sage text-cream"
            : "border-sage/20 bg-sage/5 text-charcoal hover:bg-sage/10",
        className,
      ].join(" ")}
    >
      {active && !disabled && <Check className="absolute right-2 top-2 h-3.5 w-3.5 opacity-80" />}
      {children}
    </button>
  );
}

export function PassConfigSection({
  state: s,
  showComp = true,
  currentCredits,
}: {
  state: PassPaymentState;
  showComp?: boolean;
  currentCredits?: number;
}) {
  return (
    <div className="space-y-6">
      {/* Pass type — segmented control */}
      <div>
        <Label className="font-body text-charcoal/80 mb-2.5 block text-sm">Pass type</Label>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-sage/20 bg-sage/5 p-1">
          {(["class_pass", "studio_pass"] as const).map((pt) => {
            const blocked = pt === "class_pass" && s.studioBlocksClass;
            const active = s.passType === pt;
            return (
              <button
                key={pt}
                type="button"
                disabled={blocked}
                onClick={() => { s.setPassType(pt); s.setCredits(null); s.setDays(null); }}
                className={[
                  "rounded-lg py-2 text-sm font-body font-medium transition-colors duration-200 cursor-pointer",
                  blocked
                    ? "cursor-not-allowed text-charcoal/30"
                    : active
                      ? "bg-sage text-cream shadow-xs"
                      : "text-charcoal/70 hover:text-charcoal",
                ].join(" ")}
              >
                {pt === "class_pass" ? "Class pass" : "Studio pass"}
              </button>
            );
          })}
        </div>
        {s.studioBlocksClass && (
          <p className="font-body text-xs text-charcoal/50 mt-2">
            Studio pass is unlimited — a class pass can&apos;t be added until it expires.
          </p>
        )}
      </div>

      {/* Quantity */}
      {s.passType === "class_pass" ? (
        <div>
          <Label className="font-body text-charcoal/80 mb-2.5 block text-sm">
            Classes
            {typeof currentCredits === "number" && (
              <span className="ml-2 font-normal text-charcoal/40">currently {currentCredits}</span>
            )}
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {CLASS_OPTIONS.map((n) => (
              <OptionCard key={n} active={s.credits === n} onClick={() => s.setCredits(n)} className="h-14">
                {n}
              </OptionCard>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <Label className="font-body text-charcoal/80 mb-2.5 block text-sm">Days (from today)</Label>
          <div className="grid grid-cols-4 gap-2">
            {DAY_OPTIONS.map((d) => (
              <OptionCard key={d} active={s.days === d} onClick={() => s.setDays(d)} className="h-14">
                {d}d
              </OptionCard>
            ))}
          </div>
        </div>
      )}

      {/* Expiry + start date */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">Pass expiry</Label>
          <DatePicker value={s.expiry} onChange={s.setExpiry} className="h-11" />
        </div>
        <div>
          <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">Member start date</Label>
          <DatePicker value={s.startDate} onChange={s.setStartDate} className="h-11" />
        </div>
      </div>

      {/* Comp toggle */}
      {showComp && (
        <div className="rounded-xl border border-sage/15 bg-sage/[0.03] p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox checked={s.isComp} onCheckedChange={(v) => s.setIsComp(v === true)} className="mt-0.5" />
            <span>
              <span className="font-body text-charcoal/90 text-sm flex items-center gap-1.5">
                <Gift className="h-3.5 w-3.5 text-terracotta" /> Comp pass (no payment)
              </span>
              <span className="font-body text-charcoal/50 text-xs block mt-0.5">
                Grants the pass for free. A grant note is required; no payment is recorded.
              </span>
            </span>
          </label>
          {s.isComp && (
            <div className="mt-3">
              <Textarea
                value={s.grantNote}
                onChange={(e) => s.setGrantNote(e.target.value)}
                placeholder="Reason for the comp grant…"
                className="border-charcoal/20 focus:border-sage font-body"
                rows={2}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────  UI: payment section  ────────────────────────── */

export function PaymentSection({ state: s }: { state: PassPaymentState }) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="font-body text-charcoal/70 text-sm mb-2 block">Payment method</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PAYMENT_METHODS.map((m) => {
            const active = s.method === m.v;
            const isCash = m.v === "cash";
            return (
              <button
                key={m.v}
                type="button"
                onClick={() => s.setMethod(m.v)}
                className={[
                  "flex h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-body transition-colors duration-200 cursor-pointer",
                  active
                    ? "border-sage bg-sage text-cream"
                    : "border-sage/20 bg-sage/5 text-charcoal hover:bg-sage/10",
                ].join(" ")}
              >
                {isCash && <Banknote className="h-3.5 w-3.5" />}
                {m.l}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="font-body text-charcoal/70 text-sm mb-1 block">Amount (₹)</Label>
          <Input
            type="number"
            min="0"
            step="1"
            value={s.amount}
            onChange={(e) => s.setAmount(e.target.value)}
            className="h-11 border-charcoal/20 focus:border-sage font-body tabular-nums"
            placeholder="e.g. 6015"
          />
        </div>
        <div>
          <Label className="font-body text-charcoal/70 text-sm mb-1 block">Reference (opt.)</Label>
          <Input
            type="text"
            value={s.reference}
            onChange={(e) => s.setReference(e.target.value)}
            className="h-11 border-charcoal/20 focus:border-sage font-body"
            placeholder="txn id / slip #"
          />
        </div>
      </div>

      <div>
        <Label className="font-body text-charcoal/70 text-sm mb-1 block">Proof of payment (required)</Label>
        <div className="flex items-center gap-3">
          <label
            className={[
              "flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-dashed font-body text-sm transition-colors duration-200 cursor-pointer",
              s.proofUrl
                ? "border-sage/40 bg-sage/5 text-sage"
                : "border-charcoal/20 bg-white-warm text-charcoal/60 hover:border-sage/40",
            ].join(" ")}
          >
            {s.proofUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : s.proofUrl ? (
              <Check className="h-4 w-4" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {s.proofUploading ? "Uploading…" : s.proofUrl ? "Proof attached" : "Upload image"}
            <input
              type="file"
              accept="image/*"
              disabled={s.proofUploading}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void s.uploadProof(f);
              }}
            />
          </label>
          {s.proofUrl && !s.proofUploading && (
            <a href={s.proofUrl} target="_blank" rel="noreferrer" className="font-body text-xs text-sage underline shrink-0">
              view
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* Re-export so callers don't reach into pillMaps for the method label. */
export function paymentMethodLabel(method: string): string {
  return paymentMethodPill(method).label;
}