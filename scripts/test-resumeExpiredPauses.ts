/**
 * Guards which paused passes the resume-passes cron is allowed to touch.
 * No DB needed — pure predicate.
 *
 *   npm run test:resume-passes
 */
import assert from "node:assert/strict";
import { shouldResume } from "../src/lib/resumeExpiredPauses";

const now = new Date("2026-08-10T08:00:00Z");
const d = (s: string) => new Date(s);

// Ticket-approved pause that has ended — the 10 stuck rows in prod.
assert.equal(shouldResume({ is_paused: true, pause_end_date: d("2026-08-03T00:00:00Z") }, now), true);

// Ends exactly now — inclusive, so it resumes rather than waiting another day.
assert.equal(shouldResume({ is_paused: true, pause_end_date: now }, now), true);

// Still inside the approved window — leave paused.
assert.equal(shouldResume({ is_paused: true, pause_end_date: d("2026-08-20T00:00:00Z") }, now), false);

// Admin open-ended pause: expiry is extended on MANUAL resume, so auto-resuming
// here would silently rob the member of the extension.
assert.equal(shouldResume({ is_paused: true, pause_end_date: null }, now), false);

// Already active — idempotent re-runs must be no-ops.
assert.equal(shouldResume({ is_paused: false, pause_end_date: d("2026-08-03T00:00:00Z") }, now), false);

console.log("resumeExpiredPauses: 5/5 assertions passed");
