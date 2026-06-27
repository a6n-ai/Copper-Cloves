import Image from "next/image";
import { format, isToday, isTomorrow } from "date-fns";
import { deriveScheduleState } from "@/lib/scheduleStatus";

export interface BookingRow {
  id: string;
  memberName: string;
  email: string;
  avatarUrl: string | null;
  checkedIn: boolean;
  checkInTime: string | null;
  checkInOutcome: string | null;
  extraGuests: number;
  status: string;
  userId: string;
  invitedByUserId?: string | null;
}

export interface ClassRow {
  id: string;
  className: string;
  category: string;
  startTime: string;
  endTime: string;
  capacity: number;
  enrolled: number;
  availableSpots: number;
  status: string;
  instructorCheckedIn: boolean;
  instructorCheckInTime: string | null;
  bookings: BookingRow[];
}

export const INSTRUCTOR_OPEN_BEFORE_MS = 15 * 60 * 1000;
export const INSTRUCTOR_CLOSE_AFTER_MS = 5 * 60 * 1000;

export function instructorCheckInWindowStatus(startTimeStr: string): "open" | "too_early" | "too_late" {
  const start = new Date(startTimeStr).getTime();
  const now = Date.now();
  if (now < start - INSTRUCTOR_OPEN_BEFORE_MS) return "too_early";
  if (now > start + INSTRUCTOR_CLOSE_AFTER_MS) return "too_late";
  return "open";
}

export function minutesUntilOpen(startTimeStr: string): number {
  const start = new Date(startTimeStr).getTime();
  return Math.ceil((start - INSTRUCTOR_OPEN_BEFORE_MS - Date.now()) / 60000);
}

export function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, MMM d");
}

// Time-derived display label + canonical schedule-status key. Pill tone comes
// from classStatusPill (pillMaps) so Upcoming/In-Progress/Completed map the same
// way the rest of the app renders schedule status.
export function classStatusBadge(cls: ClassRow): { label: string; status: string } {
  // Single shared time→state derivation (see scheduleStatus.ts). Map the helper's
  // state to the pill vocabulary this view uses (upcoming→available, live→started).
  const { state, label } = deriveScheduleState(cls.status ?? "available", cls.startTime, cls.endTime);
  const status = state === "upcoming" ? "available" : state === "live" ? "started" : state;
  return { label, status };
}

export function CapacityBar({ enrolled, capacity }: { enrolled: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;
  const color = pct >= 90 ? "bg-pill-danger-dot" : pct >= 60 ? "bg-terracotta" : "bg-sage";
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs font-body text-charcoal/60 mb-1">
        <span>{enrolled} signed up</span>
        <span>{capacity} capacity</span>
      </div>
      <div className="h-1.5 bg-sage/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function MemberAvatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        width={36}
        height={36}
        className="h-9 w-9 rounded-full object-cover border border-sage/20"
        unoptimized
      />
    );
  }
  const initials = name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <div className="h-9 w-9 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center shrink-0">
      <span className="font-body text-xs font-medium text-sage">{initials}</span>
    </div>
  );
}
