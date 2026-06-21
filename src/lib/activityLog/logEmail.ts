import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// Cap stored HTML so one giant template can't bloat a log row. We keep enough to
// prove exactly what the member saw.
const MAX_HTML = 100_000;

export interface LogEmailOpts {
  to: string;
  subject: string;
  html: string;
  /** "sent" | "failed" | "skipped" */
  status: string;
  error?: string | null;
  /** What kind of email this is, e.g. "booking_confirmation", "class_reminder". */
  type?: string | null;
  /** Recipient profile id; resolved best-effort from `to` when omitted. */
  targetProfileId?: string | null;
  entity?: { type: string; id: string } | null;
}

/**
 * Best-effort audit record of one outbound email into the shared `activity_logs`
 * table. NEVER throws — a logging failure must not break email delivery.
 *
 * Stores the full rendered HTML in metadata so we always have a record of the
 * exact content sent to each user. Called from the single email choke point
 * (`sendHtmlEmail`) so every transactional + CRM + scheduled email is captured.
 */
export async function logEmailSent(opts: LogEmailOpts): Promise<void> {
  try {
    const to = opts.to?.trim() || "";

    let targetId = opts.targetProfileId ?? null;
    if (!targetId && to) {
      // Email is unique per role, not globally — any matching profile is fine for
      // attributing the email to a person's timeline.
      const p = await prisma.profile.findFirst({ where: { email: to }, select: { id: true } });
      targetId = p?.id ?? null;
    }

    const html =
      opts.html.length > MAX_HTML ? `${opts.html.slice(0, MAX_HTML)}…[truncated]` : opts.html;

    const metadata: Prisma.InputJsonValue = {
      to,
      subject: opts.subject,
      type: opts.type ?? null,
      status: opts.status,
      error: opts.error ?? null,
      html,
    };

    await prisma.activityLog.create({
      data: {
        actor_profile_id: null,
        actor_role: "system",
        actor_name: "Email",
        target_profile_id: targetId,
        action: "notification.email_sent",
        category: "system",
        summary: `Email${opts.type ? ` (${opts.type})` : ""} ${opts.status}: ${opts.subject}`.slice(0, 300),
        entity_type: opts.entity?.type ?? null,
        entity_id: opts.entity?.id ?? null,
        metadata,
        ip: null,
        user_agent: null,
      },
    });
  } catch (err) {
    console.error("[logEmailSent] failed", opts.subject, err);
  }
}
