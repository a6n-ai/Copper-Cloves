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

    // Guard: only for passwordless accounts
    const targetRole = record.role ?? "user";
    const profile = await prisma.profile.findFirst({
      where: { email: record.email, role: targetRole },
      select: { hashedPassword: true },
    });
    if (!profile) return res.status(400).json({ error: "Account not found" });
    if (profile.hashedPassword) return res.status(400).json({ error: "already_activated" });

    return res.status(200).json({ email: record.email });
  }

  if (req.method === "POST") {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!password || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.used) return res.status(400).json({ error: "Invalid or already used link" });
    if (new Date() > record.expires_at) return res.status(400).json({ error: "This link has expired" });

    const targetRole = record.role ?? "user";
    const profile = await prisma.profile.findFirst({
      where: { email: record.email, role: targetRole },
      select: { id: true, hashedPassword: true },
    });
    if (!profile) return res.status(400).json({ error: "Account not found" });
    if (profile.hashedPassword) return res.status(400).json({ error: "already_activated" });

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
