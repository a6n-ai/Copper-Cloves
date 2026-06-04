import type { NextApiRequest, NextApiResponse } from "next";
import { CrmTriggerType } from "@/lib/crmTriggerTypes";
import prisma from "@/lib/prisma";
import { buildBookingCrmVariables, dispatchCrmEmailTriggers } from "@/lib/notifications/crmTemplatedDispatch";
import { sendBookingConfirmationEmail } from "@/lib/notifications/sendBookingEmail";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import {
  canCheckInNow,
  checkInOutcomeFromTimes,
} from "@/lib/bookingAttendance";
import { reconcileNoShowsGlobally } from "@/lib/bookingReconcile";
import { linkRazorpayOrderToBookingTx } from "@/lib/razorpayPersistence";
import { onboardGuestsForBooking } from "@/lib/guestOnboarding";
import {
  expectedBookingCheckoutPaise,
  parseFinanceSnapshot,
  parseGuestAttendees,
  snapshotTotalsConsistent,
} from "@/lib/financeBookingCheckout";
import { requestLogger } from "@/lib/logger";

type BookingsLog = ReturnType<typeof requestLogger>;
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function handleGet(req: NextApiRequest, res: NextApiResponse, userId: string) {
  const { status, limit, days } = req.query;
  await reconcileNoShowsGlobally(prisma);
  const where: Record<string, unknown> = { user_id: userId };
  if (status) {
    where.status = String(status) === "active"
      ? { in: ["confirmed", "pending"] }
      : String(status);
  }
  if (days) {
    const from = new Date();
    from.setDate(from.getDate() - Number(days));
    where.booking_date = { gte: from };
  }
  const bookings = await prisma.booking.findMany({
    where,
    include: {
      class_schedule: {
        include: { class_model: true, instructor: true },
      },
      user_package: { include: { package_type: true } },
    },
    ...(limit ? { take: Number(limit) } : {}),
  });

  const startMs = (b: (typeof bookings)[0]) => {
    const fromSched = b.class_schedule?.start_time?.getTime();
    if (fromSched != null && !Number.isNaN(fromSched)) return fromSched;
    if (b.class_time) {
      const t = new Date(b.class_time).getTime();
      if (!Number.isNaN(t)) return t;
    }
    return new Date(b.booking_date).getTime();
  };

  bookings.sort((a, b) => startMs(a) - startMs(b));

  return res.json(bookings);
}

// Pre-flight validation of the paid Razorpay order before the booking tx runs.
// Returns an error response payload, or null when the order is valid.
async function validatePaidOrder(
  userId: string,
  rpOrderId: string,
  financeSnap: ReturnType<typeof parseFinanceSnapshot>,
): Promise<{ status: number; error: string } | null> {
  if (!financeSnap || !snapshotTotalsConsistent(financeSnap)) {
    return { status: 400, error: "Valid finance totals are required for online payment." };
  }
  const expectedPaise = expectedBookingCheckoutPaise(financeSnap.totalInr);
  const ord = await prisma.razorpayOrder.findFirst({
    where: { razorpay_order_id: rpOrderId, user_id: userId },
  });
  if (!ord) return { status: 400, error: "Payment order not found" };
  if (ord.status !== "paid") return { status: 400, error: "Payment is not confirmed yet" };
  if (ord.booking_id != null || ord.user_package_id != null) {
    return { status: 400, error: "This payment was already used" };
  }
  if (ord.amount_paise !== expectedPaise) {
    return { status: 400, error: "Paid amount does not match checkout totals" };
  }
  return null;
}

async function assertPackageBookable(tx: TxClient, packageId: string, userId: string) {
  const pkg = await tx.userPackage.findFirst({
    where: { id: packageId, user_id: userId },
    include: { package_type: true },
  });
  if (!pkg) throw new Error("PACKAGE_NOT_ALLOWED");
  if (!pkg.is_active) throw new Error("PACKAGE_INACTIVE");
  if (pkg.expiration_date <= new Date()) throw new Error("PACKAGE_EXPIRED");
  if (pkg.package_type?.is_unlimited) throw new Error("PACKAGE_WRONG_TYPE");
}

