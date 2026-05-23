import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

/**
 * Partial-signup lead capture. POST upserts a lead by email when a visitor
 * completes step 1 of signup (name + email, optional phone). PATCH marks a lead
 * converted once they finish. Best-effort — never blocks the signup flow.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { email, fullName, phone } = req.body ?? {};
    if (typeof email !== "string" || !email.trim() || typeof fullName !== "string" || !fullName.trim()) {
      return res.status(400).json({ error: "email and fullName are required" });
    }
    const normEmail = email.trim().toLowerCase();
    try {
      await prisma.signupLead.upsert({
        where: { email: normEmail },
        create: { email: normEmail, full_name: fullName.trim(), phone: phone?.trim() || null },
        // Don't clobber a converted lead; just refresh details.
        update: { full_name: fullName.trim(), phone: phone?.trim() || null },
      });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(200).json({ ok: false });
    }
  }

  if (req.method === "PATCH") {
    const { email } = req.body ?? {};
    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "email is required" });
    }
    const normEmail = email.trim().toLowerCase();
    try {
      await prisma.signupLead.updateMany({
        where: { email: normEmail },
        data: { status: "converted", converted_at: new Date() },
      });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(200).json({ ok: false });
    }
  }

  res.setHeader("Allow", "POST, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}
