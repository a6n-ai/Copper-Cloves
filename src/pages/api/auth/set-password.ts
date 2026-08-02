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

    // Guard: only for passwordless accounts. EITHER signal counts as activated —
    // an identity (what this route will mint after Task 11b) or the legacy
    // column (all it writes today, so `user_id` alone would never fire for the
    // invite Profiles this route actually serves). Task 13 drops
    // `hashedPassword`: delete that clause then, the `user_id` one is already
    // right. Both are needed while the two halves coexist.
    const targetRole = record.role ?? "user";
    const profile = await prisma.profile.findFirst({
      where: { email: record.email, role: targetRole },
      select: { user_id: true, hashedPassword: true },
    });
    if (!profile) return res.status(400).json({ error: "Account not found" });
    if (profile.user_id || profile.hashedPassword) {
      return res.status(400).json({ error: "already_activated" });
    }

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
      select: { id: true, user_id: true, hashedPassword: true },
    });
    if (!profile) return res.status(400).json({ error: "Account not found" });
    // Guard: only for passwordless accounts. EITHER signal counts as activated —
    // an identity (user_id, minted after Task 11b) or the legacy column
    // (hashedPassword, all this writes today). Both needed while both exist.
    if (profile.user_id || profile.hashedPassword) return res.status(400).json({ error: "already_activated" });

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
