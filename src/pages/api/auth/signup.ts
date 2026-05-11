import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

function prismaErrorCode(e: unknown): string {
  if (typeof e === "object" && e !== null && "code" in e && typeof (e as { code: unknown }).code === "string") {
    return (e as { code: string }).code;
  }
  return "";
}

function userFacingDbMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const code = prismaErrorCode(e);

  if (msg.includes("Missing database URL") || msg.includes("STUDIO_DATABASE_URL")) {
    return "The server cannot reach its database. If you run the studio, add STUDIO_DATABASE_URL (or DATABASE_URL) in your hosting environment (e.g. AWS Amplify → Environment variables).";
  }

  /* Common Prisma connection / init codes */
  if (code === "P1001" || code === "P1002" || code === "P1017") {
    return "We cannot reach the database from this app. Check that your database is running, the connection string is correct, and (for AWS RDS) the security group allows inbound PostgreSQL from your hosting service.";
  }
  if (code === "P1000") {
    return "Database login failed. Check the username and password in your connection string.";
  }

  if (
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("timeout") ||
    msg.includes("Can't reach database")
  ) {
    return "Cannot connect to the database (network or firewall). For cloud hosting + RDS, ensure public accessibility or a VPC link and security group rules allow access.";
  }

  return "";
}

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
    const code = prismaErrorCode(e);

    console.error("[signup]", msg, code || "");

    if (code === "P2002") {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const friendly = userFacingDbMessage(e);
    if (friendly) {
      return res.status(503).json({
        error: friendly,
        ...(process.env.NODE_ENV === "development" ? { detail: msg, code: code || undefined } : {}),
      });
    }

    return res.status(500).json({
      error:
        "Something went wrong while creating your account. Please try again later or contact the studio.",
      ...(process.env.NODE_ENV === "development"
        ? {
            detail: msg,
            code: code || undefined,
            hint: "Use STUDIO_DATABASE_URL in .env.local (and on Amplify) if DATABASE_URL is wrong on Windows.",
          }
        : {}),
    });
  }
}
