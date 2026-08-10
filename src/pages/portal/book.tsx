import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStudioSWR } from "@/lib/swr";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

export const getServerSideProps = requireSessionSSP();
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/router";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/Pagination";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/responsive/ResponsiveDialog";
import { classInitials, classFallbackGradient } from "@/components/classes/classFallback";
import { Pill } from "@/components/ui/pill";
import {
  X,
  Clock,
  Users,
  CheckCircle,
  Calendar,
  Ticket,
  Heart,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  AlertCircle,
  ArrowDownUp,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Check,
  Star,
} from "lucide-react";
import { NavPrevButton, NavNextButton, QtyMinusButton, QtyPlusButton } from "@/components/ui/quick-actions";
import { FilterSelect, useFilterState } from "@/components/filters";
import { useSession } from "@/lib/auth/client";
import {
  startOfMondayWeekLocal,
  endOfSundayWeekLocal,
  isSameLocalCalendarDay,
} from "@/lib/calendarWeek";
// Razorpay client helpers are loaded lazily inside payment handlers — they pull
// in the razorpay SDK loader and several KB of helper code that's only needed
// at checkout time. Keeping them out of the initial page bundle improves TTI
// for the /portal/book route, which is the highest-traffic logged-in entry.
import {
  buildRazorpayReturnUrl,
  clearPendingRazorpayCheckout,
  loadPendingRazorpayCheckout,
  savePendingRazorpayCheckout,
} from "@/lib/pendingRazorpayCheckout";
import { passCategoryForPackageType } from "@/lib/couponHelpers";
import {
  bestCafeDiscount,
  cafeDiscountPercentOf,
} from "@/lib/cafeDiscount";

import Image from "next/image";
import dynamic from "next/dynamic";
import { cdnUrl } from "@/lib/cdnUrl";
import type { AddedMember } from "@/components/portal/MemberSearch";

// MemberSearch is only mounted inside Step 1 of the slide-in booking panel
// (gated behind `showBookingPanel`), never on first paint. It pulls in
// `react-phone-number-input` (country data) + the PhoneInput component, which
// are several KB that don't belong in the initial /portal/book bundle. Lazy-load
// it so the class list/filters/calendar above the fold ship without it.
const MemberSearch = dynamic(
  () => import("@/components/portal/MemberSearch").then((m) => m.MemberSearch),
  { ssr: false, loading: () => null },
);

// Tax rate (adjust as needed)
const TAX_RATE = 0.05; // 5% tax
const POST_END_GRACE_MS = 10 * 60 * 1000;

interface FoodItem {
  id: string;
  name: string;
  category: string;
  description: string;
  image: string;
  price: number;
  quantity: number;
}

function formatCafeCategory(category: string): string {
  return category
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Pull an `error` string out of a non-OK fetch Response, falling back to a default. */
async function parseApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string" && body.error) return body.error;
  } catch {
    /* ignore */
  }
  return fallback;
}

type PackageKind = "studio_pass" | "class_pass" | null;

/** Number of day-pass equivalents owed (primary + guests, minus whatever the pass covers). */
function computeDayPassEquivalentCount(
  packageType: PackageKind,
  guestCount: number,
  useCredits: boolean,
): number {
  const totalPeople = 1 + guestCount;
  if (packageType === "studio_pass") return guestCount;
  if (packageType === "class_pass") return useCredits ? guestCount : totalPeople;
  return totalPeople;
}

type CafeOrderLine = { id: string; quantity: number };

type OnlineBookingResult = {
  status: "success" | "cancelled" | "failed" | "aborted";
  failureDetail?: string;
};

/** Throws a member-facing error if a class-pass credit booking can't proceed. */
function assertClassPassUsable(
  usingClassPassCredit: boolean,
  pkg: { credits_remaining?: number | null } | null,
): void {
  if (!usingClassPassCredit) return;
  if (!pkg) throw new Error("No active package found. Please purchase a package first.");
  if ((pkg.credits_remaining ?? 0) < 1) throw new Error("You don't have any classes remaining.");
}

type BookablePkg = {
  id?: string;
  is_active: boolean;
  expiration_date: string;
  purchase_date?: string | null;
  credits_remaining?: number | null;
  package_type?: {
    name?: string | null;
    type?: string | null;
    is_unlimited?: boolean | null;
    cafe_discount_percent?: number | string | null;
  } | null;
};

/** Active (is_active + not expired) packages from a raw /api/user-packages list. */
function activePackagesOf(packages: unknown): BookablePkg[] {
  if (!Array.isArray(packages)) return [];
  const now = Date.now();
  return (packages as BookablePkg[]).filter(
    (p) => p.is_active && new Date(p.expiration_date).getTime() > now,
  );
}

const isUnlimitedPkg = (p: BookablePkg) => !!p.package_type?.is_unlimited;

/**
 * Pick the pass to deduct a class from. A member can hold several active passes at
 * once (e.g. multiple 1-Class passes); picking the first blindly can land on a
 * 0-credit pass and wrongly block booking. Deduct from the pass EXPIRING SOONEST
 * (spend it before it lapses). Unlimited passes need no deduction. Falls back to
 * any active pass so display still works.
 */
const expiresAt = (p: BookablePkg) => new Date(p.expiration_date).getTime();

function pickBookablePackage(packages: unknown): BookablePkg | null {
  const active = activePackagesOf(packages);
  if (active.length === 0) return null;
  const usable = active.filter(
    (p) => isUnlimitedPkg(p) || (p.credits_remaining ?? 0) >= 1,
  );
  const pool = usable.length > 0 ? usable : active;
  return pool.slice().sort((a, b) => expiresAt(a) - expiresAt(b))[0];
}

/** Total class credits across all active passes; null if any active pass is unlimited. */
function totalActiveClasses(packages: unknown): number | null {
  const active = activePackagesOf(packages);
  if (active.some(isUnlimitedPkg)) return null;
  return active.reduce((sum, p) => sum + Math.max(0, p.credits_remaining ?? 0), 0);
}

/** Fetch the member's active packages and return the best pass to book against (or null). */
async function fetchActivePackage(): Promise<{ id?: string; credits_remaining?: number | null } | null> {
  const res = await fetch("/api/user-packages?active=true", { credentials: "include" });
  const packages = res.ok ? await res.json() : [];
  return pickBookablePackage(packages);
}

/** Save a free (no-payment-owed) booking and any café add-ons; returns the booking id. */
async function runFreeBooking(bookingBody: unknown, cafeLines: CafeOrderLine[]): Promise<void> {
  const bookingRes = await fetch("/api/bookings", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bookingBody),
  });
  if (!bookingRes.ok) {
    throw new Error(
      await parseApiError(bookingRes, "Failed to save class booking. Please contact support."),
    );
  }
  const bookingData = await bookingRes.json();
  await submitCafeOrders(bookingData.id, cafeLines);
}

/**
 * Runs the online (Razorpay) booking checkout end-to-end: create order, open
 * checkout, complete the verified payment. Returns a single-shape result so the
 * caller can drive UI side-effects without React in this module.
 */
async function runOnlineBookingCheckout(args: {
  orderRequestBody: unknown;
  pendingBase: Record<string, unknown>;
  checkoutDescription: string;
  prefill: { email?: string; name?: string };
}): Promise<OnlineBookingResult> {
  const createRes = await fetch("/api/payments/razorpay/create-order", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.orderRequestBody),
  });
  if (!createRes.ok) {
    throw new Error(await parseApiError(createRes, "Could not start Razorpay checkout."));
  }

  const orderPayload = (await createRes.json()) as {
    order_id?: string;
    amount?: number | string;
    currency?: string;
    key_id?: string;
    razorpay_mode?: "test" | "live" | "unknown";
  };

  if (
    !orderPayload.order_id ||
    orderPayload.key_id === null ||
    orderPayload.key_id === undefined ||
    String(orderPayload.key_id).trim() === "" ||
    orderPayload.amount === null ||
    orderPayload.amount === undefined
  ) {
    throw new Error("Invalid payment setup from server.");
  }

  const amountPaise = Number(orderPayload.amount);
  if (!Number.isFinite(amountPaise)) {
    throw new Error("Invalid order amount from Razorpay.");
  }

  savePendingRazorpayCheckout({
    ...args.pendingBase,
    purpose: "booking",
    razorpayOrderId: orderPayload.order_id,
    savedAt: Date.now(),
  } as Parameters<typeof savePendingRazorpayCheckout>[0]);

  const { payWithRazorpayOrder } = await import("@/lib/razorpayCheckout");
  const checkoutResult = await payWithRazorpayOrder({
    keyId: String(orderPayload.key_id).trim(),
    amountPaise,
    currency: orderPayload.currency ?? "INR",
    orderId: orderPayload.order_id,
    name: "Copper Cloves",
    description: args.checkoutDescription,
    prefill: { email: args.prefill.email, name: args.prefill.name },
    callbackUrl: buildRazorpayReturnUrl("booking"),
    // Full-page redirect so a closed/backgrounded tab can't drop the capture.
    redirect: true,
  });
  if (checkoutResult.kind === "cancelled") {
    clearPendingRazorpayCheckout();
    return { status: "cancelled" };
  }
  if (checkoutResult.kind === "failed") {
    clearPendingRazorpayCheckout();
    const { razorpayPaymentErrorHelp } = await import("@/lib/razorpayClientHints");
    return {
      status: "failed",
      failureDetail: razorpayPaymentErrorHelp(
        checkoutResult.message,
        String(orderPayload.key_id).trim(),
        orderPayload.razorpay_mode,
      ),
    };
  }

  const pending = loadPendingRazorpayCheckout();
  if (!pending || pending.purpose !== "booking") {
    throw new Error("Checkout session lost. Please try again.");
  }
  if (checkoutResult.kind !== "success") throw new Error("Unexpected checkout state.");
  const { completePendingBookingCheckout } = await import("@/lib/completeRazorpayCheckout");
  await completePendingBookingCheckout(pending, checkoutResult.payload);
  clearPendingRazorpayCheckout();
  return { status: "success" };
}

