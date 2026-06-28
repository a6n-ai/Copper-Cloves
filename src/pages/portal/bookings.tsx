import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

export const getServerSideProps = requireSessionSSP();
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, AlertCircle, X, ArrowDownUp, ChevronRight } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MobilePagination } from "@/components/responsive/MobilePagination";
import { Pill } from "@/components/ui/pill";
import { bookingStatusPill, attendanceOutcomePill } from "@/lib/pillMaps";

import { canCheckInNow, checkInWindowBounds } from "@/lib/bookingAttendance";

type RefundOutcome = "class_pass" | "none_unlimited" | "none_no_pass";
interface CancelPreview {
  scope: "self" | "group";
  seats: number;
  affected: { name: string; isYou: boolean; refund: RefundOutcome }[];
}

function refundOutcomeText(o: RefundOutcome): string {
  if (o === "class_pass") return "1 Class Pass";
  if (o === "none_unlimited") return "no refund (unlimited)";
  return "no refund";
}

interface Booking {
  id: string;
  class_name: string;
  class_time: string;
  status: string;
  confirmation_status?: string | null;
  created_at: string;
  checked_in: boolean;
  check_in_outcome: string | null;
  invited_by_name?: string | null;
  cancel_cutoff_hours?: number | null;
  guests?: { name: string; status: string; checked_in: boolean }[];
  class_schedule?: {
    start_time: string;
    instructor?: { name?: string | null };
  } | null;
}

/** Mirrors a booking row: title + status pill, time/date lines, instructor + starts-in columns, action buttons. */
/**
 * Single source of truth for a booking card row. Was previously rendered TWICE
 * per booking (mobile card-stack + desktop-card variant via ResponsiveCards),
 * which meant every render produced 2× the DOM and React reconciliation work.
 * Now rendered once with responsive padding/typography classes; `React.memo`
 * skips rerender when the booking + derived booleans don't change.
 */
