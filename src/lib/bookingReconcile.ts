import type { PrismaClient } from "@/generated/prisma/client";
import { checkInWindowBounds } from "@/lib/bookingAttendance";

/** Mark confirmed bookings as no-show after the check-in window has closed. */
export async function reconcileNoShowsGlobally(db: PrismaClient) {
  const now = new Date();
  const candidates = await db.booking.findMany({
    where: {
      status: "confirmed",
      checked_in: false,
      check_in_outcome: null,
      class_schedule_id: { not: null },
    },
    include: { class_schedule: { select: { start_time: true } } },
  });
  for (const b of candidates) {
    const st = b.class_schedule?.start_time;
    if (!st || Number.isNaN(st.getTime())) continue;
    const { close } = checkInWindowBounds(st);
    if (now.getTime() > close) {
      await db.booking.update({
        where: { id: b.id },
        data: { check_in_outcome: "no_show" },
      });
    }
  }
}
