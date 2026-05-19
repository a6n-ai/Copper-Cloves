import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { isStudioAdminProfileRole } from "@/lib/isStudioAdminProfile";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

function toMoney(v: unknown) {
  if (v == null) return 0;
  const n = Number(v as number | string);
  return Number.isFinite(n) ? n : 0;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") return res.status(405).end();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [
    totalProfiles,
    adminProfiles,
    newProfilesThisMonth,
    newAdminProfilesThisMonth,
    checkInsToday,
    expiringWeek,
    packageRows,
    cafeOrdersMonth,
    profilesMissingWaiver,
    schedulesToday,
    upcomingSchedules,
  ] = await Promise.all([
    prisma.profile.count(),
    prisma.profile.count({
      where: { role: { equals: "admin", mode: "insensitive" } },
    }),
    prisma.profile.count({ where: { created_at: { gte: monthStart } } }),
    prisma.profile.count({
      where: {
        created_at: { gte: monthStart },
        role: { equals: "admin", mode: "insensitive" },
      },
    }),
    prisma.booking.count({
      where: { checked_in: true, check_in_time: { gte: dayStart, lt: dayEnd } },
    }),
    prisma.userPackage.count({
      where: {
        is_active: true,
        expiration_date: { gte: now, lte: weekEnd },
      },
    }),
    prisma.userPackage.findMany({
      where: { purchase_date: { gte: monthStart, lt: nextMonth } },
      include: { package_type: true },
    }),
    prisma.cafeOrder.count({
      where: { order_date: { gte: monthStart, lt: nextMonth } },
    }),
    prisma.profile.findMany({
      where: { waivers: { none: {} } },
      select: { role: true },
    }),
    prisma.classSchedule.count({
      where: { start_time: { gte: dayStart, lt: dayEnd } },
    }),
    prisma.classSchedule.findMany({
      where: { start_time: { gte: now } },
      include: { class_model: true, instructor: true },
      orderBy: { start_time: "asc" },
      take: 8,
    }),
  ]);

  const totalMembers = Math.max(0, totalProfiles - adminProfiles);
  const newMembersThisMonth = Math.max(0, newProfilesThisMonth - newAdminProfilesThisMonth);
  const usersWithoutWaiver = profilesMissingWaiver.filter(
    (p) => !isStudioAdminProfileRole(p.role)
  ).length;

  let monthRevenue = 0;
  for (const row of packageRows) {
    monthRevenue += toMoney(row.package_type.price);
  }

  const upcomingClasses = upcomingSchedules.map((s) => {
    const cap = s.capacity ?? s.class_model?.max_capacity ?? 0;
    const spotsLeft = s.available_spots;
    const full = spotsLeft <= 0;
    const timeLabel = new Date(s.start_time).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
    return {
      id: s.id,
      scheduleId: s.id,
      name: s.class_model?.name ?? "Class",
      time: timeLabel,
      instructor: s.instructor?.name ?? "—",
      instructorAvatarUrl: s.instructor?.image_url ?? null,
      enrolled: Math.max(cap - spotsLeft, 0),
      capacity: cap,
      spots: `${Math.max(cap - spotsLeft, 0)}/${cap || "—"}`,
      status: full ? "full" : "upcoming",
    };
  });

  return res.json({
    overviewStats: {
      totalMembers,
      activeToday: checkInsToday,
      expiringWeek,
      monthRevenue,
      cafeOrders: cafeOrdersMonth,
      pendingWaivers: usersWithoutWaiver,
    },
    meta: {
      classesTodayCount: schedulesToday,
      newMembersThisMonth,
    },
    upcomingClasses,
  });
}
