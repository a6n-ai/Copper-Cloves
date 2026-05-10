import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

function toMoney(v: unknown) {
  if (v == null) return 0;
  const n = Number(v as number | string);
  return Number.isFinite(n) ? n : 0;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
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
    totalMembers,
    newMembersThisMonth,
    checkInsToday,
    expiringWeek,
    packageRows,
    cafeOrdersMonth,
    usersWithoutWaiver,
    schedulesToday,
    upcomingSchedules,
    recentEvents,
  ] = await Promise.all([
    prisma.profile.count({ where: { role: "user" } }),
    prisma.profile.count({ where: { role: "user", created_at: { gte: monthStart } } }),
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
    prisma.profile.count({
      where: {
        role: "user",
        waivers: { none: {} },
      },
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
    prisma.userActivityEvent.findMany({
      orderBy: { created_at: "desc" },
      take: 10,
      include: { profile: { select: { full_name: true, email: true } } },
    }),
  ]);

  let monthRevenue = 0;
  for (const row of packageRows) {
    monthRevenue += toMoney(row.package_type.price);
  }

  const upcomingClasses = upcomingSchedules.map((s, idx) => {
    const cap = s.capacity ?? s.class_model?.max_capacity ?? 0;
    const spotsLeft = s.available_spots;
    const full = spotsLeft <= 0;
    const timeLabel = new Date(s.start_time).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return {
      id: idx + 1,
      scheduleId: s.id,
      name: s.class_model?.name ?? "Class",
      time: timeLabel,
      instructor: s.instructor?.name ?? "—",
      spots: `${Math.max(cap - spotsLeft, 0)}/${cap || "—"}`,
      status: full ? "full" : "upcoming",
    };
  });

  function relTime(d: Date) {
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hr ago`;
    return `${Math.floor(h / 24)} days ago`;
  }

  const recentActivity = recentEvents.map((e, i) => ({
    id: i + 1,
    type: e.event_category || "general",
    user: e.profile?.full_name || e.profile?.email || "Visitor",
    action: `${e.event_name}${e.path ? ` — ${e.path}` : ""}`,
    time: relTime(e.created_at),
  }));

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
    recentActivity,
  });
}
