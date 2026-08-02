// src/pages/api/auth/set-password.ts
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { attachStudioCredential, hasStudioCredential } from "@/lib/auth/studioIdentity";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return res.status(400).json({ error: "Token is required" });

    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.used) return res.status(400).json({ error: "Invalid or already used link" });
    if (new Date() > record.expires_at) return res.status(400).json({ error: "This link has expired" });

    // Guard: only for passwordless accounts. "Activated" is now a CREDENTIAL, not
    // a `user_id` — invite placeholders are created with an identity up front
    // (resolveStudioUser) so `user_id` alone would reject every legitimate
    // activation.
    const targetRole = record.role ?? "user";
    const profile = await prisma.profile.findFirst({
      where: { email: record.email, role: targetRole },
      select: { user_id: true },
    });
    if (!profile) return res.status(400).json({ error: "Account not found" });
    if (await hasStudioCredential(profile)) {
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
      select: { id: true, user_id: true },
    });
    if (!profile) return res.status(400).json({ error: "Account not found" });
    if (await hasStudioCredential(profile)) return res.status(400).json({ error: "already_activated" });

    // Writes the better-auth credential Account (and mints the identity if this
    // is an older placeholder Profile that has none). Burning the token is a
    // separate write: the credential is what the member needs, and a token left
    // unburned by a crash between the two is still bounded by its own expiry —
    // the reverse order would strand them with a used link and no password.
    // overwrite: false — activation, not a reset. The guard above already
    // proved there is no credential; this is belt-and-braces against a race
    // with a concurrent activation of the same placeholder.
    await attachStudioCredential({ profileId: profile.id, password, overwrite: false });
    await prisma.passwordResetToken.update({ where: { token }, data: { used: true } });

    return res.status(200).json({ ok: true, email: record.email });
  }

  return res.status(405).end();
}
