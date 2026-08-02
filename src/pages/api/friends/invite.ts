import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { isValidPhoneNumber } from "libphonenumber-js";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";
import { upsertFriendship } from "@/lib/friendship";
import { createStudioProfile } from "@/lib/auth/studioIdentity";
import logger from "@/lib/logger";

const INVITE_TOKEN_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  const me = session?.user?.id;
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const { name, email: rawEmail, phone: rawPhone } = (req.body ?? {}) as {
    name?: string;
    email?: string;
    phone?: string;
  };
  const email = (rawEmail ?? "").trim().toLowerCase();
  const phone = (rawPhone ?? "").trim();
  const fullName = (name ?? "").trim();

  if (!email) return res.status(400).json({ error: "Email is required" });
  if (email === (session.user?.email ?? "").trim().toLowerCase())
    return res.status(400).json({ error: "That's your own email." });
  if (!phone || !isValidPhoneNumber(phone))
    return res.status(400).json({ error: "Enter a valid mobile number." });

  try {
    // Find or create the friend's account (role user). New accounts are
    // passwordless — the invite email sets the password.
    let profile = await prisma.profile.findFirst({
      where: { email, role: "user" },
      select: { id: true, phone: true },
    });
    const isNew = !profile;

    if (!profile) {
      // Identity up front, credential later: the invitee gets a User with no
      // `credential` Account, so they cannot sign in until the invite email's
      // set-password link runs attachStudioCredential — but `user_id` is never
      // null, which is what getStudioServerSession and Task 13's
      // @@unique([user_id, role]) both rely on. createStudioProfile adopts an
      // existing identity (inviting someone who already has another portal
      // login) and rolls back only a User it minted itself.
      const created = await createStudioProfile({
        email,
        name: fullName || email,
        role: "user",
        profile: { full_name: fullName || email, phone: phone || null },
      });
      profile = { id: created.profile.id, phone: phone || null };
    } else if (phone && !profile.phone?.trim()) {
      await prisma.profile.update({ where: { id: profile.id }, data: { phone } });
    }

    if (profile.id === me) return res.status(400).json({ error: "That's your own account." });

    await upsertFriendship(prisma, me, profile.id, "invite", "request", me);

    if (isNew) {
      // ponytail: token+invite-email boilerplate mirrors members/resolve-invites;
      // not extracted because the email body differs (friend invite vs class add).
      await prisma.passwordResetToken.updateMany({
        where: { email, role: "user", used: false },
        data: { used: true },
      });
      const token = crypto.randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: { email, role: "user", token, expires_at: new Date(Date.now() + INVITE_TOKEN_TTL_MS) },
      });
      const inviterName = session.user?.name ?? "A friend";
      const baseUrl = process.env.NEXTAUTH_URL ?? `https://${req.headers.host}`;
      const setPasswordUrl = `${baseUrl}/portal/set-password?token=${token}`;
      await sendHtmlEmail({
        to: email,
        subject: `${inviterName} invited you to The Studio`,
        html: `
          <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#2C2C2C">
            <h2 style="font-size:22px;margin-bottom:8px">You've been invited</h2>
            <p style="color:#666;margin-bottom:8px">
              ${inviterName} invited you to join them at The Studio by Copper + Cloves.
            </p>
            <p style="color:#666;margin-bottom:24px">
              Set your password to create your account and connect:
            </p>
            <a href="${setPasswordUrl}"
               style="display:inline-block;background:#8f9779;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-family:Arial,sans-serif">
              Set Password →
            </a>
            <p style="color:#999;font-size:13px;margin-top:24px">This link expires in 72 hours.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:32px 0" />
            <p style="color:#bbb;font-size:12px">The Studio by Copper + Cloves</p>
          </div>
        `,
      });
    }

    return res.status(200).json({ ok: true, isNew });
  } catch (e) {
    logger.error({ err: e }, "[friends invite POST]");
    return res.status(500).json({ error: "Could not send invite" });
  }
}
