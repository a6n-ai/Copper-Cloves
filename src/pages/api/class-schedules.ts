import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma, ClassScheduleStatus } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { apiError } from "@/lib/apiError";
import { logActivity } from "@/lib/activityLog";
import { sendClassRescheduledEmails } from "@/lib/notifications/sendBookingEmail";
import { OCCUPYING_STATUSES } from "@/lib/bookingStatus";
import { HIDDEN_SCHEDULE_STATUSES, LOCKED_SCHEDULE_STATUSES } from "@/lib/scheduleStatus";

const VALID_STATUS = new Set<string>(Object.values(ClassScheduleStatus));
const LOCKED_STATUSES = new Set<string>(LOCKED_SCHEDULE_STATUSES);

// Coerce a JSON scalar to string. Guards against object stringification
// ([object Object]) by only stringifying primitive values.
function toScalarString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

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

type IncomingSchedule = {
  class_id?: unknown;
  instructor_id?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  available_spots?: unknown;
  capacity?: unknown;
  status?: unknown;
  current_bookings?: unknown;
};

function normalizeScheduleInput(
  raw: IncomingSchedule,
  idx: number,
): { data?: Prisma.ClassScheduleCreateManyInput; error?: string } {
  if (!raw.start_time || !raw.end_time || !raw.class_id) {
    return { error: `Item ${idx}: class_id, start_time, and end_time are required.` };
  }
  const start = new Date(toScalarString(raw.start_time));
  const end = new Date(toScalarString(raw.end_time));
  const spots = Number(raw.available_spots);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: `Item ${idx}: invalid start_time or end_time.` };
  }
  if (!Number.isFinite(spots) || spots < 0) {
    return { error: `Item ${idx}: invalid available_spots.` };
  }
  return {
    data: {
      class_id: toScalarString(raw.class_id),
      instructor_id:
        raw.instructor_id != null && raw.instructor_id !== "" ? toScalarString(raw.instructor_id) : null,
      start_time: start,
      end_time: end,
      available_spots: spots,
      capacity: raw.capacity != null && raw.capacity !== "" ? Number(raw.capacity) : null,
      status: parseStatus(raw.status) ?? ClassScheduleStatus.available,
      current_bookings: Number(raw.current_bookings ?? 0),
    },
  };
}

function isAnonGet(req: NextApiRequest): boolean {
  // Anonymous callers (e.g. public /classes page) can hit a CDN-cached copy;
  // authed callers always bypass since responses can include user-scoped
  // booking joins downstream.
  return (
    !req.headers.cookie?.includes("next-auth.session-token") &&
    !req.headers.cookie?.includes("__Secure-next-auth.session-token")
  );
}

