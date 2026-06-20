/**
 * Canonical Booking.status values and the sets that decide seat-holding vs revenue.
 *
 * Booking.status is a free-form string column; these constants are the source of truth.
 * - Seat-holding: counts toward class capacity (confirmed + payment_pending).
 * - Revenue/attendance: only confirmed bookings represent real, paid attendance.
 *
 * payment_pending = gateway-paid booking created up front, awaiting capture.
 * expired         = hold lapsed, Razorpay confirmed no capture, seat released.
 */
export const BOOKING_STATUS = {
  payment_pending: "payment_pending",
  confirmed: "confirmed",
  expired: "expired",
  cancelled: "cancelled",
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

/** Statuses that occupy a seat for capacity purposes. */
export const SEAT_HOLDING_STATUSES = ["confirmed", "payment_pending"] as const;

/**
 * Statuses that occupy a seat for capacity counting AND duplicate-booking checks:
 * seat-holders plus the legacy partner sign-off value (`pending`, pre-payment_pending).
 * Use this everywhere `current_bookings` / `available_spots` are recomputed or a
 * "already booked?" guard runs, so the seat math can't drift between code paths.
 */
export const OCCUPYING_STATUSES = ["confirmed", "payment_pending", "pending"] as const;

export function occupiesSeat(status: string): boolean {
  return (OCCUPYING_STATUSES as readonly string[]).includes(status);
}

/** Statuses that represent real revenue / attendance. */
export const REVENUE_STATUSES = ["confirmed"] as const;

/**
 * Every status a booked class can hold — used by ANY "class history" list
 * (member portal, admin member detail, class ledger). A class a user booked
 * ALWAYS appears in history regardless of payment; payment is a separate pill,
 * not a visibility gate. Order = display priority (most→least active).
 */
export const HISTORY_STATUSES = [
  "confirmed",
  "payment_pending",
  "expired",
  "cancelled",
] as const;

/**
 * Statuses shown on a class roster ("who's coming") — confirmed attendees plus
 * unpaid holds the desk should chase. Excludes expired (seat released) and
 * cancelled. Canonical replacement for the divergent `not: "cancelled"` /
 * `in: [confirmed, payment_pending]` / `confirmed`-only roster filters.
 */
export const ROSTER_STATUSES = ["confirmed", "payment_pending"] as const;

/** Canonical human label per status. */
export function bookingStatusLabel(status: string): string {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "payment_pending":
      return "Unpaid";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ") : "—";
  }
}

export function holdsSeat(status: string): boolean {
  return (SEAT_HOLDING_STATUSES as readonly string[]).includes(status);
}

export function countsAsRevenue(status: string): boolean {
  return (REVENUE_STATUSES as readonly string[]).includes(status);
}

export function inHistory(status: string): boolean {
  return (HISTORY_STATUSES as readonly string[]).includes(status);
}

export function onRoster(status: string): boolean {
  return (ROSTER_STATUSES as readonly string[]).includes(status);
}
