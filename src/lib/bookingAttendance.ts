/** Check-in opens 15 minutes before class start, closes 10 minutes after start (see product spec). */
export const CHECK_IN_OPEN_BEFORE_MS = 15 * 60 * 1000;
export const CHECK_IN_CLOSE_AFTER_MS = 10 * 60 * 1000;

export function checkInWindowBounds(start: Date) {
  const t = start.getTime();
  return { open: t - CHECK_IN_OPEN_BEFORE_MS, close: t + CHECK_IN_CLOSE_AFTER_MS };
}

export function canCheckInNow(classStart: Date, now: Date = new Date()): boolean {
  const { open, close } = checkInWindowBounds(classStart);
  const n = now.getTime();
  return n >= open && n <= close;
}

export function checkInOutcomeFromTimes(
  classStart: Date,
  checkInAt: Date
): "on_time" | "late" {
  return checkInAt.getTime() <= classStart.getTime() ? "on_time" : "late";
}
