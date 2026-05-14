/** Monday 00:00:00 local time for the ISO week that contains `ref` (week starts Monday). */
export function startOfMondayWeekLocal(ref: Date): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const day = d.getDay(); // 0 Sun … 6 Sat
  const diffFromMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffFromMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfSundayWeekLocal(weekStartMonday: Date): Date {
  const end = new Date(weekStartMonday);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function startOfLocalDay(ref: Date): Date {
  return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
}

/** True if both dates are the same calendar day in local time. */
export function isSameLocalCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Week 1 = the week whose Monday is the first Monday on or after the 1st of the month
 * (same grid as the public Schedule tab).
 */
export function mondayBasedWeekBoundsInMonth(
  year: number,
  monthIndex: number,
  weekNumber1Based: number
): { weekStart: Date; weekEnd: Date } {
  const startOfMonth = new Date(year, monthIndex, 1);
  const firstMonday = new Date(startOfMonth);
  while (firstMonday.getDay() !== 1) {
    firstMonday.setDate(firstMonday.getDate() + 1);
  }
  const weekStart = new Date(
    firstMonday.getFullYear(),
    firstMonday.getMonth(),
    firstMonday.getDate() + (weekNumber1Based - 1) * 7
  );
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = endOfSundayWeekLocal(weekStart);
  return { weekStart, weekEnd };
}

/** Which week number (1…5) in `monthIndex` contains `date`, or null if that Monday sits outside the month grid. */
export function weekNumberContainingDateInMonth(
  year: number,
  monthIndex: number,
  date: Date
): number | null {
  const monday = startOfMondayWeekLocal(date);
  const { weekStart: firstWeekStart } = mondayBasedWeekBoundsInMonth(year, monthIndex, 1);
  const { weekEnd: lastWeekEnd } = mondayBasedWeekBoundsInMonth(year, monthIndex, 5);
  if (monday < firstWeekStart || monday > lastWeekEnd) return null;
  for (let w = 1; w <= 5; w++) {
    const { weekStart, weekEnd } = mondayBasedWeekBoundsInMonth(year, monthIndex, w);
    if (monday >= weekStart && monday <= weekEnd) return w;
  }
  return null;
}

/** Default month/week for booking UI: align with the week that contains `reference`. */
export function defaultPortalWeekSelection(reference: Date = new Date()): {
  year: number;
  monthIndex: number;
  week: number;
} {
  const y = reference.getFullYear();
  const m = reference.getMonth();
  let w = weekNumberContainingDateInMonth(y, m, reference);
  if (w !== null) return { year: y, monthIndex: m, week: w };
  const mon = startOfMondayWeekLocal(reference);
  const my = mon.getFullYear();
  const mm = mon.getMonth();
  w = weekNumberContainingDateInMonth(my, mm, reference) ?? 1;
  return { year: my, monthIndex: mm, week: w };
}
