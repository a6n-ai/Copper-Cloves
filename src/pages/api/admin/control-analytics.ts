import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { isStudioAdminProfileRole } from "@/lib/isStudioAdminProfile";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getTopStreaks } from "@/lib/attendanceStats";
import { hasRole } from "@/lib/auth/roles";

const CHECKIN_RATE_INR = 150;
const COACH_SHARE_PERCENT = 60;

function money(v: unknown) {
  if (v == null) return 0;
  const n = Number(v as number | string);
  return Number.isFinite(n) ? n : 0;
}

function coachCostForMonth(checkIns: number) {
  return Math.round((checkIns * CHECKIN_RATE_INR * COACH_SHARE_PERCENT) / 100);
}

function monthWindows(now: Date) {
  const windows: { start: Date; end: Date; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    windows.push({
      start,
      end,
      label: start.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    });
  }
  return windows;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (!hasRole(role, "admin")) return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") return res.status(405).end();

  const now = new Date();
  const windows = monthWindows(now);
  const rangeStart = windows[0].start;

  const monthStartCurr = windows[windows.length - 1].start;
  const thirtyAgo = new Date(now);
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);

  const [
    userPackagesRange,
    checkInsRange,
    totalProfiles,
    adminProfilesCount,
    profilesCreatedInRange,
    activePkgsNow,
    checkInsDistinct30,
    streakLeaders,
    bookingsMonthConfirmed,
    schedulesMonth,
    cafeOrdersDistinct30,
    packagesPrevMonthOnly,
    packagesTwoMonthsAgoOnly,
    schedules30dBookings,
    scheduleCounts,
    bookings30,
  ] = await Promise.all([
    prisma.userPackage.findMany({
      where: { purchase_date: { gte: rangeStart } },
      include: { package_type: true },
    }),
    prisma.booking.findMany({
      where: {
        checked_in: true,
        booking_date: { gte: rangeStart },
      },
      select: { booking_date: true },
    }),
    prisma.profile.count(),
    prisma.profile.count({
      where: { role: { equals: "admin", mode: "insensitive" } },
    }),
    prisma.profile.findMany({
      where: { created_at: { gte: rangeStart } },
      select: { created_at: true, role: true },
    }),
    prisma.userPackage.findMany({
      where: { is_active: true, expiration_date: { gt: now } },
      include: { package_type: true },
    }),
    prisma.booking.groupBy({
      by: ["user_id"],
      where: {
        checked_in: true,
        booking_date: { gte: thirtyAgo },
      },
    }),
    getTopStreaks(8),
    prisma.booking.findMany({
      where: {
        status: "confirmed",
        booking_date: { gte: monthStartCurr, lte: now },
        class_schedule_id: { not: null },
      },
      include: {
        class_schedule: { include: { class_model: true, instructor: true } },
      },
    }),
    prisma.classSchedule.findMany({
      where: {
        start_time: { gte: monthStartCurr, lte: now },
      },
      select: { class_id: true, capacity: true, class_model: { select: { max_capacity: true, id: true, name: true } } },
    }),
    prisma.cafeOrder.groupBy({
      by: ["user_id"],
      where: {
        order_date: { gte: thirtyAgo },
      },
    }),
    prisma.userPackage.findMany({
      where: {
        purchase_date: { gte: windows[4].start, lt: windows[5].start },
      },
      include: { package_type: true },
    }),
    prisma.userPackage.findMany({
      where: {
        purchase_date: { gte: windows[3].start, lt: windows[4].start },
      },
      include: { package_type: true },
    }),
    prisma.classSchedule.findMany({
      where: { start_time: { gte: new Date(now.getTime() - 30 * 86400000), lte: now } },
      select: { class_id: true, capacity: true, class_model: { select: { max_capacity: true } } },
    }),
    // Independent of every result above (keyed only on now/monthStartCurr) —
    // batched here instead of running as two trailing serial round trips.
    prisma.classSchedule.groupBy({
      by: ["instructor_id"],
      where: {
        start_time: { gte: monthStartCurr, lte: now },
        instructor_id: { not: null },
      },
      _count: { id: true },
    }),
    prisma.booking.count({
      where: {
        status: "confirmed",
        booking_date: { gte: new Date(now.getTime() - 30 * 86400000), lte: now },
        class_schedule_id: { not: null },
      },
    }),
  ]);

  const allMembersCount = Math.max(0, totalProfiles - adminProfilesCount);
  const membersCreatedRange = profilesCreatedInRange.filter(
    (p) => !isStudioAdminProfileRole(p.role)
  );

  // Windows are contiguous calendar months, so a date maps to exactly one
  // window by its year*12+month key. Bucket each dataset in a single pass
  // instead of re-scanning every array (and re-parsing every date) per window.
  const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();
  const winIdxByKey = new Map<number, number>();
  windows.forEach((w, i) => winIdxByKey.set(monthKey(w.start), i));

  const revenuePerWin = new Array(windows.length).fill(0);
  const checkInsPerWin = new Array(windows.length).fill(0);
  for (const p of userPackagesRange) {
    const i = winIdxByKey.get(monthKey(new Date(p.purchase_date)));
    if (i !== undefined) revenuePerWin[i] += money(p.package_type.price);
  }
  for (const b of checkInsRange) {
    const i = winIdxByKey.get(monthKey(new Date(b.booking_date)));
    if (i !== undefined) checkInsPerWin[i] += 1;
  }
  const monthlyRevenue = windows.map((w, i) => ({
    label: w.label,
    revenue: Math.round(revenuePerWin[i]),
    expense: coachCostForMonth(checkInsPerWin[i]),
  }));

  let revenueGrowthPct: number | null = null;
  const prevM = monthlyRevenue[monthlyRevenue.length - 2]?.revenue ?? 0;
  const currM = monthlyRevenue[monthlyRevenue.length - 1]?.revenue ?? 0;
  if (prevM > 0) revenueGrowthPct = Math.round(((currM - prevM) / prevM) * 100);
  else if (currM > 0) revenueGrowthPct = 100;

  const packageTotals = new Map<string, number>();
  for (const p of userPackagesRange) {
    const name = p.package_type?.name ?? "Packages";
    packageTotals.set(name, (packageTotals.get(name) ?? 0) + money(p.package_type.price));
  }
  const totalPkgRevAll = [...packageTotals.values()].reduce((a, b) => a + b, 0);
  const revenueSources = [...packageTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, amt]) => ({
      name,
      amount: Math.round(amt),
      pct: totalPkgRevAll > 0 ? Math.round((amt / totalPkgRevAll) * 100) : 0,
    }));
  if (revenueSources.length === 0) revenueSources.push({ name: "No purchases", amount: 0, pct: 100 });

  const newMembersPerWin = new Array(windows.length).fill(0);
  for (const m of membersCreatedRange) {
    const i = winIdxByKey.get(monthKey(new Date(m.created_at)));
    if (i !== undefined) newMembersPerWin[i] += 1;
  }
  const newMembersMonthly = windows.map((w, i) => ({
    label: w.label,
    count: newMembersPerWin[i],
  }));
  const ngPrev = newMembersMonthly[newMembersMonthly.length - 2]?.count ?? 0;
  const ngCurr = newMembersMonthly[newMembersMonthly.length - 1]?.count ?? 0;
  let memberGrowthPct: number | null;
  if (ngPrev > 0) memberGrowthPct = Math.round(((ngCurr - ngPrev) / ngPrev) * 100);
  else if (ngCurr > 0) memberGrowthPct = 100;
  else memberGrowthPct = 0;

  const passCounts = new Map<string, number>();
  for (const up of activePkgsNow) {
    const n = up.package_type?.name ?? "Package";
    passCounts.set(n, (passCounts.get(n) ?? 0) + 1);
  }
  const passTotal = [...passCounts.values()].reduce((a, b) => a + b, 0);
  const passDistribution = [...passCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      pct: passTotal > 0 ? Math.round((count / passTotal) * 100) : 0,
    }));
  const active30 = checkInsDistinct30.length;

  const inactiveApprox = Math.max(0, allMembersCount - active30);
  const activeRatePct = allMembersCount > 0 ? Math.round((active30 / allMembersCount) * 100) : 0;

  const streakWinners = streakLeaders.filter((s) => s.stats.current_streak > 0).slice(0, 5);
  const streakProfiles = await prisma.profile.findMany({
    where: { id: { in: streakWinners.map((s) => s.user_id) } },
    select: { id: true, full_name: true, email: true },
  });
  const streakNameById = new Map(
    streakProfiles.map((p) => [p.id, p.full_name || p.email || "Member"]),
  );
  const leaderboard = streakWinners.map((s) => ({
    name: streakNameById.get(s.user_id) ?? "Member",
    streak: s.stats.current_streak,
  }));
  const streakMax = Math.max(...leaderboard.map((l) => l.streak), 1);

  const instCheck = new Map<string, { name: string; checkins: number }>();
  for (const b of bookingsMonthConfirmed) {
    const iid = b.class_schedule?.instructor_id;
    const name = b.class_schedule?.instructor?.name ?? "Coach";
    if (!iid) continue;
    const p = instCheck.get(iid) ?? { name, checkins: 0 };
    if (b.checked_in) p.checkins += 1;
    instCheck.set(iid, p);
  }
  const instIdToTaught = new Map<string, number>();
  for (const row of scheduleCounts) {
    if (row.instructor_id) instIdToTaught.set(row.instructor_id, row._count.id);
  }

  const instructorRows = [...instCheck.entries()]
    .map(([id, v]) => ({
      id,
      name: v.name,
      checkIns: v.checkins,
      classesTaught: instIdToTaught.get(id) ?? 0,
      earnings:
        Math.round((v.checkins * CHECKIN_RATE_INR * COACH_SHARE_PERCENT) / 100),
      sharePct: COACH_SHARE_PERCENT,
    }))
    .sort((a, b) => b.checkIns - a.checkIns);

  const maxInstCheckIns = Math.max(...instructorRows.map((r) => r.checkIns), 1);
  const topEarners = [...instructorRows]
    .sort((a, b) => b.earnings - a.earnings)
    .slice(0, 6);

  const classBookMap = new Map<string, { name: string; bookings: number }>();
  for (const b of bookingsMonthConfirmed) {
    const cm = b.class_schedule?.class_model;
    if (!cm) continue;
    const prev = classBookMap.get(cm.id) ?? { name: cm.name, bookings: 0 };
    prev.bookings += 1;
    classBookMap.set(cm.id, prev);
  }

  const slotByClassId = new Map<string, number>();
  const capByClassId = new Map<string, number>();
  for (const sl of schedulesMonth) {
    const cid = sl.class_id;
    const cap = sl.capacity ?? sl.class_model?.max_capacity ?? 12;
    slotByClassId.set(cid, (slotByClassId.get(cid) ?? 0) + 1);
    capByClassId.set(cid, Math.max(capByClassId.get(cid) ?? 0, cap));
  }

  const classPopularity = [...classBookMap.values()]
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 10);
  const maxBookings = Math.max(...classPopularity.map((c) => c.bookings), 1);

  const occupancyRows = [...classBookMap.entries()]
    .sort((a, b) => b[1].bookings - a[1].bookings)
    .slice(0, 12)
    .map(([cid, row]) => {
    const slots = slotByClassId.get(cid) ?? Math.max(1, Math.ceil(row.bookings));
    const cap = Math.max(capByClassId.get(cid) ?? 12, 1);
    const seats = slots * cap;
    let u: number;
    if (seats > 0) u = Math.min(100, Math.round((row.bookings / seats) * 100));
    else if (row.bookings > 0) u = 50;
    else u = 0;
    let status: "full" | "high" | "good" | "moderate" | "low";
    if (u >= 92) status = "full";
    else if (u >= 78) status = "high";
    else if (u >= 60) status = "good";
    else if (u >= 40) status = "moderate";
    else status = "low";
    return { name: row.name, occupancy: u, status };
  });

  const hourHist = new Array(24).fill(0);
  for (const b of bookingsMonthConfirmed) {
    const st = b.class_schedule?.start_time;
    if (!st) continue;
    const h = new Date(st).getHours();
    hourHist[h] += 1;
  }
  const peakMerged: { label: string; bookings: number; intensity: number }[] = [];
  const buckets: [number, number, string][] = [
    [5, 8, "5–8 AM"],
    [8, 11, "8–11 AM"],
    [11, 14, "11 AM–2 PM"],
    [14, 17, "2–5 PM"],
    [17, 20, "5–8 PM"],
    [20, 23, "8–11 PM"],
    [0, 5, "12–5 AM"],
    [23, 24, "11 PM–12 AM"],
  ];
  for (const [a, z, lab] of buckets) {
    let sum = 0;
    for (let h = a; h < z; h++) sum += hourHist[h] ?? 0;
    if (sum > 0) peakMerged.push({ label: lab, bookings: sum, intensity: 0 });
  }
  peakMerged.sort((a, b) => b.bookings - a.bookings);
  const peakMax = Math.max(...peakMerged.map((p) => p.bookings), 1);
  for (const p of peakMerged) p.intensity = Math.round((p.bookings / peakMax) * 100);

  const revLastMonthPrev = packagesTwoMonthsAgoOnly.reduce((s, r) => s + money(r.package_type.price), 0);
  const revLastMonth = packagesPrevMonthOnly.reduce((s, r) => s + money(r.package_type.price), 0);
  const rpmPrev = revLastMonthPrev > 0 && allMembersCount > 0 ? revLastMonthPrev / allMembersCount : 0;
  const rpmCurr = revLastMonth > 0 && allMembersCount > 0 ? revLastMonth / allMembersCount : 0;
  const rpmGrowth: number | null =
    rpmPrev > 0 ? Math.round(((rpmCurr - rpmPrev) / rpmPrev) * 100) : null;

  const slotOfferedApprox = schedules30dBookings.length * 14;
  const utilAvg =
    slotOfferedApprox > 0 ? Math.min(100, Math.round((bookings30 / slotOfferedApprox) * 100)) : 0;

  const cafeAttachPct =
    checkInsDistinct30.length > 0
      ? Math.round((cafeOrdersDistinct30.length / checkInsDistinct30.length) * 100)
      : 0;

  return res.json({
    monthlyProfitLoss: monthlyRevenue.map((m) => ({
      label: m.label,
      revenue: Math.round(m.revenue / 1000),
      expense: Math.round(m.expense / 1000),
      profitk: Math.round((m.revenue - m.expense) / 1000),
    })),
    financial: {
      monthlyRevenue: monthlyRevenue.map((m) => ({
        label: m.label,
        amount: m.revenue,
        amountKDisplay: Math.round(m.revenue / 1000),
      })),
      revenueGrowthPct,
      revenueSources: revenueSources.slice(0, 8),
      totalRevenuePackages: Math.round(totalPkgRevAll),
    },
    members: {
      newMembersMonthly: newMembersMonthly.map((x) => ({ label: x.label, count: x.count })),
      memberGrowthPct,
      passDistribution,
      totalPassHolders: passTotal,
      activeRatePct,
      atRiskCount: inactiveApprox,
      leaderboard,
      streakMax,
    },
    instructors: {
      comparison: instructorRows.map((r) => ({ name: r.name, checkIns: r.checkIns, maxScale: maxInstCheckIns })),
      topEarners: topEarners.map((e) => ({ name: e.name, earnings: e.earnings, sharePct: e.sharePct })),
      classesTaught: instructorRows.map((r) => ({ name: r.name, classes: r.classesTaught, maxScale: Math.max(...instructorRows.map((x) => x.classesTaught), 1) })),
    },
    classes: {
      popularity: classPopularity.map((c) => ({ name: c.name, bookings: c.bookings, maxScale: maxBookings })),
      occupancy: occupancyRows.slice(0, 8),
      peakHours: peakMerged.slice(0, 8),
    },
    kpis: {
      revenuePerMember: allMembersCount > 0 ? Math.round(revLastMonth / Math.max(allMembersCount, 1)) : 0,
      revenuePerMemberGrowthPct: rpmGrowth,
      classUtilization: utilAvg,
      memberSatisfaction: null as number | null,
      cafeAttachPct,
    },
  });
}
