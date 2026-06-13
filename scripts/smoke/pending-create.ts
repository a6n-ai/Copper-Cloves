import prisma from "@/lib/prisma";
import { createPendingBooking } from "@/lib/createPendingBooking";
import { BOOKING_STATUS } from "@/lib/bookingStatus";

// LOCAL DB ONLY. Run with: DATABASE_URL="postgresql://copper:copper_dev@localhost:5433/copperandcloves" npx tsx scripts/smoke/pending-create.ts
async function main() {
  const sched = await prisma.classSchedule.findFirst({ where: { status: "available" }, select: { id: true } });
  const user = await prisma.profile.findFirst({ where: { role: "user" }, select: { id: true, email: true } });
  if (!sched || !user) { console.log("need a schedule + user in local DB"); return; }
  const id1 = await createPendingBooking({ userId: user.id, classScheduleId: sched.id, className: "Smoke", classTimeISO: "", extraGuestCount: 0, financeSnapshot: { totalInr: 1 }, email: user.email });
  const id2 = await createPendingBooking({ userId: user.id, classScheduleId: sched.id, className: "Smoke", classTimeISO: "", extraGuestCount: 0, financeSnapshot: { totalInr: 1 }, email: user.email });
  const row = await prisma.booking.findUnique({ where: { id: id1 }, select: { status: true, hold_expires_at: true } });
  console.log("reuse same hold:", id1 === id2, "| status:", row?.status);
  console.assert(id1 === id2 && row?.status === BOOKING_STATUS.payment_pending);
  await prisma.booking.delete({ where: { id: id1 } });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
