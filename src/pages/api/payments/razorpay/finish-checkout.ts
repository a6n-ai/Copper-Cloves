import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import {
  finishBookingCheckoutOnServer,
  finishPackageCheckoutOnServer,
} from "@/lib/razorpayServerCheckout";
import type {
  PendingBookingCheckout,
  PendingPackageCheckout,
  PendingRazorpayCheckout,
} from "@/lib/pendingRazorpayCheckout";
import { requestLogger } from "@/lib/logger";

const PURPOSE_BOOKING = "booking" as const;

function isPendingBooking(raw: unknown): raw is PendingBookingCheckout {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as PendingBookingCheckout;
  return (
    o.purpose === PURPOSE_BOOKING &&
    typeof o.razorpayOrderId === "string" &&
    typeof o.class_schedule_id === "string"
  );
}

function isPendingPackage(raw: unknown): raw is PendingPackageCheckout {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as PendingPackageCheckout;
  return (
    o.purpose === "package" &&
    typeof o.razorpayOrderId === "string" &&
    typeof o.package_type_id === "string"
  );
}

function checkoutErrorResponse(msg: string): { status: number; error: string } {
  if (msg === "PAYMENT_NOT_FOUND") {
    return {
      status: 400,
      error:
        "Payment was not found on Razorpay yet. Wait a few seconds and refresh this page, or try booking again.",
    };
  }
  if (msg === "RAZORPAY_NOT_CONFIGURED") {
    return { status: 503, error: "Razorpay is not configured on the server." };
  }
  if (msg === "ALREADY_BOOKED") {
    return { status: 409, error: "You are already booked for this class." };
  }
  if (msg === "CLASS_FULL") {
    return { status: 409, error: "This class is full." };
  }
  if (msg === "PAYMENT_ALREADY_USED" || msg === "RAZORPAY_ORDER_USED") {
    return { status: 409, error: "This payment was already used." };
  }
  if (msg.startsWith("COUPON:")) {
    return { status: 400, error: msg.replace(/^COUPON:/, "") };
  }
  return {
    status: 502,
    error: "Could not complete checkout after payment. Try again or contact support.",
  };
}

/**
 * POST { pending: PendingRazorpayCheckout }
 * Completes booking/package after Razorpay test redirect when browser signature params are missing.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  if (req.method !== "POST") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const userId = (session.user as { id: string }).id;
  const pending = (req.body as { pending?: PendingRazorpayCheckout })?.pending;

  if (!isPendingBooking(pending) && !isPendingPackage(pending)) {
    return res.status(400).json({ error: "Invalid or missing checkout session." });
  }

  try {
    if (pending.purpose === PURPOSE_BOOKING) {
      const { bookingId } = await finishBookingCheckoutOnServer(userId, pending);
      log.info({ userId, bookingId, razorpayOrderId: pending.razorpayOrderId }, "booking checkout finished");
      return res.json({ ok: true, purpose: PURPOSE_BOOKING, bookingId });
    }

    await finishPackageCheckoutOnServer(userId, pending);
    log.info({ userId, razorpayOrderId: pending.razorpayOrderId }, "package checkout finished");
    return res.json({ ok: true, purpose: "package" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error({ err: e, userId, purpose: pending.purpose, razorpayOrderId: pending.razorpayOrderId }, "finish-checkout failed");

    const { status, error } = checkoutErrorResponse(msg);
    return res.status(status).json({ error });
  }
}
