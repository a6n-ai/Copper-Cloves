import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { logActivity } from "@/lib/activityLog";
import { OCCUPYING_STATUSES } from "@/lib/bookingStatus";
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
import { captureAuthorizedPayment, getRazorpay, razorpayConfigured } from "@/lib/razorpayServer";
import {
  incrementCouponAndRecordRedemption,
  passCategoryForPackageType,
  toFiniteNumber,
  validateAndComputeCoupon,
  type CouponContext,
} from "@/lib/couponHelpers";
import { notifyPackagePurchase } from "@/lib/notifications/notifyPackagePurchase";
import { upsertFriendship } from "@/lib/friendship";
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

  // Capture authorized funds so they settle to the studio. This path runs on
  // redirect/pg_router returns (no browser signature) — the common netbanking/UPI
  // case where the payment is `authorized` and would otherwise auto-void.
  const paidStatus = paid.status != null ? String(paid.status).toLowerCase() : "";
  if (paidStatus === "authorized") {
    try {
      const result = await captureAuthorizedPayment({
        razorpay,
        paymentId: paid.id,
        amountPaise: Math.round(Number(paid.amount ?? 0)),
        currency: paid.currency != null ? String(paid.currency) : "INR",
      });
      paid.status = result.status;
    } catch (capErr) {
      logger.error({ err: capErr, razorpayOrderId: params.razorpayOrderId, paymentId: paid.id }, "razorpay capture failed (sync)");
    }
  }

  await persistVerifiedRazorpayPayment({
    userId: params.userId,
    razorpayOrderId: params.razorpayOrderId,
    razorpayPaymentId: paid.id,
    payment: paid,
  });

  return { razorpayPaymentId: paid.id };
}

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function loadBookableSchedule(tx: TxClient, scheduleId: string) {
  const schedule = await tx.classSchedule.findUnique({
    where: { id: scheduleId },
    include: { class_model: { select: { max_capacity: true, name: true, partner_id: true } } },
  });
  if (!schedule) throw new Error("SCHEDULE_NOT_FOUND");
  if (schedule.status === "cancelled") throw new Error("CLASS_CANCELLED");
  if (schedule.status === "inactive") throw new Error("CLASS_INACTIVE");
  return schedule;
}

async function assertNotAlreadyBooked(tx: TxClient, userId: string, scheduleId: string) {
  const duplicate = await tx.booking.findFirst({
    where: {
      user_id: userId,
      class_schedule_id: scheduleId,
      status: { in: [...OCCUPYING_STATUSES] },
    },
  });
  if (duplicate) throw new Error("ALREADY_BOOKED");
}

async function computeSeatsTaken(tx: TxClient, scheduleId: string): Promise<number> {
  const occupancyRows = await tx.booking.findMany({
    where: { class_schedule_id: scheduleId, status: { in: [...OCCUPYING_STATUSES] } },
    select: { extra_guest_count: true },
  });
  return occupancyRows.reduce(
    (sum, row) => sum + 1 + Math.max(0, row.extra_guest_count ?? 0),
    0,
  );
}

/**
 * How many of the given added-member profile ids already hold a CONFIRMED
 * booking for this schedule — i.e. how many `fulfillAddedMembersAndReconcileSeats`
 * will SKIP (no new seat created) rather than transition/create. Mirrors the
 * skip condition in that function exactly, so credits follow seats actually
 * (about to be) created, not the requested "whole group" count.
 */
async function countAlreadyConfirmedAddedMembers(
  tx: TxClient,
  scheduleId: string,
  memberIds: string[],
): Promise<number> {
  if (memberIds.length === 0) return 0;
  const rows = await tx.booking.findMany({
    where: { class_schedule_id: scheduleId, user_id: { in: memberIds }, status: "confirmed" },
    select: { user_id: true },
  });
  return rows.length;
}

