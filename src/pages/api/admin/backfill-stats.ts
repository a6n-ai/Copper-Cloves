import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";

async function backfillUser(userId: string) {
  const bookings = await prisma.booking.findMany({
    where: { user_id: userId, checked_in: true },
    orderBy: { check_in_time: "asc" },
    select: { check_in_time: true },
  });

  const total = bookings.length;
  if (total === 0) return null;

  let currentStreak = 0;
  let longestStreak = 0;
  let prevDay: Date | null = null;

  for (const b of bookings) {
    const date = b.check_in_time;
    if (!date) continue;
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (!prevDay) {
      currentStreak = 1;
    } else {
      const diff = Math.round((day.getTime() - prevDay.getTime()) / 86_400_000);
      if (diff === 0) {
        /* same day — no change */
      } else if (diff === 1) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, currentStreak);
    if (!prevDay || day.getTime() !== prevDay.getTime()) prevDay = day;
  }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (prevDay) {
    const daysSince = Math.round((todayStart.getTime() - prevDay.getTime()) / 86_400_000);
    if (daysSince > 1) currentStreak = 0;
  }

  const lastDate = bookings[bookings.length - 1].check_in_time;

  await prisma.userStats.upsert({
    where: { user_id: userId },
    update: {
      total_classes_attended: total,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_class_date: lastDate,
    },
    create: {
      user_id: userId,
      total_classes_attended: total,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_class_date: lastDate,
    },
  });

  return { total, currentStreak, longestStreak };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!ensureAdmin(session, res)) return;

  const checkedInUsers = await prisma.booking.findMany({
    where: { checked_in: true },
    select: { user_id: true },
    distinct: ["user_id"],
  });

  const results: { email: string; total: number; currentStreak: number; longestStreak: number }[] = [];

  for (const { user_id } of checkedInUsers) {
    const result = await backfillUser(user_id);
    if (result) {
      const profile = await prisma.profile.findUnique({
        where: { id: user_id },
        select: { email: true },
      });
      results.push({ email: profile?.email ?? user_id, ...result });
    }
  }

  return res.json({ backfilled: results.length, results });
}
