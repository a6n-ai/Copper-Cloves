import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { dedupeInstructorRows } from "@/lib/instructorIdentity";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";
import { instructorWelcomeEmail } from "@/lib/notifications/emailTemplates";

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
    const isAdmin = (session?.user as { role?: string })?.role === "admin";
    const instructors = await prisma.instructor.findMany({
      where: isAdmin ? undefined : { is_active: true },
      orderBy: { display_order: "asc" },
    });
    return res.json(dedupeInstructorRows(instructors));
  }

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });

  if (req.method === "POST") {
    const body = req.body ?? {};
    const email = typeof body.email === "string" ? body.email.trim() : "";

    // Generate + hash a one-time password for the new instructor login.
    const tempPassword = generateTempPassword();
    const hashed_password = await bcrypt.hash(tempPassword, 12);

    const instructor = await prisma.instructor.create({
      data: { ...body, hashed_password },
    });

    // Best-effort welcome email with the plain password. Errors don't block creation.
    if (email) {
      try {
        const baseUrl =
          process.env.NEXTAUTH_URL?.trim() ||
          process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
          "https://www.thestudiobycopperandcloves.in";
        const loginUrl = `${baseUrl.replace(/\/$/, "")}/instructor/login`;
        await sendHtmlEmail({
          to: email,
          subject: "Your instructor login — The Studio",
          html: instructorWelcomeEmail({
            instructorName: instructor.name ?? "Instructor",
            email,
            tempPassword,
            loginUrl,
          }),
        });
      } catch (e) {
        console.warn("[instructors] welcome email failed", e);
      }
    }

    return res.status(201).json(instructor);
  }

  if (req.method === "PUT") {
    const { id, ...data } = req.body;
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
