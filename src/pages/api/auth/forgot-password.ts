import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";
import logger from "@/lib/logger";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const VALID_ROLES = new Set(["user", "instructor", "partner", "admin"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { email, role } = req.body as { email?: string; role?: string };
  if (!email?.trim()) return res.status(400).json({ error: "Email is required" });

  const normalised = email.trim().toLowerCase();
  const wantRole = role?.trim();

  // Resolve which portal login to reset. Unified login passes the picked role;
  // if absent, fall back to the email's sole login, else the member ("user") one.
  let targetRole: string | null = null;
  if (wantRole && VALID_ROLES.has(wantRole)) {
    targetRole = wantRole;
  } else {
    const rows = await prisma.profile.findMany({ where: { email: normalised }, select: { role: true } });
    const roles = Array.from(new Set(rows.map((r) => r.role)));
    targetRole = roles.length === 1 ? roles[0] : roles.includes("user") ? "user" : roles[0] ?? null;
  }

  // Always return 200 — never reveal whether the email/role exists.
  if (!targetRole) return res.status(200).json({ ok: true });
  const profile = await prisma.profile.findFirst({ where: { email: normalised, role: targetRole } });
  if (!profile) return res.status(200).json({ ok: true });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  // Invalidate any prior unused tokens for this same email+role
  await prisma.passwordResetToken.updateMany({
    where: { email: normalised, role: targetRole, used: false },
    data: { used: true },
  });

  await prisma.passwordResetToken.create({
    data: { email: normalised, role: targetRole, token, expires_at: expiresAt },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? `https://${req.headers.host}`;
  const resetUrl = `${baseUrl}/portal/reset-password?token=${token}`;

  const result = await sendHtmlEmail({
    to: normalised,
    subject: "Reset your password — The Studio",
    html: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#2C2C2C">
        <h2 style="font-size:24px;margin-bottom:8px">Reset your password</h2>
        <p style="color:#666;margin-bottom:24px">
          We received a request to reset the password for your Studio account.
          Click the button below to choose a new one.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#7C9070;color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-size:15px;font-family:Arial,sans-serif">
          Reset Password
        </a>
        <p style="color:#999;font-size:13px;margin-top:24px">
          This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:32px 0" />
        <p style="color:#bbb;font-size:12px">The Studio by Copper + Cloves</p>
      </div>
    `,
  });

  if (!result.ok) {
    const reason = "error" in result ? result.error : ("reason" in result ? result.reason : "unknown");
    logger.error({ reason, emailUserSet: Boolean(process.env.EMAIL_USER), emailPassSet: Boolean(process.env.EMAIL_PASS) }, "[forgot-password] email send failed");
    return res.status(500).json({ error: "Could not send reset email. Please try again later." });
  }

  return res.status(200).json({ ok: true });
}
