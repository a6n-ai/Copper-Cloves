import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { logActivity } from "@/lib/activityLog";
import { studioPassword } from "@/lib/auth/password";
import { attachStudioCredential } from "@/lib/auth/studioIdentity";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "POST") return res.status(405).end();

  // session.user.id is a Profile id.
  const profileId = (session.user as { id: string }).id;
  const { currentPassword, newPassword } = req.body ?? {};

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }
  if (newPassword.length > 72) {
    return res.status(400).json({ error: "Password is too long (max 72 characters)." });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { user_id: true },
  });
  // studioPassword.verify reads both bcrypt and scrypt, so a migrated hash and a
  // freshly written one both check out.
  const credential = profile?.user_id
    ? await prisma.account.findFirst({
        where: { userId: profile.user_id, providerId: "credential" },
        select: { password: true },
      })
    : null;
  const storedHash = credential?.password ?? null;
  if (!storedHash) {
    return res.status(400).json({ error: "Password login is not set for this account." });
  }

  if (typeof currentPassword !== "string" || !currentPassword) {
    return res.status(400).json({ error: "Current password is required." });
  }

  const ok = await studioPassword.verify({ hash: storedHash, password: currentPassword });
  if (!ok) return res.status(400).json({ error: "Current password is incorrect." });

  // Overwrites the credential, so the old password stops verifying.
  await attachStudioCredential({ profileId, password: newPassword, overwrite: true });

  await logActivity({ req, action: "auth.password_changed" });

  return res.json({ ok: true });
}
