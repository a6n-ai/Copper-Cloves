import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { CrmTriggerType } from "@/lib/crmTriggerTypes";
import prisma from "@/lib/prisma";
import { buildBookingCrmVariables, dispatchCrmEmailTriggers } from "@/lib/notifications/crmTemplatedDispatch";
import {
  canCheckInNow,
  checkInOutcomeFromTimes,
} from "@/lib/bookingAttendance";
import { reconcileNoShowsGlobally } from "@/lib/bookingReconcile";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const userId = (session.user as { id: string }).id;

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
    };;

    bookings.sort((a, b) => startMs(a) - startMs(b));

    return res.json(bookings);
  }

  if (req.method === "POST") {
    const { class_schedule_id, user_package_id, class_name, class_time } = req.body as {
      class_schedule_id?: string;
      user_package_id?: string | null;
      class_name?: string | null;
      class_time?: string | null;
    };

    let resolvedClassTime = class_time ?? null;
    if (class_schedule_id && !resolvedClassTime) {
      const sch = await prisma.classSchedule.findUnique({
        where: { id: class_schedule_id },
        select: { start_time: true },
      });
      if (sch) resolvedClassTime = sch.start_time.toISOString();
    }

    const booking = await prisma.booking.create({
      data: {
        user_id: userId,
        class_schedule_id: class_schedule_id ?? null,
        user_package_id: user_package_id ?? null,
        class_name: class_name ?? null,
        class_time: resolvedClassTime,
        status: "confirmed",
      },
    });

    // Decrement credits if a package is used
    if (user_package_id) {
      const pkg = await prisma.userPackage.findUnique({ where: { id: user_package_id } });
      if (pkg && pkg.credits_remaining !== null) {
        await prisma.userPackage.update({
          where: { id: user_package_id },
          data: { credits_remaining: { decrement: 1 } },
        });
      }
    }

    void buildBookingCrmVariables(booking.id)
      .then((variables) =>
        dispatchCrmEmailTriggers({
          triggerType: CrmTriggerType.ClassBookingConfirmed,
          userId,
          variables,
        })
      )
      .catch((e) => console.error("CRM class_booking_confirmed:", e));
    return res.status(201).json(booking);
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

    const booking = await prisma.booking.update({
      where: { id },
      data,
    });

    if (status === "cancelled") {
      void buildBookingCrmVariables(booking.id)
        .then((variables) =>
          dispatchCrmEmailTriggers({
            triggerType: CrmTriggerType.ClassBookingCancelled,
            userId,
            variables,
          })
        )
        .catch((e) => console.error("CRM class_booking_cancelled:", e));    }

    return res.json(booking);
  }

  res.status(405).end();
}
