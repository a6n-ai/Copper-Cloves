import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { normalizeLoginEmail } from "@/lib/loginEmail";

const PORTAL_ORDER = ["admin", "chef", "partner", "instructor", "user"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawEmail = (req.body?.email as string | undefined) ?? "";
  if (!rawEmail.trim()) return res.status(400).json({ error: "Email required" });

  const email = normalizeLoginEmail(rawEmail);

  const rows = await prisma.profile.findMany({
    where: { email, hashedPassword: { not: null } },
    select: { role: true },
  });

  const roles = Array.from(new Set(rows.map((r) => r.role))).sort(
    (a, b) => PORTAL_ORDER.indexOf(a) - PORTAL_ORDER.indexOf(b)
  );

  // Do not leak which emails exist; just report available portals.
  return res.status(200).json({ roles });
}
