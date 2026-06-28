import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Wrap a cron job so every run leaves a durable record in `cron_runs`. A green
 * GitHub Actions tick only proves the endpoint returned 200 — this captures what
 * the job actually DID (counts) or why it failed, so admins can verify outcome,
 * not just delivery. Best-effort: a logging failure never masks the job result.
 */
export async function withCronRun<T extends Prisma.InputJsonValue>(
  job: string,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  const run = await prisma.cronRun
    .create({ data: { job, status: "running" } })
    .catch(() => null);

  try {
    const result = await fn();
    await prisma.cronRun
      .update({
        where: { id: run?.id ?? "" },
        data: {
          status: "ok",
          finished_at: new Date(),
          duration_ms: Date.now() - startedAt,
          result,
        },
      })
      .catch(() => {});
    return result;
  } catch (e) {
    await prisma.cronRun
      .update({
        where: { id: run?.id ?? "" },
        data: {
          status: "failed",
          finished_at: new Date(),
          duration_ms: Date.now() - startedAt,
          error: e instanceof Error ? e.message : String(e),
        },
      })
      .catch(() => {});
    throw e;
  }
}
