import type { NextApiRequest, NextApiResponse } from "next";
import { CrmTriggerType } from "@/lib/crmTriggerTypes";
import prisma from "@/lib/prisma";
import { OCCUPYING_STATUSES, ROSTER_STATUSES, HISTORY_STATUSES, occupiesSeat } from "@/lib/bookingStatus";
import { buildBookingCrmVariables, dispatchCrmEmailTriggers } from "@/lib/notifications/crmTemplatedDispatch";
import { sendBookingConfirmationEmail } from "@/lib/notifications/sendBookingEmail";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import {
  canCheckInNow,
  checkInOutcomeFromTimes,
} from "@/lib/bookingAttendance";
import { reconcileNoShowsGlobally } from "@/lib/bookingReconcile";
import { linkRazorpayOrderToBookingTx, flagPaidCancelledOrphans } from "@/lib/razorpayPersistence";
import {
  expectedBookingCheckoutPaise,
  parseFinanceSnapshot,
  parseGuestAttendees,
  snapshotTotalsConsistent,
} from "@/lib/financeBookingCheckout";
import { requestLogger } from "@/lib/logger";
import { upsertFriendship } from "@/lib/friendship";
import { logActivity } from "@/lib/activityLog";
import { getStudioSettings } from "@/lib/studioSettings";
import { grantRefundForBookingRow } from "@/lib/classCancellation";
import { releaseCouponRedemption } from "@/lib/couponHelpers";

type BookingsLog = ReturnType<typeof requestLogger>;
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const STATUS_CONFIRMED = "confirmed" as const;
const STATUS_PENDING = "pending" as const;
const STATUS_CANCELLED = "cancelled" as const;
const BADGE_TYPE_PTM = "path_to_mastery" as const;

