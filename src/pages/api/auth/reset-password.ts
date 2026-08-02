import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activityLog";

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

  // Token carries the portal it was issued for; legacy tokens (null) = member.
  const targetRole = record.role ?? "user";

  const resetProfile = await prisma.profile.findFirst({
    where: { email: record.email, role: targetRole },
    select: { id: true, role: true, full_name: true, user_id: true },
  });

  await prisma.$transaction([
    prisma.profile.updateMany({
      where: { email: record.email, role: targetRole },
      data: { hashedPassword },
    }),
    prisma.passwordResetToken.update({
      where: { token },
      data: { used: true },
    }),
    // Force re-login on all devices for the reset account (kills any live session).
    // No user_id (identity not yet linked) => harmless zero-update.
    // Scope is per-identity (User), not per-role (Profile), because better-auth's
    // Session FK is userId only — it has no role dimension. This is a deliberate
    // widening from the old per-role UserSession.deleteMany: resetting one portal's
    // password now also logs out any other role that same identity holds. Fails
    // safe (revokes more, never fewer) and matches standard "reset kills all
    // sessions" practice. No live effect today (no identity holds 2+ roles yet)
    // but the admin plugin can grant a second role at any time.
    prisma.session.deleteMany({
      where: { userId: resetProfile?.user_id ?? "__no_such_user__" },
    }),
  ]);

  if (resetProfile) {
    await logActivity({
      action: "auth.password_reset",
      actor: { id: resetProfile.id, role: resetProfile.role, name: resetProfile.full_name },
      targetProfileId: resetProfile.id,
    });
  }

  return res.status(200).json({ ok: true });
}