interface BookingCardProps {
  booking: Booking;
  startIso: string;
  timeUntil: string;
  isPast: boolean;
  beforeCheckInWindow: boolean;
  afterCheckInWindow: boolean;
  canCheck: boolean;
  checkInOpen: number;
  onCheckIn: (booking: Booking) => void;
  onCancel: (booking: Booking) => void;
  formatTime: (iso: string) => string;
  formatDate: (iso: string) => string;
}
const BookingCard = memo(function BookingCard({
  booking,
  startIso,
  timeUntil,
  isPast,
  beforeCheckInWindow,
  afterCheckInWindow,
  canCheck,
  checkInOpen,
  onCheckIn,
  onCancel,
  formatTime,
  formatDate,
}: BookingCardProps) {
  // A live, seat-holding booking can be cancelled by its owner — booker OR
  // invited guest (the API cancels just the invitee's own row). "pending" is a
  // real occupying status (legacy/partner-confirm), not a dead one.
  const cancellable =
    !isPast && ["confirmed", "payment_pending", "pending"].includes(booking.status);
  return (
    <div className="bg-white-warm rounded-xl border border-sage/10 p-4 sm:p-6 hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)] transition-all duration-300">
      <div className="flex items-start justify-between gap-3 mb-2 sm:mb-3">
        <div className="flex-1 min-w-0">
          <Link href={`/portal/bookings/${booking.id}`} className="group inline-flex items-center gap-1.5 max-w-full">
            <h3 className="font-display text-lg sm:text-2xl text-charcoal truncate group-hover:text-sage transition-colors">{booking.class_name}</h3>
            <ChevronRight size={18} className="shrink-0 text-charcoal/30 group-hover:text-sage transition-colors" />
          </Link>
          <div className="flex flex-wrap gap-1.5 mt-1 sm:mt-1.5">
            <Pill {...bookingStatusPill(booking.status)}>{bookingStatusPill(booking.status).label}</Pill>
            {booking.confirmation_status === "pending" && booking.status !== "cancelled" && (
              <Pill tone="warning">Awaiting confirmation</Pill>
            )}
            {booking.checked_in && (
              <Pill tone="success">
                Checked in{booking.check_in_outcome === "on_time" ? " · On time" : ""}{booking.check_in_outcome === "late" ? " · Late" : ""}
              </Pill>
            )}
            {booking.check_in_outcome === "no_show" && (
              <Pill {...attendanceOutcomePill("no_show")}>No-show</Pill>
            )}
            {booking.invited_by_name && (
              <Pill tone="success">Invited by {booking.invited_by_name}</Pill>
            )}
          </div>
        </div>
        {!isPast && (
          <div className="shrink-0 text-right">
            <p className="font-body text-xs text-charcoal/50">Starts in</p>
            <p className="font-body text-sm font-medium text-charcoal">{timeUntil}</p>
          </div>
        )}
      </div>
      {booking.guests && booking.guests.length > 0 && (
        <div className="mb-3 rounded-lg bg-sand/40 px-3 py-2">
          <p className="font-body text-xs font-medium text-charcoal/70">
            You brought {booking.guests.length} guest{booking.guests.length > 1 ? "s" : ""}
          </p>
          <p className="font-body text-xs text-charcoal/55">
            {booking.guests
              .map((g) => `${g.name}${g.checked_in ? " · checked in" : g.status === "payment_pending" ? " · unpaid" : ""}`)
              .join(", ")}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
        <div className="flex items-center gap-1.5 text-charcoal/60">
          <Clock size={14} />
          <span className="font-body text-sm">{formatTime(startIso)}</span>
        </div>
        <div className="font-body text-sm text-charcoal/50">{formatDate(startIso)}</div>
        {/* Instructor name only on md+ — was previously the only mobile/desktop divergence. */}
        {booking.class_schedule?.instructor?.name && (
          <div className="hidden sm:block font-body text-sm text-charcoal/60">{booking.class_schedule.instructor.name}</div>
        )}
      </div>
      {/* Invited guests don't pay — the booker's payment covers the group. Show a
          status note instead of a complete-payment link. */}
      {booking.invited_by_name && (booking.status === "payment_pending" || booking.status === "expired") && (
        <p className="mb-3 font-body text-sm text-charcoal/55">
          {booking.status === "payment_pending"
            ? `Awaiting ${booking.invited_by_name}'s payment to confirm your spot.`
            : `${booking.invited_by_name}'s payment wasn't completed — this booking expired.`}
        </p>
      )}
      {!booking.invited_by_name && (booking.status === "payment_pending" || booking.status === "expired") && (
        <Link
          href={`/portal/bookings/${booking.id}`}
          className="inline-flex items-center gap-1 mb-3 font-body text-sm font-medium text-sage hover:underline"
        >
          {booking.status === "payment_pending" ? "Complete payment / I've already paid" : "Payment expired — review"} →
        </Link>
      )}
      {!isPast && (
        <div className="flex flex-col gap-2">
          {beforeCheckInWindow && (
            <p className="font-body text-xs text-charcoal/55">Check-in opens at {formatTime(new Date(checkInOpen).toISOString())} (15 min before class).</p>
          )}
          {afterCheckInWindow && (
            <p className="font-body text-xs text-charcoal/55">Check-in closed for this class.</p>
          )}
          {cancellable &&
            booking.cancel_cutoff_hours != null &&
            (() => {
              const cutoffMs = new Date(startIso).getTime() - (booking.cancel_cutoff_hours ?? 0) * 3600_000;
              return Date.now() < cutoffMs ? (
                <p className="font-body text-xs text-sage">
                  Free cancellation (refund pass) until {formatTime(new Date(cutoffMs).toISOString())}.
                </p>
              ) : (
                <p className="font-body text-xs text-terracotta">
                  Past the cancellation cutoff — cancelling now needs studio approval.
                </p>
              );
            })()}
          <div className="flex gap-2">
            {canCheck && (
              <Button onClick={() => onCheckIn(booking)} size="sm" variant="sage" className="flex-1 sm:flex-none h-11 px-4 sm:px-6">Check in</Button>
            )}
            {cancellable && (
              <Button onClick={() => onCancel(booking)} size="sm" variant="outline" className="flex-1 sm:flex-none border-terracotta/30 text-terracotta hover:bg-terracotta/5 h-11 px-4 sm:px-6 hover:text-terracotta!">
                <X size={16} className="mr-1.5" />Cancel
              </Button>
            )}
          </div>
        </div>
      )}
      {(booking.status === "cancelled" || (isPast && !booking.checked_in && booking.check_in_outcome !== "on_time" && booking.check_in_outcome !== "late")) && (
        <div className="mt-3">
          <Link
            href="/portal/book"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-sage/30 px-4 font-body text-sm font-medium text-sage transition-colors hover:bg-sage hover:text-cream"
          >
            Rebook a class
          </Link>
        </div>
      )}
    </div>
  );
});

function BookingRowSkeleton() {
  return (
    <div className="bg-white-warm rounded-xl border border-sage/10 p-6">
      <div className="flex items-center justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <div className="hidden md:block space-y-2">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="hidden lg:block space-y-2">
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="shrink-0 flex flex-col gap-2 items-end">
          <Skeleton className="h-10 w-28 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function BookingsListSkeleton({ rows = 5 }: Readonly<{ rows?: number }>) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }, (_, i) => `booking-skeleton-${i}`).map((key) => (
        <BookingRowSkeleton key={key} />
      ))}
    </div>
  );
}

