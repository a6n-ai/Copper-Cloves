/**
 * The app's own cron — a long-running scheduler for time-based class emails.
 * Runs every 5 minutes: ~1h member reminders + ~6h instructor rosters.
 * Both dispatchers are idempotent (sent-flag guarded), so overlapping runs are safe.
 *
 * Run under a persistent process (PM2 — see ecosystem.config.js):
 *   npm run scheduler
 *
 * On serverless (Amplify/Lambda) where a persistent process isn't available,
 * point an external scheduler at GET /api/cron/class-emails instead.
 */
import {
  sendDueClassReminders,
  sendDueInstructorRosters,
} from "../src/lib/notifications/scheduledClassEmails";

const INTERVAL_MS = 5 * 60 * 1000;
let running = false;

async function tick() {
  if (running) return; // avoid overlapping runs
  running = true;
  try {
    const reminders = await sendDueClassReminders();
    const rosters = await sendDueInstructorRosters();
    console.log(
      `[scheduler] ${new Date().toISOString()} reminders(sent=${reminders.sent},skip=${reminders.skipped}) rosters(sent=${rosters.sent},skip=${rosters.skipped})`,
    );
  } catch (e) {
    console.error("[scheduler] tick failed", e);
  } finally {
    running = false;
  }
}

console.log(`[scheduler] starting class-email scheduler · interval ${INTERVAL_MS / 60000}m`);
void tick();
setInterval(() => void tick(), INTERVAL_MS);
