import { memo } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Pill } from "@/components/ui/pill";
import { classStatusPill } from "@/lib/pillMaps";
import { Clock, CheckCircle2, ChevronRight, UserCheck } from "lucide-react";
import {
  type ClassRow,
  CapacityBar,
  MemberAvatar,
  classStatusBadge,
  instructorCheckInWindowStatus,
  minutesUntilOpen,
} from "@/components/instructor/shared";

interface ScheduleClassCardProps {
  cls: ClassRow;
  busy: boolean;
  errMsg?: string;
  onInstructorCheckIn: (scheduleId: string) => void;
  onMemberCheckIn: (scheduleId: string) => void;
}

/**
 * One class card in the instructor's "My Schedule" tab. Memoized so a check-in
 * on one card (which only swaps that card's row reference + per-card busy flag)
 * doesn't re-render every other card in the week.
 */
function ScheduleClassCardImpl({
  cls,
  busy,
  errMsg,
  onInstructorCheckIn,
  onMemberCheckIn,
}: ScheduleClassCardProps) {
  const statusInfo = classStatusBadge(cls);
  const checkedInCount = cls.bookings.filter((b) => b.checkedIn).length;
  const winStatus = instructorCheckInWindowStatus(cls.startTime);
  return (
    <Card className="p-4 sm:p-5 hover:border-sage/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-body font-semibold text-base sm:text-lg text-charcoal">{cls.className}</h2>
            <Pill {...classStatusPill(statusInfo.status)} size="sm" className="font-body">
              {statusInfo.label}
            </Pill>
            {cls.category && (
              <span className="font-body text-xs text-charcoal/40 uppercase tracking-wider hidden sm:inline">
                {cls.category}
              </span>
            )}
            {/* Instructor check-in badge */}
            {cls.instructorCheckedIn ? (
              <Pill tone="success" size="sm" className="font-body" icon={<CheckCircle2 className="h-3 w-3" />}>
                <span className="hidden sm:inline">You checked in {cls.instructorCheckInTime ? format(new Date(cls.instructorCheckInTime), "h:mm a") : ""}</span>
                <span className="sm:hidden">Checked in</span>
              </Pill>
            ) : winStatus === "open" ? (
              <Pill tone="warning" size="sm" className="font-body">
                Window open
              </Pill>
            ) : winStatus === "too_early" ? (
              <Pill tone="neutral" size="sm" className="font-body hidden sm:inline-flex">
                Opens {minutesUntilOpen(cls.startTime)} min before class
              </Pill>
            ) : (
              <Pill tone="neutral" size="sm" className="font-body hidden sm:inline-flex">
                Window closed
              </Pill>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-charcoal/60 font-body">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {format(new Date(cls.startTime), "h:mm a")} – {format(new Date(cls.endTime), "h:mm a")}
            </span>
            <span className="flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-sage" />
              {checkedInCount}/{cls.enrolled} checked in
            </span>
          </div>

          <CapacityBar enrolled={cls.enrolled} capacity={cls.capacity} />
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {/* Instructor self check-in */}
          {!cls.instructorCheckedIn && winStatus === "open" && (
            <Button
              variant="terracotta"
              size="sm"
              onClick={() => onInstructorCheckIn(cls.id)}
              disabled={busy}
              className="min-w-[80px]"
            >
              {busy ? <Spinner className="size-4" /> : "I'm Here"}
            </Button>
          )}
          {/* Member check-in shortcut */}
          {cls.instructorCheckedIn && (
            <Button
              onClick={() => onMemberCheckIn(cls.id)}
              variant="sage-outline"
              size="sm"
            >
              <span className="hidden sm:inline">Member Check-In</span>
              <span className="sm:hidden">Check In</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {errMsg && (
        <p className="mt-2 font-body text-xs text-pill-danger-fg bg-pill-danger-bg rounded-lg px-3 py-2">{errMsg}</p>
      )}

      {/* Member previews */}
      {cls.bookings.length > 0 && (
        <div className="mt-4 pt-4 border-t border-sage/10">
          <p className="font-body text-xs text-charcoal/50 uppercase tracking-wider mb-2">
            Registered Members
          </p>
          <div className="flex flex-wrap gap-2">
            {cls.bookings.slice(0, 8).map((b) => (
              <div key={b.id} className="flex items-center gap-1.5 bg-sage/5 rounded-full pl-1 pr-3 py-1">
                <MemberAvatar name={b.memberName} url={b.avatarUrl} />
                <span className="font-body text-xs text-charcoal">{b.memberName.split(" ")[0]}</span>
                {b.checkedIn && <CheckCircle2 className="h-3 w-3 text-sage ml-0.5" />}
                {!b.checkedIn && b.status === "payment_pending" && (
                  <span className="font-body text-[10px] font-medium text-terracotta">unpaid</span>
                )}
                {b.extraGuests > 0 && (
                  <span className="font-body text-[10px] text-terracotta">+{b.extraGuests}</span>
                )}
              </div>
            ))}
            {cls.bookings.length > 8 && (
              <div className="flex items-center bg-sage/5 rounded-full px-3 py-1">
                <span className="font-body text-xs text-charcoal/60">+{cls.bookings.length - 8} more</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export const ScheduleClassCard = memo(ScheduleClassCardImpl);
