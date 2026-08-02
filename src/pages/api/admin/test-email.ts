import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";
import { hasRole } from "@/lib/auth/roles";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getStudioServerSession(req, res);
  const role = (session?.user as { role?: string })?.role;
  if (!hasRole(role, "admin")) return res.status(403).json({ error: "Forbidden" });

  const to = typeof req.body?.to === "string" ? req.body.to.trim() : "";
  if (!to) return res.status(400).json({ error: "to is required" });

  // Optional rendered-preview overrides (CRM Email Settings "Send test").
  const subjectOverride = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const htmlOverride = typeof req.body?.html === "string" ? req.body.html.trim() : "";

  const config = {
    EMAIL_USER: process.env.EMAIL_USER ? "set" : "MISSING",
    EMAIL_PASS: process.env.EMAIL_PASS ? "set" : "MISSING",
    EMAIL_FROM: process.env.EMAIL_FROM ?? "MISSING",
    RESEND_API_KEY: process.env.RESEND_API_KEY ? "set" : "MISSING",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "MISSING",
    NODE_ENV: process.env.NODE_ENV,
    AWS_EXECUTION_ENV: process.env.AWS_EXECUTION_ENV ?? "not set",
  };

  const result = await sendHtmlEmail({
    to,
    subject: subjectOverride || "Test email — The Studio",
    html:
      htmlOverride ||
      "<p>This is a test email from The Studio by Copper + Cloves. If you receive this, email is working correctly.</p>",
  });

  return res.status(200).json({ result, config });
}
