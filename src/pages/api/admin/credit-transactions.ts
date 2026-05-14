import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

function dt(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Synthetic ledger from bookings + package purchases for the admin Credits page. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });

  if (req.method !== "GET") return res.status(405).end();

  const take = Math.min(Number(req.query.limit) || 300, 500);

  const [bookings, packages] = await Promise.all([
    prisma.booking.findMany({
      where: { status: "confirmed" },
      include: { profile: { select: { full_name: true, email: true } } },
      orderBy: { booking_date: "desc" },
      take,
    }),
    prisma.userPackage.findMany({
      include: { profile: { select: { full_name: true, email: true } }, package_type: true },
      orderBy: { purchase_date: "desc" },
      take,
    }),
  ]);

  type Row = {
    id: string;
    memberId: string;
    memberName: string;
    type: "added" | "deducted" | "used" | "expired";
    amount: number;
    reason: string;
    date: string;
    adminName: string;
  };

  const usedRows: Row[] = bookings.map((b) => ({
    id: `b-${b.id}`,
    memberId: b.user_id,
    memberName: b.profile?.full_name || b.profile?.email || "Member",
    type: "used" as const,
    amount: 1,
    reason: b.class_name ? `Booked ${b.class_name}` : "Class booking",
    date: dt(b.booking_date),
    adminName: "System",
  }));

  const addedRows: Row[] = packages.map((up) => {
    const amount =
      up.credits_total ??
      up.package_type.class_count ??
      up.classes_remaining ??
      0;
    return {
      id: `pkg-${up.id}`,
      memberId: up.user_id,
      memberName: up.profile.full_name || up.profile.email || "Member",
      type: "added" as const,
      amount: Math.max(amount, 0),
      reason: `Package purchase — ${up.package_type.name}`,
      date: dt(up.purchase_date),
      adminName: "System",
    };
  });

  const expiredRows: Row[] = packages
    .filter((up) => up.expiration_date < new Date() && !up.is_active)
    .map((up) => ({
      id: `exp-${up.id}`,
      memberId: up.user_id,
      memberName: up.profile.full_name || up.profile.email || "Member",
      type: "expired" as const,
      amount: up.credits_total ?? up.credits_remaining ?? 0,
      reason: "Pass expired — credits cleared",
      date: dt(up.expiration_date),
      adminName: "System",
    }));

  const rows = [...usedRows, ...addedRows, ...expiredRows].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  return res.json(rows);
}