function buildScheduleWhere(query: NextApiRequest["query"]): Prisma.ClassScheduleWhereInput {
  const { month, year, fromMs, toMs, visibleOnly } = query;
  // Member/public callers pass `visibleOnly=1` → enforce member visibility on the
  // server (hide cancelled/inactive) instead of trusting each client to filter.
  // Admin calendar omits it and still sees every status.
  const visible = visibleOnly === "1" || visibleOnly === "true";
  const statusFilter: Prisma.ClassScheduleWhereInput = visible
    ? { status: { notIn: [...HIDDEN_SCHEDULE_STATUSES] as ClassScheduleStatus[] } }
    : {};
  const a = typeof fromMs === "string" ? Number(fromMs) : NaN;
  const b = typeof toMs === "string" ? Number(toMs) : NaN;
  if (!Number.isNaN(a) && !Number.isNaN(b)) {
    return { start_time: { gte: new Date(a), lte: new Date(b) }, ...statusFilter };
  }
  if (month && year) {
    const start = new Date(Number(year), Number(month) - 1, 1);
    const end = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
    return { start_time: { gte: start, lte: end }, ...statusFilter };
  }
  return { ...statusFilter };
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const anonGet = isAnonGet(req);
  try {
    const { expand, minimal } = req.query;
    /** Admin calendar only needs scalar rows; nested class_model + instructor can make responses very large. */
    const slim =
      expand === "0" || expand === "false" || minimal === "1" || minimal === "true";
    const where = buildScheduleWhere(req.query);
    const schedules = slim
      ? await prisma.classSchedule.findMany({ where, orderBy: { start_time: "asc" } })
      : await prisma.classSchedule.findMany({
          where,
          include: {
            class_model: true,
            instructor: {
              omit: { hashed_password: true, studio_payout_cut_percent: true },
            },
            actual_instructor: {
              omit: { hashed_password: true, studio_payout_cut_percent: true },
            },
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

async function createScheduleBatch(req: NextApiRequest, res: NextApiResponse, items: unknown[]) {
  if (items.length === 0) {
    return res.status(400).json({ error: "items must be a non-empty array." });
  }
  if (items.length > 200) {
    return res.status(400).json({ error: "Cannot create more than 200 schedules at once." });
  }
  const data: Prisma.ClassScheduleCreateManyInput[] = [];
  for (let i = 0; i < items.length; i++) {
    const { data: row, error } = normalizeScheduleInput(items[i] as IncomingSchedule, i);
    if (error) return res.status(400).json({ error });
    if (row) data.push(row);
  }
  const result = await prisma.classSchedule.createMany({ data, skipDuplicates: true });
  await logActivity({ req, action: "admin.schedule_created", metadata: { count: result.count } });
  return res.status(201).json({
    created: result.count,
    skipped: data.length - result.count,
  });
}

async function createScheduleSingle(req: NextApiRequest, res: NextApiResponse, body: IncomingSchedule) {
  // Single-item path. Rely on unique index to reject dupes (P2002 → friendly message).
  const { data, error } = normalizeScheduleInput(body, 0);
  if (error) return res.status(400).json({ error });
  try {
    const schedule = await prisma.classSchedule.create({ data: data });
    const cm = schedule.class_id
      ? await prisma.classModel.findUnique({ where: { id: schedule.class_id }, select: { name: true } })
      : null;
    await logActivity({
      req,
      action: "admin.schedule_created",
      entity: { type: "class_schedule", id: schedule.id },
      metadata: { class_name: cm?.name ?? null, start_time: fmtIstDateTime(schedule.start_time) },
    });
    return res.status(201).json(schedule);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Idempotent re-submit — return the existing row id.
      const existing = await prisma.classSchedule.findFirst({
        where: {
          start_time: data.start_time as Date,
          class_id: data.class_id,
          instructor_id: data.instructor_id ?? null,
        },
        select: { id: true },
      });
      return res.status(200).json({ ...existing, _existed: true });
    }
    throw e;
  }
}

function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const body = req.body ?? {};
  // Batch path: { items: [...] } → single createMany. Skips dupes via unique index.
  if (Array.isArray(body.items)) {
    return createScheduleBatch(req, res, body.items);
  }
  return createScheduleSingle(req, res, body as IncomingSchedule);
}

function nullableString(v: unknown): string | null {
  return v != null && v !== "" ? toScalarString(v) : null;
}

function applyScalarScheduleFields(rest: Record<string, unknown>, data: Record<string, unknown>): void {
  if (rest.class_id != null) data.class_id = toScalarString(rest.class_id);
  if (rest.start_time != null) data.start_time = new Date(toScalarString(rest.start_time));
  if (rest.end_time != null) data.end_time = new Date(toScalarString(rest.end_time));
  if (rest.available_spots != null) data.available_spots = Number(rest.available_spots);
  if (rest.current_bookings != null) data.current_bookings = Number(rest.current_bookings);
  if (rest.capacity !== undefined) {
    data.capacity = rest.capacity != null && rest.capacity !== "" ? Number(rest.capacity) : null;
  }
}

function applyNullableScheduleFields(rest: Record<string, unknown>, data: Record<string, unknown>): void {
  if (rest.instructor_id !== undefined) data.instructor_id = nullableString(rest.instructor_id);
  if (rest.actual_instructor_id !== undefined) {
    data.actual_instructor_id = nullableString(rest.actual_instructor_id);
  }
  if (rest.instructor_check_in_outcome !== undefined) {
    data.instructor_check_in_outcome = nullableString(rest.instructor_check_in_outcome);
  }
  if (rest.class_notes !== undefined) data.class_notes = nullableString(rest.class_notes);
}

function buildScheduleUpdateData(
  rest: Record<string, unknown>,
): { data?: Record<string, unknown>; error?: string } {
  const data: Record<string, unknown> = {};
  applyScalarScheduleFields(rest, data);
  applyNullableScheduleFields(rest, data);
  if (rest.status != null) {
    const parsed = parseStatus(rest.status);
    if (!parsed) {
      return { error: `Invalid status. Allowed: ${Array.from(VALID_STATUS).join(", ")}` };
    }
    data.status = parsed;
  }
  return { data };
}

function fmtIstDateTime(d: Date): string {
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}

async function handlePut(req: NextApiRequest, res: NextApiResponse) {
  const { id, ...rest } = req.body ?? {};
  if (!id) return res.status(400).json({ error: "id required" });
  const { data, error } = buildScheduleUpdateData(rest);
  if (error) return res.status(400).json({ error });
  if (!data || Object.keys(data).length === 0) {
    return res.status(400).json({ error: "No valid fields to update." });
  }
  const existing = await prisma.classSchedule.findUnique({
    where: { id: String(id) },
    select: {
      status: true,
      start_time: true,
      end_time: true,
      class_model: { select: { name: true } },
    },
  });
  if (!existing) return res.status(404).json({ error: "Schedule not found" });
  const editLock = scheduleEditLock({ status: existing.status, end_time: existing.end_time });
  if (editLock) {
    return res.status(409).json({ error: `Class is ${editLock} and cannot be edited.` });
  }

  const oldStart = existing.start_time;
  const oldEnd = existing.end_time;

  const schedule = await prisma.classSchedule.update({
    where: { id: String(id) },
    data: data as Prisma.ClassScheduleUpdateInput,
  });

  // Did the time actually move? Compare against the pre-update values.
  const startChanged =
    data.start_time != null && (data.start_time as Date).getTime() !== oldStart.getTime();
  const endChanged =
    data.end_time != null &&
    oldEnd != null &&
    (data.end_time as Date).getTime() !== oldEnd.getTime();
  const timeChanged = startChanged || endChanged;

  if (timeChanged) {
    // Keep each booking's snapshot in sync with the canonical schedule so no
    // surface shows a stale time (the V. Shyamala 6pm-vs-7:30pm bug), then email
    // every booked customer the corrected time.
    try {
      // Resync the snapshot AND clear reminder_sent_at so the ~1h pre-class
      // reminder re-fires with the new time (even if one already went out for the
      // old time). The reminder query is time-windowed, so it only re-sends if the
      // new start is still upcoming.
      await prisma.booking.updateMany({
        where: { class_schedule_id: schedule.id, status: { in: [...OCCUPYING_STATUSES] } },
        data: { class_time: schedule.start_time.toISOString(), reminder_sent_at: null },
      });
      // Same for the instructor roster (~6h before): let it re-send with the new time.
      await prisma.classSchedule.update({
        where: { id: schedule.id },
        data: { roster_sent_at: null },
      });
    } catch (e) {
      console.error("[class-schedules PUT] class_time resync failed", e);
    }
    await sendClassRescheduledEmails(schedule.id, oldStart).catch((e) =>
      console.error("[class-schedules PUT] reschedule emails failed", e),
    );
  }

  const changedFields = Object.keys(data);
  await logActivity({
    req,
    action: "admin.schedule_edited",
    entity: { type: "class_schedule", id: schedule.id },
    metadata: {
      class_name: existing.class_model?.name ?? null,
      changed_fields: changedFields,
      time_changed: timeChanged,
      ...(timeChanged
        ? {
            old_time: fmtIstDateTime(oldStart),
            new_time: fmtIstDateTime(schedule.start_time),
            changes: [
              { field: "start_time", from: fmtIstDateTime(oldStart), to: fmtIstDateTime(schedule.start_time) },
            ],
          }
        : {}),
    },
  });
  return res.json(schedule);
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const existing = await prisma.classSchedule.findUnique({
    where: { id: String(id) },
    select: { status: true, end_time: true, class_model: { select: { name: true } } },
  });
  if (!existing) return res.status(404).json({ error: "Schedule not found" });
  const deleteLock = scheduleEditLock({ status: existing.status, end_time: existing.end_time });
  if (deleteLock) {
    return res.status(409).json({ error: `Class is ${deleteLock} and cannot be deleted.` });
  }
  await prisma.classSchedule.delete({ where: { id: String(id) } });
  await logActivity({
    req,
    action: "admin.schedule_deleted",
    entity: { type: "class_schedule", id: String(id) },
    metadata: { class_name: existing.class_model?.name ?? null },
  });
  return res.status(204).end();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") return handleGet(req, res);

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });

  try {
    if (req.method === "POST") return await handlePost(req, res);
    if (req.method === "PUT") return await handlePut(req, res);
    if (req.method === "DELETE") return await handleDelete(req, res);
  } catch (e) {
    return apiError(res, e, "[class-schedules mutate]", 503, prismaUserMessage(e));
  }

  res.status(405).end();
}
