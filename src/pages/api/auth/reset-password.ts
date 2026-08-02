import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activityLog";
import { studioPassword } from "@/lib/auth/password";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { token, password } = req.body as { token?: string; password?: string };

  if (!token) return res.status(400).json({ error: "Reset token is required" });
  // 8 = emailAndPassword.minPasswordLength. This route writes the Account
  // directly, so better-auth never enforces its own floor here — without this a
  // member could reset to a password sign-up would have rejected.
  if (!password || password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters" });

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!record || record.used) return res.status(400).json({ error: "This reset link is invalid or has already been used" });
  if (new Date() > record.expires_at) return res.status(400).json({ error: "This reset link has expired. Please request a new one" });

  // Token carries the portal it was issued for; legacy tokens (null) = member.
  const targetRole = record.role ?? "user";

  const resetProfile = await prisma.profile.findFirst({
    where: { email: record.email, role: targetRole },
    select: { id: true, role: true, full_name: true, user_id: true },
  });

  // No identity means no credential to rewrite — and no way to sign in either,
  // since the session gate refuses a User with no Profile and vice versa. Say so
  // rather than reporting a reset that changed nothing.
  if (!resetProfile?.user_id) {
    return res.status(400).json({ error: "This account cannot be reset here. Please contact the studio." });
  }

  // Straight to the credential Account: better-auth's set-password endpoint sits
  // behind the admin plugin's adminMiddleware and this route has no session.
  // Task 14 replaces this whole hand-rolled token flow with the emailOTP plugin.
  // A plain overwrite, never a packMultiHash merge — after a reset the old
  // password must stop verifying, and studioPassword.verify accepts EVERY
  // packed candidate.
  const hashedPassword = await studioPassword.hash(password);
  const credential = await prisma.account.findFirst({
    where: { userId: resetProfile.user_id, providerId: "credential" },
    select: { id: true },
  });

  await prisma.$transaction([
    credential
      ? prisma.account.update({ where: { id: credential.id }, data: { password: hashedPassword } })
      : prisma.account.create({
          data: {
            userId: resetProfile.user_id,
            accountId: resetProfile.user_id,
            providerId: "credential",
            password: hashedPassword,
          },
        }),
    prisma.passwordResetToken.update({
      where: { token },
      data: { used: true },
    }),
    // Force re-login on all devices for the reset account (kills any live session).
    // Scope is per-identity (User), not per-role (Profile), because better-auth's
    // Session FK is userId only — it has no role dimension. One email holds
    // exactly one role, so identity and role scope now coincide anyway.
    prisma.session.deleteMany({ where: { userId: resetProfile.user_id } }),
  ]);

  await logActivity({
    action: "auth.password_reset",
    actor: { id: resetProfile.id, role: resetProfile.role, name: resetProfile.full_name },
    targetProfileId: resetProfile.id,
  });

  return res.status(200).json({ ok: true });
}
