import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") return res.status(405).end();

  const { scheduleId } = req.query;
  if (!scheduleId || typeof scheduleId !== "string") {
    return res.status(400).json({ error: "scheduleId required" });
  }

  const schedule = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    select: {
      id: true,
      start_time: true,
      capacity: true,
      class_model: { select: { name: true } },
      instructor: { select: { name: true } },
      bookings: {
        where: { status: "confirmed" },
        select: {
          id: true,
          user_id: true,
          checked_in: true,
          check_in_time: true,
          check_in_outcome: true,
          extra_guest_count: true,
          profile: { select: { full_name: true, email: true, avatar_url: true } },
        },
        orderBy: { created_at: "asc" },
      },
    },
  });

  if (!schedule) return res.status(404).json({ error: "Not found" });

  return res.json({
    scheduleId: schedule.id,
    className: schedule.class_model?.name ?? "Class",
    instructor: schedule.instructor?.name ?? "—",
    startTime: schedule.start_time.toISOString(),
    capacity: schedule.capacity,
    bookings: schedule.bookings.map(b => ({
      id: b.id,
      userId: b.user_id,
      name: b.profile?.full_name || "Member",
      email: b.profile?.email ?? "",
      avatarUrl: b.profile?.avatar_url ?? null,
      checkedIn: b.checked_in,
      checkInTime: b.check_in_time?.toISOString() ?? null,
      checkInOutcome: b.check_in_outcome ?? null,
      extraGuests: b.extra_guest_count ?? 0,
    })),
  });
}