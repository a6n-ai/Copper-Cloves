import prisma from "@/lib/prisma";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";
import logger from "@/lib/logger";

const BASE_URL = "https://thestudiobycopperandcloves.in";
const LOGO_URL = `${BASE_URL}/logo2.png`;
const CAFE_IMAGE_URL = `${BASE_URL}/cafe-studio.jpg`;
const INSTAGRAM_URL = "https://www.instagram.com/thestudiobycopperandcloves";

const SAGE = "#7C9070";
const CHARCOAL = "#2C2C2C";
const MUTED = "#888888";
const BORDER = "#E8E4DC";
const TERRACOTTA = "#C17B5C";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}

function h(s: unknown): string {
  const str = s == null ? "" : typeof s === "object" ? JSON.stringify(s) : String(s as string | number | boolean);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function logoHeader(subtitle?: string): string {
  return `
    <div style="text-align:center;padding:40px 24px 24px;background:#fff">
      <img src="${LOGO_URL}" alt="The Studio by Copper + Cloves" width="180" style="max-width:180px;height:auto;filter:brightness(0)" />
      ${subtitle ? `<p style="font-family:Georgia,serif;font-size:13px;letter-spacing:0.1em;color:${MUTED};margin:12px 0 0;text-transform:lowercase">${h(subtitle)}</p>` : ""}
    </div>
  `;
}

function needHelpCard(): string {
  return `
    <div style="background:#fff;border:1px solid ${BORDER};border-radius:12px;padding:24px;margin-bottom:16px">
      <p style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:${TERRACOTTA};margin:0 0 12px">need help?</p>
      <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 12px">we're here to support you every step of the way.</p>
      <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 6px">📞 &nbsp;phone/whatsapp: <a href="tel:9008426703" style="color:${CHARCOAL};text-decoration:none">90084 26703</a></p>
      <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0">✉️ &nbsp;email: <a href="mailto:thestudio@copperandcloves.com" style="color:${SAGE}">thestudio@copperandcloves.com</a></p>
    </div>
  `;
}

function footer(): string {
  return `
    <div style="text-align:center;padding:32px 24px 0">
      <a href="${INSTAGRAM_URL}" style="font-family:Georgia,serif;font-size:14px;color:${SAGE};text-decoration:none">Follow us on Instagram</a>
    </div>
    <div style="margin-top:24px;overflow:hidden;border-radius:0 0 16px 16px">
      <img src="${CAFE_IMAGE_URL}" alt="The Studio by Copper + Cloves" width="600" style="width:100%;max-width:600px;height:220px;object-fit:cover;display:block" />
    </div>
    <div style="text-align:center;padding:20px 24px 32px;background:#fff">
      <p style="font-family:Georgia,serif;font-size:12px;color:#BBBBBB;margin:0;line-height:1.6">
        This is an automated message. Please do not reply to this email.<br/>
        For support, contact us at <a href="mailto:thestudio@copperandcloves.com" style="color:#BBBBBB">thestudio@copperandcloves.com</a>
      </p>
    </div>
  `;
}

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Studio by Copper + Cloves</title></head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:Georgia,serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    ${content}
  </div>
</body>
</html>`;
}

export async function sendPendingRecoveryEmail(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      profile: { select: { full_name: true, email: true } },
      class_schedule: {
        include: {
          class_model: { select: { name: true } },
        },
      },
    },
  });

  if (!booking?.profile?.email) return;

  const sch = booking.class_schedule;
  const className = booking.class_name?.trim() || sch?.class_model?.name || "Class";
  const dateStr = sch ? formatDate(sch.start_time) : "";
  const startTime = sch ? formatTime(sch.start_time) : "";
  const memberName = booking.profile.full_name?.trim() || booking.profile.email.split("@")[0] || "there";
  const bookingsUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "") + "/portal/bookings";

  const html = emailWrapper(`
    ${logoHeader("complete your booking")}
    <div style="padding:32px 32px 0">
      <p style="font-family:Georgia,serif;font-size:17px;color:${CHARCOAL};margin:0 0 12px">hi ${h(memberName)},</p>
      <p style="font-family:Georgia,serif;font-size:15px;color:${CHARCOAL};margin:0 0 8px;line-height:1.6">
        your spot for <strong>${h(className)}</strong>${dateStr ? ` on <strong>${h(dateStr)}</strong>` : ""}${startTime ? ` at <strong>${h(startTime)}</strong>` : ""} is being held for you — but your payment hasn't been confirmed yet.
      </p>
      <p style="font-family:Georgia,serif;font-size:15px;color:${MUTED};margin:0 0 28px;line-height:1.6">
        Spots are limited, and your hold will be released shortly if payment isn't completed.
      </p>

      <div style="background:#fff;border:1px solid ${BORDER};border-radius:12px;padding:24px;margin-bottom:16px">
        <p style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:${SAGE};margin:0 0 16px;text-align:center">what to do next</p>
        <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 10px;line-height:1.6">
          Open <strong>My Bookings</strong> in your member portal:
        </p>
        <div style="text-align:center;margin:20px 0">
          <a href="${h(bookingsUrl)}" style="display:inline-block;background:${SAGE};color:#fff;padding:13px 36px;border-radius:999px;text-decoration:none;font-family:Georgia,serif;font-size:14px;font-weight:600">go to my bookings</a>
        </div>
        <ul style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0;padding-left:20px;line-height:1.9">
          <li>if you've already paid, tap <strong>"I've already paid"</strong> on the booking to reconcile it.</li>
          <li>if payment is still pending, complete it from there before your hold expires.</li>
        </ul>
      </div>

      <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="font-family:Georgia,serif;font-size:14px;font-weight:700;color:#9A3412;margin:0 0 6px">⏳ act soon</p>
        <p style="font-family:Georgia,serif;font-size:14px;color:#9A3412;margin:0;line-height:1.6">
          Unconfirmed spots are released automatically. Complete your payment to secure your place in <strong>${h(className)}</strong>.
        </p>
      </div>

      ${needHelpCard()}

      <div style="text-align:center;padding:24px 0">
        <p style="font-family:Georgia,serif;font-size:15px;font-weight:400;color:${CHARCOAL};margin:0 0 4px">we hope to see you on the mat,</p>
        <p style="font-family:Georgia,serif;font-size:14px;color:${SAGE};margin:0">The Studio by Copper &amp; Cloves</p>
      </div>
    </div>
    ${footer()}
  `);

  const result = await sendHtmlEmail({
    to: booking.profile.email,
    subject: `Complete your booking — ${className}`,
    html,
    context: { type: "payment_recovery", targetProfileId: booking.user_id, entity: { type: "booking", id: booking.id } },
  });
  if (!result.ok && !("skipped" in result && result.skipped)) {
    logger.error({ err: (result as { error?: string }).error }, "[sendPendingRecoveryEmail] failed");
  }
}
