import prisma from "@/lib/prisma";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";
import { interpolateCrmTemplate, crmBodyToEmailHtml } from "@/lib/notifications/crmTemplatedDispatch";
import { baseVars } from "./variables";
import { EMAIL_KINDS, type EmailKind, type EmailKindName } from "./kinds";

/** Tokens used in a body that are NOT in the declared (code-owned) palette. */
export function validateBodyVariables(body: string, allowed: readonly string[]): string[] {
  const used = [...body.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1].trim());
  const set = new Set(allowed);
  return [...new Set(used.filter((u) => !set.has(u)))];
}

/** Active admin template body wins; else the kind's code builder. Subject always interpolated. */
export function renderEmail(kind: EmailKind, vars: Record<string, string>, templateBody: string | null) {
  // CRM body: wrap plain-text admin copy into HTML (no-op for already-HTML
  // bodies), then interpolate. Code builder already returns full HTML.
  const html = templateBody
    ? interpolateCrmTemplate(crmBodyToEmailHtml(templateBody), vars)
    : kind.codeBuilder(vars);
  return { subject: interpolateCrmTemplate(kind.subject, vars), html };
}

export async function sendStudioEmail(
  kind: EmailKindName,
  opts: { userId?: string; to?: string; data?: Record<string, unknown> },
): Promise<void> {
  // No process-level dedupe: callers that fan out to a group already pass
  // distinct recipients (see cancellationRecipientIds). A module-global "seen"
  // set would suppress every later legitimate send of the same kind to the same
  // address for the life of a warm Lambda/PM2 process (2nd booking confirmation,
  // reschedules, daily reminders). The service sends exactly what it's told.
  const def = EMAIL_KINDS[kind];
  let email = opts.to?.trim() ?? "";
  let profile: { full_name?: string | null; email: string } | null = opts.to
    ? { email: opts.to, full_name: null }
    : null;
  if (!email && opts.userId) {
    const p = await prisma.profile.findUnique({
      where: { id: opts.userId },
      select: { email: true, full_name: true },
    });
    if (!p?.email?.trim()) return;
    email = p.email.trim();
    profile = p;
  }
  if (!email || !profile) return;

  const vars = { ...baseVars(profile), ...(await def.buildVars(opts.data ?? {})) };

  // Active admin template body wins; else code builder.
  let templateBody: string | null = null;
  let templateId: string | null = null;
  if (def.templateKey) {
    const tmpl = await prisma.crmTemplate.findUnique({
      where: { template_key: def.templateKey },
      select: { id: true, message_body: true, channel_email: true },
    });
    if (tmpl?.channel_email && tmpl.message_body?.trim()) {
      templateBody = tmpl.message_body;
      templateId = tmpl.id;
      const unknown = validateBodyVariables(templateBody, def.variables);
      if (unknown.length) console.warn(`[email:${kind}] template uses unknown vars: ${unknown.join(", ")}`);
    }
  }

  const { subject, html } = renderEmail(def, vars, templateBody);
  const result = await sendHtmlEmail({
    to: email,
    subject,
    html,
    context: { type: `email:${kind}`, targetProfileId: opts.userId ?? null },
  });

  await prisma.crmMessage
    .create({
      data: {
        user_id: opts.userId ?? null,
        template_id: templateId,
        channel: "email",
        subject,
        message_body: html.slice(0, 4000),
        status: result.ok ? "sent" : "failed",
        sent_at: result.ok ? new Date() : null,
        error_message: result.ok ? null : "send failed",
      },
    })
    .catch(() => {});
}