async function assertPackageBookable(tx: TxClient, packageId: string, userId: string) {
  const pkg = await tx.userPackage.findFirst({
    where: { id: packageId, user_id: userId },
    include: { package_type: true },
  });
  if (!pkg?.is_active || pkg.expiration_date <= new Date()) {
    throw new Error("PACKAGE_NOT_ALLOWED");
  }
  if (pkg.package_type?.is_unlimited) throw new Error("PACKAGE_WRONG_TYPE");
}

/**
 * Side-effects that must run whenever a booking becomes confirmed, regardless of
 * whether it was created fresh (legacy) or transitioned from payment_pending:
 * café add-on orders, the one confirmation email (skipped for partner sign-off),
 * and friends/family guest onboarding. Best-effort: never throws.
 */
async function runBookingPostFulfillSideEffects(args: {
  bookingId: string;
  confirmationStatus: string | null;
  pending: PendingBookingCheckout;
  userId: string;
}): Promise<void> {
  const { bookingId, confirmationStatus, pending, userId } = args;

  for (const item of pending.cafe_items) {
    if (item.quantity <= 0) continue;
    await prisma.cafeOrder.create({
      data: {
        user_id: userId,
        cafe_item_id: item.id,
        booking_id: bookingId,
        quantity: item.quantity,
        payment_method: "razorpay",
        order_date: new Date(),
      },
    });
  }

  // Physique 57 bookings notify on instructor confirm, not now.
  if (confirmationStatus !== "pending") {
    await sendBookingConfirmationEmail(bookingId).catch((e) => logger.error({ err: e }, "[booking email]"));
  }
}

/**
 * Create added-member roster rows + auto-friend the booker, then reconcile seat
 * counters from actual rows. Idempotent + best-effort: safe to call on every
 * fulfillment attempt (redirect AND webhook), so a partial first run self-heals.
 * Must run OUTSIDE any booking transaction.
 */
async function fulfillAddedMembersAndReconcileSeats(args: {
  pending: PendingBookingCheckout;
  userId: string;
}): Promise<void> {
  const { pending, userId } = args;
  const addedMemberProfileIds = pending.added_member_profile_ids ?? [];

  if (addedMemberProfileIds.length > 0) {
    const schedule = await prisma.classSchedule.findUnique({
      where: { id: pending.class_schedule_id },
      select: { start_time: true, class_model: { select: { name: true } } },
    });
    // Canonical: the schedule wins; only fall back to the pending snapshot if the
    // schedule somehow can't be loaded.
    const resolvedClassTime = schedule?.start_time.toISOString() || pending.class_time?.trim() || "";
    const resolvedClassName = pending.class_name?.trim() || schedule?.class_model?.name || null;

    for (const memberId of addedMemberProfileIds) {
      try {
        // Up-front model: a payment_pending (or expired) row already exists from
        // createPendingBooking — flip it to confirmed. Fall back to create for
        // legacy bookings made before up-front rows existed.
        const existing = await prisma.booking.findFirst({
          where: {
            user_id: memberId,
            class_schedule_id: pending.class_schedule_id,
            status: { in: [...OCCUPYING_STATUSES] },
          },
          select: { id: true, status: true },
        });
        if (existing) {
          if (existing.status !== "confirmed") {
            await prisma.booking.update({
              where: { id: existing.id },
              data: { status: "confirmed", hold_expires_at: null },
            });
          }
        } else {
          await prisma.booking.create({
            data: {
              user_id: memberId,
              class_schedule_id: pending.class_schedule_id,
              status: "confirmed",
              class_name: resolvedClassName,
              class_time: resolvedClassTime,
              invited_by_user_id: userId,
            },
          });
        }
        await upsertFriendship(prisma, userId, memberId, "invite", "active");
      } catch (e) {
        logger.error({ err: e, invitee: memberId }, "[fulfillAddedMembersAndReconcileSeats] member failed");
      }
    }
  }

  // Reconcile denormalized counters from ACTUAL rows (authoritative + idempotent).
  try {
    const sched = await prisma.classSchedule.findUnique({
      where: { id: pending.class_schedule_id },
      include: { class_model: { select: { max_capacity: true } } },
    });
    if (sched) {
      const cap = sched.capacity ?? sched.class_model?.max_capacity ?? 0;
      if (cap > 0) {
        const seatsTaken = await computeSeatsTaken(prisma, pending.class_schedule_id);
        await prisma.classSchedule.update({
          where: { id: pending.class_schedule_id },
          data: { current_bookings: seatsTaken, available_spots: Math.max(0, cap - seatsTaken) },
        });
      }
    }
  } catch (e) {
    logger.error({ err: e }, "[fulfillAddedMembersAndReconcileSeats] counter reconcile failed");
  }
}

