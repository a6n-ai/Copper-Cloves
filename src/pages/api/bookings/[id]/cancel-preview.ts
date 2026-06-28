/**
 * Cancellation preview (who-gets-what) for the confirm dialog.
 *
 *   GET /api/bookings/:id/cancel-preview
 *     - Owner-scoped. Returns a dry-run of cancelling THIS booking:
 *       scope ("self" = invited member cancels only their seat | "group" = booker
 *       cascades the whole group) + one entry per affected seat with its refund
 *       outcome. Mirrors the real cancel path (refundOutcomeFor + the same group
 *       query), so the preview can't drift from what actually happens.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { refundOutcomeFor } from "@/lib/classCancellation";
import { OCCUPYING_STATUSES } from "@/lib/bookingStatus";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "Booking id required" });

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true, user_id: true, invited_by_user_id: true, class_schedule_id: true,
      user_package_id: true, checked_in: true,
      user_package: { select: { package_type: { select: { is_unlimited: true } } } },
    },
  });
  if (!booking || booking.user_id !== userId) {
    return res.status(404).json({ error: "Booking not found" });
  }

  const isBooker = booking.invited_by_user_id === null;
  const scope: "self" | "group" = isBooker ? "group" : "self";

  type Affected = { name: string; isYou: boolean; refund: ReturnType<typeof refundOutcomeFor> };
  const affected: Affected[] = [
    {
      name: "You",
      isYou: true,
      refund: refundOutcomeFor({
        user_package_id: booking.user_package_id,
        checked_in: booking.checked_in,
        is_unlimited: booking.user_package?.package_type?.is_unlimited ?? false,
      }),
    },
  ];

  // Booker cancel cascades the group → list each invited member they brought.
  if (isBooker && booking.class_schedule_id) {
    const groupRows = await prisma.booking.findMany({
      where: {
        invited_by_user_id: userId,
        class_schedule_id: booking.class_schedule_id,
        status: { in: [...OCCUPYING_STATUSES] },
      },
      select: {
        user_package_id: true, checked_in: true,
        profile: { select: { full_name: true, email: true } },
        user_package: { select: { package_type: { select: { is_unlimited: true } } } },
      },
    });
    for (const r of groupRows) {
      affected.push({
        name: r.profile?.full_name?.trim() || r.profile?.email?.split("@")[0] || "Member",
        isYou: false,
        refund: refundOutcomeFor({
          user_package_id: r.user_package_id,
          checked_in: r.checked_in,
          is_unlimited: r.user_package?.package_type?.is_unlimited ?? false,
        }),
      });
    }
  }

  return res.json({ scope, seats: affected.length, affected });
}
