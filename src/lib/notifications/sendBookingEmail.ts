import prisma from "@/lib/prisma";
import { sendStudioEmail } from "@/lib/notifications/email";
import { OCCUPYING_STATUSES } from "@/lib/bookingStatus";
import logger from "@/lib/logger";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}

export async function sendBookingConfirmationEmail(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, user_id: true },
  });
  if (!booking?.user_id) return;

  await sendStudioEmail("booking_confirmed", {
    userId: booking.user_id,
    data: { bookingId: booking.id },
  }).catch((e) => logger.error({ err: e, bookingId }, "[sendBookingEmail] failed"));
}

/**
 * Notify every active booker on a schedule that its time has moved. Called after
 * an admin reschedules a class (`/api/class-schedules` PUT). Best-effort and
 * idempotency-free — only fire when the time actually changed. Each send is
 * captured in the email audit log via `sendHtmlEmail`.
 */
export async function sendClassRescheduledEmails(
  scheduleId: string,
  oldStart: Date,
): Promise<void> {
  const sch = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      class_model: { select: { name: true } },
      instructor: { select: { name: true, email: true } },
      bookings: {
        where: { status: { in: [...OCCUPYING_STATUSES] } },
        include: { profile: { select: { full_name: true, email: true } } },
      },
    },
  });
  if (!sch) return;

  const className = sch.class_model?.name || "your class";
  const instructorName = sch.instructor?.name || "your instructor";
  const portalUrl = (process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "");

  for (const b of sch.bookings) {
    const email = b.profile?.email?.trim();
    if (!email) continue;
    const memberName = b.profile?.full_name?.trim() || email.split("@")[0] || "there";
    await sendStudioEmail("class_rescheduled", {
      userId: b.user_id,
      to: email,
      data: {
        Member_Name: memberName,
        Class_Name: className,
        Instructor_Name: instructorName,
        Old_Class_Date: formatDate(oldStart),
        Old_Start_Time: formatTime(oldStart),
        New_Class_Date: formatDate(sch.start_time),
        New_Start_Time: formatTime(sch.start_time),
        New_End_Time: formatTime(sch.end_time),
        Studio_Link: portalUrl ? `${portalUrl}/portal/dashboard` : "",
      },
    }).catch((e) => logger.error({ err: e, bookingId: b.id }, "[sendClassRescheduledEmails] failed"));
  }

  // Notify the instructor too — the roster re-fire only covers the ~6h window, so
  // a class moved further out would otherwise leave the instructor uninformed.
  const instructorEmail = sch.instructor?.email?.trim();
  if (instructorEmail) {
    await sendStudioEmail("class_rescheduled", {
      to: instructorEmail,
      data: {
        Member_Name: instructorName,
        Class_Name: className,
        Instructor_Name: instructorName,
        Old_Class_Date: formatDate(oldStart),
        Old_Start_Time: formatTime(oldStart),
        New_Class_Date: formatDate(sch.start_time),
        New_Start_Time: formatTime(sch.start_time),
        New_End_Time: formatTime(sch.end_time),
        Studio_Link: portalUrl ? `${portalUrl}/instructor/dashboard` : "",
      },
    }).catch((e) => logger.error({ err: e, scheduleId }, "[sendClassRescheduledEmails instructor] failed"));
  }
}
