import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { sendBookingConfirmationEmail } from "@/lib/notifications/sendBookingEmail";
import {
  expectedBookingCheckoutPaise,
  parseFinanceSnapshot,
  parseGuestAttendees,
  snapshotTotalsConsistent,
} from "@/lib/financeBookingCheckout";
import {
  ensureRazorpayOrderRowForUser,
  linkRazorpayOrderToBookingTx,
  linkRazorpayOrderToUserPackageTx,
  persistVerifiedRazorpayPayment,
} from "@/lib/razorpayPersistence";
import { getRazorpay, razorpayConfigured } from "@/lib/razorpayServer";
import {
  incrementCouponAndRecordRedemption,
  passCategoryForPackageType,
  toFiniteNumber,
  validateAndComputeCoupon,
  type CouponContext,
} from "@/lib/couponHelpers";
import { notifyPackagePurchase } from "@/lib/notifications/notifyPackagePurchase";
import { onboardGuestsForBooking } from "@/lib/guestOnboarding";
import type { Coupon } from "@/generated/prisma/client";
import type { PendingBookingCheckout, PendingPackageCheckout } from "@/lib/pendingRazorpayCheckout";
import {
  pendingBookingFromOrderNotes,
  pendingPackageFromOrderNotes,
} from "@/lib/pendingRazorpayCheckoutServer";

type RazorpayPaymentRow = {
  id?: string;
  status?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  method?: string | null;
};

function paymentItems(raw: unknown): RazorpayPaymentRow[] {
  if (Array.isArray(raw)) return raw as RazorpayPaymentRow[];
  if (raw && typeof raw === "object") {
    const o = raw as { items?: unknown };
    if (Array.isArray(o.items)) return o.items as RazorpayPaymentRow[];
  }
  return [];
}

/** Confirm payment via Razorpay API (no browser signature) — for test redirect / pg_router returns. */
export async function syncCapturedPaymentForOrder(params: {
  userId: string;
  razorpayOrderId: string;
}): Promise<{ razorpayPaymentId: string }> {
  if (!razorpayConfigured()) {
    throw new Error("RAZORPAY_NOT_CONFIGURED");
  }
  const razorpay = getRazorpay();
  await ensureRazorpayOrderRowForUser({
    userId: params.userId,
    razorpayOrderId: params.razorpayOrderId,
    razorpay,
  });

  const raw = await razorpay.orders.fetchPayments(params.razorpayOrderId);
  const items = paymentItems(raw);
  const paid = items.find((p) => {
    const st = p.status != null ? String(p.status).toLowerCase() : "";
    return st === "captured" || st === "authorized";
  });
  if (!paid?.id) {
    throw new Error("PAYMENT_NOT_FOUND");
  }

  await persistVerifiedRazorpayPayment({
    userId: params.userId,
    razorpayOrderId: params.razorpayOrderId,
    razorpayPaymentId: paid.id,
    payment: paid,
  });

  return { razorpayPaymentId: paid.id };
}

