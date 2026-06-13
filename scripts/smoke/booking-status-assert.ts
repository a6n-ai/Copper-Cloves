import { BOOKING_STATUS, SEAT_HOLDING_STATUSES, REVENUE_STATUSES, holdsSeat, countsAsRevenue } from "@/lib/bookingStatus";

let failed = 0;
function check(name: string, cond: boolean) { if (!cond) { console.error("FAIL:", name); failed++; } else console.log("ok:", name); }

check("payment_pending holds seat", holdsSeat(BOOKING_STATUS.payment_pending) === true);
check("payment_pending not revenue", countsAsRevenue(BOOKING_STATUS.payment_pending) === false);
check("confirmed holds seat", holdsSeat("confirmed") === true);
check("confirmed is revenue", countsAsRevenue("confirmed") === true);
check("expired no seat", holdsSeat("expired") === false);
check("expired no revenue", countsAsRevenue("expired") === false);
check("cancelled no seat", holdsSeat("cancelled") === false);
check("seat set = confirmed+payment_pending", JSON.stringify([...SEAT_HOLDING_STATUSES].sort()) === JSON.stringify(["confirmed","payment_pending"]));
check("revenue set = [confirmed]", JSON.stringify([...REVENUE_STATUSES]) === JSON.stringify(["confirmed"]));

if (failed) { console.error(`${failed} assertions failed`); process.exit(1); }
console.log("ALL PASS");
process.exit(0);
