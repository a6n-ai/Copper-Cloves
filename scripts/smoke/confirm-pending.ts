import prisma from "@/lib/prisma";
import { confirmPendingBookingTx } from "@/lib/confirmPendingBooking";
import { BOOKING_STATUS } from "@/lib/bookingStatus";
// LOCAL DB ONLY: DATABASE_URL="postgresql://copper:copper_dev@localhost:5433/copperandcloves" npx tsx scripts/smoke/confirm-pending.ts
async function main() {
  const sched = await prisma.classSchedule.findFirst({ where: { status: "available" }, select: { id: true, start_time: true } });
  const user = await prisma.profile.findFirst({ where: { role: "user" }, select: { id: true } });
  if (!sched || !user) { console.log("need schedule + user"); return; }
  const b = await prisma.booking.create({ data: { user_id: user.id, class_schedule_id: sched.id, status: BOOKING_STATUS.payment_pending, class_time: sched.start_time.toISOString(), hold_expires_at: new Date(Date.now()+3600_000) } });
  const r1 = await prisma.$transaction((tx) => confirmPendingBookingTx(tx, b.id));
  const r2 = await prisma.$transaction((tx) => confirmPendingBookingTx(tx, b.id));
  const row = await prisma.booking.findUnique({ where: { id: b.id }, select: { status: true, hold_expires_at: true } });
  console.log("transitioned:", r1.transitioned, r2.transitioned, "| status:", row?.status, "| hold cleared:", row?.hold_expires_at === null);
  console.assert(r1.transitioned && !r2.transitioned && row?.status === BOOKING_STATUS.confirmed && row?.hold_expires_at === null);
  await prisma.booking.delete({ where: { id: b.id } });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