type CreateBookingArgs = {
  userId: string;
  userEmail: string | null;
  scheduleId: string;
  packageId: string | null;
  rpOrderId: string | null;
  className: string | null | undefined;
  classTime: string | null | undefined;
  extraGuests: number;
  guestList: NonNullable<ReturnType<typeof parseGuestAttendees>>;
  financeSnap: ReturnType<typeof parseFinanceSnapshot>;
};

function createBookingTx(args: CreateBookingArgs) {
  return prisma.$transaction(async (tx) => {
    const schedule = await tx.classSchedule.findUnique({
      where: { id: args.scheduleId },
      include: { class_model: { select: { max_capacity: true, name: true, partner_id: true } } },
    });

    if (!schedule) throw new Error("SCHEDULE_NOT_FOUND");
    if (schedule.status === "cancelled") throw new Error("CLASS_CANCELLED");
    if (schedule.status === "inactive") throw new Error("CLASS_INACTIVE");

    const duplicate = await tx.booking.findFirst({
      where: {
        user_id: args.userId,
        class_schedule_id: args.scheduleId,
        status: { in: ["confirmed", "pending"] },
      },
    });
    if (duplicate) throw new Error("ALREADY_BOOKED");

    const cap = schedule.capacity ?? schedule.class_model?.max_capacity ?? 0;
    const occupancyRows = await tx.booking.findMany({
      where: {
        class_schedule_id: args.scheduleId,
        status: { in: ["confirmed", "pending"] },
      },
      select: { extra_guest_count: true },
    });
    const seatsTaken = occupancyRows.reduce(
      (sum, row) => sum + 1 + Math.max(0, row.extra_guest_count ?? 0),
      0,
    );

    const spotsToConsume = 1 + args.extraGuests;
    if (cap > 0 && seatsTaken + spotsToConsume > cap) throw new Error("CLASS_FULL");

    const resolvedClassTime = args.classTime ?? schedule.start_time.toISOString();
    const resolvedClassName = args.className?.trim() || schedule.class_model?.name || null;

    if (args.packageId) {
      await assertPackageBookable(tx, args.packageId, args.userId);
    }

    const created = await tx.booking.create({
      data: {
        user_id: args.userId,
        class_schedule_id: args.scheduleId,
        user_package_id: args.packageId,
        class_name: resolvedClassName,
        class_time: resolvedClassTime,
        email: args.userEmail,
        status: "confirmed",
        // Partner-run classes need the partner to sign off before the
        // member's booking is confirmed (and the confirmation email sent).
        confirmation_status: schedule.class_model?.partner_id ? "pending" : null,
        // Guests get their own roster rows (see /api/bookings/process-guests),
        // so the booker counts as one seat here. The capacity check below
        // still reserves 1 + guests up front so the group is guaranteed.
        extra_guest_count: 0,
        guest_attendees: args.guestList.length > 0 ? args.guestList : undefined,
        finance_snapshot: args.financeSnap ?? undefined,
      },
    });

    if (args.rpOrderId) {
      await linkRazorpayOrderToBookingTx(tx, {
        userId: args.userId,
        razorpayOrderId: args.rpOrderId,
        bookingId: created.id,
      });
    }

    if (args.packageId) {
      const upd = await tx.userPackage.updateMany({
        where: {
          id: args.packageId,
          user_id: args.userId,
          credits_remaining: { gte: 1 },
        },
        data: { credits_remaining: { decrement: 1 } },
      });
      if (upd.count !== 1) throw new Error("NO_CREDITS");
    }

    const newOccupiedSeats = seatsTaken + spotsToConsume;
    if (cap > 0) {
      await tx.classSchedule.update({
        where: { id: args.scheduleId },
        data: {
          current_bookings: newOccupiedSeats,
          available_spots: Math.max(0, cap - newOccupiedSeats),
        },
      });
    }

    return created;
  });
}

