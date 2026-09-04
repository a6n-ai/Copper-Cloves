/**
 * Studio timezone is fixed IST (UTC+5:30, no DST) — src/lib/notifications/* and
 * dashboard formatters already pin `timeZone: "Asia/Kolkata"` for display. This
 * file is the other direction: turning an IST calendar day (from a date picker)
 * into the correct UTC instant to store, and reading a UTC instant back out as
 * IST calendar parts. Every date picker that means "this IST day" should go
 * through here instead of relying on the browser's local timezone.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export interface IstDateParts {
  year: number;
  month: number; // 0-11
  day: number;
  hour: number;
  minute: number;
}

/** UTC instant of local midnight, IST, for the given calendar day. */
export function istMidnightToUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - IST_OFFSET_MS);
}

/** UTC instant for an explicit IST wall-clock date+time (e.g. a class start time picked as "y-m-d HH:MM IST"). */
export function istDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) - IST_OFFSET_MS);
}

/** UTC instant of end-of-day (23:59:59.999), IST, for the given calendar day. */
export function istEndOfDayToUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day + 1) - IST_OFFSET_MS - 1);
}

/** Read a UTC instant back out as its IST calendar parts. */
export function utcToIstParts(instant: Date): IstDateParts {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** A `Date`'s own (year, month, day) as read by its local getters — the calendar day a date picker cell represents, independent of what that Date's absolute instant is. */
export function localCalendarParts(d: Date): { year: number; month: number; day: number } {
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

/** Reinterpret a date-picker's selected day (browser-local Date, day identity only) as IST midnight. */
export function pickedDayToIstMidnightUtc(picked: Date): Date {
  const { year, month, day } = localCalendarParts(picked);
  return istMidnightToUtc(year, month, day);
}

/** Reinterpret a date-picker's selected day (browser-local Date, day identity only) as IST end-of-day. */
export function pickedDayToIstEndOfDayUtc(picked: Date): Date {
  const { year, month, day } = localCalendarParts(picked);
  return istEndOfDayToUtc(year, month, day);
}
