import { parseFinanceSnapshot, parseGuestAttendees } from "@/lib/financeBookingCheckout";
import type { PendingBookingCheckout, PendingPackageCheckout } from "@/lib/pendingRazorpayCheckout";

/** Validate booking body from create-order before the Razorpay order id exists. */
export function parsePendingBookingBody(raw: unknown): Omit<
  PendingBookingCheckout,
  "purpose" | "razorpayOrderId" | "savedAt"
> | null {
  const parsed = parsePendingBookingPayload(raw, "__pending__");
  if (!parsed) return null;
  const { purpose: _p, razorpayOrderId: _o, savedAt: _s, ...rest } = parsed;
  return rest;
}

/** Validate booking checkout payload from create-order (before Razorpay order id exists). */
export function parsePendingBookingPayload(
  raw: unknown,
  razorpayOrderId: string,
): PendingBookingCheckout | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const finance_snapshot = parseFinanceSnapshot(o.finance_snapshot);
  if (!finance_snapshot) return null;

  const class_schedule_id =
    typeof o.class_schedule_id === "string" ? o.class_schedule_id.trim() : "";
  if (!class_schedule_id) return null;

  let extra_guest_count = Number(o.extra_guest_count);
  if (!Number.isInteger(extra_guest_count) || extra_guest_count < 0 || extra_guest_count > 20) {
    extra_guest_count = 0;
  }

  const guests = parseGuestAttendees(o.guest_attendees);
  if (guests === null) return null;
  if (guests.length !== extra_guest_count) return null;

  const cafe_items: { id: string; quantity: number }[] = [];
  if (Array.isArray(o.cafe_items)) {
    for (const row of o.cafe_items) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.trim() : "";
      const quantity = Number(r.quantity);
      if (!id || !Number.isInteger(quantity) || quantity < 0) continue;
      if (quantity > 0) cafe_items.push({ id, quantity });
    }
  }

  return {
    purpose: "booking",
    razorpayOrderId,
    class_schedule_id,
    class_name: typeof o.class_name === "string" ? o.class_name : null,
    class_time: typeof o.class_time === "string" ? o.class_time : null,
    user_package_id:
      o.user_package_id != null && String(o.user_package_id).trim()
        ? String(o.user_package_id).trim()
        : null,
    extra_guest_count,
    guest_attendees: guests,
    finance_snapshot,
    cafe_items,
    savedAt: Date.now(),
  };
}

export function pendingPackageFromOrderNotes(
  notes: Record<string, unknown>,
  razorpayOrderId: string,
): PendingPackageCheckout | null {
  if (notes.purpose !== "package") return null;
  const package_type_id =
    typeof notes.package_type_id === "string" ? notes.package_type_id.trim() : "";
  if (!package_type_id) return null;
  const pass_type = notes.pass_type === "studio_pass" ? "studio_pass" : "class_pass";
  const coupon_code =
    typeof notes.coupon_code === "string" && notes.coupon_code.trim()
      ? notes.coupon_code.trim()
      : undefined;
  return {
    purpose: "package",
    razorpayOrderId,
    package_type_id,
    pass_type,
    coupon_code,
    savedAt: Date.now(),
  };
}

export function pendingBookingFromOrderNotes(
  notes: Record<string, unknown>,
  razorpayOrderId: string,
): PendingBookingCheckout | null {
  if (notes.purpose !== "booking") return null;
  return parsePendingBookingPayload(notes.pending_checkout, razorpayOrderId);
}
