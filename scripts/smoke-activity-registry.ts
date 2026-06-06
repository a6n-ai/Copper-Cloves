import { resolveAction, ACTIVITY_ACTIONS } from "../src/lib/activityLog/actions";

let failures = 0;
function expect(label: string, actual: string, expected: string) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: got "${actual}", expected "${expected}"`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

expect("booking summary", resolveAction("booking.created", { class_name: "Vinyasa Flow" }).summary, "Booked Vinyasa Flow");
expect("booking fallback", resolveAction("booking.created", {}).summary, "Booked a class");
expect("booking category", resolveAction("booking.created", {}).category, "member");
expect("payment summary", resolveAction("admin.payment_recorded", { method: "cash" }).summary, "Recorded cash payment");
expect("badge trim", resolveAction("admin.badge_allocated", {}).summary, "Allocated badge");
expect("unknown action category", resolveAction("totally.unknown", {}).category, "system");
expect("unknown action summary", resolveAction("totally.unknown", {}).summary, "totally.unknown");

console.log(`\nregistry has ${Object.keys(ACTIVITY_ACTIONS).length} actions`);
if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall registry checks passed");
process.exit(0);
