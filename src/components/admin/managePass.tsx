import { useEffect, useState } from "react";
import { DatePicker } from "@/components/filters";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Banknote, Check, Gift, Loader2, Upload } from "lucide-react";
import { paymentMethodPill } from "@/lib/pillMaps";
import { toast } from "sonner";

/* ────────────────────────────────────────────────────────────────────────
 * Shared "manage pass + payment" engine.
 *
 * One source of truth for the assign-pass UI so the member-detail Manage
 * dialog and the members-list "Add member" flow stay identical (same package
 * catalog, same discount/price math, same proof rules, same API calls).
 *
 * Pass selection is CATALOG-DRIVEN: the admin picks a published PackageType,
 * whose price is authoritative. A discount (% or flat ₹) reduces it; the final
 * amount is what gets recorded. A 100%/full discount is a free grant (is_comp),
 * no payment + no proof. Anything paid requires a proof image.
 * ──────────────────────────────────────────────────────────────────────── */

export const PAYMENT_METHODS = [
  { v: "razorpay_online", l: "Razorpay (Online)" },
  { v: "pine_lab_card", l: "Pine Lab Card" },
  { v: "pine_lab_upi", l: "Pine Lab UPI" },
  { v: "direct_upi", l: "Direct UPI" },
  { v: "razorpay_completed", l: "Razorpay Completed" },
  { v: "cash", l: "Cash" },
] as const;

export type PassType = "class_pass" | "studio_pass";
export type DiscountUnit = "pct" | "flat";

/** A published catalog package the admin can assign. */
export interface PackageRow {
  id: string;
  name: string;
  type: string;
  price: number;
  class_count: number | null;
  duration_months: number | null;
  is_unlimited: boolean;
}

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

function isoPlusMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** A studio/month pass has a fixed duration; its expiry is NOT admin-editable. */
function isFixedDurationPackage(pkg: PackageRow | null): boolean {
  return !!pkg && (pkg.is_unlimited || (pkg.duration_months ?? 0) > 0);
}

/* ──────────────────────────  State hook  ────────────────────────── */

export function usePassPaymentState(member?: PassMemberContext) {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState("");
  const [discountUnit, setDiscountUnit] = useState<DiscountUnit>("pct");
  const [expiry, setExpiry] = useState("");
  const [grantNote, setGrantNote] = useState("");
  const [startDate, setStartDate] = useState(member?.startDate ? member.startDate.slice(0, 10) : "");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofUploading, setProofUploading] = useState(false);
  const [defaultValidityDays, setDefaultValidityDays] = useState(30);

  // An active unlimited (studio) pass blocks stacking a class pass on top.
  const studioBlocksClass = member?.passCategory === "studio_pass" && member?.activePackageId != null;

  function reset() {
    setSelectedPackageId(null);
    setDiscountValue("");
    setDiscountUnit("pct");
    setGrantNote("");
    setStartDate(member?.startDate ? member.startDate.slice(0, 10) : "");
    setMethod("");
    setReference("");
    setProofUrl("");
  }

  // Pull the global default validity once + the published package catalog.
  function loadDefaults() {
    fetch("/api/admin/studio-settings", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const v = d?.settings?.default_package_validity_days;
        if (typeof v === "number" && v > 0) setDefaultValidityDays(v);
      })
      .catch(() => {});

    setPackagesLoading(true);
    // published=1 → only live/new packages, never the hidden legacy/comp rows
    // (an admin session would otherwise receive the full catalog).
    fetch("/api/packages?published=1", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: unknown) => {
        const list = Array.isArray(rows) ? rows : [];
        setPackages(
          list.map((p: Record<string, unknown>) => ({
            id: String(p.id),
            name: String(p.name ?? "Package"),
            type: String(p.type ?? "class_pass"),
            price: Number(p.price ?? 0),
            class_count: p.class_count == null ? null : Number(p.class_count),
            duration_months: p.duration_months == null ? null : Number(p.duration_months),
            is_unlimited: Boolean(p.is_unlimited),
          })),
        );
      })
      .catch(() => {})
      .finally(() => setPackagesLoading(false));
  }

  // Default the expiry from the selected package: fixed-duration packages derive
  // it (locked); class passes fall back to the package validity or global default.
  useEffect(() => {
    const pkg = packages.find((p) => p.id === selectedPackageId) ?? null;
    if (!pkg) return;
    if ((pkg.duration_months ?? 0) > 0) setExpiry(isoPlusMonths(pkg.duration_months as number));
    else setExpiry(isoPlusDays(defaultValidityDays));
  }, [selectedPackageId, packages, defaultValidityDays]);

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
    packages, packagesLoading,
    selectedPackageId, setSelectedPackageId,
    discountValue, setDiscountValue,
    discountUnit, setDiscountUnit,
    expiry, setExpiry,
    grantNote, setGrantNote,
    startDate, setStartDate,
    method, setMethod,
    reference, setReference,
    proofUrl, setProofUrl,
    proofUploading,
    defaultValidityDays,
    studioBlocksClass,
    reset, loadDefaults, uploadProof,
  };
}

