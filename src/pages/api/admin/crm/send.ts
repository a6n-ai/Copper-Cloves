import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";
import { interpolateCrmTemplate, crmBodyToEmailHtml } from "@/lib/notifications/crmTemplatedDispatch";

interface SendBody {
  template_id?: string;
  user_id?: string;
  /** Optional variable overrides (admin-supplied) merged into auto-built profile vars. */
  variables?: Record<string, unknown>;
}

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return v.toString();
  return "";
}

function siteBaseUrl(): string {
  return (process.env.BETTER_AUTH_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() || "").replace(/\/$/, "");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { template_id, user_id, variables: overrides }: SendBody = req.body ?? {};
  if (!template_id || !user_id) {
    return res.status(400).json({ error: "template_id and user_id required" });
  }

  const [template, profile] = await Promise.all([
    prisma.crmTemplate.findUnique({ where: { id: template_id } }),
    prisma.profile.findUnique({
      where: { id: user_id },
      select: { id: true, email: true, full_name: true },
    }),
  ]);

  if (!template) return res.status(404).json({ error: "Template not found" });
  if (!profile?.email?.trim()) {
    return res.status(400).json({ error: "Member has no email" });
  }
  if (!template.channel_email) {
    return res.status(400).json({ error: "Template does not have email channel enabled" });
  }

  const base = siteBaseUrl();
  const memberName = profile.full_name?.trim() || profile.email.split("@")[0] || "Member";

  // Merge variable namespaces:
  //  - Legacy CRM names: Member_Name, Studio_Link, Portal_Link
  //  - System template names: memberName, loginUrl, portalUrl
  // Admin-supplied overrides win.
  const merged: Record<string, string> = {
    // Legacy
    Member_Name: memberName,
    Studio_Link: base,
    Portal_Link: base ? `${base}/portal/dashboard` : "/portal/dashboard",
    // camelCase (system templates)
    memberName,
    loginUrl: base ? `${base}/portal/login` : "/portal/login",
    portalUrl: base,
    email: profile.email,
    ...Object.fromEntries(
      Object.entries(overrides ?? {}).map(([k, v]) => [k, asString(v)])
    ),
  };

  const subject = interpolateCrmTemplate(template.subject?.trim() || "Message from The Studio", merged);
  const bodyInterpolated = interpolateCrmTemplate(template.message_body ?? "", merged);
  const html = crmBodyToEmailHtml(bodyInterpolated);

  const result = await sendHtmlEmail({ to: profile.email, subject, html });

  const status = result.ok ? "sent" : "failed";
  const errMsg = !result.ok && "error" in result ? result.error.slice(0, 500) : null;

  const log = await prisma.crmMessage.create({
    data: {
      user_id: profile.id,
      template_id: template.id,
      channel: "email",
      subject,
      message_body: bodyInterpolated.length > 4000 ? `${bodyInterpolated.slice(0, 4000)}…` : bodyInterpolated,
      status,
      sent_at: status === "sent" ? new Date() : null,
      error_message: errMsg,
    },
  });

  if (!result.ok) {
    return res.status(502).json({ error: errMsg || "Send failed", message_id: log.id });
  }
  return res.status(200).json({ ok: true, message_id: log.id });
}