export async function finishBookingCheckoutOnServer(
  userId: string,
  pending: PendingBookingCheckout,
  opts?: { skipPaymentSync?: boolean },
): Promise<{ bookingId: string }> {
  const financeSnap = parseFinanceSnapshot(pending.finance_snapshot);
  if (!financeSnap || !snapshotTotalsConsistent(financeSnap)) {
    throw new Error("INVALID_FINANCE_SNAPSHOT");
  }

  const expectedPaise = expectedBookingCheckoutPaise(financeSnap.totalInr);
  let ord = await prisma.razorpayOrder.findFirst({
    where: { razorpay_order_id: pending.razorpayOrderId, user_id: userId },
  });

  if (!opts?.skipPaymentSync) {
    await syncCapturedPaymentForOrder({
      userId,
      razorpayOrderId: pending.razorpayOrderId,
    });
    ord = await prisma.razorpayOrder.findFirst({
      where: { razorpay_order_id: pending.razorpayOrderId, user_id: userId },
    });
  }

  if (!ord || ord.status !== "paid" || ord.amount_paise !== expectedPaise) {
    throw new Error("PAYMENT_ORDER_INVALID");
  }
  if (ord.booking_id != null || ord.user_package_id != null) {
    throw new Error("PAYMENT_ALREADY_USED");
  }

  // Order ownership already validated above (findFirst by user_id+order); payment table no longer carries user_id.
  const verified = await prisma.razorpayPayment.findFirst({
    where: {
      razorpay_order_id: pending.razorpayOrderId,
      status: { in: ["captured", "authorized"] },
    },
  });
  if (!verified) {
    throw new Error("PAYMENT_NOT_FOUND");
  }

  const guestList = parseGuestAttendees(pending.guest_attendees) ?? [];
  const extraGuests = pending.extra_guest_count;
  const scheduleId = pending.class_schedule_id;
  const packageId = pending.user_package_id;

  const booking = await prisma.$transaction(async (tx) => {
    const schedule = await tx.classSchedule.findUnique({
      where: { id: scheduleId },
      include: { class_model: { select: { max_capacity: true, name: true, partner_id: true } } },
    });
    if (!schedule) throw new Error("SCHEDULE_NOT_FOUND");
    if (schedule.status === "cancelled") throw new Error("CLASS_CANCELLED");
    if (schedule.status === "inactive") throw new Error("CLASS_INACTIVE");

    const duplicate = await tx.booking.findFirst({
      where: {
        user_id: userId,
        class_schedule_id: scheduleId,
        status: { in: ["confirmed", "pending"] },
      },
    });
    if (duplicate) throw new Error("ALREADY_BOOKED");

    const cap = schedule.capacity ?? schedule.class_model?.max_capacity ?? 0;
    const occupancyRows = await tx.booking.findMany({
      where: { class_schedule_id: scheduleId, status: { in: ["confirmed", "pending"] } },
      select: { extra_guest_count: true },
    });
    const seatsTaken = occupancyRows.reduce(
      (sum, row) => sum + 1 + Math.max(0, row.extra_guest_count ?? 0),
      0,
    );
    const spotsToConsume = 1 + extraGuests;
    if (cap > 0 && seatsTaken + spotsToConsume > cap) throw new Error("CLASS_FULL");

    const resolvedClassTime =
      pending.class_time?.trim() || schedule.start_time.toISOString();
    const resolvedClassName =
      pending.class_name?.trim() || schedule.class_model?.name || null;

    if (packageId) {
      const pkg = await tx.userPackage.findFirst({
        where: { id: packageId, user_id: userId },
        include: { package_type: true },
      });
      if (!pkg?.is_active || pkg.expiration_date <= new Date()) {
        throw new Error("PACKAGE_NOT_ALLOWED");
      }
      if (pkg.package_type?.is_unlimited) throw new Error("PACKAGE_WRONG_TYPE");
    }

    const booker = await tx.profile.findUnique({ where: { id: userId }, select: { email: true } });

    const created = await tx.booking.create({
      data: {
        user_id: userId,
        class_schedule_id: scheduleId,
        user_package_id: packageId,
        class_name: resolvedClassName,
        class_time: resolvedClassTime,
        email: booker?.email ?? null,
        status: "confirmed",
        // Partner-run classes await partner sign-off before confirmation.
        confirmation_status: schedule.class_model?.partner_id ? "pending" : null,
        // Guests get their own roster rows (process-guests); booker = one seat.
        // The capacity check above still reserves 1 + guests up front.
        extra_guest_count: 0,
        guest_attendees: guestList.length > 0 ? guestList : undefined,
        finance_snapshot: financeSnap,
      },
    });

    await linkRazorpayOrderToBookingTx(tx, {
      userId,
      razorpayOrderId: pending.razorpayOrderId,
      bookingId: created.id,
    });

    if (packageId) {
      const upd = await tx.userPackage.updateMany({
        where: { id: packageId, user_id: userId, credits_remaining: { gte: 1 } },
        data: { credits_remaining: { decrement: 1 } },
      });
      if (upd.count !== 1) throw new Error("NO_CREDITS");
    }

    const newOccupiedSeats = seatsTaken + spotsToConsume;
    if (cap > 0) {
      await tx.classSchedule.update({
        where: { id: scheduleId },
        data: {
          current_bookings: newOccupiedSeats,
          available_spots: Math.max(0, cap - newOccupiedSeats),
        },
      });
    }

    return created;
  });

  for (const item of pending.cafe_items) {
    if (item.quantity <= 0) continue;
    await prisma.cafeOrder.create({
      data: {
        user_id: userId,
        cafe_item_id: item.id,
        booking_id: booking.id,
        quantity: item.quantity,
        payment_method: "razorpay",
        order_date: new Date(),
      },
    });
  }

  // Physique 57 bookings notify on instructor confirm, not now.
  // Same dedicated confirmation email as /api/bookings, so redirect/webhook
  // fulfilled bookings also get exactly one correct email.
  if (booking.confirmation_status !== "pending") {
    await sendBookingConfirmationEmail(booking.id).catch((e) => logger.error({ err: e }, "[booking email]"));
  }

  // Onboard friends & family guests here too: this path runs for finish-checkout
  // (redirect return with no payload) and the webhook backup — neither of which
  // execute the client. Idempotent + best-effort so it never fails fulfillment.
  if (guestList.length > 0) {
    await onboardGuestsForBooking({
      guests: guestList,
      classScheduleId: scheduleId,
      bookerId: userId,
    }).catch((e) => logger.error({ err: e }, "[onboardGuestsForBooking] finishBookingCheckoutOnServer"));
  }

  return { bookingId: booking.id };
}

