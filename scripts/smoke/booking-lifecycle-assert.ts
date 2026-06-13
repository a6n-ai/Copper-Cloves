import { HOLD_MINUTES, RECOVERY_EMAIL_MIN_AGE_MINUTES, classifyPendingBooking } from "@/lib/bookingLifecycle";

const base = new Date("2026-06-13T10:00:00.000Z");
const at = (min: number) => new Date(base.getTime() + min * 60_000);
const pending = (createdMin: number, emailed: boolean) => ({
  created_at: at(createdMin),
  hold_expires_at: at(createdMin + HOLD_MINUTES),
  recovery_email_sent_at: emailed ? at(createdMin + 25) : null,
});

let failed = 0;
const check = (name: string, cond: boolean) => { if (!cond) { console.error("FAIL:", name); failed++; } else console.log("ok:", name); };

check("nothing in first 20m", classifyPendingBooking(pending(0, false), at(10)) === "none");
check("email after min age, not emailed", classifyPendingBooking(pending(0, false), at(30)) === "send_email");
check("no re-send when already emailed", classifyPendingBooking(pending(0, true), at(30)) === "none");
check("release past hold", classifyPendingBooking(pending(0, true), at(61)) === "release");
check("release priority even if never emailed", classifyPendingBooking(pending(0, false), at(61)) === "release");
check("constants", HOLD_MINUTES === 60 && RECOVERY_EMAIL_MIN_AGE_MINUTES === 20);

if (failed) { console.error(`${failed} failed`); process.exit(1); }
console.log("ALL PASS");
process.exit(0);
