import type { EmailSendResult } from "@/lib/notifications/resendEmail";
import { sendHtmlEmailViaResend } from "@/lib/notifications/resendEmail";
import { sendHtmlEmailViaGmailSmtp } from "@/lib/notifications/smtpGmail";

export type { EmailSendResult };

/**
 * Outbound HTML email: if `EMAIL_USER` and `EMAIL_PASS` (Gmail app password) are set,
 * sends via Gmail SMTP first; on hard failure falls back to Resend when configured.
 */
export async function sendHtmlEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailSendResult> {
  const useGmail = Boolean(process.env.EMAIL_USER?.trim() && process.env.EMAIL_PASS?.trim());

  if (useGmail) {
    const gmail = await sendHtmlEmailViaGmailSmtp(options);
    if (gmail.ok) return gmail;
    if (!("skipped" in gmail && gmail.skipped)) {
      console.warn("[email] Gmail SMTP failed, trying Resend if configured:", gmail);
    }
  }

  return sendHtmlEmailViaResend(options);
}
