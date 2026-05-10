import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    let raw: Record<string, unknown>;
    try {
      raw =
        typeof req.body === "string"
          ? (JSON.parse(req.body) as Record<string, unknown>)
          : (req.body as Record<string, unknown>);
    } catch {
      return res.status(400).json({ error: "Invalid JSON body." });
    }
    if (!raw || typeof raw !== "object") {
      return res.status(400).json({ error: "Invalid request body." });
    }
    const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
    const password = typeof raw.password === "string" ? raw.password : "";
    const full_name =
      typeof raw.full_name === "string" ? raw.full_name.trim() : undefined;
    const phone =
      typeof raw.phone === "string" ? raw.phone.trim() || null : raw.phone ?? null;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const existing = await prisma.profile.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.profile.create({
      data: {
        email,
        full_name: full_name ?? null,
        phone: typeof phone === "string" ? phone : null,
        hashedPassword,
        role: "user",
      },
    });

    return res.status(201).json({ message: "Account created successfully." });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Sign up failed";
    const code =
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      typeof (e as { code: unknown }).code === "string"
        ? (e as { code: string }).code
        : "";

    console.error("[signup]", msg);
    /* Prisma P2002: unique violation */
    if (code === "P2002") {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    return res.status(500).json({
      error: "Unable to create account. Check database connection.",
      ...(process.env.NODE_ENV === "development"
        ? { detail: msg, hint: "Use STUDIO_DATABASE_URL in .env.local if DATABASE_URL is set in Windows OS env." }
        : {}),
    });
  }
}
