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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const userId = (session.user as { id: string }).id;
  const userEmail = (session.user as { email?: string | null }).email ?? null;

  if (req.method === "GET") {
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

  if (req.method === "POST") {
    const {
      class_schedule_id,
      user_package_id,
      class_name,
      class_time,
      razorpay_order_id,
      extra_guest_count: rawGuestCount,
      guest_attendees: rawGuests,
      finance_snapshot: rawFinance,
    } = req.body as {
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
      return res.status(400).json({ error: "class_schedule_id is required" });
    }

    const packageId =
      user_package_id != null && String(user_package_id).trim()
        ? String(user_package_id).trim()
        : null;

    const guestList = parseGuestAttendees(rawGuests);
    if (guestList === null) {
      return res.status(400).json({ error: "Invalid guest_attendees payload" });
    }

    let extraGuests = Number(rawGuestCount);
    if (!Number.isInteger(extraGuests) || extraGuests < 0 || extraGuests > 20) {
      extraGuests = guestList.length;
    }
    if (guestList.length !== extraGuests) {
      return res.status(400).json({
        error: "guest_attendees length must match extra_guest_count (friends/family only).",
      });
    }

    const financeSnap = rawFinance !== undefined ? parseFinanceSnapshot(rawFinance) : null;
    if (rawFinance !== undefined && rawFinance !== null && !financeSnap) {
      return res.status(400).json({ error: "Invalid finance_snapshot" });
    }

    try {
      if (rpOrderId) {
        if (!financeSnap || !snapshotTotalsConsistent(financeSnap)) {
          return res.status(400).json({ error: "Valid finance totals are required for online payment." });
        }
        const expectedPaise = expectedBookingCheckoutPaise(financeSnap.totalInr);
        const ord = await prisma.razorpayOrder.findFirst({
          where: { razorpay_order_id: rpOrderId, user_id: userId },
        });
        if (!ord) {
          return res.status(400).json({ error: "Payment order not found" });
        }
        if (ord.status !== "paid") {
          return res.status(400).json({ error: "Payment is not confirmed yet" });
        }
        if (ord.booking_id != null || ord.user_package_id != null) {
          return res.status(400).json({ error: "This payment was already used" });
        }
        if (ord.amount_paise !== expectedPaise) {
          return res.status(400).json({ error: "Paid amount does not match checkout totals" });
        }
      }

      const booking = await prisma.$transaction(async (tx) => {
        const schedule = await tx.classSchedule.findUnique({
          where: { id: scheduleId },
          include: { class_model: { select: { max_capacity: true, name: true, partner_id: true } } },
        });

        if (!schedule) {
          throw new Error("SCHEDULE_NOT_FOUND");
        }
        if (schedule.status === "cancelled") {
          throw new Error("CLASS_CANCELLED");
        }

        const duplicate = await tx.booking.findFirst({
          where: {
            user_id: userId,
            class_schedule_id: scheduleId,
            status: { in: ["confirmed", "pending"] },
          },
        });
        if (duplicate) {
          throw new Error("ALREADY_BOOKED");
        }

        const cap =
          schedule.capacity ??
          schedule.class_model?.max_capacity ??
          0;
        const occupancyRows = await tx.booking.findMany({
          where: {
            class_schedule_id: scheduleId,
            status: { in: ["confirmed", "pending"] },
          },
          select: { extra_guest_count: true },
        });
        const seatsTaken = occupancyRows.reduce(
          (sum, row) => sum + 1 + Math.max(0, row.extra_guest_count ?? 0),
          0,
        );

        const spotsToConsume = 1 + extraGuests;
        if (cap > 0 && seatsTaken + spotsToConsume > cap) {
          throw new Error("CLASS_FULL");
        }

        let resolvedClassTime = class_time ?? null;
        if (!resolvedClassTime) {
          resolvedClassTime = schedule.start_time.toISOString();
        }

        const resolvedClassName =
          class_name?.trim() || schedule.class_model?.name || null;

        if (packageId) {
          const pkg = await tx.userPackage.findFirst({
            where: { id: packageId, user_id: userId },
            include: { package_type: true },
          });
          if (!pkg) {
            throw new Error("PACKAGE_NOT_ALLOWED");
          }
          if (!pkg.is_active) {
            throw new Error("PACKAGE_INACTIVE");
          }
          if (pkg.expiration_date <= new Date()) {
            throw new Error("PACKAGE_EXPIRED");
          }
          if (pkg.package_type?.is_unlimited) {
            throw new Error("PACKAGE_WRONG_TYPE");
          }
        }

        const created = await tx.booking.create({
          data: {
            user_id: userId,
            class_schedule_id: scheduleId,
            user_package_id: packageId,
            class_name: resolvedClassName,
            class_time: resolvedClassTime,
            email: userEmail,
            status: "confirmed",
            // Partner-run classes need the partner to sign off before the
            // member's booking is confirmed (and the confirmation email sent).
            confirmation_status: schedule.class_model?.partner_id ? "pending" : null,
            // Guests get their own roster rows (see /api/bookings/process-guests),
            // so the booker counts as one seat here. The capacity check below
            // still reserves 1 + guests up front so the group is guaranteed.
            extra_guest_count: 0,
            guest_attendees: guestList.length > 0 ? guestList : undefined,
            finance_snapshot: financeSnap ?? undefined,
          },
        });

        if (rpOrderId) {
          await linkRazorpayOrderToBookingTx(tx, {
            userId,
            razorpayOrderId: rpOrderId,
            bookingId: created.id,
          });
        }

        if (packageId) {
          const upd = await tx.userPackage.updateMany({
            where: {
              id: packageId,
              user_id: userId,
              credits_remaining: { gte: 1 },
            },
            data: { credits_remaining: { decrement: 1 } },
          });
          if (upd.count !== 1) {
            throw new Error("NO_CREDITS");
          }
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

      // Physique 57 bookings stay pending until the instructor confirms — the
      // confirmation email fires on confirm, not now. Non-57 bookings notify now.
      if (booking.confirmation_status !== "pending") {
        await Promise.all([
          sendBookingConfirmationEmail(booking.id).catch((e) => console.error("[booking email]", e)),
          buildBookingCrmVariables(booking.id)
            .then((variables) =>
              dispatchCrmEmailTriggers({
                triggerType: CrmTriggerType.ClassBookingConfirmed,
                userId,
                variables,
              })
            )
            .catch((e) => console.error("CRM class_booking_confirmed:", e)),
        ]);
      }

      // Onboard friends & family guests server-side (create accounts + roster
      // rows + emails). Done here — not on the client — so it also runs when
      // payment completes via a Razorpay full-page redirect. Idempotent + best-effort.
      if (guestList.length > 0) {
        await onboardGuestsForBooking({
          guests: guestList,
          classScheduleId: scheduleId,
          bookerId: userId,
        }).catch((e) => console.error("[onboardGuestsForBooking] bookings.ts:", e));
      }

      return res.status(201).json(booking);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "SCHEDULE_NOT_FOUND") {
        return res.status(404).json({ error: "This class is no longer on the schedule" });
      }
      if (msg === "CLASS_CANCELLED") {
        return res.status(400).json({ error: "This class has been cancelled" });
      }
      if (msg === "ALREADY_BOOKED") {
        return res.status(409).json({ error: "You already have a booking for this class" });
      }
      if (msg === "CLASS_FULL") {
        return res.status(409).json({ error: "This class is full" });
      }
      if (msg === "PACKAGE_NOT_ALLOWED") {
        return res.status(403).json({ error: "That package is not linked to your account" });
      }
      if (msg === "PACKAGE_INACTIVE") {
        return res.status(400).json({ error: "That package is not active" });
      }
      if (msg === "PACKAGE_EXPIRED") {
        return res.status(400).json({ error: "That package has expired" });
      }
      if (msg === "PACKAGE_WRONG_TYPE") {
        return res.status(400).json({ error: "Use class credits, not an unlimited pass row, for this booking" });
      }
      if (msg === "NO_CREDITS") {
        return res.status(400).json({ error: "No class credits left on that package" });
      }
      if (msg === "RAZORPAY_BOOKING_LINK_INVALID") {
        return res.status(400).json({
          error:
            "Online payment could not be linked to this booking. Try confirming again or contact support.",
        });
      }
      console.error("[bookings] POST", e);
      return res.status(500).json({ error: "Could not complete booking" });
    }
  }

  if (req.method === "PATCH") {
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
      const updated = await tx.booking.update({
        where: { id },
        data,
      });

      if (status === "cancelled" && wasActiveSeat && existing.class_schedule_id) {
        const schedId = existing.class_schedule_id;
        const schedule = await tx.classSchedule.findUnique({
          where: { id: schedId },
          include: { class_model: { select: { max_capacity: true } } },
        });
        if (schedule) {
            const cap =
              schedule.capacity ?? schedule.class_model?.max_capacity ?? 0;
            if (cap > 0) {
              const remaining = await tx.booking.findMany({
                where: {
                  class_schedule_id: schedId,
                  status: { in: ["confirmed", "pending"] },
                },
                select: { extra_guest_count: true },
              });
              const occupiedSeats = remaining.reduce(
                (sum, row) => sum + 1 + Math.max(0, row.extra_guest_count ?? 0),
                0,
              );
              await tx.classSchedule.update({
                where: { id: schedId },
                data: {
                  current_bookings: occupiedSeats,
                  available_spots: Math.max(0, cap - occupiedSeats),
                },
              });
            }
        }
      }

      // Refund the class credit consumed at booking time. Policy: refund only when
      // cancelled at least 6h before class start; late cancels (<6h) forfeit the credit.
      // Also only for an active, non-attended credit-pass booking (unlimited never
      // consumed a credit). `wasActiveSeat` guards against double refund on repeated
      // cancel calls (a cancelled row is no longer an active seat).
      const REFUND_CUTOFF_MS = 6 * 60 * 60 * 1000;
      const classStartForRefund = existing.class_schedule?.start_time;
      const refundEligible =
        !!classStartForRefund &&
        Date.now() <= classStartForRefund.getTime() - REFUND_CUTOFF_MS;
      if (
        status === "cancelled" &&
        wasActiveSeat &&
        refundEligible &&
        existing.user_package_id &&
        !existing.checked_in
      ) {
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
        .catch((e) => console.error("CRM class_booking_cancelled:", e));
    }

    if (checked_in === true && booking.checked_in) {
      // Auto-award PTM badges
      void (async () => {
        try {
          const totalClasses = await prisma.booking.count({
            where: { user_id: userId, checked_in: true },
          });
          const ptmTemplates = await prisma.badgeTemplate.findMany({
            where: { badge_type: "path_to_mastery", is_active: true },
          });
          for (const template of ptmTemplates) {
            if (
              template.threshold_classes !== null &&
              totalClasses >= template.threshold_classes
            ) {
              const alreadyEarned = await prisma.userBadge.findFirst({
                where: {
                  user_id: userId,
                  OR: [
                    { badge_template_id: template.id },
                    { badge_name: template.name, badge_type: "path_to_mastery" },
                  ],
                },
              });
              if (!alreadyEarned) {
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
            }
          }
        } catch (e) {
          console.error("[check-in badge auto-award]", e);
        }
      })();
    }

    return res.json(booking);
  }

  res.status(405).end();
}
