import type { EmailSendResult } from "@/lib/notifications/resendEmail";
import { sendHtmlEmailViaResend } from "@/lib/notifications/resendEmail";
import { sendHtmlEmailViaGmailSmtp } from "@/lib/notifications/smtpGmail";
import { logEmailSent } from "@/lib/activityLog/logEmail";
import logger from "@/lib/logger";

export type { EmailSendResult };

/** Optional context for the audit log — what the email is and who it's for. */
export interface EmailContext {
  type?: string;
  targetProfileId?: string | null;
  entity?: { type: string; id: string } | null;
}

async function deliver(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailSendResult> {
  const useGmail = Boolean(process.env.EMAIL_USER?.trim() && process.env.EMAIL_PASS?.trim());

  if (useGmail) {
    const gmail = await sendHtmlEmailViaGmailSmtp(options);
    if (gmail.ok) return gmail;
    if (!("skipped" in gmail && gmail.skipped)) {
      logger.warn({ err: gmail }, "[email] Gmail SMTP failed, trying Resend");
    }
  }

  return sendHtmlEmailViaResend(options);
}

function describeResult(result: EmailSendResult): { status: string; error: string | null } {
  if (result.ok) return { status: "sent", error: null };
  if ("skipped" in result && result.skipped) return { status: "skipped", error: result.reason };
  if ("error" in result && result.error) return { status: "failed", error: result.error };
  return { status: "failed", error: "unknown" };
}

/**
 * Outbound HTML email: if `EMAIL_USER` and `EMAIL_PASS` (Gmail app password) are set,
 * sends via Gmail SMTP first; on hard failure falls back to Resend when configured.
 *
 * Every send (sent / failed / skipped) is recorded in the `activity_logs` audit
 * table — this is the single choke point for all transactional, CRM, and
 * scheduled email, so the log is complete. Pass `context` to enrich the record.
 */
export async function sendHtmlEmail(options: {
  to: string;
  subject: string;
  html: string;
  context?: EmailContext;
}): Promise<EmailSendResult> {
  const { to, subject, html, context } = options;
  const result = await deliver({ to, subject, html });

  const { status, error } = describeResult(result);
  await logEmailSent({
    to,
    subject,
    html,
    status,
    error,
    type: context?.type ?? null,
    targetProfileId: context?.targetProfileId ?? null,
    entity: context?.entity ?? null,
  });

  return result;
}
