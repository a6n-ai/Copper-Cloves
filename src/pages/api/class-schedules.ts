import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

function prismaUserMessage(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2022") {
      return "Database is missing a column Prisma expects (run prisma db push against this database, or redeploy so Amplify preBuild can sync the schema).";
    }
    if (e.code === "P2021") {
      return "Database is missing a table. Sync the schema with prisma db push on this environment.";
    }
  }
  return e instanceof Error ? e.message : "Database error";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
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
    } catch (e) {
      console.error("[class-schedules GET]", e);
      const msg = prismaUserMessage(e);
      return res.status(503).json({ error: msg });
    }
  }

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });

  try {
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
  } catch (e) {
    console.error("[class-schedules mutate]", e);
    const msg = prismaUserMessage(e);
    return res.status(503).json({ error: msg });
  }

  res.status(405).end();
}
