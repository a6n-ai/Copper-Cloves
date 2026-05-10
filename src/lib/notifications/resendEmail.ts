export type EmailSendResult =
  | { ok: true; skipped?: false }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped?: false; error: string };

/** @see https://resend.com/docs/api-reference/emails/send-email */
export async function sendHtmlEmailViaResend(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailSendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key?.trim() || !from?.trim()) {
    return {
      ok: false,
      skipped: true,
      reason: "RESEND_API_KEY or EMAIL_FROM unset",
    };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: options.to.trim(),
      subject: options.subject,
      html: options.html,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    message?: string;
    name?: string;
  };
  if (!res.ok) {
    const msg =
      typeof json.message === "string"
        ? json.message
        : typeof json.name === "string"
          ? json.name
          : `HTTP ${res.status}`;
    return { ok: false, error: msg };
  }
  return { ok: true };
}
