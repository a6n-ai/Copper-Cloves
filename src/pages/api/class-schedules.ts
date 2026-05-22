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
    if (e.code === "P2002") {
      return "A schedule for this class, instructor and time already exists.";
    }
  }
  return e instanceof Error ? e.message : "Database error";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const { month, year, fromMs, toMs, expand, minimal } = req.query;
      /** Admin calendar only needs scalar rows; nested class_model + instructor can make responses very large. */
      const slim =
        expand === "0" ||
        expand === "false" ||
        minimal === "1" ||
        minimal === "true";
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
      const schedules = slim
        ? await prisma.classSchedule.findMany({
            where,
            orderBy: { start_time: "asc" },
          })
        : await prisma.classSchedule.findMany({
            where,
            include: {
              class_model: true,
              instructor: true,
              actual_instructor: true,
            },
            orderBy: { start_time: "asc" },
          });
      res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
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
      const body = req.body ?? {};
      const startRaw = body.start_time;
      const endRaw = body.end_time;
      if (!startRaw || !endRaw || !body.class_id) {
        return res.status(400).json({ error: "class_id, start_time, and end_time are required." });
      }
      const data = {
        class_id: String(body.class_id),
        instructor_id: body.instructor_id != null && body.instructor_id !== "" ? String(body.instructor_id) : null,
        start_time: new Date(startRaw as string),
        end_time: new Date(endRaw as string),
        available_spots: Number(body.available_spots),
        capacity: body.capacity != null && body.capacity !== "" ? Number(body.capacity) : null,
        status: typeof body.status === "string" ? body.status : "available",
        current_bookings: Number(body.current_bookings ?? 0),
      };
      if (!Number.isFinite(data.available_spots) || data.available_spots < 0) {
        return res.status(400).json({ error: "Invalid available_spots." });
      }
      if (Number.isNaN(data.start_time.getTime()) || Number.isNaN(data.end_time.getTime())) {
        return res.status(400).json({ error: "Invalid start_time or end_time." });
      }
      // Dedup: reject if a schedule already exists at this exact slot (same class + instructor + start_time).
      const existing = await prisma.classSchedule.findFirst({
        where: {
          start_time: data.start_time,
          class_id: data.class_id,
          instructor_id: data.instructor_id,
        },
        select: { id: true },
      });
      if (existing) {
        return res.status(200).json({ ...existing, _existed: true });
      }
      const schedule = await prisma.classSchedule.create({ data });
      return res.status(201).json(schedule);
    }

    if (req.method === "PUT") {
      const { id, ...rest } = req.body ?? {};
      if (!id) return res.status(400).json({ error: "id required" });
      const data: Record<string, unknown> = {};
      if (rest.class_id != null) data.class_id = String(rest.class_id);
      if (rest.instructor_id !== undefined) {
        data.instructor_id =
          rest.instructor_id != null && rest.instructor_id !== "" ? String(rest.instructor_id) : null;
      }
      if (rest.start_time != null) data.start_time = new Date(String(rest.start_time));
      if (rest.end_time != null) data.end_time = new Date(String(rest.end_time));
      if (rest.available_spots != null) data.available_spots = Number(rest.available_spots);
      if (rest.capacity !== undefined) {
        data.capacity =
          rest.capacity != null && rest.capacity !== "" ? Number(rest.capacity) : null;
      }
      if (rest.status != null) data.status = String(rest.status);
      if (rest.current_bookings != null) data.current_bookings = Number(rest.current_bookings);
      if (rest.actual_instructor_id !== undefined) {
        data.actual_instructor_id =
          rest.actual_instructor_id != null && rest.actual_instructor_id !== "" ? String(rest.actual_instructor_id) : null;
      }
      if (rest.instructor_check_in_outcome !== undefined) {
        data.instructor_check_in_outcome =
          rest.instructor_check_in_outcome != null && rest.instructor_check_in_outcome !== "" ? String(rest.instructor_check_in_outcome) : null;
      }
      if (rest.class_notes !== undefined) {
        data.class_notes = rest.class_notes != null && rest.class_notes !== "" ? String(rest.class_notes) : null;
      }
      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: "No valid fields to update." });
      }
      const schedule = await prisma.classSchedule.update({
        where: { id: String(id) },
        data: data as Prisma.ClassScheduleUpdateInput,
      });
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
