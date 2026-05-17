import nodemailer from "nodemailer";
import type { EmailSendResult } from "@/lib/notifications/resendEmail";

/** Gmail app passwords are often pasted with spaces between groups — strip them. */
function normalizeGmailAppPassword(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

/**
 * Send HTML mail through Gmail SMTP using an **App Password** (not your normal login).
 * @see https://support.google.com/accounts/answer/185833
 */
export async function sendHtmlEmailViaGmailSmtp(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailSendResult> {
  const user = process.env.EMAIL_USER?.trim();
  const passRaw = process.env.EMAIL_PASS?.trim();
  if (!user || !passRaw) {
    return { ok: false, skipped: true, reason: "EMAIL_USER or EMAIL_PASS unset" };
  }

  const pass = normalizeGmailAppPassword(passRaw);
  if (!pass) {
    return { ok: false, skipped: true, reason: "EMAIL_PASS empty after normalization" };
  }

  const from = process.env.EMAIL_FROM?.trim() || user;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // SSL — works on AWS Lambda (port 587/STARTTLS is often blocked)
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from,
      to: options.to.trim(),
      subject: options.subject,
      html: options.html,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.slice(0, 500) };
  }
}
