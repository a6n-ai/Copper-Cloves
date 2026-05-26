import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Advance class_schedules.status based on wall clock.
 *  available → completed   when end_time < now (class happened normally)
 *  cancelled → abandoned   when end_time < now (cancelled class is now history)
 *
 * Skips rows already at: completed, abandoned, inactive (admin intent), started.
 * Idempotent — safe to run repeatedly. Returns counts per transition.
 */
export async function advanceCompletedSchedules(
  prisma: PrismaClient,
): Promise<{ completed: number; abandoned: number }> {
  const now = new Date();
  const [completed, abandoned] = await Promise.all([
    prisma.classSchedule.updateMany({
      where: { end_time: { lt: now }, status: "available" },
      data: { status: "completed" },
    }),
    prisma.classSchedule.updateMany({
      where: { end_time: { lt: now }, status: "cancelled" },
      data: { status: "abandoned" },
    }),
  ]);
  return { completed: completed.count, abandoned: abandoned.count };
}
