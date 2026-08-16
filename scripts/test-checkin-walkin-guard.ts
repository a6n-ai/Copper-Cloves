/**
 * Guard test for the QR walk-in confirm gate (src/pages/api/checkin/scan.ts).
 *
 * The Aug 16 2026 incident: a member scanned the desk beacon 1 minute after it
 * rotated to the NEXT class, and the endpoint silently booked her + spent a
 * credit. A scan without `confirm` must never write anything.
 *
 * Run: npx tsx scripts/test-checkin-walkin-guard.ts
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { withinCheckinWindow, CHECKIN_OPEN_BEFORE_MS } from "../src/lib/checkinWindow";

const src = readFileSync("src/pages/api/checkin/scan.ts", "utf8");

// 1. The commit call must sit behind the confirm gate, not before it.
const gateAt = src.indexOf("if (!confirm)");
const commitAt = src.indexOf("await commitWalkIn(");
assert.ok(gateAt > 0, "confirm gate missing from handleMemberScan");
assert.ok(commitAt > gateAt, "commitWalkIn must run AFTER the !confirm early-return");

// 2. The gate returns 409 + the flag both clients key on.
const gateBlock = src.slice(gateAt, commitAt);
assert.ok(gateBlock.includes("status(409)"), "confirm gate must answer 409");
assert.ok(gateBlock.includes("needsWalkInConfirm"), "confirm gate must set needsWalkInConfirm");
assert.ok(!gateBlock.includes("commitWalkIn"), "no write may happen inside the gate");

// 3. Walk-in rows carry the denormalised class fields (were NULL before the fix).
const commitFn = src.slice(src.indexOf("async function commitWalkIn"), gateAt);
assert.ok(commitFn.includes("class_name:"), "walk-in row must set class_name");
assert.ok(commitFn.includes("class_time:"), "walk-in row must set class_time");

// 4. The beacon rotation that caused the incident is real: at start-1m of the
//    9:30 class, the 8:00 class is already out of its window.
const barre = new Date("2026-08-16T04:00:00Z"); // 9:30 IST
const mat = new Date("2026-08-16T02:30:00Z"); // 8:00 IST
const scan = new Date("2026-08-16T03:31:47Z"); // 9:01 IST
assert.equal(withinCheckinWindow(barre, scan), true, "barre window open at scan time");
assert.equal(withinCheckinWindow(mat, scan), false, "mat window already closed at scan time");
assert.equal(CHECKIN_OPEN_BEFORE_MS, 30 * 60 * 1000);

console.log("checkin walk-in guard: OK");
