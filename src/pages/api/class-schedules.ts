import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { month, year, fromMs, toMs } = req.query;
    let where: { start_time?: { gte: Date; lte: Date } } = {};
    const a = typeof fromMs === "string" ? Number(fromMs) : NaN;
    const b = typeof toMs === "string" ? Number(toMs) : NaN;
    if (!Number.isNaN(a) && !Number.isNaN(b)) {
      where = { start_time: { gte: new Date(a), lte: new Date(b) } };
    } else if (month && year) {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
      where = { start_time: { gte: start, lte: end } };
    }
    const schedules = await prisma.classSchedule.findMany({
      where,
      include: {
        class_model: true,
        instructor: true,
      },
      orderBy: { start_time: "asc" },
    });
    return res.json(schedules);
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "POST") {
    const data = req.body;
    const schedule = await prisma.classSchedule.create({ data });
    return res.status(201).json(schedule);
  }

  if (req.method === "PUT") {
    const { id, ...data } = req.body;
    const schedule = await prisma.classSchedule.update({ where: { id }, data });
    return res.json(schedule);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    await prisma.classSchedule.delete({ where: { id: String(id) } });
    return res.status(204).end();
  }

  res.status(405).end();
}
