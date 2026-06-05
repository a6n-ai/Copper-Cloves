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

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
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
      // Bound the request so awaiting it can never hang the API handler.
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Resend request failed: ${msg.slice(0, 300)}` };
  }

  const json = (await res.json().catch(() => ({}))) as {
    message?: string;
    name?: string;
  };
  if (!res.ok) {
    let msg: string;
    if (typeof json.message === "string") {
      msg = json.message;
    } else if (typeof json.name === "string") {
      msg = json.name;
    } else {
      msg = `HTTP ${res.status}`;
    }
    return { ok: false, error: msg };
  }
  return { ok: true };
}
