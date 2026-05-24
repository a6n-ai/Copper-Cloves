process.env.CHECKIN_QR_SECRET = "test-secret-123";
import { mintCheckinToken, verifyCheckinToken } from "@/lib/checkinToken";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("ok:", msg);
}

const future = Date.now() + 60_000;
const t = mintCheckinToken("sched-1", "member", future);
const v = verifyCheckinToken(t);
assert(!!v && v.scheduleId === "sched-1" && v.kind === "member", "valid token round-trips");

const expired = mintCheckinToken("sched-1", "member", Date.now() - 1000);
assert(verifyCheckinToken(expired) === null, "expired token rejected");

const tampered = t.slice(0, -2) + (t.endsWith("a") ? "bb" : "aa");
assert(verifyCheckinToken(tampered) === null, "tampered token rejected");

process.env.CHECKIN_QR_SECRET = "different-secret";
assert(verifyCheckinToken(t) === null, "wrong secret rejected");

console.log("\nALL PASS");
process.exit(0);
