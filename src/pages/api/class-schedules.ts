import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma, ClassScheduleStatus } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { apiError } from "@/lib/apiError";

const VALID_STATUS = new Set<string>(Object.values(ClassScheduleStatus));
const LOCKED_STATUSES = new Set<string>(["completed", "abandoned"]);

/**
 * Authoritative edit/delete lock. A class is locked once it is terminal
 * (completed/abandoned) OR its scheduled end_time has passed — the latter
 * guards against a lagged enum (cron not yet run). Returns the lock reason
 * for the error message, or null if the class is still editable.
 */
function scheduleEditLock(s: { status: string; end_time: Date | null }): string | null {
  if (LOCKED_STATUSES.has(s.status)) return s.status;
  if (s.end_time != null && s.end_time.getTime() < Date.now()) return "complete";
  return null;
}

function parseStatus(v: unknown): ClassScheduleStatus | undefined {
  if (typeof v !== "string") return undefined;
  return VALID_STATUS.has(v) ? (v as ClassScheduleStatus) : undefined;
}

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
    // Anonymous callers (e.g. public /classes page) can hit a CDN-cached copy;
    // authed callers always bypass since responses can include user-scoped
    // booking joins downstream.
    const anonGet = !req.headers.cookie?.includes("next-auth.session-token") &&
      !req.headers.cookie?.includes("__Secure-next-auth.session-token");
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
      res.setHeader(
        "Cache-Control",
        anonGet
          ? "public, s-maxage=60, stale-while-revalidate=300"
          : "private, no-store, max-age=0, must-revalidate",
      );
      return res.json(schedules);
    } catch (e) {
      return apiError(res, e, "[class-schedules GET]", 503, prismaUserMessage(e));
    }
  }

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });

  try {
    if (req.method === "POST") {
      const body = req.body ?? {};

      type Incoming = {
        class_id?: unknown;
        instructor_id?: unknown;
        start_time?: unknown;
        end_time?: unknown;
        available_spots?: unknown;
        capacity?: unknown;
        status?: unknown;
        current_bookings?: unknown;
      };

      const normalize = (raw: Incoming, idx: number): { data?: Prisma.ClassScheduleCreateManyInput; error?: string } => {
        if (!raw.start_time || !raw.end_time || !raw.class_id) {
          return { error: `Item ${idx}: class_id, start_time, and end_time are required.` };
        }
        const start = new Date(String(raw.start_time));
        const end = new Date(String(raw.end_time));
        const spots = Number(raw.available_spots);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return { error: `Item ${idx}: invalid start_time or end_time.` };
        }
        if (!Number.isFinite(spots) || spots < 0) {
          return { error: `Item ${idx}: invalid available_spots.` };
        }
        return {
          data: {
            class_id: String(raw.class_id),
            instructor_id:
              raw.instructor_id != null && raw.instructor_id !== "" ? String(raw.instructor_id) : null,
            start_time: start,
            end_time: end,
            available_spots: spots,
            capacity:
              raw.capacity != null && raw.capacity !== "" ? Number(raw.capacity) : null,
            status: parseStatus(raw.status) ?? ClassScheduleStatus.available,
            current_bookings: Number(raw.current_bookings ?? 0),
          },
        };
      };

      // Batch path: { items: [...] } → single createMany. Skips dupes via unique index.
      if (Array.isArray(body.items)) {
        if (body.items.length === 0) {
          return res.status(400).json({ error: "items must be a non-empty array." });
        }
        if (body.items.length > 200) {
          return res.status(400).json({ error: "Cannot create more than 200 schedules at once." });
        }
        const data: Prisma.ClassScheduleCreateManyInput[] = [];
        for (let i = 0; i < body.items.length; i++) {
          const { data: row, error } = normalize(body.items[i] as Incoming, i);
          if (error) return res.status(400).json({ error });
          if (row) data.push(row);
        }
        const result = await prisma.classSchedule.createMany({ data, skipDuplicates: true });
        return res.status(201).json({
          created: result.count,
          skipped: data.length - result.count,
        });
      }

      // Single-item path. Rely on unique index to reject dupes (P2002 → friendly message).
      const { data, error } = normalize(body as Incoming, 0);
      if (error) return res.status(400).json({ error });
      try {
        const schedule = await prisma.classSchedule.create({ data: data! });
        return res.status(201).json(schedule);
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          // Idempotent re-submit — return the existing row id.
          const existing = await prisma.classSchedule.findFirst({
            where: {
              start_time: data!.start_time as Date,
              class_id: data!.class_id,
              instructor_id: data!.instructor_id ?? null,
            },
            select: { id: true },
          });
          return res.status(200).json({ ...existing, _existed: true });
        }
        throw e;
      }
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
      if (rest.status != null) {
        const parsed = parseStatus(rest.status);
        if (!parsed) return res.status(400).json({ error: `Invalid status. Allowed: ${Array.from(VALID_STATUS).join(", ")}` });
        data.status = parsed;
      }
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
      const existing = await prisma.classSchedule.findUnique({
        where: { id: String(id) },
        select: { status: true, end_time: true },
      });
      if (!existing) return res.status(404).json({ error: "Schedule not found" });
      const editLock = scheduleEditLock(existing);
      if (editLock) {
        return res.status(409).json({ error: `Class is ${editLock} and cannot be edited.` });
      }
      const schedule = await prisma.classSchedule.update({
        where: { id: String(id) },
        data: data as Prisma.ClassScheduleUpdateInput,
      });
      return res.json(schedule);
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      const existing = await prisma.classSchedule.findUnique({
        where: { id: String(id) },
        select: { status: true, end_time: true },
      });
      if (!existing) return res.status(404).json({ error: "Schedule not found" });
      const deleteLock = scheduleEditLock(existing);
      if (deleteLock) {
        return res.status(409).json({ error: `Class is ${deleteLock} and cannot be deleted.` });
      }
      await prisma.classSchedule.delete({ where: { id: String(id) } });
      return res.status(204).end();
    }
  } catch (e) {
    return apiError(res, e, "[class-schedules mutate]", 503, prismaUserMessage(e));
  }

  res.status(405).end();
}
