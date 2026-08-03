/**
 * Exercise-agent MCP tools. Read-only, all scoped to one member.
 *
 * Security invariant (see monarch/.llm/architecture.md "Security invariant"): every
 * handler here takes `profileId` from ExerciseToolContext — a value the SERVER closes
 * over at construction time (see exerciseServer.ts). None of these tools accept a
 * user/profile id as an argument. Do not add one — that turns a chat tool call into a
 * cross-tenant data leak.
 */
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";

export type ExerciseToolContext = {
  prisma: PrismaClient;
  profileId: string;
};

export type ExerciseToolDef<Shape extends z.ZodRawShape> = {
  name: string;
  description: string;
  inputSchema: Shape;
  handler: (args: z.infer<z.ZodObject<Shape>>, ctx: ExerciseToolContext) => Promise<unknown>;
};

// --- get_upcoming_bookings ---------------------------------------------------------

const getUpcomingBookings: ExerciseToolDef<Record<string, never>> = {
  name: "get_upcoming_bookings",
  description:
    "List the member's own confirmed upcoming class bookings (class name, time, instructor, status). No input.",
  inputSchema: {},
  handler: async (_args, { prisma, profileId }) => {
    const rows = await prisma.booking.findMany({
      where: {
        user_id: profileId,
        status: "confirmed",
        class_schedule: { start_time: { gte: new Date() } },
      },
      include: { class_schedule: { include: { class_model: true, instructor: true } } },
      orderBy: { class_schedule: { start_time: "asc" } },
    });
    return rows
      .filter((b) => b.class_schedule)
      .map((b) => ({
        booking_id: b.id,
        class_name: b.class_schedule!.class_model?.name ?? b.class_name ?? "Class",
        start_time: b.class_schedule!.start_time.toISOString(),
        end_time: b.class_schedule!.end_time.toISOString(),
        instructor_name: b.class_schedule!.instructor?.name ?? null,
        status: b.status,
      }));
  },
};

// --- get_class_schedule -------------------------------------------------------------

const getClassScheduleShape = {
  from_date: z.string().datetime().optional().describe("ISO datetime, defaults to now"),
  to_date: z.string().datetime().optional().describe("ISO datetime, defaults to 14 days from now"),
  category: z.string().optional().describe("Class category filter, e.g. 'Gentle', 'High'"),
  instructor_name: z.string().optional(),
};

const getClassSchedule: ExerciseToolDef<typeof getClassScheduleShape> = {
  name: "get_class_schedule",
  description:
    "List bookable (available) upcoming class sessions in a date window, optionally filtered by category or instructor. Not scoped to the member — this is the studio's public schedule.",
  inputSchema: getClassScheduleShape,
  handler: async (args, { prisma }) => {
    const from = args.from_date ? new Date(args.from_date) : new Date();
    const to = args.to_date ? new Date(args.to_date) : new Date(Date.now() + 14 * 24 * 60 * 60_000);

    const rows = await prisma.classSchedule.findMany({
      where: {
        status: "available",
        start_time: { gte: from, lte: to },
        ...(args.category ? { class_model: { category: { equals: args.category, mode: "insensitive" } } } : {}),
        ...(args.instructor_name ? { instructor: { name: { contains: args.instructor_name, mode: "insensitive" } } } : {}),
      },
      include: { class_model: true, instructor: true },
      orderBy: { start_time: "asc" },
      take: 50,
    });

    return rows.map((s) => ({
      schedule_id: s.id,
      class_name: s.class_model?.name ?? "Class",
      category: s.class_model?.category ?? null,
      start_time: s.start_time.toISOString(),
      end_time: s.end_time.toISOString(),
      instructor_name: s.instructor?.name ?? null,
      spots_left: s.available_spots,
    }));
  },
};

// --- get_progress_summary -----------------------------------------------------------