/**
 * Confirm a pre-created payment_pending booking (created up front by create-order):
 * flip to confirmed, link the order, refresh denormalized seat counters, then run the
 * same post-fulfill side-effects as a fresh booking. Idempotent — if already confirmed,
 * side-effects are skipped (they ran on the first transition).
 */
async function confirmPreCreatedBookingFlow(args: {
  userId: string;
  bookingId: string;
  pending: PendingBookingCheckout;
  financeSnap?: unknown;
}): Promise<{ bookingId: string; transitioned: boolean }> {
  const { userId, bookingId, pending, financeSnap } = args;
  const { confirmPendingBookingTx } = await import("@/lib/confirmPendingBooking");

  // 1. Commit the status flip on its OWN transaction. Previously the confirm,
  // order-link, and seat recompute shared one transaction — if linking or the
  // seat update threw, the whole thing rolled back and the booking reverted to
  // payment_pending even though the payment had already been captured/persisted
  // in a separate step (the "payment updated but booking not updated" bug).
  const result = await prisma.$transaction((tx) =>
    confirmPendingBookingTx(tx, bookingId, financeSnap),
  );

  // 2. Best-effort post-confirm: link the order, drop the booker back to one seat
  // (guests/added members get their own rows below), and refresh counters. A
  // failure here leaves the booking CONFIRMED (recoverable) instead of undoing it.
  // Set inside the transaction below when the credit debit falls short; logged
  // via logActivity AFTER the transaction settles (never write off-tx while a
  // tx is still open — matches the existing post-transitioned logActivity call).
  let creditShortfall: {
    userPackageId: string;
    requestedCredits: number;
    creditsToDeduct: number;
  } | null = null;

  if (result.transitioned) {
    try {
      await prisma.$transaction(async (tx) => {
        await linkRazorpayOrderToBookingTx(tx, {
          userId,
          razorpayOrderId: pending.razorpayOrderId,
          bookingId: result.bookingId,
        });
        await tx.booking.update({
          where: { id: result.bookingId },
          data: {
            extra_guest_count: 0,
            // Link the booking to the pass so it reads as a pass booking in history/finance.
            ...(pending.user_package_id ? { user_package_id: pending.user_package_id } : {}),
          },
        });
        // Deduct the booker's pass credit for their own seat. Runs only inside the
        // single `result.transitioned` confirm (guarded by confirmPendingBookingTx's
        // conditional flip), so client-verify + webhook + reconcile can't double-spend.
        // The fresh-booking path decrements at bookings.ts / line ~505; the pre-created
        // path (create-order always pre-reserves the booking) reached neither — this is
        // the class-pass member who paid for a guest/add-on and kept their credit for free.
        // Log-not-throw: the payment is already captured, so a missing credit (out of
        // credits / pkg gone) must not roll the confirmed booking back to payment_pending.
        if (pending.user_package_id) {
          const requestedCredits = pending.credits_to_deduct ?? 1;
          // Credits follow seats actually (about to be) created: a member who
          // already holds a confirmed seat for this schedule is skipped by
          // fulfillAddedMembersAndReconcileSeats below, so covering the "whole
          // group" must not charge for their absent row (mirrors bookings.ts).
          // Filter the booker out of their own added-member list (mirrors
          // createPendingBooking and the fresh-booking path). By this point the
          // booker's own row is already confirmed, so a self-invite would be
          // counted as "already booked" and under-debit the group by one.
          const addedMemberIds = (pending.added_member_profile_ids ?? []).filter((id) => id !== userId);
          const alreadyConfirmed =
            requestedCredits > 1
              ? await countAlreadyConfirmedAddedMembers(tx, pending.class_schedule_id, addedMemberIds)
              : 0;
          const membersInserted = Math.max(0, addedMemberIds.length - alreadyConfirmed);
          const creditsToDeduct = requestedCredits > 1 ? 1 + membersInserted : requestedCredits;
          const upd = await tx.userPackage.updateMany({
            where: {
              id: pending.user_package_id,
              user_id: userId,
              credits_remaining: { gte: creditsToDeduct },
            },
            data: { credits_remaining: { decrement: creditsToDeduct } },
          });
          if (upd.count !== 1) {
            logger.error(
              {
                bookingId: result.bookingId,
                userPackageId: pending.user_package_id,
                userId,
                requestedCredits,
                creditsToDeduct,
                // Debits are all-or-nothing, so the whole attempt is what went
                // untaken — name it as such rather than "shortfall", which reads
                // as a deficit and misleads when creditsToDeduct < requested.
                attemptedCredits: creditsToDeduct,
              },
              "[confirmPreCreatedBookingFlow] pass credit NOT decremented (no credits / package missing) — booking confirmed without credit",
            );
            // Durable marker (log-not-throw is intentional here — payment is already
            // captured, so we must not roll the confirmed booking back). logActivity
            // itself fires after the transaction settles (see below).
            creditShortfall = {
              userPackageId: pending.user_package_id,
              requestedCredits,
              creditsToDeduct,
            };
          }
        }
        const sched = await tx.classSchedule.findUnique({
          where: { id: pending.class_schedule_id },
          include: { class_model: { select: { max_capacity: true } } },
        });
        if (sched) {
          const cap = sched.capacity ?? sched.class_model?.max_capacity ?? 0;
          if (cap > 0) {
            const seatsTaken = await computeSeatsTaken(tx, pending.class_schedule_id);
            await tx.classSchedule.update({
              where: { id: pending.class_schedule_id },
              data: { current_bookings: seatsTaken, available_spots: Math.max(0, cap - seatsTaken) },
            });
          }
        }
      });
    } catch (e) {
      logger.error(
        { err: e, bookingId: result.bookingId },
        "[confirmPreCreatedBookingFlow] post-confirm link/seat failed — booking stays confirmed",
      );
    }

    if (creditShortfall) {
      await logActivity({
        actor: { role: "system", name: "System" },
        action: "booking.credit_shortfall",
        targetProfileId: userId,
        entity: { type: "booking", id: result.bookingId },
        metadata: {
          user_package_id: creditShortfall.userPackageId,
          requested_credits: creditShortfall.requestedCredits,
          credits_to_deduct: creditShortfall.creditsToDeduct,
          attempted_credits: creditShortfall.creditsToDeduct,
        },
      }).catch(() => {});
    }
  }

  if (result.transitioned) {
    const b = await prisma.booking.findUnique({
      where: { id: result.bookingId },
      select: { confirmation_status: true },
    });
    await runBookingPostFulfillSideEffects({
      bookingId: result.bookingId,
      confirmationStatus: b?.confirmation_status ?? null,
      pending,
      userId,
    });
    await logActivity({
      actor: { role: "system", name: "System" },
      action: "booking.confirmed",
      targetProfileId: userId,
      entity: { type: "booking", id: result.bookingId },
      metadata: {
        class_name: pending.class_name ?? undefined,
        changes: [{ field: "status", from: "payment_pending", to: "confirmed" }],
      },
    }).catch(() => {});
  }
  await fulfillAddedMembersAndReconcileSeats({ pending, userId });
  return result;
}