/** Fire all café orders concurrently for a booking; throws on the first failure. */
async function submitCafeOrders(bookingId: string, lines: CafeOrderLine[]): Promise<void> {
  const results = await Promise.all(
    lines.map((item) =>
      fetch("/api/cafe/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cafe_item_id: item.id,
          booking_id: bookingId,
          quantity: item.quantity,
          payment_method: "pay_at_studio",
        }),
      }),
    ),
  );
  for (const res of results) {
    if (!res.ok) throw new Error(await parseApiError(res, "Could not add café order."));
  }
}

export interface Class {
  id: string;
  name: string;
  time: string;
  instructor: string;
  instructorImageUrl?: string | null;
  duration: string;
  image: string;
  category: string;
  description?: string;
  benefits?: string[];
  maxCapacity?: number;
  /** Effective capacity for this dated instance (schedule override ?? class default). */
  capacity?: number;
  /** Remaining bookable seats (schedule.available_spots, already net of bookings). */
  spotsLeft?: number;
  /** Raw schedule lifecycle status (available | started | completed | ...). */
  status?: string;
  /** ISO datetime for this scheduled instance (for booking + sorting). */
  startTimeIso: string;
  /** ISO time as epoch ms — precomputed once so sort compares don't build Date per call. */
  startTimeMs: number;
  /** False when start time is in the past (still listed for the weekly grid). */
  isBookable?: boolean;
}

/** Raw class-schedule row as returned by GET /api/class-schedules. */
type RawSchedule = {
  id: string;
  start_time: string;
  end_time?: string | null;
  status?: string;
  capacity?: number | null;
  available_spots?: number | null;
  class_model?: {
    name?: string;
    duration?: number;
    category?: string;
    image_url?: string;
    description?: string | null;
    benefits?: string[];
    max_capacity?: number;
  };
  instructor?: { name?: string; image_url?: string | null };
};

/** Mirrors a bookable class Card: image, title, 3-icon info row, full-width button. */
/**
 * Memoized class card — extracted out of the parent map so each card only
 * rerenders when its own props change. Previously every state change on the
 * page (e.g. friends/family input keystroke, food quantity tick, coupon
 * validate) rebuilt the inline JSX for every card in `paginatedClasses`.
 * Combined with `useCallback` on the parent's `handleSelectClass`, this lets
 * `React.memo` actually skip rerenders.
 */
