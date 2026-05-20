import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { dedupeInstructorRows } from "@/lib/instructorIdentity";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";

/** Random URL-safe alphanumeric password. */
function generateTempPassword(len = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function instructorWelcomeHtml(name: string, email: string, password: string, loginUrl: string): string {
  return `
    <div style="font-family:Helvetica,Arial,sans-serif;color:#333;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="font-weight:600;color:#333;margin-bottom:8px;">Welcome to The Studio, ${name}</h2>
      <p style="color:#6b6b6b;line-height:1.6;">
        Your instructor account has been created. Use the credentials below to sign in and start checking in your classes.
      </p>
      <div style="margin:20px 0;padding:16px 20px;border:1px solid #e5e5e0;border-radius:12px;background:#f7f7f0;">
        <p style="margin:0 0 6px;font-size:13px;color:#6b6b6b;">Login email</p>
        <p style="margin:0 0 14px;font-size:15px;font-weight:600;color:#333;font-family:'SF Mono',Consolas,monospace;">${email}</p>
        <p style="margin:0 0 6px;font-size:13px;color:#6b6b6b;">Temporary password</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#333;font-family:'SF Mono',Consolas,monospace;">${password}</p>
      </div>
      <p style="color:#6b6b6b;line-height:1.6;">
        Sign in here: <a href="${loginUrl}" style="color:#8F9779;">${loginUrl}</a>
      </p>
      <p style="color:#888;font-size:12px;line-height:1.6;margin-top:24px;">
        Please change your password after your first login. If you didn't expect this email, contact the studio.
      </p>
      <p style="color:#888;font-size:12px;margin-top:24px;">— The Studio by Copper &amp; Cloves</p>
    </div>
  `;
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
          html: instructorWelcomeHtml(instructor.name ?? "Instructor", email, tempPassword, loginUrl),
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
