// src/pages/api/auth/set-password.ts
import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return res.status(400).json({ error: "Token is required" });

    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.used) return res.status(400).json({ error: "Invalid or already used link" });
    if (new Date() > record.expires_at) return res.status(400).json({ error: "This link has expired" });

    // Guard: only for passwordless accounts. Keyed on `user_id`, NOT on the
    // legacy hashedPassword column — a password reset now nulls that column, so
    // gating on it would let an activation link re-activate a live account.
    // A placeholder invite Profile has no identity; an activated one does.
    const targetRole = record.role ?? "user";
    const profile = await prisma.profile.findFirst({
      where: { email: record.email, role: targetRole },
      select: { user_id: true },
    });
    if (!profile) return res.status(400).json({ error: "Account not found" });
    if (profile.user_id) return res.status(400).json({ error: "already_activated" });

    return res.status(200).json({ email: record.email });
  }

  if (req.method === "POST") {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token) return res.status(400).json({ error: "Token is required" });
    // 8 = emailAndPassword.minPasswordLength, which this route bypasses.
    if (!password || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.used) return res.status(400).json({ error: "Invalid or already used link" });
    if (new Date() > record.expires_at) return res.status(400).json({ error: "This link has expired" });

    const targetRole = record.role ?? "user";
    const profile = await prisma.profile.findFirst({
      where: { email: record.email, role: targetRole },
      select: { id: true, user_id: true },
    });
    if (!profile) return res.status(400).json({ error: "Account not found" });
    // See the GET branch: identity presence, not the legacy column.
    if (profile.user_id) return res.status(400).json({ error: "already_activated" });

    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.profile.updateMany({
        where: { email: record.email, role: targetRole },
        data: { hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { token },
        data: { used: true },
      }),
    ]);

    return res.status(200).json({ ok: true, email: record.email });
  }

  return res.status(405).end();
}
