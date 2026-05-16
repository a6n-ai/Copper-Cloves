import type { RazorpaySuccessPayload } from "@/lib/razorpayCheckout";
import type { PendingBookingCheckout, PendingPackageCheckout } from "@/lib/pendingRazorpayCheckout";

export async function verifyRazorpayPayment(payload: RazorpaySuccessPayload): Promise<void> {
  const verifyRes = await fetch("/api/payments/razorpay/verify-payment", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      razorpay_order_id: payload.razorpay_order_id,
      razorpay_payment_id: payload.razorpay_payment_id,
      razorpay_signature: payload.razorpay_signature,
    }),
  });
  if (!verifyRes.ok) {
    let msg =
      "Payment could not be verified. If money was debited, contact support with your payment reference.";
    try {
      const errBody = await verifyRes.json();
      if (typeof errBody?.error === "string") msg = errBody.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}

export async function completePendingBookingCheckout(
  pending: PendingBookingCheckout,
  payload: RazorpaySuccessPayload,
): Promise<{ bookingId: string }> {
  if (payload.razorpay_order_id !== pending.razorpayOrderId) {
    throw new Error("Payment order does not match this checkout. Please try booking again.");
  }

  await verifyRazorpayPayment(payload);

  const bookingRes = await fetch("/api/bookings", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      class_schedule_id: pending.class_schedule_id,
      class_name: pending.class_name,
      class_time: pending.class_time,
      user_package_id: pending.user_package_id,
      razorpay_order_id: payload.razorpay_order_id,
      extra_guest_count: pending.extra_guest_count,
      guest_attendees: pending.guest_attendees,
      finance_snapshot: pending.finance_snapshot,
    }),
  });
  if (!bookingRes.ok) {
    let msg = "Failed to save class booking after payment. Please contact support.";
    try {
      const errBody = await bookingRes.json();
      if (typeof errBody?.error === "string") msg = errBody.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const bookingData = (await bookingRes.json()) as { id: string };
  const bookingId = bookingData.id;

  for (const item of pending.cafe_items) {
    if (item.quantity <= 0) continue;
    const foodRes = await fetch("/api/cafe/orders", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cafe_item_id: item.id,
        booking_id: bookingId,
        quantity: item.quantity,
        payment_method: "razorpay",
      }),
    });
    if (!foodRes.ok) {
      let msg = "Booking saved but a café item could not be added.";
      try {
        const errBody = await foodRes.json();
        if (errBody?.error) msg = String(errBody.error);
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
  }

  return { bookingId };
}

export async function completePendingPackageCheckout(
  pending: PendingPackageCheckout,
  payload: RazorpaySuccessPayload,
): Promise<void> {
  if (payload.razorpay_order_id !== pending.razorpayOrderId) {
    throw new Error("Payment order does not match this purchase. Please try again.");
  }

  await verifyRazorpayPayment(payload);

  const purchaseRes = await fetch("/api/user-packages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      package_type_id: pending.package_type_id,
      pass_type: pending.pass_type,
      coupon_code: pending.coupon_code,
      razorpay_order_id: payload.razorpay_order_id,
    }),
  });
  if (!purchaseRes.ok) {
    let msg = "Payment received but package could not be activated. Please contact support.";
    try {
      const errBody = await purchaseRes.json();
      if (typeof errBody?.error === "string") msg = errBody.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}

/** Query params Razorpay appends on `callback_url` redirect. */
export function razorpayPayloadFromSearch(search: string): RazorpaySuccessPayload | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const razorpay_payment_id = params.get("razorpay_payment_id")?.trim() ?? "";
  const razorpay_order_id = params.get("razorpay_order_id")?.trim() ?? "";
  const razorpay_signature = params.get("razorpay_signature")?.trim() ?? "";
  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) return null;
  return { razorpay_payment_id, razorpay_order_id, razorpay_signature };
}
