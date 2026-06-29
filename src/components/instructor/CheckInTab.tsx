import { memo, useMemo } from "react";
import { format, isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Pill } from "@/components/ui/pill";
import {
  Users,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import {
  type BookingRow,
  type ClassRow,
  MemberAvatar,
  instructorCheckInWindowStatus,
} from "@/components/instructor/shared";

interface CheckInTabProps {
  classes: ClassRow[];
  selectedClassId: string | null;
  onSelectClass: (id: string) => void;
  checkingIn: Record<string, boolean>;
  reminding: Record<string, boolean>;
  instructorCheckingIn: Record<string, boolean>;
  onCheckIn: (bookingId: string) => void;
  onRemindPayment: (bookingId: string) => void;
  onInstructorCheckIn: (scheduleId: string) => void;
  onRefresh: () => void;
  onBack: () => void;
}

interface BookingRowItemProps {
  booking: BookingRow;
  subLabel: string | null;
  busyCheckIn: boolean;
  busyRemind: boolean;
  onCheckIn: (bookingId: string) => void;
  onRemindPayment: (bookingId: string) => void;
}

/** One attendee row — memoized so checking in one member doesn't re-render the
 *  whole roster (parent keeps non-touched booking refs stable). */
const BookingRowItem = memo(function BookingRowItem({
  booking: b,
  subLabel,
  busyCheckIn,
  busyRemind,
  onCheckIn,
  onRemindPayment,
}: BookingRowItemProps) {
  return (
    <li className="px-4 sm:px-5 py-3 flex items-center gap-3">
      <MemberAvatar name={b.memberName} url={b.avatarUrl} />

      <div className="flex-1 min-w-0">
        <p className="font-body text-sm font-medium text-charcoal truncate flex items-center gap-1.5">
          <span className="truncate">{b.memberName}</span>
          {b.extraGuests > 0 && (
            <span className="font-body text-xs text-terracotta">+{b.extraGuests}</span>
          )}
          {b.status === "payment_pending" && (
            <Pill tone="warning" size="sm" className="font-body shrink-0">
              Payment pending
            </Pill>
          )}
        </p>
        {subLabel && (
          <p className="font-body text-xs text-charcoal/45 mt-0.5">{subLabel}</p>
        )}
        {b.checkedIn && b.checkInTime && (
          <p className="font-body text-xs text-charcoal/40 mt-0.5">
            {format(new Date(b.checkInTime), "h:mm a")}
            {b.checkInOutcome === "late" && <span className="ml-1 text-terracotta">(late)</span>}
          </p>
        )}
      </div>

      {b.checkedIn ? (
        <div className="flex items-center gap-1 text-sage font-body text-sm shrink-0">
          <CheckCircle2 className="h-5 w-5" />
        </div>
      ) : b.status === "payment_pending" ? (
        <Button
          size="sm"
          variant="terracotta"
          onClick={() => onRemindPayment(b.id)}
          disabled={busyRemind}
          className="rounded-full px-3 shrink-0 h-9"
        >
          {busyRemind ? (
            <Spinner className="size-4" />
          ) : (
            <>
              <Clock className="h-3.5 w-3.5 mr-1" />
              Remind
            </>
          )}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="sage"
          onClick={() => onCheckIn(b.id)}
          disabled={busyCheckIn}
          className="rounded-full px-3 shrink-0 h-9"
        >
          {busyCheckIn ? (
            <Spinner className="size-4" />
          ) : (
            <>
              <Circle className="h-3.5 w-3.5 mr-1" />
              Check In
            </>
          )}
        </Button>
      )}
    </li>
  );
});

function CheckInTabImpl({
  classes,
  selectedClassId,
  onSelectClass,
  checkingIn,
  reminding,
  instructorCheckingIn,
  onCheckIn,
  onRemindPayment,
  onInstructorCheckIn,
  onRefresh,
  onBack,
}: CheckInTabProps) {
  const todayClasses = useMemo(
    () => classes.filter((c) => isToday(new Date(c.startTime))),
    [classes],
  );
  const selectedClass = useMemo(
    () => todayClasses.find((c) => c.id === selectedClassId) ?? null,
    [todayClasses, selectedClassId],
  );

  // Precompute the "Guest of … / Brought …" label per booking in a single pass
  // over the roster instead of an O(n²) find/filter inside every rendered row.
  const subLabelById = useMemo(() => {
    const out = new Map<string, string | null>();
    const rows = selectedClass?.bookings ?? [];
    const nameByUserId = new Map<string, string>();
    const broughtByUserId = new Map<string, string[]>();
    for (const r of rows) {
      nameByUserId.set(r.userId, r.memberName);
      if (r.invitedByUserId) {
        const list = broughtByUserId.get(r.invitedByUserId);
        if (list) list.push(r.memberName);
        else broughtByUserId.set(r.invitedByUserId, [r.memberName]);
      }
    }
    for (const r of rows) {
      if (r.invitedByUserId) {
        const booker = nameByUserId.get(r.invitedByUserId) ?? null;
        out.set(r.id, booker ? `Guest of ${booker}` : null);
      } else {
        const brought = broughtByUserId.get(r.userId);
        out.set(r.id, brought && brought.length > 0 ? `Brought ${brought.join(", ")}` : null);
      }
    }
    return out;
  }, [selectedClass]);

  if (todayClasses.length === 0) {
    return (
      <div className="bg-white-warm rounded-2xl border border-sage/10 p-10 text-center">
        <AlertCircle className="h-10 w-10 text-sage/30 mx-auto mb-3" />
        <p className="font-body font-semibold text-lg text-charcoal">No classes today</p>
        <p className="font-body text-sm text-charcoal/50 mt-1">Check-in is only available for today&apos;s classes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Class selector */}
      {todayClasses.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {todayClasses.map((cls) => (
            <button
              key={cls.id}
              onClick={() => onSelectClass(cls.id)}
              className={`font-body text-sm px-4 py-2 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1 ${
                selectedClassId === cls.id
                  ? "bg-sage text-cream border-sage"
                  : "bg-white-warm text-charcoal border-sage/20 hover:border-sage/40"
              }`}
            >
              {cls.className} · {format(new Date(cls.startTime), "h:mm a")}
            </button>
          ))}
        </div>
      )}

      {selectedClass ? (
        <div className="bg-white-warm rounded-2xl border border-sage/10 overflow-hidden">
          {/* Class header */}
          <div className="px-5 py-4 border-b border-sage/10 flex items-center justify-between">
            <div>
              <h2 className="font-body font-semibold text-xl text-charcoal">{selectedClass.className}</h2>
              <p className="font-body text-sm text-charcoal/60 mt-0.5">
                {format(new Date(selectedClass.startTime), "h:mm a")} –{" "}
                {format(new Date(selectedClass.endTime), "h:mm a")}
                &nbsp;·&nbsp;
                <span className="text-sage font-medium">
                  {selectedClass.bookings.filter((b) => b.checkedIn).length}/{selectedClass.enrolled} checked in
                </span>
              </p>
              {/* Instructor check-in status */}
              {selectedClass.instructorCheckedIn && (
                <p className="font-body text-xs text-sage mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  You checked in at {selectedClass.instructorCheckInTime ? format(new Date(selectedClass.instructorCheckInTime), "h:mm a") : "—"}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!selectedClass.instructorCheckedIn && instructorCheckInWindowStatus(selectedClass.startTime) === "open" && (
                <Button
                  variant="terracotta"
                  size="sm"
                  onClick={() => onInstructorCheckIn(selectedClass.id)}
                  disabled={instructorCheckingIn[selectedClass.id]}
                  className="rounded-full"
                >
                  {instructorCheckingIn[selectedClass.id] ? <Spinner className="size-4" /> : "I'm Here"}
                </Button>
              )}
              <Button
                onClick={onRefresh}
                variant="sage-outline"
                size="icon-sm"
                className="rounded-full"
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Booking list */}
          {selectedClass.bookings.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="h-8 w-8 text-sage/20 mx-auto mb-2" />
              <p className="font-body text-sm text-charcoal/50">No one has booked this class yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-sage/10">
              {selectedClass.bookings.map((b) => (
                <BookingRowItem
                  key={b.id}
                  booking={b}
                  subLabel={subLabelById.get(b.id) ?? null}
                  busyCheckIn={checkingIn[b.id]}
                  busyRemind={reminding[b.id]}
                  onCheckIn={onCheckIn}
                  onRemindPayment={onRemindPayment}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="gap-1.5 text-charcoal/50 hover:text-charcoal"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to overview
      </Button>
    </div>
  );
}

export default CheckInTabImpl;
