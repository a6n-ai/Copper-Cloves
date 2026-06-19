/**
 * The app's own cron — a long-running scheduler using node-schedule.
 *  • class-emails       every 5 min  — ~1h member reminders + ~6h instructor rosters
 *  • schedule-lifecycle every 30 min — flip past-due classes to completed/abandoned
 *  • razorpay-reconcile hourly       — fulfill paid-but-stuck Razorpay orders (deep backstop)
 * All jobs are idempotent (sent-flag / status guarded), so overlapping runs are safe.
 *
 * Run on a persistent host:
 *   npm run scheduler
 *
 * On Amplify (serverless/ephemeral), use external cron (EventBridge, cron-job.org, etc.)
 * hitting GET /api/cron/class-emails, /api/cron/reconcile-no-shows and
 * /api/cron/reconcile-razorpay instead.
 */
import schedule from "node-schedule";
import {
  sendDueClassReminders,
  sendDueInstructorRosters,
} from "../src/lib/notifications/scheduledClassEmails";
import { advanceCompletedSchedules } from "../src/lib/scheduleLifecycle";
import { reconcileStuckRazorpayOrders } from "../src/lib/razorpayPersistence";
import { processPendingBookingLifecycle } from "../src/lib/processPendingBookingLifecycle";

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

const razorpayReconcileJob = guarded("razorpay-reconcile", async () => {
  const r = await reconcileStuckRazorpayOrders();
  if (r.scanned || r.fulfilled || r.healedPaid || r.errors) {
    console.log(
      `[scheduler] ${new Date().toISOString()} razorpay(scanned=${r.scanned},fulfilled=${r.fulfilled},persistedOnly=${r.persistedOnly},healedPaid=${r.healedPaid},unpaid=${r.stillUnpaid},errors=${r.errors})`,
    );
  }
});

const lifecycleBookingsJob = guarded("lifecycle-bookings", async () => {
  const r = await processPendingBookingLifecycle();
  if (r.scanned || r.confirmed || r.expired || r.errors) {
    console.log(`[scheduler] ${new Date().toISOString()} lifecycle-bookings(scanned=${r.scanned},emailed=${r.emailed},confirmed=${r.confirmed},expired=${r.expired},errors=${r.errors})`);
  }
});

console.log("[scheduler] starting · class-emails */5m · schedule-lifecycle */30m · razorpay-reconcile @hourly · lifecycle-bookings */15m");
// Run once at boot so a freshly-restarted process doesn't wait a full interval.
void classEmailsJob();
void lifecycleJob();
void razorpayReconcileJob();
void lifecycleBookingsJob();
schedule.scheduleJob("*/5 * * * *", classEmailsJob);
schedule.scheduleJob("*/30 * * * *", lifecycleJob);
schedule.scheduleJob("0 * * * *", razorpayReconcileJob);
schedule.scheduleJob("*/15 * * * *", lifecycleBookingsJob);
