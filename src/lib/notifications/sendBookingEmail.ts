import prisma from "@/lib/prisma";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";
import { bookingConfirmationEmail } from "@/lib/notifications/emailTemplates";
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

  const result = await sendHtmlEmail({ to: booking.profile.email, subject: `You're booked for ${className}`, html });
  if (!result.ok && !("skipped" in result && result.skipped)) {
    logger.error({ err: (result as { error?: string }).error }, "[sendBookingEmail] failed");
  }
}
