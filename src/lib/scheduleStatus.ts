/**
 * Canonical ClassSchedule status sets + the single time→display-state derivation.
 *
 * `ClassSchedule.status` is a Prisma enum: available | inactive | started |
 * completed | cancelled | abandoned. `started` is NEVER persisted — it is a
 * display-only state derived from the wall clock by `deriveScheduleState()`.
 *
 * These constants are the source of truth so visibility, edit-lock, payout
 * eligibility and the live/completed badge can't drift per-surface.
 */

/** Hidden from members/public: admin-paused (`inactive`) + soft-deleted (`cancelled`). */
export const HIDDEN_SCHEDULE_STATUSES = ["cancelled", "inactive"] as const;

/** Surfaced to members/public (everything not hidden). Past/abandoned still show, greyed + unbookable. */
export const VISIBLE_SCHEDULE_STATUSES = ["available", "started", "completed", "abandoned"] as const;

/** Terminal — edit/delete locked. Callers ALSO lock when `end_time < now` (cron may lag). */
export const LOCKED_SCHEDULE_STATUSES = ["completed", "abandoned"] as const;

/** Booking is blocked outright when the schedule is in one of these states. */
export const NON_BOOKABLE_SCHEDULE_STATUSES = ["cancelled", "inactive"] as const;

export function isScheduleVisible(status: string): boolean {
  return !(HIDDEN_SCHEDULE_STATUSES as readonly string[]).includes(status);
}

export type ScheduleDisplayState =
  | "upcoming"
  | "live"
  | "completed"
  | "cancelled"
  | "abandoned"
  | "inactive";

const STATE_LABEL: Record<ScheduleDisplayState, string> = {
  upcoming: "Upcoming",
  live: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  abandoned: "Cancelled",
  inactive: "Hidden",
};

/**
 * Single source for the live/upcoming/completed badge. Stored terminal/admin
 * states win; otherwise (available/started) the state is derived from the clock.
 * Tolerates cron lag — an `available` class whose window has passed reads as
 * `completed`, one inside its window reads as `live`.
 */
export function deriveScheduleState(
  status: string,
  start: Date | string | number,
  end: Date | string | number,
  now: number = Date.now(),
): { state: ScheduleDisplayState; label: string } {
  if (status === "cancelled") return { state: "cancelled", label: STATE_LABEL.cancelled };
  if (status === "abandoned") return { state: "abandoned", label: STATE_LABEL.abandoned };
  if (status === "inactive") return { state: "inactive", label: STATE_LABEL.inactive };
  if (status === "completed") return { state: "completed", label: STATE_LABEL.completed };

  // available | started → derive from window.
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isFinite(startMs) && now < startMs) return { state: "upcoming", label: STATE_LABEL.upcoming };
  if (Number.isFinite(endMs) && now >= endMs) return { state: "completed", label: STATE_LABEL.completed };
  return { state: "live", label: STATE_LABEL.live };
}
