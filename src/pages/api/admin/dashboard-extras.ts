import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { reconcileNoShowsGlobally } from "@/lib/bookingReconcile";
import { isStudioAdminProfileRole } from "@/lib/isStudioAdminProfile";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import {
  financeDemoTransactionsForUi,
  isFinanceDemoEnabled,
} from "@/lib/adminFinanceDemoTransactions";
import { parseFinanceSnapshot } from "@/lib/financeBookingCheckout";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") return res.status(405).end();

  const includeFinanceDemo =
    isFinanceDemoEnabled() && req.query.finance_demo !== "0";
  const financeDemoRows = includeFinanceDemo ? financeDemoTransactionsForUi() : [];

  try {
    await reconcileNoShowsGlobally(prisma);
  } catch (reconcileErr) {
    console.error("[dashboard-extras] reconcileNoShowsGlobally", reconcileErr);
  }

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const d14 = new Date(now);
  d14.setDate(d14.getDate() + 14);
  const d30 = new Date(now);
  d30.setDate(d30.getDate() + 30);

  let todaySchedules,
    expiringSoonPkgs,
    bookings30,
    scheduleSlots30,
    checkInsRecent,
    noShowsCount,
    activePackages,
    topBookers,
    recentPackages,
    topLeaderStats,
    cafeOrdersSample,
    instructorsFromDb,
    expBucketRows,
    financeBookingCandidates;

  try {
    [
      todaySchedules,
      expiringSoonPkgs,
      bookings30,
      scheduleSlots30,
      checkInsRecent,
      noShowsCount,
      activePackages,
      topBookers,
      recentPackages,
      topLeaderStats,
      cafeOrdersSample,
      instructorsFromDb,
      expBucketRows,
      financeBookingCandidates,
    ] = await Promise.all([
    prisma.classSchedule.findMany({
      where: { start_time: { gte: dayStart, lt: dayEnd } },
      include: {
        class_model: true,
        instructor: true,
        bookings: {
          where: { status: "confirmed" },
          include: { profile: { select: { full_name: true, email: true } } },
        },
      },
      orderBy: { start_time: "asc" },
    }),
    prisma.userPackage.findMany({
      where: { is_active: true, expiration_date: { gte: now, lte: d14 } },
      include: { profile: true, package_type: true },
      orderBy: { expiration_date: "asc" },
      take: 80,
    }),
    prisma.booking.findMany({
      where: {
        booking_date: { gte: monthAgo },
        status: "confirmed",
        class_schedule_id: { not: null },
      },
      include: { class_schedule: { include: { class_model: true, instructor: true } } },
    }),
    prisma.classSchedule.findMany({
      where: { start_time: { gte: monthAgo } },
      select: { class_id: true, capacity: true, class_model: { select: { max_capacity: true } } },
    }),
    prisma.booking.findMany({
      where: {
        checked_in: true,
        check_in_time: { not: null },
        booking_date: { gte: monthAgo },
        class_schedule_id: { not: null },
      },
      include: { class_schedule: true },
    }),
    prisma.booking.count({
      where: {
        check_in_outcome: "no_show",
        booking_date: { gte: monthAgo },
      },
    }),
    prisma.userPackage.findMany({
      where: { is_active: true, expiration_date: { gte: now } },
      include: { package_type: true },
    }),
    prisma.booking.findMany({
      where: { booking_date: { gte: monthAgo }, status: "confirmed" },
      select: { user_id: true },
    }),
    prisma.userPackage.findMany({
      take: 40,
      orderBy: { purchase_date: "desc" },
      include: {
        profile: { select: { full_name: true, email: true, phone: true } },
        package_type: true,
        razorpay_order: {
          include: {
            payments: { select: { razorpay_payment_id: true, amount_paise: true } },
          },
        },
      },
    }),
    prisma.userStats.findMany({
      orderBy: { total_classes_attended: "desc" },
      take: 1,
    }),
    prisma.cafeOrder.findMany({
      take: 8,
      orderBy: { order_date: "desc" },
      include: { cafe_item: { select: { name: true } } },
    }),
    prisma.instructor.findMany({
      orderBy: [{ display_order: "asc" }, { name: "asc" }],
    }),
    prisma.userPackage.findMany({
      where: { is_active: true, expiration_date: { gt: now, lte: d30 } },
      select: { expiration_date: true },
    }),
    prisma.booking.findMany({
      where: {
        booking_date: { gte: monthAgo },
        status: { in: ["confirmed", "pending"] },
      },
      take: 200,
      orderBy: { booking_date: "desc" },
      include: {
        profile: { select: { full_name: true, email: true, phone: true } },
        class_schedule: { include: { class_model: { select: { name: true } } } },
        razorpay_order: { select: { razorpay_order_id: true, amount_paise: true } },
        payments: { select: { razorpay_payment_id: true, amount_paise: true } },
        cafe_orders: {
          include: {
            cafe_item: { select: { name: true, price: true } },
          },
        },
      },
    }),
    ]);
  } catch (dbErr) {
    console.error("[dashboard-extras] database load failed", dbErr);
    return res.status(200).json({
      transactions: includeFinanceDemo ? financeDemoRows : [],
      todayClasses: [],
      expiringMembers: [],
      classPerformance: [
        { name: "No bookings yet", bookings: 0, capacity: 0, utilization: 0, discipline: "—" },
      ],
      disciplineSplit: [{ name: "—", count: 0, percentage: 100 }],
      instructorPerformance: [
        { name: "—", classes: 0, avgAttendance: 0, totalCheckIns: 0, rating: 0, specialties: "" },
      ],
      instructors: [],
      memberList: [],
      memberStats: {
        memberOfMonth: { name: "—", classes: 0, streak: 0 },
        topClass: { name: "—", bookings: 0 },
        weeklyStreak: { average: 0, top: 0 },
        onTimeCheckIns: 0,
        lateCheckIns: 0,
        checkInSample: 0,
        onTimeCheckInPct: 0,
        lateCheckInPct: 0,
        noShows: 0,
        expiring7Days: 0,
        expiring15Days: 0,
        expiring30Days: 0,
        specialtyActive: 0,
        inactiveUsers: 0,
      },
      sampleActivityOrderHistory: [],
      _partial: true,
    });
  }

  let lateCheckIns = 0;
  for (const b of checkInsRecent) {
    const st = b.class_schedule?.start_time;
    const ct = b.check_in_time;
    if (!st || !ct) continue;
    if (new Date(ct).getTime() > new Date(st).getTime()) lateCheckIns++;
  }
  const onTimeApprox = Math.max(0, checkInsRecent.length - lateCheckIns);

  const noShows = noShowsCount;

  const checkInSample = checkInsRecent.length;
  const onTimeCheckInPct = checkInSample > 0 ? Math.round((onTimeApprox / checkInSample) * 100) : 0;
  const lateCheckInPct = checkInSample > 0 ? Math.round((lateCheckIns / checkInSample) * 100) : 0;

  const todayClasses = todaySchedules.map((s) => ({
    id: s.id,
    name: s.class_model?.name ?? "Class",
    time: new Date(s.start_time).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    instructor: s.instructor?.name ?? "—",
    enrolled: s.bookings.length,
    checkedIn: s.bookings.filter((bk) => bk.checked_in).length,
    capacity: s.capacity ?? s.class_model?.max_capacity ?? 0,
    attendees: s.bookings.map((bk) => ({
      id: bk.id,
      userId: bk.user_id,
      name: bk.profile?.full_name || "Member",
      email: bk.profile?.email ?? "",
      checkedIn: bk.checked_in,
      checkInOutcome: bk.check_in_outcome,
      checkInTime: bk.check_in_time
        ? new Date(bk.check_in_time).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : null,
    })),
  }));

  const expiringMembers = expiringSoonPkgs.map((up) => ({
    id: up.user_id,
    name: up.profile.full_name || up.profile.email || "Member",
    email: up.profile.email ?? "",
    package: up.package_type?.name ?? "Package",
    expires: `${Math.max(
      0,
      Math.ceil((up.expiration_date.getTime() - now.getTime()) / 86400000)
    )} days`,
    credits: up.credits_remaining ?? 0,
  }));

  type ClassAgg = { id: string; name: string; bookings: number; capacity: number; category: string };
  const classMap = new Map<string, ClassAgg>();
  for (const b of bookings30) {
    const cm = b.class_schedule?.class_model;
    if (!cm) continue;
    const prev =
      classMap.get(cm.id) ??
      ({
        id: cm.id,
        name: cm.name,
        bookings: 0,
        capacity: cm.max_capacity || 15,
        category: cm.category || "general",
      } satisfies ClassAgg);
    prev.bookings++;
    classMap.set(cm.id, prev);
  }

  const slotCountByClass = new Map<string, number>();
  for (const sl of scheduleSlots30) slotCountByClass.set(sl.class_id, (slotCountByClass.get(sl.class_id) ?? 0) + 1);

  const classPerformance = [...classMap.values()].map((v) => {
    const slots =
      slotCountByClass.has(v.id) ? slotCountByClass.get(v.id)! : Math.max(1, Math.ceil(v.bookings / 10));
    const seatOffered = slots * v.capacity;
    const utilization =
      seatOffered > 0 ? Math.min(100, Math.round((v.bookings / seatOffered) * 100)) : v.bookings > 0 ? 33 : 0;
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

  type InstAgg = { name: string; specialties: string; bookings: number; checkIns: number };
  const instMap = new Map<string, InstAgg>();
  for (const b of bookings30) {
    const sch = b.class_schedule;
    if (!sch?.instructor_id || !sch.instructor) continue;
    const prev =
      instMap.get(sch.instructor_id) ??
      ({
        name: sch.instructor.name,
        specialties: sch.instructor.specialties?.slice(0, 2).join(", ") ?? "Classes",
        bookings: 0,
        checkIns: 0,
      } satisfies InstAgg);
    prev.bookings++;
    if (b.checked_in) prev.checkIns++;
    instMap.set(sch.instructor_id, prev);
  }
  const instructorPerformance = [...instMap.values()].map((i) => ({
    name: i.name,
    classes: i.bookings,
    avgAttendance:
      i.bookings > 0 ? Math.round((i.checkIns / Math.max(i.bookings, 1)) * 14 * 10) / 10 : 0,
    totalCheckIns: i.checkIns,
    rating: Math.min(
      5,
      Number((4.5 + Math.min(i.checkIns / Math.max(i.bookings, 1), 1) * 0.49).toFixed(1))
    ),
    specialties: i.specialties,
  }));

  let premiumActive = 0;
  let specialtyActive = 0;
  for (const up of activePackages) {
    const t = (up.package_type?.type || "").toLowerCase();
    const pass = (up.pass_type || "").toLowerCase();
    if (t.includes("studio") || pass === "studio_pass" || up.package_type?.is_unlimited) {
      specialtyActive++;
    } else premiumActive++;
  }

  const fourteenAgo = new Date(now);
  fourteenAgo.setDate(fourteenAgo.getDate() - 14);
  const activePkgUserIds = new Set(
    (
      await prisma.userPackage.findMany({
        where: { is_active: true, expiration_date: { gte: now } },
        select: { user_id: true },
      })
    ).map((r) => r.user_id)
  );
  const lastExpRows = await prisma.userPackage.groupBy({
    by: ["user_id"],
    _max: { expiration_date: true },
  });
  const lastMap = new Map(
    lastExpRows.map((r) => [r.user_id, r._max.expiration_date] as const)
  );
  const allMembers = await prisma.profile.findMany({
    select: { id: true, role: true },
  });
  const memberRows = allMembers.filter((p) => !isStudioAdminProfileRole(p.role));
  let inactiveUsers = 0;
  for (const m of memberRows) {
    if (activePkgUserIds.has(m.id)) continue;
    const le = lastMap.get(m.id);
    if (!le || le.getTime() < fourteenAgo.getTime()) inactiveUsers++;
  }

  let exp7 = 0;
  let exp15 = 0;
  let exp2030 = 0;
  for (const r of expBucketRows) {
    const d = Math.ceil((r.expiration_date.getTime() - now.getTime()) / 86400000);
    if (d <= 7) exp7++;
    else if (d <= 15) exp15++;
    else exp2030++;
  }

  const bookerCounts = new Map<string, number>();
  for (const row of topBookers) bookerCounts.set(row.user_id, (bookerCounts.get(row.user_id) ?? 0) + 1);
  let topUserId = "";
  let topCount = 0;
  for (const [uid, c] of bookerCounts.entries()) {
    if (c > topCount) {
      topCount = c;
      topUserId = uid;
    }
  }

  let memberOfMonth = { name: "—", classes: 0, streak: 0 };
  if (topUserId) {
    const profile = await prisma.profile.findUnique({
      where: { id: topUserId },
      include: { user_stats: true },
    });
    if (profile) {
      memberOfMonth = {
        name: profile.full_name || profile.email || "Member",
        classes: topCount || 0,
        streak: profile.user_stats?.current_streak ?? 0,
      };
    }
  }

  const topClassBooking = [...classMap.values()].sort((a, b) => b.bookings - a.bookings)[0];
  const lead = topLeaderStats[0];

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
        totalInr:
          rz?.amount_paise != null ? Math.round(Number(rz.amount_paise)) / 100 : net,
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
    const cafeOrdered =
      foodNet > 0.009 || (Array.isArray(b.cafe_orders) && b.cafe_orders.length > 0);
    const memberPlusLabel = guests > 0 ? `+${guests}` : "";
    const foodOrderedLabel = cafeOrdered ? "Food ordered" : "No food";

    const passLine = snap.noActivePackageCheckout
      ? `1 Day Class Pass ×${snap.dayPassEquivalentCount}`
      : `Day-pass equivalent ×${snap.dayPassEquivalentCount}`;

    const classTitle = b.class_schedule?.class_model?.name ?? "Class";
    const category = `${classTitle} (${passLine})`;

    const payIds =
      b.payments?.map((p) => p.razorpay_payment_id).filter(Boolean) ?? [];

    const guestRows = guestListFromJson(b.guest_attendees);
    const attendeeLines: {
      role: string;
      name: string;
      email?: string;
      phone?: string;
      notes?: string;
    }[] = [
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
          : snap.paymentMethod === "online"
            ? "Online"
            : "Pay at studio",
      financeDetail,
    };
  });

  const liveTransactions = [...packageTransactions, ...bookingFinanceTransactions].sort((a, b) =>
    a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0,
  );

  const transactions = includeFinanceDemo
    ? [...financeDemoRows, ...liveTransactions]
    : liveTransactions;

  const memberList = recentPackages.slice(0, 24).map((up, idx) => ({
    id: idx + 1,
    profileId: up.user_id,
    name: up.profile.full_name || up.profile.email || "Member",
    email: up.profile.email ?? "",
    package: up.package_type.name,
    credits: up.credits_remaining ?? 0,
    expiry: dt(up.expiration_date),
    streak: 0,
    onTime: 0,
    late: 0,
    noShow: 0,
  }));

  const sampleOrderHistory = cafeOrdersSample.map((o) => ({
    item: o.cafe_item?.name ?? "Café",
    date: dt(o.order_date),
    amount: 0,
  }));

  const instructors = instructorsFromDb.map((ins, idx) => ({
    id: ins.id,
    name: ins.name,
    email: ins.email ?? `coach${idx + 1}@thestudio.local`,
    phone: ins.phone ?? "—",
    specialties:
      Array.isArray(ins.specialties) && ins.specialties.length > 0
        ? ins.specialties.slice(0, 4)
        : ["Classes"],
    philosophy: ins.philosophy || ins.about || "",
    paymentPercentage: 60,
    photo: ins.image_url || "/placeholder.jpg",
    status: "active" as const,
  }));

  return res.json({
    todayClasses,
    expiringMembers,
    classPerformance: classPerformance.length
      ? classPerformance
      : [{ name: "No bookings yet", bookings: 0, capacity: 0, utilization: 0, discipline: "—" }],
    disciplineSplit:
      disciplineSplit.length > 0 ? disciplineSplit : [{ name: "—", count: 0, percentage: 100 }],
    instructorPerformance:
      instructorPerformance.length > 0
        ? instructorPerformance
        : [{ name: "—", classes: 0, avgAttendance: 0, totalCheckIns: 0, rating: 0, specialties: "" }],
    instructors,
    transactions,
    memberList,
    memberStats: {
      memberOfMonth,
      topClass: { name: topClassBooking?.name ?? "—", bookings: topClassBooking?.bookings ?? 0 },
      weeklyStreak: {
        average: lead?.current_streak ?? 0,
        top: lead?.longest_streak ?? 0,
      },
      onTimeCheckIns: onTimeApprox,
      lateCheckIns,
      checkInSample,
      onTimeCheckInPct,
      lateCheckInPct,
      noShows,
      expiring7Days: exp7,
      expiring15Days: exp15,
      expiring30Days: expBucketRows.length,
      specialtyActive,
      inactiveUsers,
    },
    sampleActivityOrderHistory: sampleOrderHistory,
  });
}
