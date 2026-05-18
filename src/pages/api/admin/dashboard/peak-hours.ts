import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

const SLOTS = [
  { label: "6–8 AM", startHour: 6, endHour: 8 },
  { label: "8–10 AM", startHour: 8, endHour: 10 },
  { label: "10–12 PM", startHour: 10, endHour: 12 },
  { label: "12–2 PM", startHour: 12, endHour: 14 },
  { label: "2–5 PM", startHour: 14, endHour: 17 },
  { label: "5–7 PM", startHour: 17, endHour: 19 },
  { label: "7–9 PM", startHour: 19, endHour: 21 },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Time-of-day × day-of-week booking heatmap over the last 30 days.
 * Returns rows (time slots) and grid: rows[][cols] = booking count.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.method !== "GET") return res.status(405).end();

  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const rows = await prisma.booking.findMany({
      where: { status: "confirmed", booking_date: { gte: since }, class_schedule_id: { not: null } },
      select: { class_schedule: { select: { start_time: true } } },
    });

    // grid[slotIdx][dayIdx] = count
    const grid: number[][] = SLOTS.map(() => Array(DAYS.length).fill(0));
    let max = 0;
    for (const b of rows) {
      const st = b.class_schedule?.start_time;
      if (!st) continue;
      const hour = st.getHours();
      const slotIdx = SLOTS.findIndex((s) => hour >= s.startHour && hour < s.endHour);
      if (slotIdx === -1) continue;
      const jsDay = st.getDay(); // 0=Sun
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1; // Mon-first
      grid[slotIdx][dayIdx] += 1;
      if (grid[slotIdx][dayIdx] > max) max = grid[slotIdx][dayIdx];
    }

    return res.json({
      slots: SLOTS.map((s) => s.label),
      days: DAYS,
      grid,
      max,
    });
  } catch (e) {
    console.error("[dashboard/peak-hours]", e);
    return res.status(200).json({ slots: SLOTS.map((s) => s.label), days: DAYS, grid: SLOTS.map(() => Array(DAYS.length).fill(0)), max: 0, _partial: true });
  }
}