export async function finishPackageCheckoutOnServer(
  userId: string,
  pending: PendingPackageCheckout,
  opts?: { skipPaymentSync?: boolean },
): Promise<void> {
  if (!opts?.skipPaymentSync) {
    await syncCapturedPaymentForOrder({
      userId,
      razorpayOrderId: pending.razorpayOrderId,
    });
  }

  const userPackage = await prisma.$transaction(async (tx) => {
    const packageType = await tx.packageType.findUnique({
      where: { id: pending.package_type_id },
    });
    if (!packageType) throw new Error("NOT_FOUND");

    // Authoritative pass category from the package (type column, then is_unlimited),
    // not the client-sent pass_type — keeps coupon matching correct.
    const pass = passCategoryForPackageType(packageType);
    const couponContext: CouponContext = pass;

    const subtotal = toFiniteNumber(packageType.price);
    if (!Number.isFinite(subtotal) || subtotal <= 0) throw new Error("BAD_PRICE");

    let coupon: Coupon | null = null;
    let discountInr = 0;
    if (pending.coupon_code?.trim()) {
      const v = await validateAndComputeCoupon(
        tx,
        pending.coupon_code,
        couponContext,
        subtotal,
        { userId, guestEmail: null },
      );
      if ("error" in v) throw new Error(`COUPON:${v.error}`);
      coupon = v.coupon;
      discountInr = v.discountInr;
    }

    const payableInr = Math.max(0, subtotal - discountInr);
    if (payableInr > 0) {
      const rpOrder = await tx.razorpayOrder.findFirst({
        where: { razorpay_order_id: pending.razorpayOrderId, user_id: userId },
      });
      if (!rpOrder) throw new Error("RAZORPAY_ORDER_NOT_FOUND");
      if (rpOrder.status !== "paid") throw new Error("PAYMENT_NOT_CONFIRMED");
      if (rpOrder.booking_id != null || rpOrder.user_package_id != null) {
        throw new Error("RAZORPAY_ORDER_USED");
      }
    }

    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + (packageType.duration_months ?? 1));

    const created = await tx.userPackage.create({
      data: {
        user_id: userId,
        package_type_id: pending.package_type_id,
        credits_remaining: packageType.is_unlimited ? null : (packageType.class_count ?? null),
        credits_total: packageType.is_unlimited ? null : (packageType.class_count ?? null),
        expiration_date: expirationDate,
        is_active: true,
        pass_type: pass,
        coupon_id: coupon?.id ?? null,
        purchase_discount_inr: discountInr > 0 ? discountInr : null,
      },
      include: { package_type: true },
    });

    await tx.profile.update({
      where: { id: userId },
      data: { pass_type: pass },
    });

    if (coupon && discountInr > 0) {
      await incrementCouponAndRecordRedemption(tx, coupon, discountInr, couponContext, {
        userId,
        guestEmail: null,
      });
    }

    if (payableInr > 0) {
      await linkRazorpayOrderToUserPackageTx(tx, {
        userId,
        razorpayOrderId: pending.razorpayOrderId,
        userPackageId: created.id,
      });
    }

    return created;
  });

  await notifyPackagePurchase({
    userId,
    packageType: userPackage.package_type,
    expirationDate: userPackage.expiration_date,
  }).catch((e) => logger.error({ err: e }, "notifyPackagePurchase"));
}

/**
 * Production webhook path: order is paid + checkout context stored on `razorpay_orders.notes`.
 * Idempotent — no-op if booking/package already linked.
 */
export async function fulfillCheckoutFromPaidOrder(
  razorpayOrderId: string,
): Promise<"booking" | "package" | "skipped" | "none"> {
  const orderRow = await prisma.razorpayOrder.findUnique({
    where: { razorpay_order_id: razorpayOrderId },
  });
  if (!orderRow || orderRow.status !== "paid") return "none";
  if (orderRow.booking_id != null || orderRow.user_package_id != null) return "skipped";

  const notes =
    orderRow.notes != null && typeof orderRow.notes === "object"
      ? (orderRow.notes as Record<string, unknown>)
      : null;
  if (!notes) return "none";

  const userId = orderRow.user_id;

  const bookingPending = pendingBookingFromOrderNotes(notes, razorpayOrderId);
  if (bookingPending) {
    await finishBookingCheckoutOnServer(userId, bookingPending, { skipPaymentSync: true });
    return "booking";
  }

  const packagePending = pendingPackageFromOrderNotes(notes, razorpayOrderId);
  if (packagePending) {
    await finishPackageCheckoutOnServer(userId, packagePending, { skipPaymentSync: true });
    return "package";
  }

  return "none";
}
