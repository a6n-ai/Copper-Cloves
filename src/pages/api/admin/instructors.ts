import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { dedupeInstructorRows } from "@/lib/instructorIdentity";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { sendStudioEmail } from "@/lib/notifications/email";
import logger from "@/lib/logger";
import { hasRole } from "@/lib/auth/roles";
import { attachStudioCredential } from "@/lib/auth/studioIdentity";

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
    if (email) {
      const lower = email.toLowerCase();
      const existing = await prisma.profile.findFirst({
        where: { email: lower, role: "instructor" },
        select: { id: true },
      });
      const profile = existing
        ? await prisma.profile.update({
            where: { id: existing.id },
            data: { full_name: instructor.name ?? undefined, onboarding_completed: true },
          })
        : await prisma.profile.create({
            data: {
              email: lower,
              full_name: instructor.name ?? null,
              // Identity resolved by attachStudioCredential below — which adopts
              // an existing User for this email (a member becoming an
              // instructor) rather than failing on User.email's unique index.
              role: "instructor",
              onboarding_completed: true,
            },
          });
      await attachStudioCredential({ profileId: profile.id, password: tempPassword });
      await prisma.instructor.update({ where: { id: instructor.id }, data: { profile_id: profile.id } });
    }

    // Best-effort welcome email with the plain password. Errors don't block creation.
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
            Temp_Password: tempPassword,
            Login_Link: loginUrl,
          },
        });
      } catch (e) {
        logger.warn({ err: e }, "[instructors] welcome email failed");
      }
    }

    return res.status(201).json(instructor);
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