const getProgressSummary: ExerciseToolDef<Record<string, never>> = {
  name: "get_progress_summary",
  description:
    "Member's own progress: total classes attended, current/longest streak, last class date. No input.",
  inputSchema: {},
  handler: async (_args, { prisma, profileId }) => {
    const [stats, streak] = await Promise.all([
      prisma.userStats.findUnique({ where: { user_id: profileId } }),
      prisma.userStreak.findUnique({ where: { user_id: profileId } }),
    ]);
    return {
      total_classes_attended: stats?.total_classes_attended ?? 0,
      current_streak: streak?.current_streak ?? stats?.current_streak ?? 0,
      longest_streak: streak?.longest_streak ?? stats?.longest_streak ?? 0,
      last_class_date: (streak?.last_class_date ?? stats?.last_class_date)?.toISOString() ?? null,
    };
  },
};

// --- get_active_packages -------------------------------------------------------------

const getActivePackages: ExerciseToolDef<Record<string, never>> = {
  name: "get_active_packages",
  description: "Member's own active class packages/passes: name, credits remaining/total, expiry. No input.",
  inputSchema: {},
  handler: async (_args, { prisma, profileId }) => {
    const rows = await prisma.userPackage.findMany({
      where: { user_id: profileId, is_active: true },
      include: { package_type: true },
      orderBy: { expiration_date: "asc" },
    });
    return rows.map((p) => ({
      package_name: p.package_type?.name ?? "Package",
      is_unlimited: p.package_type?.is_unlimited ?? false,
      credits_remaining: p.credits_remaining,
      credits_total: p.credits_total,
      expiration_date: p.expiration_date.toISOString(),
      is_paused: p.is_paused,
    }));
  },
};

// --- get_badges -----------------------------------------------------------------------

const getBadges: ExerciseToolDef<Record<string, never>> = {
  name: "get_badges",
  description: "Member's own earned badges: name, icon, when earned. No input.",
  inputSchema: {},
  handler: async (_args, { prisma, profileId }) => {
    const rows = await prisma.userBadge.findMany({
      where: { user_id: profileId },
      orderBy: { earned_at: "desc" },
    });
    return rows.map((b) => ({
      badge_name: b.badge_name,
      icon: b.icon,
      earned_at: b.earned_at.toISOString(),
    }));
  },
};

// --- get_recent_activity ---------------------------------------------------------------

const getRecentActivityShape = {
  limit: z.number().int().min(1).max(50).optional().describe("Max events to return, default 20"),
};

const getRecentActivity: ExerciseToolDef<typeof getRecentActivityShape> = {
  name: "get_recent_activity",
  description:
    "Member's own recent activity (classes attended, categories) — use this to vary suggestions instead of repeating what they just did.",
  inputSchema: getRecentActivityShape,
  handler: async (args, { prisma, profileId }) => {
    const events = await prisma.userActivityEvent.findMany({
      where: { profile_id: profileId },
      orderBy: { created_at: "desc" },
      take: args.limit ?? 20,
    });

    const scheduleIds = events
      .filter((e) => e.entity_type === "class_schedule" && e.entity_id)
      .map((e) => e.entity_id as string);

    const schedules = scheduleIds.length
      ? await prisma.classSchedule.findMany({
          where: { id: { in: scheduleIds } },
          include: { class_model: true },
        })
      : [];
    const scheduleById = new Map(schedules.map((s) => [s.id, s]));

    return events.map((e) => {
      const schedule = e.entity_id ? scheduleById.get(e.entity_id) : undefined;
      return {
        event_name: e.event_name,
        event_category: e.event_category,
        class_name: schedule?.class_model?.name ?? null,
        class_category: schedule?.class_model?.category ?? null,
        occurred_at: e.created_at.toISOString(),
      };
    });
  },
};

export const exerciseTools = [
  getUpcomingBookings,
  getClassSchedule,
  getProgressSummary,
  getActivePackages,
  getBadges,
  getRecentActivity,
] as const;