const BOOKING_ERROR_MAP: Record<string, { status: number; error: string }> = {
  SCHEDULE_NOT_FOUND: { status: 404, error: "This class is no longer on the schedule" },
  CLASS_CANCELLED: { status: 400, error: "This class has been cancelled" },
  CLASS_INACTIVE: { status: 400, error: "This class is currently paused" },
  ALREADY_BOOKED: { status: 409, error: "You already have a booking for this class" },
  CLASS_FULL: { status: 409, error: "This class is full" },
  PACKAGE_NOT_ALLOWED: { status: 403, error: "That package is not linked to your account" },
  PACKAGE_INACTIVE: { status: 400, error: "That package is not active" },
  PACKAGE_EXPIRED: { status: 400, error: "That package has expired" },
  PACKAGE_WRONG_TYPE: {
    status: 400,
    error: "Use class credits, not an unlimited pass row, for this booking",
  },
  NO_CREDITS: { status: 400, error: "No class credits left on that package" },
  RAZORPAY_BOOKING_LINK_INVALID: {
    status: 400,
    error:
      "Online payment could not be linked to this booking. Try confirming again or contact support.",
  },
};

type ParsedBooking = {
  scheduleId: string;
  packageId: string | null;
  rpOrderId: string | null;
  className: string | null | undefined;
  classTime: string | null | undefined;
  extraGuests: number;
  guestList: NonNullable<ReturnType<typeof parseGuestAttendees>>;
  financeSnap: ReturnType<typeof parseFinanceSnapshot>;
};

function parseBookingRequest(
  body: unknown,
): { ok: boolean; value?: ParsedBooking; error?: string } {
  const {
    class_schedule_id,
    user_package_id,
    class_name,
    class_time,
    razorpay_order_id,
    extra_guest_count: rawGuestCount,
    guest_attendees: rawGuests,
    finance_snapshot: rawFinance,
  } = (body ?? {}) as {
    class_schedule_id?: string;
    user_package_id?: string | null;
    class_name?: string | null;
    class_time?: string | null;
    razorpay_order_id?: string | null;
    extra_guest_count?: unknown;
    guest_attendees?: unknown;
    finance_snapshot?: unknown;
  };

  const rpOrderId =
    razorpay_order_id != null && String(razorpay_order_id).trim()
      ? String(razorpay_order_id).trim()
      : null;

  const scheduleId =
    typeof class_schedule_id === "string" && class_schedule_id.trim()
      ? class_schedule_id.trim()
      : null;

  if (!scheduleId) {
    return { ok: false, error: "class_schedule_id is required" };
  }

  const packageId =
    user_package_id != null && String(user_package_id).trim()
      ? String(user_package_id).trim()
      : null;

  const guestList = parseGuestAttendees(rawGuests);
  if (guestList === null) {
    return { ok: false, error: "Invalid guest_attendees payload" };
  }

  let extraGuests = Number(rawGuestCount);
  if (!Number.isInteger(extraGuests) || extraGuests < 0 || extraGuests > 20) {
    extraGuests = guestList.length;
  }
  if (guestList.length !== extraGuests) {
    return {
      ok: false,
      error: "guest_attendees length must match extra_guest_count (friends/family only).",
    };
  }

  const financeSnap = rawFinance !== undefined ? parseFinanceSnapshot(rawFinance) : null;
  if (rawFinance !== undefined && rawFinance !== null && !financeSnap) {
    return { ok: false, error: "Invalid finance_snapshot" };
  }

  return {
    ok: true,
    value: {
      scheduleId,
      packageId,
      rpOrderId,
      className: class_name,
      classTime: class_time,
      extraGuests,
      guestList,
      financeSnap,
    },
  };
}

