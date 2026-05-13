import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { CrmTriggerType } from "@/lib/crmTriggerTypes";
import prisma from "@/lib/prisma";
import { buildBookingCrmVariables, dispatchCrmEmailTriggers } from "@/lib/notifications/crmTemplatedDispatch";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const userId = (session.user as { id: string }).id;

  if (req.method === "GET") {
    const { status, limit, days } = req.query;
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
      orderBy: { booking_date: "desc" },
      ...(limit ? { take: Number(limit) } : {}),
    });
    return res.json(bookings);
  }

  if (req.method === "POST") {
    const { class_schedule_id, user_package_id, class_name, class_time } = req.body;

    const booking = await prisma.booking.create({
      data: {
        user_id: userId,
        class_schedule_id: class_schedule_id ?? null,
        user_package_id: user_package_id ?? null,
        class_name: class_name ?? null,
        class_time: class_time ?? null,
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
    const { id, status, checked_in } = req.body;

    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (status === "cancelled") data.cancellation_date = new Date();
    if (checked_in !== undefined) {
      data.checked_in = checked_in;
      if (checked_in) data.check_in_time = new Date();
    }

    const booking = await prisma.booking.update({
      where: { id, user_id: userId },
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
