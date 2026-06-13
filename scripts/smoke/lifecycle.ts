import prisma from "@/lib/prisma";
import { processPendingBookingLifecycle } from "@/lib/processPendingBookingLifecycle";
import { BOOKING_STATUS } from "@/lib/bookingStatus";
// LOCAL DB ONLY: DATABASE_URL="postgresql://copper:copper_dev@localhost:5433/copperandcloves" npx tsx scripts/smoke/lifecycle.ts
async function main() {
  const sched = await prisma.classSchedule.findFirst({ where: { status: "available" }, select: { id: true, start_time: true } });
  const user = await prisma.profile.findFirst({ where: { role: "user" }, select: { id: true } });
  if (!sched || !user) { console.log("need schedule + user"); return; }
  const b = await prisma.booking.create({ data: { user_id: user.id, class_schedule_id: sched.id, status: BOOKING_STATUS.payment_pending, class_time: sched.start_time.toISOString(), created_at: new Date(Date.now()-90*60_000), hold_expires_at: new Date(Date.now()-30*60_000) } });
  const r = await processPendingBookingLifecycle();
  const row = await prisma.booking.findUnique({ where: { id: b.id }, select: { status: true } });
  console.log("result:", r, "| status:", row?.status);
  console.assert(row?.status === BOOKING_STATUS.expired);
  await prisma.booking.delete({ where: { id: b.id } });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