async function handleGet(req: NextApiRequest, res: NextApiResponse, userId: string) {
  const { status, limit, days } = req.query;
  await reconcileNoShowsGlobally(prisma);
  const where: Record<string, unknown> = { user_id: userId };
  if (status) {
    const s = String(status);
    if (s === "active") {
      // Active/upcoming = seat-holders the member is expected to attend, incl.
      // unpaid gateway holds (payment_pending) and the legacy partner-pending value.
      where.status = { in: [...ROSTER_STATUSES, STATUS_PENDING] };
    } else if (s === "history") {
      // Class history shows EVERY booked class regardless of payment — confirmed,
      // payment_pending (unpaid), expired, cancelled. Payment is a display pill,
      // not a visibility gate.
      where.status = { in: [...HISTORY_STATUSES, STATUS_PENDING] };
    } else {
      where.status = s;
    }
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
      invited_by: { select: { full_name: true } },
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

  // Group info: the guests THIS user brought, per schedule. Guests are separate
  // booking rows owned by the guest's account (invited_by_user_id = this booker),
  // so they aren't in `bookings` (which is scoped to user_id). One extra query,
  // grouped in memory, attached to the booker's row for each schedule.
  const scheduleIds = Array.from(
    new Set(bookings.map((b) => b.class_schedule_id).filter((id): id is string => !!id)),
  );
  const guestsBySchedule = new Map<string, { name: string; status: string; checked_in: boolean }[]>();
  if (scheduleIds.length > 0) {
    const guestRows = await prisma.booking.findMany({
      where: {
        invited_by_user_id: userId,
        class_schedule_id: { in: scheduleIds },
        status: { in: [...HISTORY_STATUSES, STATUS_PENDING] },
      },
      select: {
        class_schedule_id: true,
        status: true,
        checked_in: true,
        profile: { select: { full_name: true, email: true } },
      },
    });
    for (const g of guestRows) {
      if (!g.class_schedule_id) continue;
      const arr = guestsBySchedule.get(g.class_schedule_id) ?? [];
      arr.push({
        name: g.profile?.full_name?.trim() || g.profile?.email?.split("@")[0] || "Guest",
        status: g.status,
        checked_in: g.checked_in,
      });
      guestsBySchedule.set(g.class_schedule_id, arr);
    }
  }

  const mapped = bookings.map((b) => ({
    ...b,
    invited_by_name: b.invited_by?.full_name ?? null,
    // Only the booker's own row (not an invited row) carries the guest list.
    guests: !b.invited_by_user_id && b.class_schedule_id ? guestsBySchedule.get(b.class_schedule_id) ?? [] : [],
  }));
  return res.json(mapped);
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
  addedMemberProfileIds: string[];
};

function createBookingTx(args: CreateBookingArgs) {
  return prisma.$transaction(async (tx) => {
    // Serialize concurrent bookings on this schedule (read-then-insert race).
    await tx.$queryRaw`SELECT id FROM class_schedules WHERE id = ${args.scheduleId} FOR UPDATE`;

    const schedule = await tx.classSchedule.findUnique({
      where: { id: args.scheduleId },
      include: { class_model: { select: { max_capacity: true, name: true, partner_id: true } } },
    });

    if (!schedule) throw new Error("SCHEDULE_NOT_FOUND");
    if (schedule.status === STATUS_CANCELLED) throw new Error("CLASS_CANCELLED");
    if (schedule.status === "inactive") throw new Error("CLASS_INACTIVE");

    const duplicate = await tx.booking.findFirst({
      where: {
        user_id: args.userId,
        class_schedule_id: args.scheduleId,
        status: { in: [...OCCUPYING_STATUSES] },
      },
    });
    if (duplicate) throw new Error("ALREADY_BOOKED");

    const cap = schedule.capacity ?? schedule.class_model?.max_capacity ?? 0;
    const occupancyRows = await tx.booking.findMany({
      where: {
        class_schedule_id: args.scheduleId,
        status: { in: [...OCCUPYING_STATUSES] },
      },
      select: { extra_guest_count: true },
    });
    const seatsTaken = occupancyRows.reduce(
      (sum, row) => sum + 1 + Math.max(0, row.extra_guest_count ?? 0),
      0,
    );

    const spotsToConsume = 1 + args.extraGuests + args.addedMemberProfileIds.length;
    if (cap > 0 && seatsTaken + spotsToConsume > cap) throw new Error("CLASS_FULL");

    // Canonical: the booked schedule is the single source of truth for the time.
    // Never trust a client-supplied classTime — it can point at a different slot
    // (the V. Shyamala case: snapshot said 6pm while the schedule was 7:30pm).
    const resolvedClassTime = schedule.start_time.toISOString();
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
        status: STATUS_CONFIRMED,
        // Partner-run classes need the partner to sign off before the
        // member's booking is confirmed (and the confirmation email sent).
        confirmation_status: schedule.class_model?.partner_id ? STATUS_PENDING : null,
        // Added members get their own booking rows (below), so the booker counts
        // as one seat here. The capacity check above reserves the whole group.
        extra_guest_count: 0,
        guest_attendees: args.guestList.length > 0 ? args.guestList : undefined,
        finance_snapshot: args.financeSnap ?? undefined,
      },
    });

    // Create one Booking row per added member (invited by the primary booker)
    for (const profileId of args.addedMemberProfileIds) {
      const alreadyBooked = await tx.booking.findFirst({
        where: {
          user_id: profileId,
          class_schedule_id: args.scheduleId,
          status: { in: [...OCCUPYING_STATUSES] },
        },
        select: { id: true },
      });
      if (alreadyBooked) continue;

      await tx.booking.create({
        data: {
          user_id: profileId,
          class_schedule_id: args.scheduleId,
          status: STATUS_CONFIRMED,
          class_name: resolvedClassName,
          class_time: resolvedClassTime,
          invited_by_user_id: args.userId,
        },
      });
    }

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
  addedMemberProfileIds: string[];
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

  const rawAddedProfileIds = (body as Record<string, unknown>).added_member_profile_ids;
  const addedMemberProfileIds: string[] = Array.isArray(rawAddedProfileIds)
    ? (rawAddedProfileIds as unknown[]).filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0,
      )
    : [];

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
      addedMemberProfileIds,
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
  const { scheduleId, packageId, rpOrderId, className, classTime, extraGuests, guestList, financeSnap, addedMemberProfileIds } =
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
      addedMemberProfileIds,
    });

    // Auto-friend booker ↔ each added member. Best-effort, OUTSIDE the booking tx
    // so a friendship write error can never roll back the paid booking.
    for (const memberId of addedMemberProfileIds) {
      try {
        await upsertFriendship(prisma, userId, memberId, "invite", "active");
      } catch (err) {
        log.error({ err, invitee: memberId }, "[bookings] friendship upsert failed");
      }
    }

    // Physique 57 bookings stay pending until the instructor confirms — the
    // confirmation email fires on confirm, not now. Non-57 bookings notify now.
    if (booking.confirmation_status !== STATUS_PENDING) {
      // Single source of truth for the confirmation email. The CRM
      // class_booking_confirmed email trigger was removed here — it duplicated
      // this send and rendered blank (template used {{className}}-style keys
      // that don't match the dispatcher's Snake_Case variables).
      await sendBookingConfirmationEmail(booking.id).catch((e) => log.error({ err: e, bookingId: booking.id }, "booking confirmation email failed"));
    }

    await logActivity({ req, action: "booking.created", entity: { type: "booking", id: booking.id }, metadata: { class_name: booking.class_name ?? undefined } });
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
    where: { class_schedule_id: schedId, status: { in: [...OCCUPYING_STATUSES] } },
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

