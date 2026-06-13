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

/** Statuses that represent real revenue / attendance. */
export const REVENUE_STATUSES = ["confirmed"] as const;

export function holdsSeat(status: string): boolean {
  return (SEAT_HOLDING_STATUSES as readonly string[]).includes(status);
}

export function countsAsRevenue(status: string): boolean {
  return (REVENUE_STATUSES as readonly string[]).includes(status);
}
