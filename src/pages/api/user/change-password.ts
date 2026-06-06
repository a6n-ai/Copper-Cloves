import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { logActivity } from "@/lib/activityLog";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "POST") return res.status(405).end();

  const userId = (session.user as { id: string }).id;
  const { currentPassword, newPassword } = req.body ?? {};

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }
  if (newPassword.length > 72) {
    return res.status(400).json({ error: "Password is too long (max 72 characters)." });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { hashedPassword: true },
  });
  if (!profile?.hashedPassword) {
    return res.status(400).json({ error: "Password login is not set for this account." });
  }

  if (typeof currentPassword !== "string" || !currentPassword) {
    return res.status(400).json({ error: "Current password is required." });
  }

  const ok = await bcrypt.compare(currentPassword, profile.hashedPassword);
  if (!ok) return res.status(400).json({ error: "Current password is incorrect." });

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.profile.update({
    where: { id: userId },
    data: { hashedPassword },
  });

  await logActivity({ req, action: "auth.password_changed" });

  return res.json({ ok: true });
}
