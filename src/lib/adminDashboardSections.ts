/**
 * Shared section computations for the admin dashboard.
 * Each function does the smallest DB work for its slice — endpoints under
 * /api/admin/dashboard/* call exactly one of these.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import {
  financeDemoTransactionsForUi,
  isFinanceDemoEnabled,
} from "@/lib/adminFinanceDemoTransactions";
import { parseFinanceSnapshot } from "@/lib/financeBookingCheckout";
import { getDynamicStats, getDynamicStatsForUsers, getTopStreaks, getStreakDistribution } from "@/lib/attendanceStats";

import { cdnUrl } from "@/lib/cdnUrl";
function dt(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function money(v: unknown) {
  if (v == null) return 0;
  const n = Number(v as number | string);
  return Number.isFinite(n) ? n : 0;
}

function guestListFromJson(raw: unknown): { name?: string; email?: string; phone?: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { name?: string; email?: string; phone?: string }[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const g = row as Record<string, unknown>;
    out.push({
      name: typeof g.name === "string" ? g.name : undefined,
      email: typeof g.email === "string" ? g.email : undefined,
      phone: typeof g.phone === "string" ? g.phone : undefined,
    });
  }
  return out;
}

function dayBoundsToday() {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return { now, dayStart, dayEnd };
}

function dayBoundsFor(date: Date) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return { dayStart, dayEnd };
}

function monthAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
}

type Db = PrismaClient | typeof prisma;

export async function getTodayClasses(db: Db = prisma, forDate?: Date) {
  const { dayStart, dayEnd } = forDate ? dayBoundsFor(forDate) : dayBoundsToday();
  const todaySchedules = await db.classSchedule.findMany({
    where: { start_time: { gte: dayStart, lt: dayEnd } },
    select: {
      id: true,
      start_time: true,
      capacity: true,
      class_model: { select: { name: true, max_capacity: true } },
      instructor: { select: { name: true, image_url: true } },
      bookings: {
        where: { status: "confirmed" },
        select: {
          id: true,
          user_id: true,
          checked_in: true,
          check_in_outcome: true,
          check_in_time: true,
          profile: { select: { full_name: true, email: true, avatar_url: true } },
        },
      },
    },
    orderBy: { start_time: "asc" },
  });

  return todaySchedules.map((s) => ({
    id: s.id,
    name: s.class_model?.name ?? "Class",
    time: new Date(s.start_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }),
    instructor: s.instructor?.name ?? "—",
    instructorAvatarUrl: s.instructor?.image_url ?? null,
    enrolled: s.bookings.length,
    checkedIn: s.bookings.filter((bk) => bk.checked_in).length,
    capacity: s.capacity ?? s.class_model?.max_capacity ?? 0,
    attendees: s.bookings.map((bk) => ({
      id: bk.id,
      userId: bk.user_id,
      name: bk.profile?.full_name || "Member",
      email: bk.profile?.email ?? "",
      avatarUrl: bk.profile?.avatar_url ?? null,
      checkedIn: bk.checked_in,
      checkInOutcome: bk.check_in_outcome,
      checkInTime: bk.check_in_time
        ? new Date(bk.check_in_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
        : null,
    })),
  }));
}

export async function getExpiringMembers(db: Db = prisma) {
  const now = new Date();
  const d14 = new Date(now);
  d14.setDate(d14.getDate() + 14);
  const expiring = await db.userPackage.findMany({
    where: { is_active: true, expiration_date: { gte: now, lte: d14 } },
    select: {
      user_id: true,
      credits_remaining: true,
      expiration_date: true,
      profile: { select: { full_name: true, email: true } },
      package_type: { select: { name: true } },
    },
    orderBy: { expiration_date: "asc" },
    take: 80,
  });
  return expiring.map((up) => ({
    id: up.user_id,
    name: up.profile.full_name || up.profile.email || "Member",
    email: up.profile.email ?? "",
    package: up.package_type?.name ?? "Package",
    expires: `${Math.max(
      0,
      Math.ceil((up.expiration_date.getTime() - now.getTime()) / 86400000),
    )} days`,
    credits: up.credits_remaining ?? 0,
  }));
}

type ClassAgg = { id: string; name: string; bookings: number; capacity: number; category: string };

async function aggregateClassPerformance(db: Db) {
  const mAgo = monthAgo();
  const [bookings30, scheduleSlots30] = await Promise.all([
    db.booking.findMany({
      where: { booking_date: { gte: mAgo }, status: "confirmed", class_schedule_id: { not: null } },
      select: {
        checked_in: true,
        class_schedule: {
          select: {
            instructor_id: true,
            class_model: { select: { id: true, name: true, max_capacity: true, category: true } },
            instructor: { select: { name: true, specialties: true } },
          },
        },
      },
    }),
    db.classSchedule.findMany({
      where: { start_time: { gte: mAgo } },
      select: { class_id: true, capacity: true, class_model: { select: { max_capacity: true } } },
    }),
  ]);

  const classMap = new Map<string, ClassAgg>();
  for (const b of bookings30) {
    const cm = b.class_schedule?.class_model;
    if (!cm) continue;
    const prev =
      classMap.get(cm.id) ??
      ({ id: cm.id, name: cm.name, bookings: 0, capacity: cm.max_capacity || 15, category: cm.category || "general" } satisfies ClassAgg);
    prev.bookings++;
    classMap.set(cm.id, prev);
  }

  const slotCountByClass = new Map<string, number>();
  for (const sl of scheduleSlots30) slotCountByClass.set(sl.class_id, (slotCountByClass.get(sl.class_id) ?? 0) + 1);

  const classPerformance = [...classMap.values()].map((v) => {
    const slots = slotCountByClass.has(v.id) ? slotCountByClass.get(v.id)! : Math.max(1, Math.ceil(v.bookings / 10));
    const seatOffered = slots * v.capacity;
    const utilization = seatOffered > 0
      ? Math.min(100, Math.round((v.bookings / seatOffered) * 100))
      : v.bookings > 0 ? 33 : 0;
    return {
      name: v.name,
      bookings: v.bookings,
      capacity: seatOffered,
      utilization,
      discipline: v.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    };
  });

  const discMap = new Map<string, number>();
  for (const v of classMap.values()) {
    const lab = v.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    discMap.set(lab, (discMap.get(lab) ?? 0) + v.bookings);
  }
  const discTotal = [...discMap.values()].reduce((a, b) => a + b, 0);
  const disciplineSplit = [...discMap.entries()].map(([name, count]) => ({
    name,
    count,
    percentage: discTotal > 0 ? Math.round((count / discTotal) * 100) : 0,
  }));

  return { bookings30, classMap, classPerformance, disciplineSplit };
}

export async function getClassPerformance(db: Db = prisma) {
  const { classPerformance, disciplineSplit } = await aggregateClassPerformance(db);
  return {
    classPerformance: classPerformance.length
      ? classPerformance
      : [{ name: "No bookings yet", bookings: 0, capacity: 0, utilization: 0, discipline: "—" }],
    disciplineSplit: disciplineSplit.length > 0 ? disciplineSplit : [{ name: "—", count: 0, percentage: 100 }],
  };
}

export async function getInstructorPerformance(db: Db = prisma) {
  const mAgo = monthAgo();
  const bookings30 = await db.booking.findMany({
    where: { booking_date: { gte: mAgo }, status: "confirmed", class_schedule_id: { not: null } },
    select: {
      checked_in: true,
      class_schedule: {
        select: {
          instructor_id: true,
          instructor: { select: { name: true, specialties: true, image_url: true } },
        },
      },
    },
  });

  type InstAgg = { name: string; specialties: string; photo: string | null; bookings: number; checkIns: number };
  const instMap = new Map<string, InstAgg>();
  for (const b of bookings30) {
    const sch = b.class_schedule;
    if (!sch?.instructor_id || !sch.instructor) continue;
    const prev =
      instMap.get(sch.instructor_id) ??
      ({
        name: sch.instructor.name,
        specialties: sch.instructor.specialties?.slice(0, 2).join(", ") ?? "Classes",
        photo: sch.instructor.image_url ?? null,
        bookings: 0,
        checkIns: 0,
      } satisfies InstAgg);
    prev.bookings++;
    if (b.checked_in) prev.checkIns++;
    instMap.set(sch.instructor_id, prev);
  }

  const rows = [...instMap.values()].map((i) => ({
    name: i.name,
    classes: i.bookings,
    avgAttendance: i.bookings > 0 ? Math.round((i.checkIns / Math.max(i.bookings, 1)) * 14 * 10) / 10 : 0,
    totalCheckIns: i.checkIns,
    rating: Math.min(5, Number((4.5 + Math.min(i.checkIns / Math.max(i.bookings, 1), 1) * 0.49).toFixed(1))),
    specialties: i.specialties,
    photo: i.photo,
  }));
  return rows.length > 0
    ? rows
    : [{ name: "—", classes: 0, avgAttendance: 0, totalCheckIns: 0, rating: 0, specialties: "", photo: null }];
}

export async function getInstructorsSummary(db: Db = prisma) {
  const rows = await db.instructor.findMany({
    orderBy: [{ display_order: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, email: true, phone: true,
      specialties: true, philosophy: true, about: true, image_url: true,
    },
  });
  return rows.map((ins, idx) => ({
    id: ins.id,
    name: ins.name,
    email: ins.email ?? `coach${idx + 1}@thestudio.local`,
    phone: ins.phone ?? "—",
    specialties: Array.isArray(ins.specialties) && ins.specialties.length > 0 ? ins.specialties.slice(0, 4) : ["Classes"],
    philosophy: ins.philosophy || ins.about || "",
    paymentPercentage: 60,
    photo: ins.image_url || cdnUrl("/placeholder.jpg"),
    status: "active" as const,
  }));
}

export async function getMemberStats(db: Db = prisma) {
  const now = new Date();
  const mAgo = monthAgo();
  const d30 = new Date(now);
  d30.setDate(d30.getDate() + 30);
  const fourteenAgo = new Date(now);
  fourteenAgo.setDate(fourteenAgo.getDate() - 14);

  // Top class — single SQL aggregate, no Node-side loop over all bookings.
  type TopClassRow = { name: string; c: bigint };
  const topClassRowsP = db.$queryRaw<TopClassRow[]>`
    SELECT cm.name AS name, COUNT(*)::bigint AS c
    FROM class_bookings b
    JOIN class_schedules cs ON cs.id = b.class_schedule_id
    JOIN class_types cm ON cm.id = cs.class_id
    WHERE b.booking_date >= ${mAgo} AND b.status = 'confirmed'
    GROUP BY cm.id, cm.name
    ORDER BY c DESC
    LIMIT 1
  `;

  // Top booker (member of month) — single GROUP BY user_id, then a profile lookup.
  type TopBookerRow = { user_id: string; c: bigint };
  const topBookerRowsP = db.$queryRaw<TopBookerRow[]>`
    SELECT user_id, COUNT(*)::bigint AS c
    FROM class_bookings
    WHERE booking_date >= ${mAgo} AND status = 'confirmed'
    GROUP BY user_id
    ORDER BY c DESC
    LIMIT 1
  `;

  // Inactive users — single SQL, no profile.findMany.
  type InactiveRow = { c: bigint };
  const inactiveRowP = db.$queryRaw<InactiveRow[]>`
    SELECT COUNT(*)::bigint AS c
    FROM profiles p
    WHERE LOWER(COALESCE(p.role, '')) <> 'admin'
      AND NOT EXISTS (
        SELECT 1 FROM user_packages up
        WHERE up.user_id = p.id AND up.is_active = true AND up.expiration_date >= ${now}
      )
      AND (
        NOT EXISTS (SELECT 1 FROM user_packages up WHERE up.user_id = p.id)
        OR (SELECT MAX(expiration_date) FROM user_packages WHERE user_id = p.id) < ${fourteenAgo}
      )
  `;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const growthStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    checkInsRecent,
    noShowsCount,
    activePackages,
    topLeaderStats,
    expBucketRows,
    topClassRows,
    topBookerRows,
    inactiveRow,
    totalMembersCount,
    checkInsThisMonth,
    signupRows,
    streakDistribution,
  ] = await Promise.all([
    db.booking.findMany({
      where: { checked_in: true, check_in_time: { not: null }, booking_date: { gte: mAgo }, class_schedule_id: { not: null } },
      select: { check_in_time: true, class_schedule: { select: { start_time: true } } },
    }),
    db.booking.count({ where: { check_in_outcome: "no_show", booking_date: { gte: mAgo } } }),
    db.userPackage.findMany({
      where: { is_active: true, expiration_date: { gte: now } },
      select: { user_id: true, pass_type: true, package_type: { select: { type: true, is_unlimited: true } } },
    }),
    getTopStreaks(1),
    db.userPackage.findMany({
      where: { is_active: true, expiration_date: { gt: now, lte: d30 } },
      select: { expiration_date: true },
    }),
    topClassRowsP,
    topBookerRowsP,
    inactiveRowP,
    db.profile.count({ where: { NOT: { role: { equals: "admin", mode: "insensitive" } } } }),
    db.booking.count({ where: { checked_in: true, check_in_time: { gte: monthStart } } }),
    db.profile.findMany({
      where: { created_at: { gte: growthStart }, NOT: { role: { equals: "admin", mode: "insensitive" } } },
      select: { created_at: true },
    }),
    getStreakDistribution(),
  ]);

  // New-member signups bucketed by month for the last 12 months.
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const growthBuckets: { key: string; month: string; growth: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    growthBuckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: monthNames[d.getMonth()], growth: 0 });
  }
  const growthIndex = new Map(growthBuckets.map((b, idx) => [b.key, idx]));
  for (const row of signupRows) {
    const d = new Date(row.created_at);
    const idx = growthIndex.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (idx != null) growthBuckets[idx].growth += 1;
  }
  const memberGrowth = growthBuckets.map(({ month, growth }) => ({ month, growth }));

  let lateCheckIns = 0;
  for (const b of checkInsRecent) {
    const st = b.class_schedule?.start_time;
    const ct = b.check_in_time;
    if (!st || !ct) continue;
    if (new Date(ct).getTime() > new Date(st).getTime()) lateCheckIns++;
  }
  const onTimeApprox = Math.max(0, checkInsRecent.length - lateCheckIns);
  const checkInSample = checkInsRecent.length;
  const onTimeCheckInPct = checkInSample > 0 ? Math.round((onTimeApprox / checkInSample) * 100) : 0;
  const lateCheckInPct = checkInSample > 0 ? Math.round((lateCheckIns / checkInSample) * 100) : 0;

  let specialtyActive = 0;
  const activeMemberIds = new Set<string>();
  const studioMemberIds = new Set<string>();
  for (const up of activePackages) {
    const t = (up.package_type?.type || "").toLowerCase();
    const pass = (up.pass_type || "").toLowerCase();
    const isStudio = t.includes("studio") || pass === "studio_pass" || Boolean(up.package_type?.is_unlimited);
    if (isStudio) specialtyActive++;
    activeMemberIds.add(up.user_id);
    if (isStudio) studioMemberIds.add(up.user_id);
  }
  const activeMembers = activeMemberIds.size;
  const studioPassActive = studioMemberIds.size;
  // Members whose only active pass(es) are non-studio class passes.
  const classPassActive = Array.from(activeMemberIds).filter((id) => !studioMemberIds.has(id)).length;

  const inactiveUsers = Number(inactiveRow[0]?.c ?? 0);

  let exp7 = 0, exp15 = 0;
  for (const r of expBucketRows) {
    const d = Math.ceil((r.expiration_date.getTime() - now.getTime()) / 86400000);
    if (d <= 7) exp7++;
    else if (d <= 15) exp15++;
  }

  // Member of month — top booker + profile fetch.
  let memberOfMonth = { name: "—", classes: 0, streak: 0 };
  const topBooker = topBookerRows[0];
  if (topBooker?.user_id) {
    const [profile, streak] = await Promise.all([
      db.profile.findUnique({
        where: { id: topBooker.user_id },
        select: { full_name: true, email: true },
      }),
      getDynamicStats(topBooker.user_id),
    ]);
    if (profile) {
      memberOfMonth = {
        name: profile.full_name || profile.email || "Member",
        classes: Number(topBooker.c) || 0,
        streak: streak.current_streak,
      };
    }
  }

  const topClassRow = topClassRows[0];
  const lead = topLeaderStats[0]?.stats;

  return {
    memberOfMonth,
    topClass: { name: topClassRow?.name ?? "—", bookings: Number(topClassRow?.c ?? 0) },
    weeklyStreak: { average: lead?.current_streak ?? 0, top: lead?.longest_streak ?? 0 },
    onTimeCheckIns: onTimeApprox,
    lateCheckIns,
    checkInSample,
    onTimeCheckInPct,
    lateCheckInPct,
    noShows: noShowsCount,
    expiring7Days: exp7,
    expiring15Days: exp15,
    expiring30Days: expBucketRows.length,
    specialtyActive,
    inactiveUsers,
    totalMembers: totalMembersCount,
    activeMembers,
    studioPassActive,
    classPassActive,
    checkInsThisMonth,
    memberGrowth,
    streakDistribution,
  };
}

export async function getMemberList(db: Db = prisma) {
  const recent = await db.userPackage.findMany({
    take: 40,
    orderBy: { purchase_date: "desc" },
    select: {
      user_id: true,
      credits_remaining: true,
      expiration_date: true,
      profile: { select: { full_name: true, email: true, phone: true, avatar_url: true } },
      package_type: { select: { name: true } },
    },
  });
  const top = recent.slice(0, 24);
  const userIds = top.map((up) => up.user_id);

  const [statsByUser, bookingRows] = await Promise.all([
    getDynamicStatsForUsers(userIds),
    db.booking.findMany({
      where: { user_id: { in: userIds } },
      select: { user_id: true, checked_in: true, check_in_outcome: true },
    }),
  ]);

  const perf = new Map<string, { onTime: number; late: number; noShow: number }>();
  for (const b of bookingRows) {
    const p = perf.get(b.user_id) ?? { onTime: 0, late: 0, noShow: 0 };
    if (b.check_in_outcome === "no_show") p.noShow += 1;
    else if (b.checked_in) {
      if (b.check_in_outcome === "late") p.late += 1;
      else p.onTime += 1;
    }
    perf.set(b.user_id, p);
  }

  return top.map((up, idx) => {
    const pf = perf.get(up.user_id) ?? { onTime: 0, late: 0, noShow: 0 };
    return {
      id: idx + 1,
      profileId: up.user_id,
      name: up.profile.full_name || up.profile.email || "Member",
      email: up.profile.email ?? "",
      avatarUrl: up.profile.avatar_url ?? null,
      package: up.package_type.name,
      credits: up.credits_remaining ?? 0,
      expiry: dt(up.expiration_date),
      streak: statsByUser.get(up.user_id)?.current_streak ?? 0,
      onTime: pf.onTime,
      late: pf.late,
      noShow: pf.noShow,
    };
  });
}

export async function getTransactions(db: Db = prisma, opts: { includeFinanceDemo?: boolean } = {}) {
  const mAgo = monthAgo();
  const includeFinanceDemo = opts.includeFinanceDemo ?? isFinanceDemoEnabled();
  const financeDemoRows = includeFinanceDemo ? financeDemoTransactionsForUi() : [];

  const [recentPackages, financeBookingCandidates] = await Promise.all([
    db.userPackage.findMany({
      take: 40,
      orderBy: { purchase_date: "desc" },
      select: {
        id: true,
        purchase_date: true,
        purchase_discount_inr: true,
        pass_type: true,
        profile: { select: { full_name: true, email: true, phone: true } },
        package_type: { select: { name: true, type: true, price: true } },
        razorpay_order: {
          select: {
            razorpay_order_id: true,
            amount_paise: true,
            payments: { select: { razorpay_payment_id: true, amount_paise: true } },
          },
        },
      },
    }),
    db.booking.findMany({
      where: { booking_date: { gte: mAgo }, status: { in: ["confirmed", "pending"] } },
      take: 200,
      orderBy: { booking_date: "desc" },
      select: {
        id: true,
        user_id: true,
        booking_date: true,
        extra_guest_count: true,
        guest_attendees: true,
        finance_snapshot: true,
        profile: { select: { full_name: true, email: true, phone: true } },
        class_schedule: { select: { class_model: { select: { name: true } } } },
        razorpay_order: { select: { razorpay_order_id: true, amount_paise: true } },
        payments: { select: { razorpay_payment_id: true, amount_paise: true } },
        cafe_orders: { select: { quantity: true, cafe_item: { select: { name: true, price: true } } } },
      },
    }),
  ]);

  const financeBookings = financeBookingCandidates.filter(
    (b) => parseFinanceSnapshot(b.finance_snapshot) !== null,
  );

  const packageTransactions = recentPackages.map((up) => {
    const gross = money(up.package_type.price);
    const disc = money(up.purchase_discount_inr);
    const net = Math.max(0, gross - disc);
    const rz = up.razorpay_order;
    const payIds = rz?.payments?.map((p) => p.razorpay_payment_id).filter(Boolean) ?? [];
    const fullName = up.profile.full_name || up.profile.email || "Member";

    const financeDetail = {
      finance1: true as const,
      source: "package" as const,
      memberName: fullName,
      memberEmail: up.profile.email ?? "—",
      memberPhone: up.profile.phone ?? "—",
      purchasedAtISO: up.purchase_date.toISOString(),
      transactionKinds: ["Package purchase"] as string[],
      razorpayOrderId: rz?.razorpay_order_id ?? null,
      razorpayPaymentIds: payIds,
      breakdown: {
        packageListInr: gross,
        couponDiscountInr: disc > 0 ? disc : undefined,
        classOrStudioPassInr: net,
        cafeNetInr: 0,
        taxInr: 0,
        totalInr: rz?.amount_paise != null ? Math.round(Number(rz.amount_paise)) / 100 : net,
      },
      attendeeLines: [
        {
          role: "Member",
          name: fullName,
          email: up.profile.email ?? "—",
          phone: up.profile.phone ?? "—",
          notes: `${up.package_type.name} (${up.package_type.type ?? up.pass_type ?? "package"})`,
        },
      ],
      cafeLines: [] as { name: string; quantity: number }[],
      paymentMethodSummary: rz ? "online" : "—",
      classSummary: `${up.package_type.name} (Studio pass / package)`,
      groupHeadcount: 1,
    };

    return {
      id: `pkg-${up.id}`,
      rawId: up.id,
      sortKey: up.purchase_date.toISOString(),
      memberPlusLabel: "",
      foodOrderedLabel: "—",
      finance1Tag: true,
      date: dt(up.purchase_date),
      member: fullName.split(" ")[0] ?? fullName.slice(0, 14),
      memberFull: fullName,
      type: "revenue" as const,
      amount: net,
      category: `${up.package_type.name} (Package)`,
      method: rz ? "Razorpay" : "—",
      financeDetail,
    };
  });

  const bookingFinanceTransactions = financeBookings.map((b) => {
    const snap = parseFinanceSnapshot(b.finance_snapshot)!;
    const profile = b.profile;
    const fullName = profile.full_name || profile.email || "Member";
    const guests = Math.max(0, b.extra_guest_count ?? 0);
    const foodNet = Math.max(0, snap.foodFeeInr - snap.foodDiscountInr);
    const cafeOrdered = foodNet > 0.009 || (Array.isArray(b.cafe_orders) && b.cafe_orders.length > 0);
    const memberPlusLabel = guests > 0 ? `+${guests}` : "";
    const foodOrderedLabel = cafeOrdered ? "Food ordered" : "No food";
    const passLine = snap.noActivePackageCheckout
      ? `1 Day Class Pass ×${snap.dayPassEquivalentCount}`
      : `Day-pass equivalent ×${snap.dayPassEquivalentCount}`;
    const classTitle = b.class_schedule?.class_model?.name ?? "Class";
    const category = `${classTitle} (${passLine})`;
    const payIds = b.payments?.map((p) => p.razorpay_payment_id).filter(Boolean) ?? [];
    const guestRows = guestListFromJson(b.guest_attendees);

    const attendeeLines: { role: string; name: string; email?: string; phone?: string; notes?: string }[] = [
      {
        role: "Member (booking holder)",
        name: fullName,
        email: profile.email ?? undefined,
        phone: profile.phone ?? undefined,
        notes:
          snap.paymentMethod === "online"
            ? "Paid online (Razorpay) — class + café on one checkout where applicable."
            : "Pay at studio",
      },
    ];
    for (let i = 0; i < guests; i++) {
      const g = guestRows[i] ?? {};
      attendeeLines.push({
        role: `Guest ${i + 1}`,
        name: g.name?.trim() || "(name not provided)",
        email: g.email?.trim(),
        phone: g.phone?.trim(),
        notes: `${passLine} (same roster row)`,
      });
    }

    const transactionKinds: string[] = [
      ...(snap.noActivePackageCheckout ? ["1 Day Class Pass (checkout)"] : ["Class checkout"]),
      ...(cafeOrdered ? ["Café purchase"] : []),
    ];

    const cafeLines = (b.cafe_orders ?? []).map((co) => ({
      name: co.cafe_item?.name ?? "Café item",
      quantity: co.quantity ?? 1,
    }));

    const financeDetail = {
      finance1: true as const,
      source: "booking" as const,
      memberName: fullName,
      memberEmail: profile.email ?? "—",
      memberPhone: profile.phone ?? "—",
      bookedAtISO: b.booking_date.toISOString(),
      transactionKinds,
      razorpayOrderId: b.razorpay_order?.razorpay_order_id ?? null,
      razorpayPaymentIds: payIds,
      breakdown: {
        packageListInr: undefined as number | undefined,
        classOrStudioPassInr: snap.classFeeInr,
        cafeNetInr: foodNet,
        taxInr: snap.taxInr,
        totalInr: snap.totalInr,
      },
      attendeeLines,
      cafeLines,
      paymentMethodSummary: snap.paymentMethod,
      classSummary: `${classTitle} — ${passLine}`,
      groupHeadcount: 1 + guests,
    };

    return {
      id: `booking-${b.id}`,
      rawId: b.id,
      sortKey: b.booking_date.toISOString(),
      memberPlusLabel,
      foodOrderedLabel,
      finance1Tag: true,
      date: dt(b.booking_date),
      member: fullName.split(" ")[0] ?? fullName.slice(0, 14),
      memberFull: fullName,
      type: "revenue" as const,
      amount: snap.totalInr,
      category,
      method:
        snap.paymentMethod === "online" && payIds.length > 0
          ? "Razorpay"
          : snap.paymentMethod === "online" ? "Online" : "Pay at studio",
      financeDetail,
    };
  });

  const liveTransactions = [...packageTransactions, ...bookingFinanceTransactions].sort((a, b) =>
    a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0,
  );

  return includeFinanceDemo ? [...financeDemoRows, ...liveTransactions] : liveTransactions;
}
