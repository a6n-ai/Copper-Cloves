import { memo, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

export const getServerSideProps = requireSessionSSP();
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, AlertCircle, X } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MobilePagination } from "@/components/responsive/MobilePagination";

import { canCheckInNow, checkInWindowBounds } from "@/lib/bookingAttendance";

interface Booking {
  id: string;
  class_name: string;
  class_time: string;
  status: string;
  confirmation_status?: string | null;
  created_at: string;
  checked_in: boolean;
  check_in_outcome: string | null;
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
  return (
    <div className="bg-white-warm rounded-xl shadow-xs border border-sage/10 p-4 sm:p-6 hover:shadow-md transition-all duration-300">
      <div className="flex items-start justify-between gap-3 mb-2 sm:mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg sm:text-2xl text-charcoal truncate">{booking.class_name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1 sm:mt-1.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-body ${booking.status === "confirmed" ? "bg-sage/10 text-sage" : "bg-terracotta/10 text-terracotta"}`}>
              {booking.status === "confirmed" ? "Confirmed" : "Pending"}
            </span>
            {booking.confirmation_status === "pending" && booking.status !== "cancelled" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-body bg-terracotta/10 text-terracotta">Awaiting confirmation</span>
            )}
            {booking.checked_in && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-body bg-sage/10 text-sage">
                Checked in{booking.check_in_outcome === "on_time" ? " · On time" : ""}{booking.check_in_outcome === "late" ? " · Late" : ""}
              </span>
            )}
            {booking.check_in_outcome === "no_show" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-body bg-charcoal/10 text-charcoal/70">No-show</span>
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
      {!isPast && (
        <div className="flex flex-col gap-2">
          {beforeCheckInWindow && (
            <p className="font-body text-xs text-charcoal/55">Check-in opens at {formatTime(new Date(checkInOpen).toISOString())} (15 min before class).</p>
          )}
          {afterCheckInWindow && (
            <p className="font-body text-xs text-charcoal/55">Check-in closed for this class.</p>
          )}
          <div className="flex gap-2">
            {canCheck && (
              <Button onClick={() => onCheckIn(booking)} size="sm" variant="sage" className="flex-1 sm:flex-none h-11 px-4 sm:px-6">Check in</Button>
            )}
            <Button onClick={() => onCancel(booking)} size="sm" variant="outline" className="flex-1 sm:flex-none border-terracotta/30 text-terracotta hover:bg-terracotta/5 h-11 px-4 sm:px-6 hover:text-terracotta!">
              <X size={16} className="mr-1.5" />Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

function BookingRowSkeleton() {
  return (
    <div className="bg-white-warm rounded-xl shadow-xs border border-sage/10 p-6">
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
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 8;

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
      const res = await fetch("/api/bookings?status=active");
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

    const classTime = new Date(effectiveClassTime(booking));
    const now = new Date();
    const hoursDiff = (classTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    setCanRefund(hoursDiff > 6);
    setShowCancelDialog(true);
  }

  async function handleConfirmCancel() {
    if (!selectedBooking) return;
    try {
      setCanceling(true);
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedBooking.id, status: "cancelled" }),
      });
      if (!res.ok) throw new Error("Cancel failed");
      setBookings(prev => prev.filter(b => b.id !== selectedBooking.id));
      setShowCancelDialog(false);
      setSelectedBooking(null);
    } catch (error) {
      console.error("Error canceling booking:", error);
      toast({ title: "Could not cancel", description: "Failed to cancel booking. Please try again.", variant: "error" });
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
      hour12: true
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

  // Newest class first. Precompute startMs once per booking to avoid building a
  // new Date in every compare. Memoize so unrelated state changes don't re-sort.
  const sortedBookings = useMemo(() => {
    return bookings
      .map((b) => ({ b, ms: new Date(effectiveClassTime(b)).getTime() }))
      .sort((a, b) => b.ms - a.ms)
      .map(({ b }) => b);
  }, [bookings]);
  const totalPages = Math.ceil(sortedBookings.length / PAGE_SIZE);
  const paginatedBookings = useMemo(
    () => sortedBookings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sortedBookings, currentPage],
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
                  <strong>Cancellation with refund:</strong> You are canceling more than 6 hours before the class. 
                  Your class will be refunded to your account.
                </>
              ) : (
                <>
                  <strong>No refund policy:</strong> You are canceling within 6 hours of the class start time. 
                  The class will be canceled, but <strong>your class will NOT be reimbursed</strong>.
                </>
              )}
            </AlertDescription>
          </Alert>

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
                  {canRefund ? "Refundable" : "Non-refundable"}
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
              {canceling ? "Canceling..." : "Confirm Cancellation"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}