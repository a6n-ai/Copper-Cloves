import { sendHtmlEmail } from "@/lib/notifications/sendEmail";
import { otpEmail, otpSubject, type OtpEmailKind } from "@/lib/notifications/emailTemplates";
import logger from "@/lib/logger";

export async function sendOtpEmail({ email, otp, type, ttlMinutes }: { email: string; otp: string; type: OtpEmailKind; ttlMinutes: number }) {
  const result = await sendHtmlEmail({
    to: email,
    subject: otpSubject(type),
    html: otpEmail({ kind: type, otp, ttlMinutes }),
  });
  if (!result.ok) logger.error({ type }, "[auth] OTP email send failed");
}
