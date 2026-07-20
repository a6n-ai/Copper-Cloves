/** Persist checkout across Razorpay redirect (test pg_router leaves the book page). */

import type { FinanceSnapshotV1, GuestAttendee } from "@/lib/financeBookingCheckout";

const STORAGE_KEY = "cc_pending_razorpay_checkout_v1";

export type PendingBookingCheckout = {
  purpose: "booking";
  razorpayOrderId: string;
  class_schedule_id: string;
  class_name: string | null;
  class_time: string | null;
  user_package_id: string | null;
  extra_guest_count: number;
  guest_attendees: GuestAttendee[];
  added_member_profile_ids: string[];
  finance_snapshot: FinanceSnapshotV1;
  cafe_items: { id: string; quantity: number }[];
  /** Class-pass credits to spend on this booking: 1 (just the booker) or 1 + added-member count (whole group). Server-validated; absent on pre-feature cached payloads. */
  credits_to_deduct?: number;
  /** Coupon applied to this booking; re-validated + recorded server-side at fulfillment. */
  coupon_code?: string | null;
  /** Coupon context the client matched against (`food` | `class_pass` | `studio_pass`). */
  coupon_context?: string | null;
  savedAt: number;
};

export type PendingPackageCheckout = {
  purpose: "package";
  razorpayOrderId: string;
  package_type_id: string;
  pass_type: "studio_pass" | "class_pass";
  coupon_code?: string;
  savedAt: number;
};

export type PendingRazorpayCheckout = PendingBookingCheckout | PendingPackageCheckout;

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function savePendingRazorpayCheckout(payload: PendingRazorpayCheckout): void {
  const s = storage();
  if (!s) return;
  s.setItem(STORAGE_KEY, JSON.stringify({ ...payload, savedAt: Date.now() }));
}

export function loadPendingRazorpayCheckout(): PendingRazorpayCheckout | null {
  const s = storage();
  if (!s) return null;
  const raw = s.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingRazorpayCheckout;
    if (!parsed?.purpose || !parsed.razorpayOrderId) return null;
    if (Date.now() - (parsed.savedAt ?? 0) > 2 * 60 * 60 * 1000) {
      s.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingRazorpayCheckout(): void {
  const s = storage();
  if (!s) return;
  s.removeItem(STORAGE_KEY);
}

export function buildRazorpayReturnUrl(purpose: "booking" | "package"): string {
  if (typeof window === "undefined") return "";
  const base = window.location.origin.replace(/\/$/, "");
  return `${base}/api/payments/razorpay/callback-redirect?purpose=${purpose}`;
}
