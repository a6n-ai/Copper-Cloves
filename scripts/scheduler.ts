/**
 * The app's own cron — a long-running scheduler using node-schedule.
 *  • class-emails       every 5 min  — ~1h member reminders + ~6h instructor rosters
 *  • schedule-lifecycle every 30 min — flip past-due classes to completed/abandoned
 * All jobs are idempotent (sent-flag / status guarded), so overlapping runs are safe.
 *
 * Run under a persistent process (PM2 — see ecosystem.config.js):
 *   npm run scheduler
 *
 * On serverless (Amplify/Lambda) where a persistent process isn't available,
 * point an external scheduler at GET /api/cron/class-emails and
 * GET /api/cron/reconcile-no-shows instead.
 */
import schedule from "node-schedule";
import {
  sendDueClassReminders,
  sendDueInstructorRosters,
} from "../src/lib/notifications/scheduledClassEmails";
import { advanceCompletedSchedules } from "../src/lib/scheduleLifecycle";

/** Wrap a job so overlapping ticks are skipped and failures don't kill the process. */
function guarded(name: string, fn: () => Promise<void>): () => Promise<void> {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (e) {
      console.error(`[scheduler] ${name} failed`, e);
    } finally {
      running = false;
    }
  };
}

const classEmailsJob = guarded("class-emails", async () => {
  const reminders = await sendDueClassReminders();
  const rosters = await sendDueInstructorRosters();
  console.log(
    `[scheduler] ${new Date().toISOString()} reminders(sent=${reminders.sent},skip=${reminders.skipped}) rosters(sent=${rosters.sent},skip=${rosters.skipped})`,
  );
});

const lifecycleJob = guarded("schedule-lifecycle", async () => {
  const prisma = (await import("../src/lib/prisma")).default;
  const r = await advanceCompletedSchedules(prisma);
  if (r.completed || r.abandoned) {
    console.log(
      `[scheduler] ${new Date().toISOString()} lifecycle(completed=${r.completed},abandoned=${r.abandoned})`,
    );
  }
});

console.log("[scheduler] starting · class-emails */5m · schedule-lifecycle */30m");
// Run both once at boot so a freshly-restarted process doesn't wait a full interval.
void classEmailsJob();
void lifecycleJob();
schedule.scheduleJob("*/5 * * * *", classEmailsJob);
schedule.scheduleJob("*/30 * * * *", lifecycleJob);