export default function MyBookingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { status } = useSession();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [canRefund, setCanRefund] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelPreview, setCancelPreview] = useState<CancelPreview | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");
  const [sortAsc, setSortAsc] = useState(false);
  const PAGE_SIZE = 8;

  // Reset to page 1 whenever the filter or sort order changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, sortAsc]);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/portal/login"); return; }
    if (status === "authenticated") {
      setIsAuthenticated(true);
      fetchBookings().finally(() => setIsLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function fetchBookings() {
    try {
      // Full class history: every booked class regardless of payment (confirmed,
      // unpaid holds, expired, cancelled) — each row carries its own status pill.
      const res = await fetch("/api/bookings?status=history");
      if (!res.ok) throw new Error("Failed");
      setBookings(await res.json());
    } catch (error) {
      console.error("Error fetching bookings:", error);
      setBookings([]);
    }
  }

  function effectiveClassTime(booking: Booking): string {
    if (booking.class_schedule?.start_time) return booking.class_schedule.start_time;
    return booking.class_time;
  }

  function handleCancelClick(booking: Booking) {
    setSelectedBooking(booking);
    setCancelReason("");

    const classTime = new Date(effectiveClassTime(booking));
    const now = new Date();
    const hoursDiff = (classTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Client-side hint only (default 6h cutoff). The server is authoritative: a
    // self-cancel after the configured cutoff falls back to a request, and a
    // request before the cutoff falls back to a self-cancel.
    setCanRefund(hoursDiff > 6);
    // Dry-run: who gets cancelled + what refund each person receives.
    setCancelPreview(null);
    fetch(`/api/bookings/${booking.id}/cancel-preview`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CancelPreview | null) => setCancelPreview(d))
      .catch(() => {});
    setShowCancelDialog(true);
  }

  // Self-serve cancel (before cutoff). Returns "ok" | "needs_request" | "error".
  async function trySelfCancel(bookingId: string, reason?: string): Promise<"ok" | "needs_request" | "error"> {
    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bookingId, status: "cancelled", reason: reason?.trim() || undefined }),
    });
    if (res.ok) return "ok";
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data?.code === "CUTOFF_PASSED") return "needs_request";
    return "error";
  }

  // Late-cancel request (after cutoff). Returns "ok" | "can_self_cancel" | "error".
  async function tryCancelRequest(bookingId: string, reason: string): Promise<"ok" | "can_self_cancel" | "error"> {
    const res = await fetch(`/api/bookings/${bookingId}/cancel-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    });
    if (res.ok) return "ok";
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data?.code === "USE_SELF_CANCEL") return "can_self_cancel";
    return "error";
  }

  async function handleConfirmCancel() {
    if (!selectedBooking) return;
    const bookingId = selectedBooking.id;
    try {
      setCanceling(true);

      if (canRefund) {
        const r = await trySelfCancel(bookingId, cancelReason);
        if (r === "ok") {
          setBookings((prev) => prev.filter((b) => b.id !== bookingId));
          toast({ title: "Booking cancelled", description: "A refund pass has been added to your account." });
        } else if (r === "needs_request") {
          const rr = await tryCancelRequest(bookingId, cancelReason);
          if (rr === "ok") {
            toast({ title: "Request submitted", description: "The studio will review your cancellation request." });
          } else {
            throw new Error("request failed");
          }
        } else {
          throw new Error("cancel failed");
        }
      } else {
        const rr = await tryCancelRequest(bookingId, cancelReason);
        if (rr === "ok") {
          toast({ title: "Request submitted", description: "The studio will review your cancellation request." });
        } else if (rr === "can_self_cancel") {
          const r = await trySelfCancel(bookingId, cancelReason);
          if (r === "ok") {
            setBookings((prev) => prev.filter((b) => b.id !== bookingId));
            toast({ title: "Booking cancelled", description: "A refund pass has been added to your account." });
          } else {
            throw new Error("cancel failed");
          }
        } else {
          throw new Error("request failed");
        }
      }

      setShowCancelDialog(false);
      setSelectedBooking(null);
      setCancelReason("");
    } catch (error) {
      console.error("Error canceling booking:", error);
      toast({ title: "Could not cancel", description: "Something went wrong. Please try again.", variant: "error" });
    } finally {
      setCanceling(false);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
  }

  function getTimeUntilClass(classTimeIso: string) {
    const now = new Date();
    const classDate = new Date(classTimeIso);
    const hoursDiff = (classDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff < 0) return "Past";
    if (hoursDiff < 1) return "Less than 1 hour";
    if (hoursDiff < 24) return `${Math.floor(hoursDiff)} hours`;
    const days = Math.floor(hoursDiff / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  }

  async function handleCheckIn(booking: Booking) {
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: booking.id, checked_in: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Check-in failed", description: typeof data?.error === "string" ? data.error : "Could not check in. Please try again.", variant: "error" });
        return;
      }
      await fetchBookings();
    } catch {
      toast({ title: "Check-in failed", description: "Could not check in. Please try again.", variant: "error" });
    }
  }

  // Filter + sort + paginate. A booking is "upcoming" only if its class is still
  // in the future AND it's not cancelled/expired; everything else is "past".
  const counts = useMemo(() => {
    const now = Date.now();
    let up = 0;
    for (const b of bookings) {
      const ms = new Date(effectiveClassTime(b)).getTime();
      if (ms > now && b.status !== "cancelled" && b.status !== "expired") up++;
    }
    return { all: bookings.length, upcoming: up, past: bookings.length - up };
  }, [bookings]);

  const filteredSorted = useMemo(() => {
    const now = Date.now();
    const rows = bookings.map((b) => ({ b, ms: new Date(effectiveClassTime(b)).getTime() }));
    const filtered = rows.filter(({ b, ms }) => {
      const isUpcoming = ms > now && b.status !== "cancelled" && b.status !== "expired";
      if (filter === "upcoming") return isUpcoming;
      if (filter === "past") return !isUpcoming;
      return true;
    });
    filtered.sort((a, b) => (sortAsc ? a.ms - b.ms : b.ms - a.ms));
    return filtered.map((x) => x.b);
  }, [bookings, filter, sortAsc]);

  const totalPages = Math.ceil(filteredSorted.length / PAGE_SIZE);
  const paginatedBookings = useMemo(
    () => filteredSorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredSorted, currentPage],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          <BookingsListSkeleton rows={5} />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/5">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <PageHeader title="My Bookings" subtitle="View and manage your upcoming class reservations" />
      </div>

      {/* Bookings Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {bookings.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-sage/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="text-sage" size={40} />
            </div>
            <h3 className="font-display text-2xl text-charcoal mb-3">No Bookings Yet</h3>
            <p className="font-body text-charcoal/60 mb-6">
              You haven't booked any classes. Start your wellness journey today!
            </p>
            <Button
              onClick={() => router.push("/portal/book")}
              variant="sage"
            >
              Browse Classes
            </Button>
          </div>
        ) : (
          <>
            {/* Filter + sort controls */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-lg border border-sage/20 bg-white-warm p-1">
                {([
                  { key: "all", label: "All", n: counts.all },
                  { key: "upcoming", label: "Upcoming", n: counts.upcoming },
                  { key: "past", label: "Past", n: counts.past },
                ] as const).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setFilter(t.key)}
                    className={[
                      "rounded-md px-3 py-1.5 font-body text-sm font-medium transition-colors duration-200 cursor-pointer",
                      filter === t.key ? "bg-sage text-cream" : "text-charcoal/65 hover:text-charcoal",
                    ].join(" ")}
                  >
                    {t.label} <span className="tabular-nums opacity-70">{t.n}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSortAsc((v) => !v)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sage/20 bg-white-warm px-3 font-body text-sm text-charcoal/70 transition-colors duration-200 hover:bg-sage/5 cursor-pointer"
              >
                <ArrowDownUp size={14} />
                {sortAsc ? "Soonest first" : "Latest first"}
              </button>
            </div>

            {paginatedBookings.length === 0 ? (
              <p className="py-12 text-center font-body text-charcoal/55">No {filter === "all" ? "" : filter} bookings.</p>
            ) : (
            <div className="space-y-3 sm:space-y-4">
              {paginatedBookings.map((booking) => {
                const startIso = effectiveClassTime(booking);
                const timeUntil = getTimeUntilClass(startIso);
                const isPast = timeUntil === "Past";
                const startDate = new Date(startIso);
                const now = Date.now();
                const { open: checkInOpen, close: checkInClose } = checkInWindowBounds(startDate);
                const beforeCheckInWindow =
                  !isPast && !booking.checked_in && booking.status !== "cancelled" && now < checkInOpen;
                const afterCheckInWindow =
                  !isPast && !booking.checked_in && booking.status !== "cancelled" && now > checkInClose;
                const canCheck =
                  !isPast && !booking.checked_in && booking.status !== "cancelled" && canCheckInNow(startDate);
                return (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    startIso={startIso}
                    timeUntil={timeUntil}
                    isPast={isPast}
                    beforeCheckInWindow={beforeCheckInWindow}
                    afterCheckInWindow={afterCheckInWindow}
                    canCheck={canCheck}
                    checkInOpen={checkInOpen}
                    onCheckIn={(b) => void handleCheckIn(b)}
                    onCancel={handleCancelClick}
                    formatTime={formatTime}
                    formatDate={formatDate}
                  />
                );
              })}
            </div>
            )}
            {totalPages > 1 && (
              <MobilePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                className="mt-4"
              />
            )}
          </>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <ResponsiveDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <ResponsiveDialogContent className="sm:max-w-md bg-white-warm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-2xl text-charcoal">
              Cancel Booking
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/70">
              Are you sure you want to cancel your booking for {selectedBooking?.class_name}?
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {/* Warning Alert */}
          <Alert className="border-terracotta/30 bg-terracotta/5">
            <AlertCircle className="h-4 w-4 text-terracotta" />
            <AlertDescription className="font-body text-sm text-charcoal ml-2">
              {canRefund ? (
                <>
                  <strong>Cancellation with refund:</strong> You are canceling before the cutoff.
                  A <strong>1 Class Pass</strong> refund will be added to your account.
                </>
              ) : (
                <>
                  <strong>Past the cancellation cutoff:</strong> You can no longer cancel this class directly.
                  Submit a request below and the studio will review it.
                </>
              )}
            </AlertDescription>
          </Alert>

          {cancelPreview && (
            <div className="rounded-lg border border-sage/20 bg-sage/[0.04] p-3">
              <p className="font-body text-xs font-medium text-charcoal/70 mb-1.5">
                {cancelPreview.scope === "group"
                  ? `This cancels ${cancelPreview.seats} seat${cancelPreview.seats > 1 ? "s" : ""} — you and your group:`
                  : "This cancels your seat only:"}
              </p>
              <ul className="space-y-1">
                {cancelPreview.affected.map((a, i) => (
                  <li key={`${a.name}-${i}`} className="flex items-center justify-between font-body text-sm">
                    <span className="text-charcoal">{a.isYou ? "You" : a.name}</span>
                    <span className={a.refund === "class_pass" ? "font-medium text-sage" : "text-charcoal/50"}>
                      {refundOutcomeText(a.refund)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!canRefund && (
            <div className="grid gap-1.5 pt-1">
              <Label htmlFor="cancel-reason" className="font-body text-sm text-charcoal/70">
                Reason for late cancellation
              </Label>
              <Textarea
                id="cancel-reason"
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Let the studio know why you need to cancel…"
              />
            </div>
          )}

          {selectedBooking && (
            <div className="py-4 space-y-2 border-t border-b border-sage/10">
              <div className="flex justify-between">
                <span className="font-body text-sm text-charcoal/60">Class</span>
                <span className="font-body text-charcoal font-medium">{selectedBooking.class_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-body text-sm text-charcoal/60">Date & Time</span>
                <span className="font-body text-charcoal">
                  {formatDate(effectiveClassTime(selectedBooking))} at {formatTime(effectiveClassTime(selectedBooking))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-body text-sm text-charcoal/60">Refund Status</span>
                <span className={`font-body font-medium ${canRefund ? "text-sage" : "text-terracotta"}`}>
                  {canRefund ? "Refund pass" : "Needs review"}
                </span>
              </div>
            </div>
          )}

          <ResponsiveDialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={canceling}
              className="border-sage/20 text-charcoal hover:bg-sage/5 hover:text-charcoal!"
            >
              Keep Booking
            </Button>
            <Button
              onClick={handleConfirmCancel}
              disabled={canceling}
              variant="terracotta"
            >
              {canceling ? "Submitting..." : canRefund ? "Confirm Cancellation" : "Submit Request"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}