export type PassPaymentState = ReturnType<typeof usePassPaymentState>;

/* ──────────────────────────  Derived selectors  ────────────────────────── */

export function selectedPackageOf(s: PassPaymentState): PackageRow | null {
  return s.packages.find((p) => p.id === s.selectedPackageId) ?? null;
}

export interface PriceBreakdown {
  originalPaise: number;
  discountPaise: number;
  finalPaise: number;
  isFree: boolean;
}

/** Authoritative price math — original from catalog, minus the discount. */
export function priceBreakdown(s: PassPaymentState): PriceBreakdown {
  const pkg = selectedPackageOf(s);
  const originalPaise = pkg ? Math.round(pkg.price * 100) : 0;
  const d = Number(s.discountValue);
  const validD = Number.isFinite(d) && d > 0 ? d : 0;
  const discountPaise =
    s.discountUnit === "pct"
      ? Math.round((originalPaise * Math.min(validD, 100)) / 100)
      : Math.min(originalPaise, Math.round(validD * 100));
  const finalPaise = Math.max(0, originalPaise - discountPaise);
  // Only a priced package that's been fully discounted is "free" — with nothing
  // selected (originalPaise 0) the Free/Comp method shouldn't look pre-picked.
  return { originalPaise, discountPaise, finalPaise, isFree: originalPaise > 0 && finalPaise <= 0 };
}

export function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/* ──────────────────────────  Validation  ────────────────────────── */

/** True when a package has been chosen. */
export function passConfigSelected(s: PassPaymentState): boolean {
  return s.selectedPackageId !== null;
}

export function validateConfig(s: PassPaymentState): string | null {
  if (!s.selectedPackageId) return "Select a package first";
  if (!s.expiry) return "Set a pass expiry";
  return null;
}

