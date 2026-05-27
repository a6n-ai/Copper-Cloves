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

function isPendingBooking(raw: unknown): raw is PendingBookingCheckout {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as PendingBookingCheckout;
  return (
    o.purpose === "booking" &&
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
    if (pending.purpose === "booking") {
      const { bookingId } = await finishBookingCheckoutOnServer(userId, pending);
      log.info({ userId, bookingId, razorpayOrderId: pending.razorpayOrderId }, "booking checkout finished");
      return res.json({ ok: true, purpose: "booking", bookingId });
    }

    await finishPackageCheckoutOnServer(userId, pending);
    log.info({ userId, razorpayOrderId: pending.razorpayOrderId }, "package checkout finished");
    return res.json({ ok: true, purpose: "package" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error({ err: e, userId, purpose: pending.purpose, razorpayOrderId: pending.razorpayOrderId }, "finish-checkout failed");

    if (msg === "PAYMENT_NOT_FOUND") {
      return res.status(400).json({
        error:
          "Payment was not found on Razorpay yet. Wait a few seconds and refresh this page, or try booking again.",
      });
    }
    if (msg === "RAZORPAY_NOT_CONFIGURED") {
      return res.status(503).json({ error: "Razorpay is not configured on the server." });
    }
    if (msg === "ALREADY_BOOKED") {
      return res.status(409).json({ error: "You are already booked for this class." });
    }
    if (msg === "CLASS_FULL") {
      return res.status(409).json({ error: "This class is full." });
    }
    if (msg === "PAYMENT_ALREADY_USED" || msg === "RAZORPAY_ORDER_USED") {
      return res.status(409).json({ error: "This payment was already used." });
    }
    if (msg.startsWith("COUPON:")) {
      return res.status(400).json({ error: msg.replace(/^COUPON:/, "") });
    }

    return res.status(502).json({
      error: "Could not complete checkout after payment. Try again or contact support.",
    });
  }
}
