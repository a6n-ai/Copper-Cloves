interface StreakState {
  current_streak: number;
  longest_streak: number;
  last_class_date: Date | null;
}

/**
 * Returns updated streak values after a check-in, or null if this user already
 * checked in today (streak shouldn't be incremented twice on the same calendar day).
 */
export function calculateStreakUpdate(
  state: StreakState,
  checkInDate: Date,
): { current_streak: number; longest_streak: number; last_class_date: Date } | null {
  const todayStart = new Date(
    checkInDate.getFullYear(),
    checkInDate.getMonth(),
    checkInDate.getDate(),
  );

  if (state.last_class_date) {
    const lastStart = new Date(
      state.last_class_date.getFullYear(),
      state.last_class_date.getMonth(),
      state.last_class_date.getDate(),
    );
    const daysDiff = Math.round(
      (todayStart.getTime() - lastStart.getTime()) / 86_400_000,
    );

    if (daysDiff === 0) return null; // already counted today

    const newCurrent =
      daysDiff === 1 ? state.current_streak + 1 : 1;
    const newLongest = Math.max(newCurrent, state.longest_streak);
    return { current_streak: newCurrent, longest_streak: newLongest, last_class_date: checkInDate };
  }

  // First ever check-in
  return { current_streak: 1, longest_streak: Math.max(1, state.longest_streak), last_class_date: checkInDate };
}