export function validatePayment(s: PassPaymentState): string | null {
  if (priceBreakdown(s).isFree) return null;
  if (!s.method) return "Select a payment method";
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

/** Create the pass for the chosen catalog package. Free grant ⇒ is_comp. */
export async function applyPassConfig(profileId: string, s: PassPaymentState) {
  const pkg = selectedPackageOf(s);
  if (!pkg) throw new Error("No package selected");
  const isFree = priceBreakdown(s).isFree;
  const body: Record<string, unknown> = {
    profile_id: profileId,
    package_type_id: pkg.id,
    pass_type: pkg.type,
    is_comp: isFree,
    grant_note: s.grantNote.trim() || undefined,
    expiration_date: s.expiry || undefined,
  };
  if (pkg.type === "class_pass" && pkg.class_count != null) body.class_count = pkg.class_count;
  await patchMember(body);
}

export async function persistStartDate(profileId: string, s: PassPaymentState, originalStartDate: string | null) {
  const original = originalStartDate ? originalStartDate.slice(0, 10) : "";
  if (s.startDate && s.startDate !== original) {
    await patchMember({ profile_id: profileId, start_date: s.startDate });
  }
}

export async function recordPayment(profileId: string, s: PassPaymentState, existingPackageId: string | null) {
  const { finalPaise } = priceBreakdown(s);
  const res = await fetch("/api/admin/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      user_id: profileId,
      user_package_id: existingPackageId ?? undefined,
      method: s.method,
      amount_paise: finalPaise,
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
 * account.
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
    const pkg = selectedPackageOf(s);
    const { finalPaise, isFree } = priceBreakdown(s);
    body.pass = {
      package_type_id: pkg?.id,
      pass_type: pkg?.type,
      class_count: pkg?.type === "class_pass" && pkg.class_count != null ? pkg.class_count : undefined,
      expiration_date: s.expiry || undefined,
      is_comp: isFree,
      grant_note: s.grantNote.trim() || undefined,
      start_date: s.startDate || undefined,
    };
    if (!isFree) {
      body.payment = {
        method: s.method,
        amount_paise: finalPaise,
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
  const pkg = selectedPackageOf(s);
  if (!pkg) return "No package selected";
  const qty =
    pkg.type === "class_pass"
      ? pkg.class_count != null
        ? `${pkg.class_count} classes`
        : "class pass"
      : pkg.is_unlimited
        ? "unlimited"
        : pkg.duration_months
          ? `${pkg.duration_months} mo`
          : "studio pass";
  return `${pkg.name} · ${qty}`;
}

/* ──────────────────────────  UI: config section  ────────────────────────── */

export function PassConfigSection({
  state: s,
  currentCredits,
}: {
  state: PassPaymentState;
  showComp?: boolean;
  currentCredits?: number;
}) {
  const selected = selectedPackageOf(s);
  const expiryLocked = isFixedDurationPackage(selected);
  const [typeTab, setTypeTab] = useState<PassType>(
    s.studioBlocksClass ? "studio_pass" : selected?.type === "studio_pass" ? "studio_pass" : "class_pass",
  );
  const visiblePackages = s.packages.filter((p) => p.type === typeTab);

  return (
    <div className="space-y-6">
      {/* Pass type tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-sage/20 bg-sage/5 p-1">
        {(["class_pass", "studio_pass"] as const).map((t) => {
          const blocked = t === "class_pass" && s.studioBlocksClass;
          return (
            <button
              key={t}
              type="button"
              disabled={blocked}
              onClick={() => {
                setTypeTab(t);
                if (selectedPackageOf(s)?.type !== t) s.setSelectedPackageId(null);
              }}
              className={[
                "rounded-lg py-2 text-sm font-body font-medium transition-colors duration-200",
                blocked
                  ? "cursor-not-allowed text-charcoal/30"
                  : typeTab === t
                    ? "bg-sage text-cream shadow-xs cursor-pointer"
                    : "text-charcoal/70 hover:text-charcoal cursor-pointer",
              ].join(" ")}
            >
              {t === "class_pass" ? "Class pass" : "Studio pass"}
            </button>
          );
        })}
      </div>

      {/* Package picker */}
      <div>
        <Label className="font-body text-charcoal/80 mb-2.5 block text-sm">
          Package
          {typeof currentCredits === "number" && (
            <span className="ml-2 font-normal text-charcoal/40">currently {currentCredits} classes</span>
          )}
        </Label>
        {s.packagesLoading ? (
          <div className="flex h-20 items-center justify-center rounded-xl border border-sage/15 bg-sage/[0.03]">
            <Loader2 className="h-4 w-4 animate-spin text-sage" />
          </div>
        ) : visiblePackages.length === 0 ? (
          <p className="font-body text-sm text-charcoal/50">No published {typeTab === "class_pass" ? "class" : "studio"} packages.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {visiblePackages.map((pkg) => {
              const active = s.selectedPackageId === pkg.id;
              const blocked = pkg.type === "class_pass" && s.studioBlocksClass;
              const qty =
                pkg.type === "class_pass"
                  ? pkg.class_count != null ? `${pkg.class_count} classes` : "Class pass"
                  : pkg.is_unlimited ? "Unlimited" : pkg.duration_months ? `${pkg.duration_months} month` : "Studio pass";
              return (
                <button
                  key={pkg.id}
                  type="button"
                  disabled={blocked}
                  onClick={() => s.setSelectedPackageId(pkg.id)}
                  className={[
                    "relative flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-colors duration-200",
                    blocked
                      ? "cursor-not-allowed border-charcoal/10 bg-charcoal/5 opacity-50"
                      : active
                        ? "border-sage bg-sage/10 cursor-pointer"
                        : "border-sage/20 bg-sage/[0.03] hover:bg-sage/[0.07] cursor-pointer",
                  ].join(" ")}
                >
                  {active && <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-sage" />}
                  <span className="font-display text-sm leading-tight text-charcoal pr-5">{pkg.name}</span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-body text-sm font-semibold text-charcoal tabular-nums">{formatINR(Math.round(pkg.price * 100))}</span>
                    <span className="font-body text-[11px] text-charcoal/50">{qty}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {s.studioBlocksClass && (
          <p className="font-body text-xs text-charcoal/50 mt-2">
            Studio pass is unlimited — a class pass can&apos;t be added until it expires.
          </p>
        )}
      </div>

      {/* Expiry + start date */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">
            Pass expiry{expiryLocked && <span className="ml-1.5 font-normal text-charcoal/40">· fixed by package</span>}
          </Label>
          {expiryLocked ? (
            <div className="flex h-11 items-center rounded-md border border-charcoal/10 bg-charcoal/5 px-3 font-body text-sm text-charcoal/60">
              {s.expiry || "—"}
            </div>
          ) : (
            <DatePicker value={s.expiry} onChange={s.setExpiry} className="h-11" />
          )}
        </div>
        <div>
          <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">Member start date</Label>
          <DatePicker value={s.startDate} onChange={s.setStartDate} className="h-11" />
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────  UI: discount + payment section  ────────────────────────── */

export function PaymentSection({ state: s }: { state: PassPaymentState }) {
  const { originalPaise, discountPaise, finalPaise, isFree } = priceBreakdown(s);
  const hasPackage = s.selectedPackageId !== null;

  return (
    <div className="space-y-4">
      {/* Discount */}
      <div>
        <Label className="font-body text-charcoal/70 text-sm mb-2 block">Discount (optional)</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            min="0"
            step="1"
            value={s.discountValue}
            onChange={(e) => s.setDiscountValue(e.target.value)}
            className="h-11 border-charcoal/20 focus:border-sage font-body tabular-nums"
            placeholder="0"
          />
          <div className="grid grid-cols-2 gap-1 rounded-md border border-sage/20 bg-sage/5 p-1 shrink-0">
            {(["pct", "flat"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => s.setDiscountUnit(u)}
                className={[
                  "rounded px-3 text-sm font-body font-medium transition-colors duration-200 cursor-pointer",
                  s.discountUnit === u ? "bg-sage text-cream" : "text-charcoal/70 hover:text-charcoal",
                ].join(" ")}
              >
                {u === "pct" ? "%" : "₹"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Price breakdown */}
      {hasPackage && (
        <div className="rounded-xl border border-sage/20 bg-sage/5 p-3 font-body text-sm">
          <div className="flex items-center justify-between text-charcoal/60">
            <span>Package price</span>
            <span className="tabular-nums">{formatINR(originalPaise)}</span>
          </div>
          {discountPaise > 0 && (
            <div className="flex items-center justify-between text-terracotta">
              <span>Discount{s.discountUnit === "pct" ? ` (${Math.min(Number(s.discountValue) || 0, 100)}%)` : ""}</span>
              <span className="tabular-nums">− {formatINR(discountPaise)}</span>
            </div>
          )}
          <div className="mt-1.5 flex items-center justify-between border-t border-sage/15 pt-1.5 font-semibold text-charcoal">
            <span>Amount payable</span>
            <span className="tabular-nums">{formatINR(finalPaise)}</span>
          </div>
        </div>
      )}

      {/* Payment method — always visible; "Free / Comp" is a method that zeroes the amount. */}
      <div>
        <Label className="font-body text-charcoal/70 text-sm mb-2 block">Payment method</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PAYMENT_METHODS.map((m) => {
            const active = !isFree && s.method === m.v;
            const isCash = m.v === "cash";
            return (
              <button
                key={m.v}
                type="button"
                onClick={() => {
                  s.setMethod(m.v);
                  // Picking a real method un-frees a 100%/full discount.
                  if (isFree) s.setDiscountValue("");
                }}
                className={[
                  "flex h-10 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-body transition-colors duration-200 cursor-pointer",
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
          {/* Free / Comp → sets 100% discount, amount becomes ₹0, no proof. */}
          <button
            type="button"
            onClick={() => {
              s.setDiscountUnit("pct");
              s.setDiscountValue("100");
              s.setMethod("");
            }}
            className={[
              "flex h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-body transition-colors duration-200 cursor-pointer",
              isFree
                ? "border-terracotta bg-terracotta text-cream"
                : "border-terracotta/30 bg-terracotta/5 text-terracotta hover:bg-terracotta/10",
            ].join(" ")}
          >
            <Gift className="h-3.5 w-3.5" /> Free / Comp
          </button>
        </div>
      </div>

      {isFree ? (
        /* Free grant — no payment, no proof. */
        <div className="rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
          <span className="font-body text-sm text-charcoal/90 flex items-center gap-1.5">
            <Gift className="h-3.5 w-3.5 text-terracotta" /> Free pass — no payment recorded.
          </span>
          <Textarea
            value={s.grantNote}
            onChange={(e) => s.setGrantNote(e.target.value)}
            placeholder="Reason for the free grant (optional)…"
            className="mt-3 border-charcoal/20 focus:border-sage font-body"
            rows={2}
          />
        </div>
      ) : (
        <>
          {/* Reference + proof */}
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
        </>
      )}
    </div>
  );
}

/* Re-export so callers don't reach into pillMaps for the method label. */
export function paymentMethodLabel(method: string): string {
  return paymentMethodPill(method).label;
}
