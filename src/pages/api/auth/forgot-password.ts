import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { email } = req.body as { email?: string };
  if (!email?.trim()) return res.status(400).json({ error: "Email is required" });

  const normalised = email.trim().toLowerCase();

  // Always return 200 — never reveal whether email exists
  const profile = await prisma.profile.findUnique({ where: { email: normalised } });
  if (!profile) return res.status(200).json({ ok: true });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  // Invalidate any prior unused tokens for this email
  await prisma.passwordResetToken.updateMany({
    where: { email: normalised, used: false },
    data: { used: true },
  });

  await prisma.passwordResetToken.create({
    data: { email: normalised, token, expires_at: expiresAt },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? `https://${req.headers.host}`;
  const resetUrl = `${baseUrl}/portal/reset-password?token=${token}`;

  await sendHtmlEmail({
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

  return res.status(200).json({ ok: true });
}