type CancelRefundRow = {
  user_id: string;
  user_package_id: string | null;
  checked_in: boolean;
  extra_guest_count: number | null;
  user_package?: { package_type?: { is_unlimited: boolean } | null } | null;
};

// Refund-as-pass (spec §9): a cancelled non-unlimited seat earns a `1 Class Pass`
// (origin=cancellation); anonymous extra guests grant their passes to the booker.
// `wasActiveSeat` guards against double refund on repeated cancel calls (a
// cancelled row is no longer an active seat). Replaces the old credit increment.
async function refundCancelledSeatsAsPass(
  tx: TxClient,
  rows: CancelRefundRow[],
  wasActiveSeat: boolean,
) {
  if (!wasActiveSeat) return;
  for (const row of rows) {
    await grantRefundForBookingRow(tx, {
      user_id: row.user_id,
      user_package_id: row.user_package_id,
      checked_in: row.checked_in,
      extra_guest_count: row.extra_guest_count,
      is_unlimited: row.user_package?.package_type?.is_unlimited ?? false,
    });
  }
}

async function awardPtmBadges(userId: string, log: BookingsLog) {
  try {
    const [totalClasses, ptmTemplates] = await Promise.all([
      prisma.booking.count({ where: { user_id: userId, checked_in: true } }),
      prisma.badgeTemplate.findMany({ where: { badge_type: BADGE_TYPE_PTM, is_active: true } }),
    ]);

    const eligible = ptmTemplates.filter(
      (t) => t.threshold_classes !== null && totalClasses >= t.threshold_classes,
    );
    if (eligible.length === 0) return;

    // Check which badges are already earned in a single batch query.
    const earned = await prisma.userBadge.findMany({
      where: {
        user_id: userId,
        OR: eligible.flatMap((t) => [
          { badge_template_id: t.id },
          { badge_name: t.name, badge_type: BADGE_TYPE_PTM },
        ]),
      },
      select: { badge_template_id: true, badge_name: true },
    });
    const earnedTemplateIds = new Set(earned.map((e) => e.badge_template_id));
    const earnedNames = new Set(earned.map((e) => e.badge_name));

    const toCreate = eligible.filter(
      (t) => !earnedTemplateIds.has(t.id) && !earnedNames.has(t.name),
    );
    if (toCreate.length === 0) return;

    await prisma.userBadge.createMany({
      data: toCreate.map((template) => ({
        user_id: userId,
        badge_template_id: template.id,
        badge_name: template.name,
        badge_description: template.description ?? null,
        badge_type: BADGE_TYPE_PTM,
        icon: template.icon,
        color: template.color,
        milestone_value: template.threshold_classes,
        total_classes: totalClasses,
      })),
      skipDuplicates: true,
    });
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
    include: {
      class_schedule: { select: { start_time: true } },
      user_package: { select: { package_type: { select: { is_unlimited: true } } } },
    },
  });
  if (!existing) return res.status(404).json({ error: "Booking not found" });

  // Invited bookings can only be cancelled by the person who created the invite, not the invitee.
  if (status === STATUS_CANCELLED && existing.invited_by_user_id !== null) {
    return res.status(403).json({ error: "Invited bookings can only be cancelled by the person who added you" });
  }

  // Cancellation cutoff (spec §9): self-cancel is only allowed up to
  // cancellation_cutoff_hours before class start. After the cutoff the member
  // must file a cancellation request for admin approval.
  if (status === STATUS_CANCELLED && existing.status !== STATUS_CANCELLED) {
    const classStart = existing.class_schedule?.start_time;
    if (classStart) {
      const { cancellation_cutoff_hours } = await getStudioSettings();
      const cutoffMs = cancellation_cutoff_hours * 60 * 60 * 1000;
      if (Date.now() > classStart.getTime() - cutoffMs) {
        return res.status(409).json({
          code: "CUTOFF_PASSED",
          error:
            "This class is past the cancellation cutoff. Please file a cancellation request for the studio to review.",
        });
      }
    }
  }

  const wasActiveSeat = occupiesSeat(existing.status) && Boolean(existing.class_schedule_id);

  const data: Record<string, unknown> = {};
  if (status) data.status = status;
  if (status === STATUS_CANCELLED) data.cancellation_date = new Date();

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

    // Group cascade: when the BOOKER (not an invited guest) cancels, cancel the
    // whole group they brought — guests are tied to the booker's booking.
    const refundRows: CancelRefundRow[] = [];
    if (status === STATUS_CANCELLED) {
      refundRows.push({
        user_id: existing.user_id,
        user_package_id: existing.user_package_id,
        checked_in: existing.checked_in,
        extra_guest_count: existing.extra_guest_count,
        user_package: existing.user_package,
      });
    }

    if (
      status === STATUS_CANCELLED &&
      existing.invited_by_user_id === null &&
      existing.class_schedule_id
    ) {
      // Capture the group rows BEFORE cancelling so we can refund each member.
      const groupRows = await tx.booking.findMany({
        where: {
          invited_by_user_id: userId,
          class_schedule_id: existing.class_schedule_id,
          status: { in: [...OCCUPYING_STATUSES] },
        },
        select: {
          user_id: true,
          user_package_id: true,
          checked_in: true,
          extra_guest_count: true,
          user_package: { select: { package_type: { select: { is_unlimited: true } } } },
        },
      });
      refundRows.push(...groupRows);

      await tx.booking.updateMany({
        where: {
          invited_by_user_id: userId,
          class_schedule_id: existing.class_schedule_id,
          status: { in: [...OCCUPYING_STATUSES] },
        },
        data: { status: STATUS_CANCELLED, cancellation_date: new Date() },
      });
    }

    if (status === STATUS_CANCELLED && wasActiveSeat && existing.class_schedule_id) {
      await reconcileScheduleSeatsAfterCancel(tx, existing.class_schedule_id);
    }

    if (status === STATUS_CANCELLED) {
      await refundCancelledSeatsAsPass(tx, refundRows, wasActiveSeat);
      // Reverse any coupon used on this booking so its redemption count + per-user
      // limit free up. Only the booker's row carries the coupon; group rows have none.
      await releaseCouponRedemption(tx, { bookingId: id });
    }

    return updated;
  });

  if (status === STATUS_CANCELLED) {
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
    await logActivity({ req, action: "booking.cancelled", entity: { type: "booking", id: booking.id }, metadata: { class_name: booking.class_name ?? undefined } });
    // Reconcile-on-cancel: if this booking was paid online (captured/authorized) the cancel
    // releases the seat but the refund-as-pass path does NOT apply (online seats carry no
    // user_package_id). Surface the order as a refund/void candidate so an admin handles the
    // money. Never auto-refunds/captures. Best-effort — must not fail the cancel.
    await flagPaidCancelledOrphans({ bookingId: booking.id }).catch((e) =>
      log.error({ err: e, bookingId: booking.id }, "cancel-time orphan flag failed"),
    );
  }

  if (checked_in === true && booking.checked_in) {
    await logActivity({
      req,
      action: "booking.checked_in",
      targetProfileId: userId,
      entity: { type: "booking", id: booking.id },
      metadata: { class_name: booking.class_name ?? undefined, outcome: booking.check_in_outcome ?? undefined },
    });
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
