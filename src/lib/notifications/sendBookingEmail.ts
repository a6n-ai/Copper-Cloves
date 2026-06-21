import prisma from "@/lib/prisma";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";
import { bookingConfirmationEmail, classRescheduledEmail } from "@/lib/notifications/emailTemplates";
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
    include: {
      profile: { select: { full_name: true, email: true } },
      class_schedule: {
        include: {
          class_model: { select: { name: true } },
          instructor: { select: { name: true } },
        },
      },
    },
  });

  if (!booking?.profile?.email) return;

  const sch = booking.class_schedule;
  const className = booking.class_name?.trim() || sch?.class_model?.name || "Class";
  const instructorName = sch?.instructor?.name || "";
  const dateStr = sch ? formatDate(sch.start_time) : "";
  const startTime = sch ? formatTime(sch.start_time) : "";
  const endTime = sch ? formatTime(sch.end_time) : "";
  const memberName = booking.profile.full_name?.trim() || booking.profile.email.split("@")[0] || "there";
  const portalUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "") + "/portal/dashboard";

  const html = bookingConfirmationEmail({ memberName, className, instructorName, dateStr, startTime, endTime, portalUrl });

  const result = await sendHtmlEmail({
    to: booking.profile.email,
    subject: `You're booked for ${className}`,
    html,
    context: { type: "booking_confirmation", targetProfileId: booking.user_id, entity: { type: "booking", id: booking.id } },
  });
  if (!result.ok && !("skipped" in result && result.skipped)) {
    logger.error({ err: (result as { error?: string }).error }, "[sendBookingEmail] failed");
  }
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
  const portalUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");

  for (const b of sch.bookings) {
    const email = b.profile?.email?.trim();
    if (!email) continue;
    const memberName = b.profile?.full_name?.trim() || email.split("@")[0] || "there";
    const html = classRescheduledEmail({
      memberName,
      className,
      instructorName,
      oldDateStr: formatDate(oldStart),
      oldStartTime: formatTime(oldStart),
      newDateStr: formatDate(sch.start_time),
      newStartTime: formatTime(sch.start_time),
      newEndTime: formatTime(sch.end_time),
      portalUrl: portalUrl ? `${portalUrl}/portal/dashboard` : undefined,
    });
    await sendHtmlEmail({
      to: email,
      subject: `Class time updated — ${className}`,
      html,
      context: { type: "class_rescheduled", targetProfileId: b.user_id, entity: { type: "booking", id: b.id } },
    }).catch((e) => logger.error({ err: e, bookingId: b.id }, "[sendClassRescheduledEmails] failed"));
  }

  // Notify the instructor too — the roster re-fire only covers the ~6h window, so
  // a class moved further out would otherwise leave the instructor uninformed.
  const instructorEmail = sch.instructor?.email?.trim();
  if (instructorEmail) {
    const html = classRescheduledEmail({
      memberName: instructorName,
      className,
      instructorName,
      oldDateStr: formatDate(oldStart),
      oldStartTime: formatTime(oldStart),
      newDateStr: formatDate(sch.start_time),
      newStartTime: formatTime(sch.start_time),
      newEndTime: formatTime(sch.end_time),
      portalUrl: portalUrl ? `${portalUrl}/instructor/dashboard` : undefined,
    });
    await sendHtmlEmail({
      to: instructorEmail,
      subject: `Class time updated — ${className}`,
      html,
      context: { type: "class_rescheduled_instructor", entity: { type: "class_schedule", id: scheduleId } },
    }).catch((e) => logger.error({ err: e, scheduleId }, "[sendClassRescheduledEmails instructor] failed"));
  }
}
