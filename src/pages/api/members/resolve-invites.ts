// src/pages/api/members/resolve-invites.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { isValidPhoneNumber } from "libphonenumber-js";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";
import {
  createStudioProfile,
  LoginEmailTakenError,
  type CreatedStudioProfile,
} from "@/lib/auth/studioIdentity";

const INVITE_TOKEN_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

type AddedMember = { profile_id?: string; name: string; email: string; phone?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const { added_members, class_name, class_time } = req.body as {
    added_members?: AddedMember[];
    class_name?: string;
    class_time?: string;
  };

  if (!Array.isArray(added_members) || added_members.length === 0) {
    return res.status(200).json({ profile_ids: [] });
  }
  if (added_members.length > 5) {
    return res.status(400).json({ error: "Maximum 5 additional members per booking" });
  }

  const inviterName = session.user.name ?? "A studio member";
  const baseUrl = process.env.BETTER_AUTH_URL ?? `https://${req.headers.host}`;
  const selfId = session.user.id;
  const selfEmail = (session.user.email ?? "").trim().toLowerCase();
  // Booker's own phone — a guest must not be saved with the booker's number
  // (creates duplicate-contact accounts; see MemberSearch samePhone guard).
  const selfProfile = await prisma.profile.findFirst({
    where: { id: selfId },
    select: { phone: true },
  });
  const selfPhoneDigits = (selfProfile?.phone ?? "").replace(/\D/g, "");
  const sameAsSelfPhone = (p?: string) => {
    const d = (p ?? "").replace(/\D/g, "");
    if (d.length < 7 || selfPhoneDigits.length < 7) return false;
    return d === selfPhoneDigits || d.slice(-10) === selfPhoneDigits.slice(-10);
  };
  const resolved: string[] = [];

  for (const member of added_members) {
    // Booker can't be their own guest (would double-book + double-charge).
    if (member.profile_id && member.profile_id === selfId) {
      return res.status(400).json({ error: "You can't add yourself as a guest." });
    }
    if (selfEmail && member.email.trim().toLowerCase() === selfEmail) {
      return res.status(400).json({ error: "You can't add yourself as a guest." });
    }
    const memberPhone = member.phone?.trim();
    // Reject a guest carrying the booker's own phone — unless it's an existing
    // member they picked (profile_id set, real separate account).
    if (!member.profile_id && sameAsSelfPhone(memberPhone)) {
      return res.status(400).json({ error: "Each guest needs their own mobile number, not yours." });
    }
    // Validate the number with the same library the client uses. Required for a
    // newly-entered guest (no profile_id) so we never create an account with a
    // malformed phone.
    if (!member.profile_id) {
      if (!memberPhone || !isValidPhoneNumber(memberPhone)) {
        return res.status(400).json({ error: "Enter a valid mobile number for each guest." });
      }
    }

    // If caller already resolved a profile_id, verify it exists and use it
    if (member.profile_id) {
      const exists = await prisma.profile.findFirst({
        where: { id: member.profile_id, role: "user" },
        select: { id: true, phone: true },
      });
      if (exists) {
        // Backfill a missing phone from the one captured at booking time —
        // never overwrite a phone already on file.
        if (memberPhone && !exists.phone?.trim()) {
          await prisma.profile.update({ where: { id: exists.id }, data: { phone: memberPhone } });
        }
        resolved.push(exists.id);
        continue;
      }
    }

    const email = member.email.trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Invalid email in added_members" });

    // Find or create the profile
    let profile = await prisma.profile.findFirst({
      where: { email, role: "user" },
      select: { id: true, hashedPassword: true, phone: true },
    });

    const isNew = !profile;
    if (!profile) {
      // Create minimal account (no password — invite email sets it). The
      // identity is minted up front with no `credential` Account, so the guest
      // cannot sign in until set-password runs, but `user_id` is never null —
      // the invariant getStudioServerSession and Task 13's @@unique([user_id])
      // both rely on. An email that already has a login in another portal is a
      // hard 409 (one email, one role) — the guest needs their own address.
      // Typed, not `let created;` — an evolving `any` under noImplicitAny:false
      // hides every field-shape mistake on the result.
      let created: CreatedStudioProfile;
      try {
        created = await createStudioProfile({
          email,
          name: member.name.trim() || email,
          role: "user",
          profile: { full_name: member.name.trim() || email, phone: memberPhone || null },
        });
      } catch (e) {
        if (e instanceof LoginEmailTakenError) return res.status(409).json({ error: e.message });
        throw e;
      }
      profile = { id: created.profile.id, hashedPassword: null, phone: memberPhone || null };
    } else if (memberPhone && !profile.phone?.trim()) {
      // Existing account found by email but no phone on file — backfill it.
      await prisma.profile.update({ where: { id: profile.id }, data: { phone: memberPhone } });
    }

    resolved.push(profile.id);

    // Send invite email only to new (passwordless) accounts
    if (isNew) {
      // Invalidate prior unused invite tokens for this email
      await prisma.passwordResetToken.updateMany({
        where: { email, role: "user", used: false },
        data: { used: true },
      });

      const token = crypto.randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: {
          email,
          role: "user",
          token,
          expires_at: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
        },
      });

      const setPasswordUrl = `${baseUrl}/portal/set-password?token=${token}`;
      const classLabel = class_name
        ? `<strong>${class_name}</strong>${class_time ? ` on ${class_time}` : ""}`
        : "a class";

      await sendHtmlEmail({
        to: email,
        subject: "You've been added to a class at The Studio",
        html: `
          <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#2C2C2C">
            <h2 style="font-size:22px;margin-bottom:8px">You've been added to a class</h2>
            <p style="color:#666;margin-bottom:8px">
              ${inviterName} added you to ${classLabel} at The Studio by Copper + Cloves.
            </p>
            <p style="color:#666;margin-bottom:24px">
              Your account has been created. Set your password to see your booking:
            </p>
            <a href="${setPasswordUrl}"
               style="display:inline-block;background:#8f9779;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-family:Arial,sans-serif">
              Set Password →
            </a>
            <p style="color:#999;font-size:13px;margin-top:24px">
              This link expires in 72 hours.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:32px 0" />
            <p style="color:#bbb;font-size:12px">The Studio by Copper + Cloves</p>
          </div>
        `,
      });
    }
  }

  return res.status(200).json({ profile_ids: resolved });
}
