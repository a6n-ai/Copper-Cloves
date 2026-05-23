import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { token, password } = req.body as { token?: string; password?: string };

  if (!token) return res.status(400).json({ error: "Reset token is required" });
  if (!password || password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!record || record.used) return res.status(400).json({ error: "This reset link is invalid or has already been used" });
  if (new Date() > record.expires_at) return res.status(400).json({ error: "This reset link has expired. Please request a new one" });

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    // Portal reset targets the member (role "user") login for this email.
    prisma.profile.updateMany({
      where: { email: record.email, role: "user" },
      data: { hashedPassword },
    }),
    prisma.passwordResetToken.update({
      where: { token },
      data: { used: true },
    }),
  ]);

  return res.status(200).json({ ok: true });
}
