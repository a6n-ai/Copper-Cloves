import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { dedupeInstructorRows } from "@/lib/instructorIdentity";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { sendStudioEmail } from "@/lib/notifications/email";
import logger from "@/lib/logger";
import { hasRole } from "@/lib/auth/roles";
import { attachStudioCredential, createStudioProfile } from "@/lib/auth/studioIdentity";

function rateOverride(v: unknown): number | null | undefined {
  if (v === undefined) return undefined; // not provided → leave unchanged
  if (v === null || v === "") return null; // explicit clear → inherit global
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

/** Random URL-safe alphanumeric password. */
function generateTempPassword(len = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "12mb",
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const session = await getStudioServerSession(req, res);
    const isAdmin = hasRole((session?.user as { role?: string })?.role, "admin");
    const instructors = await prisma.instructor.findMany({
      where: isAdmin ? undefined : { is_active: true },
      orderBy: { display_order: "asc" },
    });
    return res.json(dedupeInstructorRows(instructors));
  }

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (!hasRole(role, "admin")) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "POST") {
    const body = req.body ?? {};
    const email = typeof body.email === "string" ? body.email.trim() : "";

    // One-time password for the new instructor login. The bcrypt hash on the
    // Instructor row is legacy and read by nothing on the sign-in path; the
    // usable credential is written by attachStudioCredential below.
    const tempPassword = generateTempPassword();
    const hashed_password = await bcrypt.hash(tempPassword, 12);

    const r12 = rateOverride(body.rate_12_paise); if (r12 !== undefined) body.rate_12_paise = r12;
    const r8 = rateOverride(body.rate_8_paise); if (r8 !== undefined) body.rate_8_paise = r8;
    const r4 = rateOverride(body.rate_4_paise); if (r4 !== undefined) body.rate_4_paise = r4;
    const r1 = rateOverride(body.rate_1_paise); if (r1 !== undefined) body.rate_1_paise = r1;
    const instructor = await prisma.instructor.create({
      data: { ...body, hashed_password },
    });

    // Unified login: give the instructor a role "instructor" Profile and link it.
    // `false` = this person already had a password and keeps it.
    let tempPasswordUsable = false;
    if (email) {
      const lower = email.toLowerCase();
      try {
        const existing = await prisma.profile.findFirst({
          where: { email: lower, role: "instructor" },
          select: { id: true },
        });
        let profileId: string;
        if (existing) {
          await prisma.profile.update({
            where: { id: existing.id },
            data: { full_name: instructor.name ?? undefined, onboarding_completed: true },
          });
          profileId = existing.id;
        } else {
          // Adopts an existing User for this email (a member becoming an
          // instructor) instead of failing on User.email's unique index.
          const created = await createStudioProfile({
            email: lower,
            name: instructor.name ?? lower,
            role: "instructor",
            profile: { full_name: instructor.name ?? null, onboarding_completed: true },
          });
          profileId = created.profile.id;
        }
        // overwrite: false — this route PROVISIONS a login, it is not a reset.
        // Credentials are per-identity, so overwriting here would replace the
        // password of the member whose email this is.
        const { written } = await attachStudioCredential({
          profileId,
          password: tempPassword,
          overwrite: false,
        });
        tempPasswordUsable = written;
        await prisma.instructor.update({ where: { id: instructor.id }, data: { profile_id: profileId } });
      } catch (e) {
        // Without this the retry runs instructor.create again and leaves a
        // duplicate row. The Profile is left in place — it is repairable, and a
        // retry routes back through attachStudioCredential.
        await prisma.instructor.delete({ where: { id: instructor.id } }).catch(() => {});
        logger.error({ err: e }, "[instructors] login provisioning failed; instructor rolled back");
        return res.status(500).json({ error: "Could not create the instructor login." });
      }
    }

    // Best-effort welcome email. Errors don't block creation.
    if (email) {
      try {
        const baseUrl =
          process.env.NEXTAUTH_URL?.trim() ||
          process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
          "https://www.thestudiobycopperandcloves.in";
        const loginUrl = `${baseUrl.replace(/\/$/, "")}/login`;
        await sendStudioEmail("instructor_welcome", {
          to: email,
          data: {
            Instructor_Name: instructor.name ?? "Instructor",
            Email: email,
            // Empty when this email already had a login: they keep their own
            // password, so mailing the temp one would be mailing a password
            // that does not work. The template swaps in "your existing
            // password" instead.
            Temp_Password: tempPasswordUsable ? tempPassword : "",
            Login_Link: loginUrl,
          },
        });
      } catch (e) {
        logger.warn({ err: e }, "[instructors] welcome email failed");
      }
    }

    // password_applied false = this email already had a Studio login and keeps
    // its own password; no temp password was issued or mailed.
    return res.status(201).json({ ...instructor, password_applied: tempPasswordUsable });
  }

  if (req.method === "PUT") {
    const { id, ...data } = req.body;
    const dr12 = rateOverride(data.rate_12_paise); if (dr12 !== undefined) data.rate_12_paise = dr12;
    const dr8 = rateOverride(data.rate_8_paise); if (dr8 !== undefined) data.rate_8_paise = dr8;
    const dr4 = rateOverride(data.rate_4_paise); if (dr4 !== undefined) data.rate_4_paise = dr4;
    const dr1 = rateOverride(data.rate_1_paise); if (dr1 !== undefined) data.rate_1_paise = dr1;
    const instructor = await prisma.instructor.update({ where: { id }, data });
    return res.json(instructor);
  }

  if (req.method === "PATCH") {
    const { id } = req.query;
    const { is_active } = req.body as { is_active: boolean };
    if (!id) return res.status(400).json({ error: "id required" });
    const instructor = await prisma.instructor.update({
      where: { id: String(id) },
      data: { is_active },
    });
    return res.json(instructor);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    await prisma.instructor.delete({ where: { id: String(id) } });
    return res.status(204).end();
  }

  res.status(405).end();
}