async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  userEmail: string | null,
  log: BookingsLog,
) {
  const parsed = parseBookingRequest(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }
  const { scheduleId, packageId, rpOrderId, className, classTime, extraGuests, guestList, financeSnap } =
    parsed.value;

  try {
    if (rpOrderId) {
      const orderError = await validatePaidOrder(userId, rpOrderId, financeSnap);
      if (orderError) {
        return res.status(orderError.status).json({ error: orderError.error });
      }
    }

    const booking = await createBookingTx({
      userId,
      userEmail,
      scheduleId,
      packageId,
      rpOrderId,
      className,
      classTime,
      extraGuests,
      guestList,
      financeSnap,
    });

    // Physique 57 bookings stay pending until the instructor confirms — the
    // confirmation email fires on confirm, not now. Non-57 bookings notify now.
    if (booking.confirmation_status !== "pending") {
      // Single source of truth for the confirmation email. The CRM
      // class_booking_confirmed email trigger was removed here — it duplicated
      // this send and rendered blank (template used {{className}}-style keys
      // that don't match the dispatcher's Snake_Case variables).
      await sendBookingConfirmationEmail(booking.id).catch((e) => log.error({ err: e, bookingId: booking.id }, "booking confirmation email failed"));
    }

    // Onboard friends & family guests server-side (create accounts + roster
    // rows + emails). Done here — not on the client — so it also runs when
    // payment completes via a Razorpay full-page redirect. Idempotent + best-effort.
    if (guestList.length > 0) {
      await onboardGuestsForBooking({
        guests: guestList,
        classScheduleId: scheduleId,
        bookerId: userId,
      }).catch((e) => log.error({ err: e, bookingId: booking.id }, "onboardGuestsForBooking failed"));
    }

    return res.status(201).json(booking);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const mapped = BOOKING_ERROR_MAP[msg];
    if (mapped) {
      return res.status(mapped.status).json({ error: mapped.error });
    }
    log.error({ err: e, userId }, "booking POST failed");
    return res.status(500).json({ error: "Could not complete booking" });
  }
}

async function reconcileScheduleSeatsAfterCancel(tx: TxClient, schedId: string) {
  const schedule = await tx.classSchedule.findUnique({
    where: { id: schedId },
    include: { class_model: { select: { max_capacity: true } } },
  });
  if (!schedule) return;
  const cap = schedule.capacity ?? schedule.class_model?.max_capacity ?? 0;
  if (cap <= 0) return;
  const remaining = await tx.booking.findMany({
    where: { class_schedule_id: schedId, status: { in: ["confirmed", "pending"] } },
    select: { extra_guest_count: true },
  });
  const occupiedSeats = remaining.reduce(
    (sum, row) => sum + 1 + Math.max(0, row.extra_guest_count ?? 0),
    0,
  );
  await tx.classSchedule.update({
    where: { id: schedId },
    data: { current_bookings: occupiedSeats, available_spots: Math.max(0, cap - occupiedSeats) },
  });
}

async function refundCreditIfEligible(
  tx: TxClient,
  existing: { class_schedule?: { start_time: Date | null } | null; user_package_id: string | null; checked_in: boolean },
  status: string | undefined,
  wasActiveSeat: boolean,
) {
  // Refund the class credit consumed at booking time. Policy: refund only when
  // cancelled at least 6h before class start; late cancels (<6h) forfeit the credit.
  // Also only for an active, non-attended credit-pass booking (unlimited never
  // consumed a credit). `wasActiveSeat` guards against double refund on repeated
  // cancel calls (a cancelled row is no longer an active seat).
  const REFUND_CUTOFF_MS = 6 * 60 * 60 * 1000;
  const classStartForRefund = existing.class_schedule?.start_time;
  const refundEligible =
    !!classStartForRefund && Date.now() <= classStartForRefund.getTime() - REFUND_CUTOFF_MS;
  if (
    status !== "cancelled" ||
    !wasActiveSeat ||
    !refundEligible ||
    !existing.user_package_id ||
    existing.checked_in
  ) {
    return;
  }
  const up = await tx.userPackage.findUnique({
    where: { id: existing.user_package_id },
    include: { package_type: { select: { is_unlimited: true } } },
  });
  if (up && !up.package_type?.is_unlimited && up.credits_remaining != null) {
    await tx.userPackage.update({
      where: { id: up.id },
      data: { credits_remaining: { increment: 1 } },
    });
  }
}