/** Instructor avatar (photo or initials) used in the card image strip + detail dialog. */
function InstructorAvatar({ name, imageUrl, className = "" }: Readonly<{ name: string; imageUrl?: string | null; className?: string }>) {
  const initial = (name || "").slice(0, 1).toUpperCase();
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full border-2 border-white-warm/90 bg-linear-to-br from-terracotta/80 to-terracotta ${className}`}>
      {imageUrl ? (
        <Image src={imageUrl} alt={name} fill sizes="64px" className="object-cover" />
      ) : (
        <span aria-hidden="true" className="flex h-full w-full items-center justify-center font-body font-semibold text-sm text-white-warm">
          {initial}
        </span>
      )}
    </div>
  );
}

type StatusTone = "available" | "low" | "full" | "past";
const STATUS_DOT: Record<StatusTone, string> = {
  available: "bg-sage",
  low: "bg-terracotta",
  full: "bg-terracotta",
  past: "bg-charcoal/30",
};
const STATUS_TEXT: Record<StatusTone, string> = {
  available: "text-sage",
  low: "text-terracotta",
  full: "text-terracotta",
  past: "text-charcoal/40",
};
/** Maps the booking status tone to the shared Pill component tone. */
const STATUS_PILL_TONE: Record<StatusTone, "success" | "warning" | "neutral"> = {
  available: "success",
  low: "warning",
  full: "warning",
  past: "neutral",
};
/** Friendly labels for the schedule lifecycle status (past / non-bookable classes). */
const LIFECYCLE_LABEL: Record<string, string> = {
  started: "In progress",
  completed: "Completed",
  abandoned: "Cancelled",
  cancelled: "Cancelled",
  // Past start time but the lifecycle enum hasn't flipped yet (cron-driven, can lag).
  // To the member the class is over, so read it as Completed rather than a vague "Ended".
  available: "Completed",
};
/** Derive the booking status (label + tone + whether it can still be booked). */
function classStatus(cls: Class): { label: string; tone: StatusTone; canBook: boolean } {
  if (cls.isBookable === false) {
    return { label: LIFECYCLE_LABEL[cls.status ?? ""] ?? "Completed", tone: "past", canBook: false };
  }
  const spots = cls.spotsLeft;
  // Members no longer see the live remaining-seat count — only whether the class
  // is bookable. "Class full" stays so the Book button still disables; admin /
  // instructor views keep the real numbers.
  if (typeof spots === "number" && spots <= 0) {
    return { label: "Class full", tone: "full", canBook: false };
  }
  return { label: "Spots available", tone: "available", canBook: true };
}

interface BookClassCardProps {
  cls: Class;
  onSelect: (cls: Class) => void;
  onOpenDetails: (cls: Class) => void;
}
/** Member booking card — mirrors the public ClassCard look. Clicking anywhere on
 *  the card opens the details dialog (the title stays a real button for keyboard /
 *  screen-reader users); the Book CTA stops propagation and runs the booking flow. */
const BookClassCard = memo(function BookClassCard({ cls, onSelect, onOpenDetails }: BookClassCardProps) {
  const status = classStatus(cls);
  // Calendar chip surfaces the day — the time-only badge couldn't. Past/future
  // weeks default to "all days", so without it a list reads as an
  // undifferentiated stack. Cheap to parse: the card is memoized.
  const startDate = new Date(cls.startTimeIso);
  const weekday = startDate.toLocaleDateString("en-US", { weekday: "short" });
  const dayNum = startDate.getDate();
  const seats = cls.capacity ?? cls.maxCapacity;
  const dimmed = !status.canBook;
  return (
    <div
      className="group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-white-warm transition-[border-color,box-shadow,transform] duration-[250ms] ease-out hover:-translate-y-0.5 hover:border-[#c8c6be] hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)] focus-within:ring-2 focus-within:ring-sage"
    >
      {/* Whole-card click target for opening details — keyboard accessible. Sits
          below the interactive Book button (which stops propagation + higher z). */}
      <button
        type="button"
        onClick={() => onOpenDetails(cls)}
        aria-label={`View details for ${cls.name}, ${weekday} ${dayNum} at ${cls.time}`}
        className="absolute inset-0 z-0 cursor-pointer"
      />
      <div className="pointer-events-none relative z-10 h-52 shrink-0 overflow-hidden sm:h-56">
        <Image
          src={cls.image}
          alt={cls.name}
          fill
          sizes="(max-width: 640px) 100vw, 50vw"
          className="object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-105"
        />
        {/* Past / full → warm tonal scrim (not a grayscale filter — keeps the palette warm). */}
        {dimmed && <div className="pointer-events-none absolute inset-0 bg-cream/40" aria-hidden="true" />}
        {/* Solid white-warm panels over the photo — per the design system, no glass/blur over images. */}
        <span className="absolute left-3 top-3 flex flex-col items-center rounded-xl border border-border bg-white-warm px-2.5 py-1 text-center shadow-sm">
          <span className="font-body text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-terracotta">{weekday}</span>
          <span className="font-body font-semibold text-lg leading-tight text-charcoal tabular-nums">{dayNum}</span>
        </span>
        <span className="absolute right-3 top-3 inline-flex items-center rounded-full border border-border bg-white-warm px-2.5 py-1 font-body text-xs font-medium text-sage shadow-sm">
          {cls.category}
        </span>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-charcoal/85 via-charcoal/35 to-transparent"
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
          <span className="flex min-w-0 items-center gap-2.5">
            <InstructorAvatar name={cls.instructor} imageUrl={cls.instructorImageUrl} className="size-9" />
            <span className="truncate font-body text-sm font-medium text-white-warm">{cls.instructor}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-white-warm px-2.5 py-1 font-body text-xs font-medium text-charcoal">
            <Clock className="size-3 text-sage" />
            {cls.time}
          </span>
        </div>
      </div>
      <div className="relative z-10 flex flex-col p-5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenDetails(cls); }}
          aria-label={`View details for ${cls.name}, ${weekday} ${dayNum} at ${cls.time}`}
          className="self-start rounded-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
        >
          <h3 className="font-body font-semibold text-2xl leading-tight text-charcoal transition-colors group-hover:text-sage">{cls.name}</h3>
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-xs text-charcoal/55">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5 text-sage" />
            {cls.duration}
          </span>
          {typeof seats === "number" && (
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5 text-sage" />
              {seats} spots
            </span>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Pill tone={STATUS_PILL_TONE[status.tone]} size="md" dot className="font-body font-medium">
            {status.label}
          </Pill>
          <Button
            onClick={(e) => { e.stopPropagation(); onSelect(cls); }}
            disabled={!status.canBook}
            variant="sage"
            size="sm"
            className="gap-1.5 rounded-full px-4"
          >
            <Ticket size={15} /> Book
          </Button>
        </div>
      </div>
    </div>
  );
});

/** Class details (member view) — mirrors the public ClassDetailDialog, with the
 *  schedule time + a Reserve action that hands off to the booking flow. */
function BookClassDetailDialog({
  cls,
  onClose,
  onReserve,
}: Readonly<{
  cls: Class | null;
  onClose: () => void;
  onReserve: (cls: Class) => void;
}>) {
  const status = cls ? classStatus(cls) : null;
  return (
    <ResponsiveDialog open={!!cls} onOpenChange={(o) => { if (!o) onClose(); }}>
      <ResponsiveDialogContent className="max-w-lg overflow-hidden bg-white-warm p-0 sm:max-h-[90vh] sm:overflow-y-auto [&>button]:right-4 [&>button]:top-4 [&>button]:z-20 [&>button]:flex [&>button]:size-8 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:bg-white-warm/90 [&>button]:text-charcoal [&>button]:opacity-100 [&>button]:shadow-md hover:[&>button]:bg-white-warm">
        {cls && (
          <>
            <div className="relative h-44">
              {cls.image ? (
                <Image src={cls.image} alt={cls.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
              ) : (
                <div className={`h-full w-full ${classFallbackGradient}`} aria-hidden="true">
                  <span className="font-body font-semibold text-5xl text-white-warm/55">{classInitials(cls.name)}</span>
                </div>
              )}
              <Pill size="sm" className="absolute left-4 top-4 border-0 bg-white-warm/90 text-sage">{cls.category}</Pill>
            </div>
            <div className="space-y-4 p-5 sm:p-6">
              <ResponsiveDialogHeader className="space-y-1 text-left">
                <ResponsiveDialogTitle className="font-body font-semibold text-3xl text-charcoal">{cls.name}</ResponsiveDialogTitle>
                <ResponsiveDialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-sm text-charcoal/55">
                  <span className="inline-flex items-center gap-1.5"><Clock className="size-4" />{cls.time} · {cls.duration}</span>
                  <span className="inline-flex items-center gap-1.5"><Users className="size-4" />up to {cls.capacity ?? cls.maxCapacity ?? 15} spots</span>
                  {status && (
                    <span className={`inline-flex items-center gap-1.5 font-medium ${STATUS_TEXT[status.tone]}`}>
                      <span className={`size-1.5 rounded-full ${STATUS_DOT[status.tone]}`} aria-hidden="true" />
                      {status.label}
                    </span>
                  )}
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>

              {cls.description && (
                <p className="font-body text-sm leading-relaxed text-charcoal/75">{cls.description}</p>
              )}

              {cls.benefits && cls.benefits.length > 0 && (
                <div>
                  <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[0.12em] text-sage">What you&apos;ll gain</p>
                  <ul className="space-y-1.5">
                    {cls.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2 font-body text-sm text-charcoal/75">
                        <CheckCircle className="mt-0.5 size-4 shrink-0 text-sage" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-2.5 rounded-xl border border-sage/15 bg-sage/5 p-3">
                <InstructorAvatar name={cls.instructor} imageUrl={cls.instructorImageUrl} className="size-10" />
                <div className="min-w-0">
                  <p className="font-body text-xs text-charcoal/55">Instructor</p>
                  <p className="truncate font-body text-sm font-medium text-charcoal">{cls.instructor}</p>
                </div>
              </div>

              <Button variant="sage" className="w-full" disabled={!status?.canBook} onClick={() => onReserve(cls)}>
                {status?.canBook ? "Reserve Your Spot" : status?.label ?? "Unavailable"}
              </Button>
            </div>
          </>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

interface FoodRowProps {
  item: FoodItem;
  onAdjust: (id: string, delta: number) => void;
}
/**
 * Café row inside Step 3. Memoed so adjusting one item's quantity doesn't
 * re-render every other row (we render the full menu, not a paginated list).
 */
const FoodRow = memo(function FoodRow({ item, onAdjust }: FoodRowProps) {
  return (
    <div
      key={item.id}
      className="p-4 rounded-xl bg-white-warm border border-sage/10 hover:border-sage/30 transition-all"
    >
      <div className="flex gap-4">
        <Image
          src={item.image}
          alt={item.name}
          width={96}
          height={96}
          className="rounded-lg object-cover bg-sage/10"
        />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className="font-body font-semibold text-lg text-charcoal">{item.name}</h4>
            <Pill tone="neutral" className="text-[10px]">
              {formatCafeCategory(item.category)}
            </Pill>
          </div>
          {item.description ? (
            <p className="font-body text-xs text-charcoal/60 mb-2">{item.description}</p>
          ) : null}
          <div className="flex items-center justify-between">
            <p className="font-body text-sage font-semibold">₹{item.price}</p>
            <div className="flex items-center gap-3">
              <QtyMinusButton
                onClick={() => onAdjust(item.id, -1)}
                disabled={item.quantity === 0}
                className="rounded-full bg-sage/10"
                label="Decrease quantity"
              />
              <span className="font-body text-charcoal font-medium w-8 text-center">
                {item.quantity}
              </span>
              <QtyPlusButton
                onClick={() => onAdjust(item.id, 1)}
                className="rounded-full bg-sage/10"
                label="Increase quantity"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

function BookClassCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white-warm">
      <div className="relative h-52 w-full overflow-hidden sm:h-56">
        <Skeleton className="h-full w-full rounded-none" />
        <Skeleton className="absolute left-3 top-3 h-11 w-11 rounded-xl" />
        <Skeleton className="absolute right-3 top-3 h-6 w-20 rounded-full" />
      </div>
      <div className="flex flex-col p-5">
        <Skeleton className="h-7 w-3/5" />
        <div className="mt-3 flex items-center gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function BookClassGridSkeleton({ count = 6 }: Readonly<{ count?: number }>) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start gap-6">
      {Array.from({ length: count }, (_, i) => `book-card-skeleton-${i}`).map((key) => (
        <BookClassCardSkeleton key={key} />
      ))}
    </div>
  );
}

/** Full-page loading state — mirrors header, week calendar, filter row, and grid. */
function BookPageSkeleton() {
  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Week Navigation */}
      <div className="mb-6 bg-white-warm rounded-2xl border border-sage/20 p-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => `week-day-skeleton-${i}`).map((key) => (
            <div key={key} className="flex flex-col items-center py-2 px-0.5 gap-1">
              <Skeleton className="h-2.5 w-6 rounded-sm" />
              <Skeleton className="h-4 w-5 rounded-sm" />
            </div>
          ))}
        </div>
      </div>

      {/* Filter row — Tailwind needs literal class names, no template interp */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex gap-2 overflow-hidden flex-1 min-w-0">
          <Skeleton className="shrink-0 h-9 w-20 rounded-full" />
          <Skeleton className="shrink-0 h-9 w-24 rounded-full" />
          <Skeleton className="shrink-0 h-9 w-20 rounded-full" />
          <Skeleton className="shrink-0 h-9 w-28 rounded-full" />
          <Skeleton className="shrink-0 h-9 w-24 rounded-full" />
        </div>
        <Skeleton className="shrink-0 h-9 w-20 rounded-full" />
      </div>

      {/* Cards grid */}
      <BookClassGridSkeleton count={6} />
    </>
  );
}

/** Monday-based index (Mon=0 … Sun=6) of a date within its week. */
const mondayWeekIndex = (d: Date) => (d.getDay() + 6) % 7;

export default function BookClass() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const authed = !!session?.user;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  /** True while confirming booking / running Razorpay (does not replace entire page). */
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  /** Razorpay dismissed or failed — offer retry without a runtime error overlay. */
  const [paymentRecovery, setPaymentRecovery] = useState<
    null | { variant: "cancelled" | "failed"; detail?: string }
  >(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  // User data states
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");

  // Profile via shared SWR (deduped across the portal). Display-only here.
  const { data: profileData } = useStudioSWR<{ full_name?: string; email?: string; phone?: string; whatsapp_phone?: string }>("/api/user/profile");
  useEffect(() => {
    if (!profileData) return;
    setUserName(profileData.full_name || "Member");
    setUserEmail(profileData.email || "");
    setUserPhone(profileData.phone || profileData.whatsapp_phone || "");
  }, [profileData]);

  // Booking panel states
  const [showBookingPanel, setShowBookingPanel] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [addedMembers, setAddedMembers] = useState<AddedMember[]>([]);
  
  // User package states - fetch from database
  const [userPackage, setUserPackage] = useState<{
    type: "studio_pass" | "class_pass" | null;
    name: string;
    classesRemaining: number | null;
    isUnlimited: boolean;
    /** Café food discount from package_types.cafe_discount_percent (0 if none). */
    cafeDiscountPercent: number;
  }>({
    type: null,
    name: "",
    classesRemaining: null,
    isUnlimited: false,
    cafeDiscountPercent: 0
  });
  // Per-pass breakdown for members holding several active class passes, sorted
  // oldest-first (the order they're spent). Empty for unlimited / no-pass members.
  const [activeClassPasses, setActiveClassPasses] = useState<
    { id?: string; name: string; classesRemaining: number; expiry: string | null }[]
  >([]);
  // Credits remaining on the SINGLE pass that will actually be debited
  // (pickBookablePackage's choice) — distinct from userPackage.classesRemaining,
  // which is the sum across ALL active passes. Group-cover gating must use this,
  // not the aggregate: the debit only ever hits one pass, so a member with two
  // 2-credit passes (4 summed) can't be allowed to "cover" a 3-seat group.
  const [bookablePassCredits, setBookablePassCredits] = useState<number | null>(null);

  // Credits & payment
  const [useCredits, setUseCredits] = useState(true);
  // When the booker has added friends, they can spend their own pass credits to
  // cover the whole group instead of paying per guest. Default false = today's
  // behavior (1 credit for the booker, guests paid in cash).
  const [coverGuestsWithCredits, setCoverGuestsWithCredits] = useState(false);

  // Food ordering
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [loadingFoodItems, setLoadingFoodItems] = useState(false);
  const [foodItemsLoadError, setFoodItemsLoadError] = useState<string | null>(null);
  
  // Checkout
  // Featured Studio Pass (no-package upsell)
  const [featuredPackage, setFeaturedPackage] = useState<{ id: string; name: string; price: number; duration_months: number | null } | null>(null);
  const [addingPass, setAddingPass] = useState(false);

  // Coupon code
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountInr: number } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  
  // Pagination & filters
  const [currentPage, setCurrentPage] = useState(1);
  const [detailClass, setDetailClass] = useState<Class | null>(null);
  const f = useFilterState({ className: "all" });
  const [dateSort, setDateSort] = useState<"asc" | "desc">("asc");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(() => mondayWeekIndex(new Date()));
  const classesPerPage = 6;

  const weekMonday = useMemo(() => {
    const base = startOfMondayWeekLocal(new Date());
    const d = new Date(base);
    d.setDate(d.getDate() + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOffset]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekMonday);
      d.setDate(d.getDate() + i);
      return d;
    }),
  [weekMonday]);

  const weekSummary = useMemo(() => {
    const weekEnd = endOfSundayWeekLocal(weekMonday);
    return `${weekMonday.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}`;
  }, [weekMonday]);

  // Class schedules for the visible week via SWR — keyed on the week range so
  // revisiting a week is served from cache instead of re-hitting the network.
  // keepPreviousData (from useStudioSWR) means `isLoading` is true only for an
  // uncached week, letting us scope the skeleton to just the card grid.
  const classesKey = useMemo(() => {
    if (!authed) return null;
    const weekEnd = endOfSundayWeekLocal(weekMonday);
    const params = new URLSearchParams({
      fromMs: String(weekMonday.getTime()),
      toMs: String(weekEnd.getTime()),
      visibleOnly: "1",
    });
    return `/api/class-schedules?${params}`;
  }, [authed, weekMonday]);

  const { data: rawSchedules, isLoading: loadingClasses } =
    useStudioSWR<RawSchedule[]>(classesKey);

  const allClasses = useMemo<Class[]>(() => {
    if (!Array.isArray(rawSchedules)) return [];
    const weekStart = weekMonday;
    const weekEnd = endOfSundayWeekLocal(weekMonday);
    const nowMs = Date.now();
    return rawSchedules
      .filter((s) => {
        const t = new Date(s.start_time).getTime();
        return (
          t >= weekStart.getTime() &&
          t <= weekEnd.getTime() &&
          s.status !== "cancelled" &&
          s.status !== "inactive"
        );
      })
      .map((schedule) => {
        const startMs = new Date(schedule.start_time).getTime();
        const durationMs = (schedule.class_model?.duration || 60) * 60 * 1000;
        const endMs = schedule.end_time ? new Date(schedule.end_time).getTime() : startMs + durationMs;
        const cap = schedule.capacity ?? schedule.class_model?.max_capacity ?? 15;
        return {
          id: schedule.id,
          name: schedule.class_model?.name || "Unknown Class",
          time: new Date(schedule.start_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }),
          instructor: schedule.instructor?.name || "Instructor",
          instructorImageUrl: schedule.instructor?.image_url ?? null,
          duration: `${schedule.class_model?.duration || 60} min`,
          category: schedule.class_model?.category || "General",
          description: schedule.class_model?.description ?? "",
          benefits: schedule.class_model?.benefits ?? [],
          maxCapacity: schedule.class_model?.max_capacity ?? 15,
          capacity: cap,
          spotsLeft: typeof schedule.available_spots === "number" ? schedule.available_spots : undefined,
          status: schedule.status,
          image: schedule.class_model?.image_url || cdnUrl("/placeholder.jpg"),
          startTimeIso:
            typeof schedule.start_time === "string"
              ? schedule.start_time
              : new Date(schedule.start_time).toISOString(),
          startTimeMs: startMs,
          isBookable: endMs + POST_END_GRACE_MS > nowMs,
        };
      })
      .sort((a, b) => a.startTimeMs - b.startTimeMs);
  }, [rawSchedules, weekMonday]);

  const uniqueClassNames = useMemo(() => {
    const names = new Set(allClasses.map(c => c.name));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [allClasses]);

  const filteredClasses = useMemo(() => {
    const list = allClasses.filter(cls => {
      const nameMatch = f.values.className === "all" || cls.name === f.values.className;
      const dayMatch = selectedDayIndex === null || isSameLocalCalendarDay(new Date(cls.startTimeIso), weekDays[selectedDayIndex]);
      return nameMatch && dayMatch;
    });
    const dir = dateSort === "asc" ? 1 : -1;
    return list.sort((a, b) => (a.startTimeMs - b.startTimeMs) * dir);
  }, [allClasses, f.values.className, selectedDayIndex, weekDays, dateSort]);

  const startIndex = (currentPage - 1) * classesPerPage;
  const paginatedClasses = filteredClasses.slice(startIndex, startIndex + classesPerPage);

  useEffect(() => {
    // SSR (requireSessionSSP) already gates this route — unauthenticated visitors
    // never reach the client. No client-side redirect to the legacy /portal/login.
    if (authed) {
      setIsAuthenticated(true);
      checkAuthAndLoadData();
    }
  }, [authed]);

  // Guards the one-shot auto-advance below so it can't fight a manual day pick.
  const didAutoAdvanceDay = useRef(false);

  useEffect(() => {
    if (authed) {
      // Current week → preselect today; other weeks → show all days.
      setSelectedDayIndex(weekOffset === 0 ? mondayWeekIndex(new Date()) : null);
      f.reset();
      didAutoAdvanceDay.current = false;
    }
    // Intentionally keyed on authed/weekOffset only. `f` is a fresh object each render, so depending
    // on it would re-run every render; f.reset is a stable useCallback that only needs to fire here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, weekOffset]);

  // Current week only: once classes load, if every class today is already done,
  // jump to the next day that still has a bookable class so the member doesn't
  // land on a list of "Completed". One-shot per week load; never overrides a manual pick.
  useEffect(() => {
    if (!authed || weekOffset !== 0) return;
    if (loadingClasses || didAutoAdvanceDay.current || allClasses.length === 0) return;
    didAutoAdvanceDay.current = true;
    const today = mondayWeekIndex(new Date());
    const dayHasBookable = (idx: number) =>
      allClasses.some(
        (c) => c.isBookable !== false && isSameLocalCalendarDay(new Date(c.startTimeIso), weekDays[idx]),
      );
    if (dayHasBookable(today)) return;
    for (let i = today + 1; i <= 6; i++) {
      if (dayHasBookable(i)) {
        setSelectedDayIndex(i);
        return;
      }
    }
  }, [authed, weekOffset, loadingClasses, allClasses, weekDays]);

  async function checkAuthAndLoadData() {
    try {
      // Profile loads via shared SWR (deduped across the portal) — not here.
      const [packagesRes, allPkgRes] = await Promise.all([
        fetch("/api/user-packages?active=true"),
        fetch("/api/packages"),
      ]);

      const packages = packagesRes.ok ? await packagesRes.json() : [];
      const allPkgTypes = allPkgRes.ok ? await allPkgRes.json() : [];
      // Pick highest-priced unlimited 3-month pass as the featured upsell
      const studioPass3m = Array.isArray(allPkgTypes)
        ? (allPkgTypes
            .filter((p: { is_unlimited: boolean; duration_months: number | null }) => p.is_unlimited && p.duration_months === 3)
            .sort((a: { price: number | string }, b: { price: number | string }) => Number(b.price) - Number(a.price))[0]
          || allPkgTypes.find((p: { is_unlimited: boolean }) => p.is_unlimited)
          || null)
        : null;
      if (studioPass3m) {
        setFeaturedPackage({ id: studioPass3m.id, name: studioPass3m.name, price: Number(studioPass3m.price), duration_months: studioPass3m.duration_months ?? null });
      }

      const pkg = pickBookablePackage(packages);

      if (pkg) {
        const packageType = pkg.package_type;
        const totalClasses = totalActiveClasses(packages);
        // Active class passes with classes left, expiring-first (spend order).
        setActiveClassPasses(
          activePackagesOf(packages)
            .filter((p) => !isUnlimitedPkg(p) && (p.credits_remaining ?? 0) >= 1)
            .sort((a, b) => expiresAt(a) - expiresAt(b))
            .map((p) => ({
              id: p.id,
              name: p.package_type?.name || "Class Pass",
              classesRemaining: p.credits_remaining ?? 0,
              expiry: p.expiration_date ?? null,
            })),
        );
        setUserPackage({
          type: packageType ? passCategoryForPackageType(packageType) : "class_pass",
          name: packageType?.name || "Package",
          // Aggregate across all active passes so the member sees their true total;
          // deduction still comes off the oldest pass (pickBookablePackage).
          classesRemaining: totalClasses,
          isUnlimited: packageType?.is_unlimited || false,
          // Best rate across every active pass — matches what the till charges.
          cafeDiscountPercent: bestCafeDiscount(activePackagesOf(packages)).percent,
        });
        setBookablePassCredits(pkg.credits_remaining ?? 0);
      } else {
        setActiveClassPasses([]);
        setUserPackage({ type: null, name: "No Active Package", classesRemaining: 0, isUnlimited: false, cafeDiscountPercent: 0 });
        setBookablePassCredits(0);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading user data:", error);
      setIsLoading(false);
    }
  }

  async function fetchCafeItems() {
    setLoadingFoodItems(true);
    setFoodItemsLoadError(null);
    try {
      const res = await fetch("/api/cafe/items?available=true");
      const raw = res.ok ? await res.json() : [];
      const list = Array.isArray(raw) ? raw : [];
      setFoodItems(
        list.map(
          (item: {
            id: string;
            name: string;
            category?: string;
            description?: string | null;
            image_url?: string | null;
            price: number | string;
          }) => ({
            id: item.id,
            name: item.name,
            category: item.category ?? "other",
            description: item.description?.trim() ?? "",
            image: item.image_url?.trim() || cdnUrl("/placeholder.jpg"),
            price: Number(item.price),
            quantity: 0,
          }),
        ),
      );
    } catch (err) {
      console.error("Error loading cafe items:", err);
      setFoodItems([]);
      setFoodItemsLoadError("Could not load the café menu. You can continue without add-ons.");
    } finally {
      setLoadingFoodItems(false);
    }
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [f.values.className, selectedDayIndex, dateSort]);

  // Handlers — useCallback so the memoized BookClassCard skips rerender when
  // only unrelated parent state changes (typing in friends/family, etc).
  const handleSelectClass = useCallback((cls: Class) => {
    setSelectedClass(cls);
    setShowBookingPanel(true);
    setBookingStep(1);
    // Reset state
    setAddedMembers([]);
    setFoodItems(prev => prev.map(item => ({ ...item, quantity: 0 })));
    setUseCredits(true);
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);

    // Fetch cafe items for Step 3
    fetchCafeItems();
  }, []);

  function handleNextStep() {
    if (bookingStep === 1) {
      // Step 1 -> 2: Add People -> Credit Management
      setBookingStep(2);
    } else if (bookingStep === 2) {
      // Step 2 -> 3: Credits -> Food
      setBookingStep(3);
    } else if (bookingStep === 3) {
      // Step 3 -> 4: Food -> Checkout
      setBookingStep(4);
    }
  }

  function handleBackStep() {
    if (bookingStep > 1) {
      setBookingStep(bookingStep - 1);
    }
  }

  const handleFoodQuantity = useCallback((id: string, change: number) => {
    setFoodItems(prev => prev.map(item =>
      item.id === id
        ? { ...item, quantity: Math.max(0, item.quantity + change) }
        : item
    ));
  }, []);

  const creditsNeededForGroup = 1 + addedMembers.length;
  // Gate on the single pass that will actually be debited, not the sum across
  // every active pass (see bookablePassCredits) — otherwise the UI can offer
  // "cover the whole group" when no single pass holds enough credits, and the
  // server-side updateMany (targeted at one pass) silently books extra seats
  // for free while logging (online path) instead of blocking the purchase.
  const canCoverGuestsWithCredits =
    userPackage.type === "class_pass" &&
    (bookablePassCredits ?? 0) >= creditsNeededForGroup;
  const coveringGroup =
    useCredits && coverGuestsWithCredits && canCoverGuestsWithCredits && addedMembers.length > 0;

  // Reset the choice when it stops being valid (group size or pass balance changed).
  useEffect(() => {
    if (!canCoverGuestsWithCredits && coverGuestsWithCredits) setCoverGuestsWithCredits(false);
  }, [canCoverGuestsWithCredits, coverGuestsWithCredits]);

  const calculateTotals = useCallback(() => {
    const totalPeople = 1 + addedMembers.length;
    const classPrice = 945;

    // Class cost
    let classTotal = 0;
    if (userPackage.type === "class_pass") {
      if (useCredits) {
        // Booker's pass covers their own seat. If they also chose to cover the
        // group, every added member's seat is paid in credits too.
        classTotal = coveringGroup ? 0 : addedMembers.length * classPrice;
      } else {
        // User chose not to use their classes - pay for everyone
        classTotal = totalPeople * classPrice;
      }
    } else if (userPackage.type === "studio_pass") {
      // Unlimited - primary user covered, charge for added members
      classTotal = addedMembers.length * classPrice;
    } else {
      // No package - charge everyone
      classTotal = totalPeople * classPrice;
    }
    
    // Food cost
    const foodTotal = foodItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Discount logic - ONLY on food items
    // Rate comes from the member's pass config, never a hardcoded tier table.
    const discount = foodTotal > 0 ? (foodTotal * userPackage.cafeDiscountPercent) / 100 : 0;
    
    const subtotal = classTotal + foodTotal;
    const totalAfterDiscount = subtotal - discount;
    const couponDiscount = appliedCoupon?.discountInr ?? 0;
    const finalTotal = Math.max(0, totalAfterDiscount - couponDiscount);
    // Prices are tax-inclusive; extract GST for display only
    const taxIncluded = Math.round((finalTotal * TAX_RATE / (1 + TAX_RATE)) * 100) / 100;

    return { classTotal, foodTotal, discount, couponDiscount, subtotal, taxIncluded, finalTotal };
  }, [addedMembers, userPackage, useCredits, coveringGroup, foodItems, appliedCoupon]);

  // Single memoized total used by both the submit handler and JSX (was called twice).
  const totals = useMemo(() => calculateTotals(), [calculateTotals]);

  async function handleAddPass() {
    if (!featuredPackage) return;
    setAddingPass(true);
    try {
      const createRes = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "package",
          package_type_id: featuredPackage.id,
          pass_type: "studio_pass",
        }),
      });
      if (!createRes.ok) {
        throw new Error(await parseApiError(createRes, "Could not start checkout."));
      }
      const orderPayload = await createRes.json() as { order_id?: string; amount?: number | string; currency?: string; key_id?: string; razorpay_mode?: "test" | "live" | "unknown" };
      if (!orderPayload.order_id || orderPayload.key_id === null || orderPayload.key_id === undefined || orderPayload.amount === null || orderPayload.amount === undefined) {
        throw new Error("Invalid payment setup from server.");
      }
      const amountPaiseServer = Number(orderPayload.amount);

      savePendingRazorpayCheckout({
        purpose: "package",
        razorpayOrderId: orderPayload.order_id,
        package_type_id: featuredPackage.id,
        pass_type: "studio_pass",
        savedAt: Date.now(),
      });

      const { payWithRazorpayOrder } = await import("@/lib/razorpayCheckout");
      const checkoutResult = await payWithRazorpayOrder({
        keyId: String(orderPayload.key_id).trim(),
        amountPaise: amountPaiseServer,
        currency: orderPayload.currency ?? "INR",
        orderId: orderPayload.order_id,
        name: "Copper Cloves",
        description: featuredPackage.name,
        prefill: { email: userEmail || undefined, name: userName || undefined },
        callbackUrl: buildRazorpayReturnUrl("package"),
        // Full-page redirect so a closed/backgrounded tab can't drop the capture.
        redirect: true,
      });

      if (checkoutResult.kind === "cancelled") {
        clearPendingRazorpayCheckout();
        toast({ title: "Cancelled", description: "Pass purchase cancelled.", variant: "error" });
        return;
      }
      if (checkoutResult.kind === "failed") {
        clearPendingRazorpayCheckout();
        const { razorpayPaymentErrorHelp } = await import("@/lib/razorpayClientHints");
        toast({ title: "Payment failed", description: razorpayPaymentErrorHelp(checkoutResult.message, String(orderPayload.key_id).trim(), orderPayload.razorpay_mode), variant: "error" });
        return;
      }

      const pending = loadPendingRazorpayCheckout();
      if (!pending || pending.purpose !== "package") throw new Error("Checkout session lost.");
      if (checkoutResult.kind !== "success") throw new Error("Unexpected checkout state.");
      const { completePendingPackageCheckout } = await import("@/lib/completeRazorpayCheckout");
      await completePendingPackageCheckout(pending, checkoutResult.payload);
      clearPendingRazorpayCheckout();

      // Refresh user package state so Step 2 shows the new pass
      const pkgRes = await fetch("/api/user-packages?active=true", { credentials: "include" });
      const pkgs = pkgRes.ok ? await pkgRes.json() : [];
      const now = new Date();
      const active = Array.isArray(pkgs) ? pkgs.find((p: { expiration_date: string; is_active: boolean }) => p.is_active && new Date(p.expiration_date) > now) : null;
      if (active) {
        const pt = active.package_type;
        setUserPackage({
          type: "studio_pass",
          name: pt?.name ?? featuredPackage.name,
          classesRemaining: null,
          isUnlimited: true,
          cafeDiscountPercent: cafeDiscountPercentOf(pt),
        });
      }

      toast({ title: "Pass activated!", description: "Your Studio Pass is now active. Class is covered.", variant: "success" });
      setBookingStep(3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pass purchase failed.";
      toast({ title: "Error", description: msg, variant: "error" });
    } finally {
      setAddingPass(false);
    }
  }

  async function handleConfirmBooking() {
    try {
      setIsSubmittingBooking(true);

      const usingClassPassCredit = userPackage.type === "class_pass" && useCredits;
      const packageToUse = await fetchActivePackage();
      assertClassPassUsable(usingClassPassCredit, packageToUse);

      // Re-check the group cover against FRESH server credits, not the balance
      // read at mount. `bookablePassCredits` goes stale as soon as this member
      // books once without a reload — trusting it would let a second group
      // booking through on a pass that can no longer fund it, and the online
      // (pre-created) confirm path logs rather than throws on a failed debit,
      // so the seats would be issued for free.
      if (coveringGroup) {
        const freshCredits = packageToUse?.credits_remaining ?? 0;
        setBookablePassCredits(freshCredits);
        if (freshCredits < creditsNeededForGroup) {
          setCoverGuestsWithCredits(false);
          throw new Error(
            `This pass now has ${freshCredits} class${freshCredits === 1 ? "" : "es"} left — not enough to cover ${creditsNeededForGroup}. Review your booking and try again.`,
          );
        }
      }

      const owedTotals = calculateTotals();
      const { classTotal, foodTotal, discount, taxIncluded, finalTotal } = owedTotals;
      const dayPassEquivalentCount = coveringGroup
        ? 0
        : computeDayPassEquivalentCount(userPackage.type, addedMembers.length, useCredits);

      const financeSnapshotPayload = {
        version: 1 as const,
        classFeeInr: classTotal,
        foodFeeInr: foodTotal,
        foodDiscountInr: discount,
        couponDiscountInr: owedTotals.couponDiscount,
        taxInr: taxIncluded,
        totalInr: finalTotal,
        dayPassEquivalentCount,
        noActivePackageCheckout: userPackage.type === null,
        paymentMethod: "online" as const,
      };

      const classTimeISO = selectedClass?.startTimeIso ?? null;
      const userPackageIdForBooking = usingClassPassCredit ? packageToUse?.id ?? null : null;
      // Coupon context the server re-validates against (mirrors the Apply handler).
      const couponContext =
        owedTotals.classTotal <= 0 ? "food" : userPackage.type === "studio_pass" ? "studio_pass" : "class_pass";
      const couponCode = appliedCoupon?.code ?? null;
      const cafeLines = foodItems
        .filter((item) => item.quantity > 0)
        .map((item) => ({ id: item.id, quantity: item.quantity }));

      // Resolve added members → get profile IDs (creates accounts for new people, sends emails)
      let addedMemberProfileIds: string[] = [];
      if (addedMembers.length > 0) {
        const resolveRes = await fetch("/api/members/resolve-invites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            added_members: addedMembers,
            class_name: selectedClass?.name ?? null,
            class_time: selectedClass?.startTimeIso ?? null,
          }),
        });
        if (!resolveRes.ok) {
          const err = await parseApiError(resolveRes, "Could not add members to booking");
          toast({ title: "Error", description: err, variant: "error" });
          setIsSubmittingBooking(false);
          return;
        }
        const resolveData = await resolveRes.json() as { profile_ids: string[] };
        addedMemberProfileIds = resolveData.profile_ids ?? [];
      }

      const creditsToDeduct = coveringGroup ? 1 + addedMemberProfileIds.length : 1;

      if (finalTotal > 0) {
        const result = await runOnlineBookingCheckout({
          orderRequestBody: {
            purpose: "booking",
            pending_checkout: {
              class_schedule_id: selectedClass?.id ?? "",
              class_name: selectedClass?.name ?? null,
              class_time: classTimeISO,
              user_package_id: userPackageIdForBooking,
              extra_guest_count: 0,
              guest_attendees: [],
              added_member_profile_ids: addedMemberProfileIds,
              finance_snapshot: financeSnapshotPayload,
              cafe_items: cafeLines,
              coupon_code: couponCode,
              coupon_context: couponCode ? couponContext : null,
              credits_to_deduct: usingClassPassCredit ? creditsToDeduct : undefined,
            },
          },
          pendingBase: {
            class_schedule_id: selectedClass?.id ?? "",
            class_name: selectedClass?.name ?? null,
            class_time: classTimeISO,
            user_package_id: userPackageIdForBooking,
            extra_guest_count: 0,
            guest_attendees: [],
            added_member_profile_ids: addedMemberProfileIds,
            finance_snapshot: financeSnapshotPayload,
            cafe_items: cafeLines,
            coupon_code: couponCode,
            coupon_context: couponCode ? couponContext : null,
            credits_to_deduct: usingClassPassCredit ? creditsToDeduct : undefined,
          },
          checkoutDescription: selectedClass?.name ? `Class — ${selectedClass.name}` : "Studio booking",
          prefill: { email: userEmail || undefined, name: userName || undefined },
        });
        if (result.status === "cancelled" || result.status === "failed") {
          setPaymentRecovery(
            result.status === "cancelled"
              ? { variant: "cancelled" }
              : { variant: "failed", detail: result.failureDetail },
          );
          return;
        }
        // Guest onboarding now happens server-side during fulfillment (see
        // /api/bookings + razorpayServerCheckout) so it survives redirect flows.
        toast({ title: "Payment successful", description: `Booking confirmed for ₹${finalTotal.toFixed(0)}.`, variant: "success" });
        setShowBookingPanel(false);
        router.push("/portal/dashboard");
        return;
      }

      await runFreeBooking(
        {
          class_schedule_id: selectedClass?.id ?? null,
          class_name: selectedClass?.name,
          class_time: classTimeISO,
          user_package_id: userPackageIdForBooking,
          razorpay_order_id: null,
          extra_guest_count: 0,
          guest_attendees: [],
          added_member_profile_ids: addedMemberProfileIds,
          finance_snapshot: financeSnapshotPayload,
          credits_to_deduct: usingClassPassCredit ? creditsToDeduct : undefined,
        },
        cafeLines,
      );

      toast({ title: "Booking confirmed", description: "No payment required.", variant: "success" });
      setShowBookingPanel(false);
      router.push("/portal/dashboard");
    } catch (err: unknown) {
      console.error("BOOKING ERROR:", err);
      const message = err instanceof Error ? err.message : "Failed to complete booking. Please try again.";
      toast({ title: "Booking failed", description: message, variant: "error" });
    } finally {
      setIsSubmittingBooking(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/5">
        <main className="pt-8 pb-12 min-h-screen">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <BookPageSkeleton />
          </div>
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  // `totals` defined above as a useMemo over the same inputs.

  let bookSubtitle: string;
  if (loadingClasses) {
    bookSubtitle = "Loading classes…";
  } else if (filteredClasses.length > 0) {
    const classWord = filteredClasses.length !== 1 ? "classes" : "class";
    bookSubtitle = `${filteredClasses.length} ${classWord} found`;
  } else {
    bookSubtitle = "No classes match your filters";
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/5">
      <main className="pt-8 pb-12 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="mb-6">
            <PageHeader
              title="Book Your Next Session"
              subtitle={bookSubtitle}
            />
          </div>

          {/* Week Navigation */}
          <div className="mb-6 bg-white-warm rounded-2xl border border-sage/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <NavPrevButton
                onClick={() => setWeekOffset(o => o - 1)}
                className="rounded-full"
                label="Previous week"
              />
              <span className="font-body text-xs sm:text-sm text-charcoal/70 font-medium flex items-center gap-1.5 sm:gap-2">
                {weekSummary || "Loading…"}
                {weekOffset === 0 && <Pill tone="success" size="sm">This Week</Pill>}
                {weekOffset === 1 && <Pill tone="success" size="sm">Next Week</Pill>}
                {weekOffset < 0 && <Pill tone="warning" size="sm">Past</Pill>}
                {weekOffset > 1 && <Pill tone="success" size="sm">Upcoming</Pill>}
              </span>
              <NavNextButton
                onClick={() => setWeekOffset(o => o + 1)}
                className="rounded-full"
                label="Next week"
              />
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day, i) => {
                const today = new Date();
                const isToday = isSameLocalCalendarDay(day, today);
                const isPast = !isToday && day < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const isSelected = selectedDayIndex === i;
                const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

                let buttonStateClass: string;
                if (isSelected) buttonStateClass = "bg-sage text-cream";
                else if (isPast) buttonStateClass = "opacity-40 cursor-default";
                else if (isToday) buttonStateClass = "bg-sage/15 text-sage border border-sage/30";
                else buttonStateClass = "hover:bg-sage/10 text-charcoal/70";

                let dateTextClass: string;
                if (isSelected) dateTextClass = "text-cream";
                else if (isPast) dateTextClass = "text-charcoal/40";
                else if (isToday) dateTextClass = "text-sage";
                else dateTextClass = "text-charcoal";

                return (
                  <button
                    key={day.toISOString()}
                    disabled={isPast}
                    aria-disabled={isPast}
                    onClick={() => {
                      if (isPast) return;
                      setSelectedDayIndex(isSelected ? null : i);
                    }}
                    className={`flex flex-col items-center py-2 px-0.5 rounded-xl transition-all min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1 text-[11px] sm:text-sm ${buttonStateClass}`}
                  >
                    <span className="text-[10px] font-body uppercase tracking-wide leading-none mb-1">
                      {dayNames[i]}
                    </span>
                    <span className={`text-base font-body font-semibold leading-none tabular-nums ${dateTextClass}`}>
                      {day.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Class Filter + Date sort */}
          <div className="flex items-center gap-3 mb-8">
            <FilterSelect
              value={f.values.className}
              onChange={(v) => f.set("className", v)}
              options={[
                { value: "all", label: "All Classes" },
                ...uniqueClassNames.map((name) => ({ value: name, label: name })),
              ]}
              ariaLabel="Filter by class name"
              placeholder="All Classes"
              className="flex-1 min-w-0 sm:w-auto"
            />
            <button
              type="button"
              onClick={() => setDateSort(d => (d === "asc" ? "desc" : "asc"))}
              title={dateSort === "asc" ? "Date: soonest first" : "Date: latest first"}
              aria-label={dateSort === "asc" ? "Sort by date, soonest first. Click to reverse." : "Sort by date, latest first. Click to reverse."}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-body border border-sage/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1 text-charcoal hover:border-sage hover:bg-sage/5 transition-all"
            >
              <ArrowDownUp className="w-3.5 h-3.5 text-sage" />
              Date
              {dateSort === "asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Class Cards Grid — only the grid region swaps to a skeleton while a
              week's classes load; the header, week-nav and filters above stay
              mounted so scroll position and week navigation are preserved. */}
          {loadingClasses ? (
            <BookClassGridSkeleton count={6} />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start gap-6 mb-8">
                {paginatedClasses.map((cls) => (
                  <BookClassCard key={cls.id} cls={cls} onSelect={handleSelectClass} onOpenDetails={setDetailClass} />
                ))}
              </div>

              {/* Pagination — windowed numbers + range label (same as admin) */}
              <Pagination
                page={currentPage}
                total={filteredClasses.length}
                pageSize={classesPerPage}
                onChange={setCurrentPage}
                alwaysShow
              />

              {/* Empty State */}
              {paginatedClasses.length === 0 && (
                <Card className="border-sage/20 bg-white-warm">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <Calendar className="w-16 h-16 text-sage/40 mb-4" />
                    <h3 className="font-body font-semibold text-2xl text-charcoal mb-2">No Classes Available</h3>
                    <p className="font-body text-charcoal/60 mb-6">Try adjusting your filters or check back soon.</p>
                    <Button
                      onClick={() => { f.reset(); setSelectedDayIndex(null); }}
                      variant="outline"
                      className="border-sage text-sage hover:bg-sage hover:text-cream transition-all duration-500"
                    >
                      Clear Filters
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <BookClassDetailDialog
            cls={detailClass}
            onClose={() => setDetailClass(null)}
            onReserve={(c) => {
              setDetailClass(null);
              handleSelectClass(c);
            }}
          />
        </div>
      </main>

      {/* Booking Panel - Multi-Step Flow */}
      <div 
        className={`fixed inset-y-0 right-0 w-full max-w-2xl bg-white-warm shadow-[0_8px_48px_rgba(51,51,51,0.14)] transform transition-all duration-500 ease-in-out z-50 overflow-y-auto ${
          showBookingPanel ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Panel Header */}
          <div className="sticky top-0 z-10 px-4 sm:px-6 py-4 flex items-center justify-between border-b border-sage/10 bg-white-warm">
            <div>
              <h2 className="font-body font-semibold text-xl sm:text-3xl text-charcoal mb-0.5">
                {bookingStep === 1 && "Who's Coming?"}
                {bookingStep === 2 && "Class Management"}
                {bookingStep === 3 && "Add Nourishment"}
                {bookingStep === 4 && "Checkout"}
              </h2>
              <p className="font-body text-xs sm:text-sm text-charcoal/60">
                Step {bookingStep} of 4 · {selectedClass?.name}
              </p>
            </div>
            <Button
              onClick={() => setShowBookingPanel(false)}
              variant="sage-outline"
              size="icon"
              className="rounded-full"
              aria-label="Close"
            >
              <X size={20} />
            </Button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
            {/* Step 1: Add People */}
            {bookingStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-body font-semibold text-xl text-charcoal mb-2">Primary Attendee</h3>
                  <div className="p-4 rounded-xl bg-sage/5 border border-sage/20">
                    <p className="font-body text-charcoal font-medium">{userName}</p>
                    <p className="font-body text-sm text-charcoal/60">{userEmail}</p>
                  </div>
                </div>

                {/* Add Studio Members */}
                <div className="mt-2">
                  <h3 className="font-body font-semibold text-lg text-charcoal mb-2">Add People</h3>
                  <p className="font-body text-sm text-charcoal/60 mb-3">
                    Search for studio members or add someone new. You&apos;ll pay for their class.
                  </p>
                  <MemberSearch value={addedMembers} onChange={setAddedMembers} currentEmail={userEmail} currentPhone={userPhone} />
                </div>

                <div className="pt-4 border-t border-sage/10">
                  <p className="font-body text-sm text-charcoal/60 mb-2">
                    Total Attendees: <span className="font-semibold text-charcoal">{1 + addedMembers.length}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Credit Management */}
            {bookingStep === 2 && (
              <div className="space-y-6">
                <div className="p-6 rounded-xl bg-linear-to-br from-sage/10 to-cream/30 border border-sage/20">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-body text-sm text-charcoal/60 uppercase tracking-wide mb-1">
                        Your Package
                      </p>
                      <p className="font-body font-semibold text-2xl text-charcoal">
                        {userPackage.name}
                      </p>
                    </div>
                    {userPackage.type === "class_pass" && (
                      <div className="text-right">
                        <p className="font-body text-sm text-charcoal/60 uppercase tracking-wide mb-1">
                          Classes Remaining
                        </p>
                        <p className="font-body text-3xl font-semibold tabular-nums text-sage">
                          {userPackage.classesRemaining || 0}
                        </p>
                      </div>
                    )}
                    {userPackage.type === "studio_pass" && (
                      <div className="text-right">
                        <p className="font-body text-sm text-charcoal/60 uppercase tracking-wide mb-1">
                          Access Type
                        </p>
                        <p className="font-body text-3xl font-semibold text-sage">
                          Unlimited
                        </p>
                      </div>
                    )}
                  </div>

                  {userPackage.type === "class_pass" && activeClassPasses.length > 1 && (
                    <div className="pt-4 border-t border-sage/20 space-y-1.5">
                      <p className="font-body text-sm text-charcoal/60 uppercase tracking-wide mb-1">
                        Active passes (expiring pass used first)
                      </p>
                      {activeClassPasses.map((p, i) => (
                        <div key={p.id ?? i} className="flex items-center justify-between font-body text-sm">
                          <span className="text-charcoal">
                            {p.name}
                            {p.expiry && (
                              <span className="text-charcoal/50">
                                {" "}· exp {new Date(p.expiry).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </span>
                            )}
                          </span>
                          <span className="tabular-nums text-sage font-semibold">{p.classesRemaining} left</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {userPackage.isUnlimited && (
                    <div className="pt-4 border-t border-sage/20">
                      <p className="font-body text-sm text-charcoal/60 uppercase tracking-wide mb-1">
                        Current Package
                      </p>
                      <p className="font-body text-charcoal">
                        {userPackage.name}
                      </p>
                      {userPackage.cafeDiscountPercent > 0 && (
                        <p className="font-body text-xs text-sage mt-2 inline-flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          {userPackage.cafeDiscountPercent}% discount on café items
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {userPackage.type === "studio_pass" && (
                    <div 
                      className="p-5 rounded-xl border-2 border-sage bg-sage/5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full border-2 border-sage bg-sage mt-0.5 flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-white-warm" />
                        </div>
                        <div className="flex-1">
                          <p className="font-body text-charcoal font-medium mb-1">
                            Unlimited Access - No Charge
                          </p>
                          <p className="font-body text-sm text-charcoal/60">
                            Your {userPackage.name} includes unlimited classes. Book as many as you like!
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {userPackage.type === "class_pass" && (
                    <>
                      <button
                        type="button"
                        className={`w-full text-left p-5 rounded-xl border-2 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1 ${
                          useCredits
                            ? "border-sage bg-sage/5"
                            : "border-sage/20 bg-white-warm hover:border-sage/40"
                        }`}
                        onClick={() => setUseCredits(true)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                            useCredits ? "border-sage bg-sage" : "border-sage/30"
                          }`}>
                            {useCredits && <div className="w-2.5 h-2.5 rounded-full bg-white-warm" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-body text-charcoal font-medium mb-1">
                              Use My Classes
                            </p>
                            <p className="font-body text-sm text-charcoal/60">
                              {(() => {
                                const classesAvailable = userPackage.classesRemaining || 0;

                                if (classesAvailable < 1) {
                                  return (
                                    <span className="text-terracotta inline-flex items-center gap-1">
                                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                      No classes remaining. Pay ₹{(1 + addedMembers.length) * 945} for all attendees.
                                    </span>
                                  );
                                } else if (addedMembers.length > 0) {
                                  return coveringGroup
                                    ? `${creditsNeededForGroup} classes deducted — free for everyone.`
                                    : `1 class deducted for you. Pay ₹${addedMembers.length * 945} for ${addedMembers.length} guest${addedMembers.length > 1 ? 's' : ''}.`;
                                } else {
                                  return "1 class will be deducted for your spot.";
                                }
                              })()}
                            </p>
                          </div>
                        </div>
                      </button>

                      {useCredits && addedMembers.length > 0 && (
                        <div className="mt-3 space-y-2 pl-8">
                          <button
                            type="button"
                            onClick={() => setCoverGuestsWithCredits(false)}
                            className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                              !coverGuestsWithCredits ? "border-sage bg-sage/5" : "border-sage/20 hover:border-sage/40"
                            }`}
                          >
                            <span className="font-body text-charcoal">Just me — 1 class</span>
                            <span className="block font-body text-xs text-charcoal/60">
                              Pay ₹{addedMembers.length * 945} for {addedMembers.length} guest{addedMembers.length > 1 ? "s" : ""}.
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={!canCoverGuestsWithCredits}
                            onClick={() => setCoverGuestsWithCredits(true)}
                            className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                              coverGuestsWithCredits ? "border-sage bg-sage/5" : "border-sage/20 enabled:hover:border-sage/40"
                            }`}
                          >
                            <span className="font-body text-charcoal">
                              Use my pass for everyone — {creditsNeededForGroup} classes
                            </span>
                            <span className="block font-body text-xs text-charcoal/60">
                              {canCoverGuestsWithCredits
                                ? "No payment needed for the class."
                                : `You have ${bookablePassCredits ?? 0} left on this pass — this needs ${creditsNeededForGroup}.`}
                            </span>
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        className={`w-full text-left p-5 rounded-xl border-2 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1 ${
                          !useCredits
                            ? "border-sage bg-sage/5"
                            : "border-sage/20 bg-white-warm hover:border-sage/40"
                        }`}
                        onClick={() => setUseCredits(false)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                            !useCredits ? "border-sage bg-sage" : "border-sage/30"
                          }`}>
                            {!useCredits && <div className="w-2.5 h-2.5 rounded-full bg-white-warm" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-body text-charcoal font-medium mb-1">
                              Pay for This Class
                            </p>
                            <p className="font-body text-sm text-charcoal/60">
                              Save your classes. Pay ₹{(1 + addedMembers.length) * 945} at checkout.
                            </p>
                          </div>
                        </div>
                      </button>
                    </>
                  )}

                  {userPackage.type === null && featuredPackage && (
                    <div className="p-5 rounded-xl border-2 border-sage/40 bg-sage/5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-5 h-5 rounded-full border-2 border-sage bg-sage/20 mt-0.5 flex items-center justify-center shrink-0">
                          <Star className="w-3 h-3 text-sage fill-sage" />
                        </div>
                        <div className="flex-1">
                          <p className="font-body text-charcoal font-medium mb-0.5">
                            {featuredPackage.name}
                          </p>
                          <p className="font-body text-xs text-charcoal/60 mb-2">
                            Unlimited classes · ₹{featuredPackage.price.toLocaleString("en-IN")}
                            {featuredPackage.duration_months ? ` · Valid ${featuredPackage.duration_months} months` : ""}
                          </p>
                          <p className="font-body text-xs text-charcoal/50">
                            No active package — you&apos;re paying ₹{(1 + addedMembers.length) * 945} per class. Pass pays off after {Math.ceil(featuredPackage.price / 945)} visits.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-2 border-t border-sage/20">
                        <Button
                          onClick={handleAddPass}
                          disabled={addingPass}
                          variant="sage"
                          size="sm"
                          className="flex-1"
                        >
                          {addingPass ? "Processing…" : "Add this Pass →"}
                        </Button>
                        <Link
                          href="/portal/packages"
                          className="font-body text-xs text-sage hover:text-sage/80 underline underline-offset-2 transition-colors whitespace-nowrap"
                        >
                          Explore all Packages
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                  {userPackage.type === "studio_pass" && (
                  <div className="p-5 rounded-xl bg-sage/5 border border-sage/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center">
                        <AlertCircle className="text-sage" size={20} />
                      </div>
                      <h3 className="font-body font-semibold text-lg text-charcoal">Class Coverage</h3>
                    </div>
                    <p className="font-body text-sm text-charcoal/70 mb-3">
                      Your unlimited package covers <strong>1 person</strong> (you).
                    </p>
                    {addedMembers.length > 0 && (
                      <div className="pt-3 border-t border-sage/10">
                        <p className="font-body text-sm text-charcoal/70 mb-2">
                          <strong>Additional Members:</strong> {addedMembers.length} × ₹945 = ₹{addedMembers.length * 945}
                        </p>
                        <p className="font-body text-xs text-charcoal/60 italic">
                          Added members will be charged at the class rate (₹945 per person).
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Add Food */}
            {bookingStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-body font-semibold text-2xl text-charcoal mb-2">
                    Add Nourishment
                  </h3>
                  <p className="font-body text-charcoal/60 mb-6">
                    Select meals for after your class. Perfect for refueling!
                    {userPackage.cafeDiscountPercent > 0 && (
                      <span className={`flex items-center gap-1 text-sage mt-1${userPackage.isUnlimited ? " font-bold" : ""}`}>
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        Your {userPackage.name} includes {userPackage.cafeDiscountPercent}% off on café items
                      </span>
                    )}
                  </p>
                </div>

                <div className="space-y-4">
                  {loadingFoodItems ? (
                    <p className="font-body text-sm text-charcoal/60 text-center py-8">
                      Loading café menu…
                    </p>
                  ) : null}
                  {!loadingFoodItems && foodItemsLoadError ? (
                    <p className="font-body text-sm text-destructive bg-destructive/10 border border-destructive/25 rounded-lg p-3">
                      {foodItemsLoadError}
                    </p>
                  ) : null}
                  {!loadingFoodItems && !foodItemsLoadError && foodItems.length === 0 ? (
                    <p className="font-body text-sm text-charcoal/60 text-center py-8">
                      No café items are available right now. Mark items as available in Admin → Café → Menu.
                    </p>
                  ) : null}
                  {foodItems.map((item) => (
                    <FoodRow key={item.id} item={item} onAdjust={handleFoodQuantity} />
                  ))}
                </div>

                <div className="p-5 rounded-xl bg-cream/30 border border-sage/10">
                  <p className="font-body text-sm text-charcoal/60">
                    Food Subtotal: <span className="font-semibold text-charcoal">₹{totals.foodTotal}</span>
                    {totals.discount > 0 && (
                      <span className="text-sage block mt-1">
                        Discount Applied: -₹{totals.discount.toFixed(0)}
                        {userPackage.cafeDiscountPercent > 0 && ` (${userPackage.cafeDiscountPercent}% off)`}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Checkout */}
            {bookingStep === 4 && (
              <div className="space-y-3 sm:space-y-6">
                {/* Booking Summary — collapsed on mobile into a single compact row */}
                <div className="p-3 sm:p-6 rounded-xl bg-linear-to-br from-cream/40 to-sage/5 border border-sage/10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-body text-xs text-charcoal/60 uppercase tracking-wide mb-0.5">Class</p>
                      <p className="font-body font-semibold text-base sm:text-xl text-charcoal leading-tight">{selectedClass?.name}</p>
                      <p className="font-body text-xs sm:text-sm text-charcoal/60">{selectedClass?.time} • {selectedClass?.instructor}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-body text-xs text-charcoal/60 uppercase tracking-wide mb-0.5">Attendees</p>
                      <p className="font-body text-sm text-charcoal font-medium">{1 + addedMembers.length}</p>
                    </div>
                  </div>
                  {foodItems.filter(item => item.quantity > 0).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-sage/10">
                      <p className="font-body text-xs text-charcoal/50">
                        + {foodItems.filter(item => item.quantity > 0).map(i => `${i.name} ×${i.quantity}`).join(", ")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Coupon Code */}
                {totals.finalTotal > 0 && (
                  <div className="p-3 sm:p-5 rounded-xl bg-white-warm border border-sage/10">
                    <p className="font-body text-sm font-medium text-charcoal mb-2">Have a coupon code?</p>
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between">
                        <span className="font-body text-sm text-sage font-medium inline-flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          {appliedCoupon.code} — -₹{appliedCoupon.discountInr.toFixed(0)} off
                        </span>
                        <button
                          onClick={() => { setAppliedCoupon(null); setCouponCode(""); setCouponError(null); }}
                          className="font-body text-xs text-charcoal/50 hover:text-terracotta underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(null); }}
                          aria-label="Coupon code"
                          placeholder="Enter code"
                          className="flex-1 font-body text-sm px-3 py-2 rounded-lg border border-sage/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1 bg-white-warm text-charcoal placeholder:text-charcoal/30 uppercase"
                        />
                        <Button
                          disabled={!couponCode.trim() || couponLoading}
                          variant="sage"
                          onClick={async () => {
                            setCouponLoading(true);
                            setCouponError(null);
                            try {
                              let ctx: "studio_pass" | "class_pass" | "food";
                              if (totals.classTotal <= 0) ctx = "food";
                              else if (userPackage.type === "studio_pass") ctx = "studio_pass";
                              else ctx = "class_pass";
                              const r = await fetch("/api/coupons/validate", {
                                method: "POST",
                                credentials: "include",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ code: couponCode.trim(), context: ctx, subtotal: totals.finalTotal }),
                              });
                              const d = await r.json();
                              if (d.valid) {
                                setAppliedCoupon({ code: d.code, discountInr: d.discountInr });
                              } else {
                                setCouponError(d.error ?? "Invalid coupon");
                              }
                            } catch {
                              setCouponError("Could not apply coupon. Try again.");
                            } finally {
                              setCouponLoading(false);
                            }
                          }}
                        >
                          {couponLoading ? "…" : "Apply"}
                        </Button>
                      </div>
                    )}
                    {couponError && (
                      <p className="font-body text-xs text-terracotta mt-2">{couponError}</p>
                    )}
                  </div>
                )}

                {/* Payment Breakdown */}
                <div className="p-3 sm:p-6 rounded-xl bg-white-warm border border-sage/10 space-y-2 sm:space-y-3">
                  <h4 className="font-body font-semibold text-base sm:text-lg text-charcoal">Payment Breakdown</h4>

                  {totals.classTotal > 0 && (
                    <div className="flex justify-between font-body text-sm">
                      <span className="text-charcoal/70">
                        {(() => {
                          if (userPackage.type === "class_pass" && useCredits) return `Guests (${addedMembers.length} × ₹945)`;
                          if (userPackage.type === "studio_pass") return `Guests (${addedMembers.length} × ₹945)`;
                          return `Class (${1 + addedMembers.length} × ₹945)`;
                        })()}
                      </span>
                      <span className="text-charcoal tabular-nums">₹{totals.classTotal}</span>
                    </div>
                  )}

                  {totals.foodTotal > 0 && (
                    <div className="flex justify-between font-body text-sm">
                      <span className="text-charcoal/70">Food</span>
                      <span className="text-charcoal tabular-nums">₹{totals.foodTotal}</span>
                    </div>
                  )}

                  {totals.discount > 0 && (
                    <div className="flex justify-between font-body text-sm">
                      <span className="text-sage">Discount</span>
                      <span className="text-sage tabular-nums">-₹{totals.discount.toFixed(0)}</span>
                    </div>
                  )}

                  {totals.couponDiscount > 0 && (
                    <div className="flex justify-between font-body text-sm">
                      <span className="text-sage">Coupon ({appliedCoupon?.code})</span>
                      <span className="text-sage tabular-nums">-₹{totals.couponDiscount.toFixed(0)}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-sage/10 flex justify-between font-body font-semibold text-xl">
                    <span className="text-charcoal">Total</span>
                    <span className="text-sage tabular-nums">₹{totals.finalTotal.toFixed(0)}</span>
                  </div>

                  {totals.taxIncluded > 0 && (
                    <p className="font-body text-xs text-charcoal/40 text-right">
                      Incl. 5% GST: ₹{totals.taxIncluded.toFixed(0)}
                    </p>
                  )}

                  {userPackage.type === "class_pass" && useCredits && (
                    <p className="font-body text-xs text-charcoal/60 italic">
                      {coveringGroup
                        ? `* ${creditsNeededForGroup} classes deducted (covers everyone)`
                        : "* 1 class deducted (your spot only)"}
                    </p>
                  )}

                  {userPackage.type === "studio_pass" && (
                    <p className="font-body text-xs text-charcoal/60 italic">
                      * Unlimited pass — no deduction
                    </p>
                  )}

                  {userPackage.type === null && (
                    <p className="font-body text-xs text-terracotta/80 italic">
                      * No active package — full payment required
                    </p>
                  )}
                </div>

                {/* Payment method — online only */}
                {totals.finalTotal > 0 && (
                  <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-sage/20 bg-white-warm">
                    <div className="h-8 w-8 rounded-full bg-sage/10 flex items-center justify-center shrink-0">
                      <CreditCard className="h-4 w-4 text-sage" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-body text-sm font-semibold text-charcoal">Pay via Razorpay</p>
                      <p className="font-body text-xs text-charcoal/60">Card · UPI · netbanking</p>
                    </div>
                  </div>
                )}

                {totals.finalTotal === 0 && (
                  <div className="flex items-center gap-3 p-3 sm:p-5 rounded-xl bg-sage/5 border border-sage/20">
                    <div className="w-8 h-8 rounded-full bg-sage/20 flex items-center justify-center shrink-0">
                      <Heart className="text-sage" size={18} fill="currentColor" />
                    </div>
                    <div>
                      <p className="font-body text-sm text-charcoal font-medium">No Payment Required</p>
                      <p className="font-body text-xs text-charcoal/60">Your unlimited package covers everything!</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Panel Footer - Navigation */}
          <div className="sticky bottom-0 p-3 sm:p-6 bg-white-warm border-t border-sage/10">
            <div className="flex gap-3">
              {bookingStep > 1 && (
                <Button
                  onClick={handleBackStep}
                  variant="outline"
                  disabled={isSubmittingBooking}
                  className="border-sage/30 text-charcoal hover:bg-sage/5 hover:text-charcoal!"
                >
                  <ChevronLeft size={18} className="mr-2" />
                  Back
                </Button>
              )}
              
              {bookingStep < 4 ? (
                <Button
                  onClick={handleNextStep}
                  disabled={isSubmittingBooking}
                  variant="sage"
                  className="flex-1 text-base py-3 sm:py-6 min-h-[44px]"
                >
                  Continue
                  <ChevronRight size={18} className="ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleConfirmBooking}
                  disabled={isSubmittingBooking}
                  variant="sage"
                  className="flex-1 text-base py-3 sm:py-6 min-h-[44px]"
                >
                  {(() => {
                    if (isSubmittingBooking) return "Working…";
                    if (totals.finalTotal > 0) return `Confirm & Pay ₹${totals.finalTotal.toFixed(0)}`;
                    return "Confirm Booking";
                  })()}
                </Button>
              )}
            </div>

            <Button 
              variant="ghost" 
              onClick={() => setShowBookingPanel(false)} 
              disabled={isSubmittingBooking}
              className="w-full text-charcoal/50 hover:text-charcoal font-body text-sm transition-all duration-500 hover:bg-sage/5 mt-2"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
      
      {/* Overlay */}
      {showBookingPanel && (
        <button
          type="button"
          aria-label="Close booking panel"
          className="fixed inset-0 bg-charcoal/40 z-40 transition-opacity duration-500 animate-in fade-in"
          onClick={() => setShowBookingPanel(false)}
        />
      )}

      <AlertDialog
        open={paymentRecovery !== null}
        onOpenChange={(open) => {
          if (!open) setPaymentRecovery(null);
        }}
      >
        <AlertDialogContent className="border-sage/20 bg-white-warm font-body">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-body font-semibold text-charcoal">
              {paymentRecovery?.variant === "failed" ? "Payment didn’t go through" : "Payment cancelled"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-charcoal/70 space-y-2">
              {paymentRecovery?.variant === "cancelled" ? (
                <span>You closed checkout before completing payment. Your booking hasn&apos;t been placed yet.</span>
              ) : (
                <span className="whitespace-pre-line block">
                  {paymentRecovery?.detail ?? "Something went wrong with this payment attempt."}
                </span>
              )}
              <span className="block pt-1">
                You can try paying again — we&apos;ll open Razorpay checkout with a fresh order.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-sage/30 text-charcoal"
              onClick={() => setPaymentRecovery(null)}
            >
              Close
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-sage hover:bg-sage/90 text-cream"
              onClick={() => {
                setPaymentRecovery(null);
                void handleConfirmBooking();
              }}
            >
              Retry payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}