export const CHECKIN_OPEN_BEFORE_MS = 30 * 60 * 1000;
export const CHECKIN_CLOSE_AFTER_MS = 30 * 60 * 1000;

/** True if `now` is within [start-30m, start+30m]. */
export function withinCheckinWindow(start: Date, now: Date = new Date()): boolean {
  const t = now.getTime();
  return (
    t >= start.getTime() - CHECKIN_OPEN_BEFORE_MS && t <= start.getTime() + CHECKIN_CLOSE_AFTER_MS
  );
}

/** Token expiry for a schedule: start + 30m (epoch ms). */
export function checkinTokenExp(start: Date): number {
  return start.getTime() + CHECKIN_CLOSE_AFTER_MS;
}