async function awardPtmBadges(userId: string, log: BookingsLog) {
  try {
    const totalClasses = await prisma.booking.count({
      where: { user_id: userId, checked_in: true },
    });
    const ptmTemplates = await prisma.badgeTemplate.findMany({
      where: { badge_type: "path_to_mastery", is_active: true },
    });
    for (const template of ptmTemplates) {
      if (template.threshold_classes === null || totalClasses < template.threshold_classes) {
        continue;
      }
      const alreadyEarned = await prisma.userBadge.findFirst({
        where: {
          user_id: userId,
          OR: [
            { badge_template_id: template.id },
            { badge_name: template.name, badge_type: "path_to_mastery" },
          ],
        },
      });
      if (alreadyEarned) continue;
      await prisma.userBadge.create({
        data: {
          user_id: userId,
          badge_template_id: template.id,
          badge_name: template.name,
          badge_description: template.description ?? null,
          badge_type: "path_to_mastery",
          icon: template.icon,
          color: template.color,
          milestone_value: template.threshold_classes,
          total_classes: totalClasses,
        },
      });
    }
  } catch (e) {
    log.error({ err: e }, "check-in badge auto-award failed");
  }
}

async function handlePatch(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  log: BookingsLog,
) {
  const { id, status, checked_in } = req.body as {
    id?: string;
    status?: string;
    checked_in?: boolean;
  };

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Booking id required" });
  }

  const existing = await prisma.booking.findFirst({
    where: { id, user_id: userId },
    include: { class_schedule: { select: { start_time: true } } },
  });
  if (!existing) return res.status(404).json({ error: "Booking not found" });

  const wasActiveSeat =
    ["confirmed", "pending"].includes(existing.status) && Boolean(existing.class_schedule_id);

  const data: Record<string, unknown> = {};
  if (status) data.status = status;
  if (status === "cancelled") data.cancellation_date = new Date();

  if (checked_in === true) {
    if (existing.checked_in) {
      return res.status(400).json({ error: "Already checked in" });
    }
    const classStart = existing.class_schedule?.start_time;
    if (!classStart) {
      return res.status(400).json({ error: "This booking is not linked to a scheduled class" });
    }
    const now = new Date();
    if (!canCheckInNow(classStart, now)) {
      return res.status(400).json({
        error: "Check-in is only available from 15 minutes before until 10 minutes after class start.",
      });
    }
    data.checked_in = true;
    data.check_in_time = now;
    data.check_in_outcome = checkInOutcomeFromTimes(classStart, now);
  }

  const booking = await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({ where: { id }, data });

    if (status === "cancelled" && wasActiveSeat && existing.class_schedule_id) {
      await reconcileScheduleSeatsAfterCancel(tx, existing.class_schedule_id);
    }

    await refundCreditIfEligible(tx, existing, status, wasActiveSeat);

    return updated;
  });

  if (status === "cancelled") {
    // Awaited so the cancellation email/CRM actually sends on serverless.
    await buildBookingCrmVariables(booking.id)
      .then((variables) =>
        dispatchCrmEmailTriggers({
          triggerType: CrmTriggerType.ClassBookingCancelled,
          userId,
          variables,
        })
      )
      .catch((e) => log.error({ err: e }, "CRM class_booking_cancelled failed"));
  }

  if (checked_in === true && booking.checked_in) {
    // Auto-award PTM badges
    void awardPtmBadges(userId, log);
  }

  return res.json(booking);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const userId = (session.user as { id: string }).id;
  const userEmail = (session.user as { email?: string | null }).email ?? null;

  if (req.method === "GET") return handleGet(req, res, userId);
  if (req.method === "POST") return handlePost(req, res, userId, userEmail, log);
  if (req.method === "PATCH") return handlePatch(req, res, userId, log);

  res.status(405).end();
}