/**
 * Record the coupon redemption for a confirmed booking. Idempotent (one redemption
 * per booking_id) and strictly best-effort: the booking is already paid + confirmed,
 * so a since-exhausted coupon or any error is logged, never thrown.
 */
async function recordBookingCouponRedemption(
  userId: string,
  bookingId: string,
  pending: PendingBookingCheckout,
): Promise<void> {
  const code = pending.coupon_code;
  const ctx = pending.coupon_context;
  if (!code) return;
  if (ctx !== "food" && ctx !== "class_pass" && ctx !== "studio_pass") return;
  const snap = parseFinanceSnapshot(pending.finance_snapshot);
  if (!snap) return;
  const subtotal = snap.classFeeInr + Math.max(0, snap.foodFeeInr - snap.foodDiscountInr);
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.couponRedemption.count({ where: { booking_id: bookingId } });
      if (existing > 0) return; // fulfillment ran before (webhook + reconcile) — don't double-count
      const v = await validateAndComputeCoupon(tx, code, ctx, subtotal, { userId, guestEmail: null });
      if ("error" in v) {
        logger.warn({ bookingId, reason: v.error }, "[coupon] booking redemption skipped — coupon no longer valid");
        return;
      }
      await incrementCouponAndRecordRedemption(tx, v.coupon, v.discountInr, ctx, {
        userId,
        guestEmail: null,
        bookingId,
      });
    });
  } catch (e) {
    logger.error({ err: e, bookingId }, "[coupon] booking redemption record failed (best-effort)");
  }
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
  if (ord.user_package_id != null) {
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

  // If create-order already reserved a pending booking, confirm it (with full
  // side-effects: café orders, email, guest onboarding, seat counters) instead of
  // creating a new one.
  if (ord.booking_id != null) {
    const result = await confirmPreCreatedBookingFlow({
      userId,
      bookingId: ord.booking_id,
      pending,
      financeSnap,
    });
    await recordBookingCouponRedemption(userId, result.bookingId, pending);
    return { bookingId: result.bookingId };
  }

  const guestList = parseGuestAttendees(pending.guest_attendees) ?? [];
  const extraGuests = pending.extra_guest_count;
  const scheduleId = pending.class_schedule_id;
  const packageId = pending.user_package_id;
  // Filter the booker out of their own added-member list, mirroring
  // createPendingBooking. Without this, a member who added themselves by email
  // would have their own just-created confirmed row counted as "already
  // booked", under-debiting the group by one credit.
  const addedMemberProfileIds = (pending.added_member_profile_ids ?? []).filter((id) => id !== userId);

  const booking = await prisma.$transaction(async (tx) => {
    // Serialize concurrent bookings on this schedule (read-then-insert race).
    await tx.$queryRaw`SELECT id FROM class_schedules WHERE id = ${scheduleId} FOR UPDATE`;

    const schedule = await loadBookableSchedule(tx, scheduleId);

    await assertNotAlreadyBooked(tx, userId, scheduleId);

    const cap = schedule.capacity ?? schedule.class_model?.max_capacity ?? 0;
    const seatsTaken = await computeSeatsTaken(tx, scheduleId);
    const spotsToConsume = 1 + extraGuests + addedMemberProfileIds.length;
    if (cap > 0 && seatsTaken + spotsToConsume > cap) throw new Error("CLASS_FULL");

    // Canonical: derive from the booked schedule, never the client-supplied snapshot.
    const resolvedClassTime = schedule.start_time.toISOString();
    const resolvedClassName =
      pending.class_name?.trim() || schedule.class_model?.name || null;

    if (packageId) {
      await assertPackageBookable(tx, packageId, userId);
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
        // Added members get their own booking rows; booker = one seat.
        // The capacity check above still reserves the whole group up front.
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
      const requestedCredits = pending.credits_to_deduct ?? 1;
      // Credits follow seats actually created: added-member rows are created by
      // fulfillAddedMembersAndReconcileSeats AFTER this tx and it skips a member
      // who already holds a confirmed seat for this schedule — covering the
      // "whole group" must not charge for their absent row (mirrors bookings.ts /
      // confirmPreCreatedBookingFlow above).
      const alreadyConfirmed =
        requestedCredits > 1
          ? await countAlreadyConfirmedAddedMembers(tx, scheduleId, addedMemberProfileIds)
          : 0;
      const membersInserted = Math.max(0, addedMemberProfileIds.length - alreadyConfirmed);
      const creditsToDeduct = requestedCredits > 1 ? 1 + membersInserted : requestedCredits;
      const upd = await tx.userPackage.updateMany({
        where: { id: packageId, user_id: userId, credits_remaining: { gte: creditsToDeduct } },
        data: { credits_remaining: { decrement: creditsToDeduct } },
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

  // Café orders, confirmation email, and guest onboarding — shared with the
  // pending-booking confirm path so both flows behave identically.
  await runBookingPostFulfillSideEffects({
    bookingId: booking.id,
    confirmationStatus: booking.confirmation_status,
    pending,
    userId,
  });
  await fulfillAddedMembersAndReconcileSeats({ pending, userId });

  await recordBookingCouponRedemption(userId, booking.id, pending);
  return { bookingId: booking.id };
}

async function resolvePackageCoupon(
  tx: TxClient,
  couponCode: string | null | undefined,
  couponContext: CouponContext,
  subtotal: number,
  userId: string,
): Promise<{ coupon: Coupon | null; discountInr: number }> {
  if (!couponCode?.trim()) {
    return { coupon: null, discountInr: 0 };
  }
  const v = await validateAndComputeCoupon(
    tx,
    couponCode,
    couponContext,
    subtotal,
    { userId, guestEmail: null },
  );
  if ("error" in v) throw new Error(`COUPON:${v.error}`);
  return { coupon: v.coupon, discountInr: v.discountInr };
}

async function assertPaidRazorpayOrderUnused(
  tx: TxClient,
  razorpayOrderId: string,
  userId: string,
) {
  const rpOrder = await tx.razorpayOrder.findFirst({
    where: { razorpay_order_id: razorpayOrderId, user_id: userId },
  });
  if (!rpOrder) throw new Error("RAZORPAY_ORDER_NOT_FOUND");
  if (rpOrder.status !== "paid") throw new Error("PAYMENT_NOT_CONFIRMED");
  if (rpOrder.booking_id != null || rpOrder.user_package_id != null) {
    throw new Error("RAZORPAY_ORDER_USED");
  }
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

    const { coupon, discountInr } = await resolvePackageCoupon(
      tx,
      pending.coupon_code,
      couponContext,
      subtotal,
      userId,
    );

    const payableInr = Math.max(0, subtotal - discountInr);
    if (payableInr > 0) {
      await assertPaidRazorpayOrderUnused(tx, pending.razorpayOrderId, userId);
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
        userPackageId: created.id,
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

  const orderNotes =
    orderRow.notes != null && typeof orderRow.notes === "object"
      ? (orderRow.notes as Record<string, unknown>)
      : null;

  // Pre-created pending booking path: confirm it in place, with full side-effects
  // (café orders, email, guest onboarding, seat counters) reconstructed from order notes.
  if (orderRow.booking_id != null) {
    const pendingForBooking = orderNotes
      ? pendingBookingFromOrderNotes(orderNotes, razorpayOrderId)
      : null;
    if (pendingForBooking) {
      const result = await confirmPreCreatedBookingFlow({
        userId: orderRow.user_id,
        bookingId: orderRow.booking_id,
        pending: pendingForBooking,
        financeSnap: pendingForBooking.finance_snapshot,
      }).catch((e) => {
        if (e instanceof Error && e.message === "PENDING_BOOKING_NOT_FOUND") return null;
        throw e;
      });
      return result?.transitioned ? "booking" : "skipped";
    }
    // No usable notes — fall back to a bare status flip + email (degraded, rare).
    const { confirmPendingBookingTx } = await import("@/lib/confirmPendingBooking");
    const result = await prisma
      .$transaction((tx) => confirmPendingBookingTx(tx, orderRow.booking_id))
      .catch((e) => {
        if (e instanceof Error && e.message === "PENDING_BOOKING_NOT_FOUND") return null;
        throw e;
      });
    if (result?.transitioned) {
      sendBookingConfirmationEmail(result.bookingId).catch(() => {});
      return "booking";
    }
    return "skipped";
  }
  if (orderRow.user_package_id != null) return "skipped";

  const notes = orderNotes;
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
