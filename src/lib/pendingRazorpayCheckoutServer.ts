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

/** Clamp guest count to a valid non-negative integer ≤ 20, defaulting out-of-range to 0. */
function normalizeExtraGuestCount(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 20) return 0;
  return n;
}

/** Parse a single cafe_items row; returns null when the row is invalid or has zero quantity. */
function parseCafeItemRow(row: unknown): { id: string; quantity: number } | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const quantity = Number(r.quantity);
  if (!id || !Number.isInteger(quantity) || quantity < 0) return null;
  if (quantity <= 0) return null;
  return { id, quantity };
}

/** Collect valid, positive-quantity cafe items from a raw payload field. */
function parseCafeItems(raw: unknown): { id: string; quantity: number }[] {
  const cafe_items: { id: string; quantity: number }[] = [];
  if (Array.isArray(raw)) {
    for (const row of raw) {
      const item = parseCafeItemRow(row);
      if (item) cafe_items.push(item);
    }
  }
  return cafe_items;
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

  const extra_guest_count = normalizeExtraGuestCount(o.extra_guest_count);

  const guests = parseGuestAttendees(o.guest_attendees);
  if (guests === null) return null;
  if (guests.length !== extra_guest_count) return null;

  const cafe_items = parseCafeItems(o.cafe_items);

  const added_member_profile_ids: string[] = [];
  if (Array.isArray(o.added_member_profile_ids)) {
    for (const id of o.added_member_profile_ids) {
      if (typeof id === "string" && id.trim()) {
        added_member_profile_ids.push(id.trim());
      }
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
    added_member_profile_ids,
    finance_snapshot,
    cafe_items,
    coupon_code:
      typeof o.coupon_code === "string" && o.coupon_code.trim() ? o.coupon_code.trim() : null,
    coupon_context:
      typeof o.coupon_context === "string" && o.coupon_context.trim()
        ? o.coupon_context.trim()
        : null,
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
