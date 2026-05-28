import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { normalizeLoginEmail } from "@/lib/loginEmail";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";
import { welcomeEmail } from "@/lib/notifications/emailTemplates";
import logger from "@/lib/logger";

function walkErrorChain(e: unknown): unknown[] {
  const list: unknown[] = [];
  let cur: unknown = e;
  const seen = new Set<unknown>();
  while (cur != null && !seen.has(cur)) {
    seen.add(cur);
    list.push(cur);
    if (cur instanceof Error && cur.cause != null) cur = cur.cause;
    else break;
  }
  return list;
}

function prismaMeta(e: unknown): { code: string; message: string } {
  for (const item of walkErrorChain(e)) {
    if (item instanceof Prisma.PrismaClientKnownRequestError) {
      return { code: item.code, message: item.message };
    }
    if (item instanceof Prisma.PrismaClientInitializationError) {
      const init = item as Error & { errorCode?: string };
      return { code: init.errorCode ?? "", message: item.message };
    }
    if (item instanceof Prisma.PrismaClientValidationError) {
      return { code: "VALIDATION", message: item.message };
    }
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (typeof e === "object" && e !== null && "code" in e && typeof (e as { code: unknown }).code === "string") {
    return { code: (e as { code: string }).code, message: msg };
  }
  return { code: "", message: msg };
}

function userFacingDbMessage(code: string, message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("permission denied")) {
    return "Database access error (permission denied). Confirm the database user can read/write the profiles table and prisma db push has been applied on production.";
  }
  if (lower.includes("relation") && lower.includes("profiles") && lower.includes("does not exist")) {
    return "The profiles table is missing. Run prisma db push (or deploy migrations) on the production database.";
  }

  if (message.includes("Missing database URL") || message.includes("STUDIO_DATABASE_URL")) {
    return "The server cannot reach its database. If you run the studio, add STUDIO_DATABASE_URL (or DATABASE_URL) in your hosting environment (e.g. AWS Amplify → Environment variables).";
  }

  /* Common Prisma connection / init codes */
  if (code === "P1001" || code === "P1002" || code === "P1017") {
    return "We cannot reach the database from this app. Check that your database is running, the connection string is correct, and (for AWS RDS) the security group allows inbound PostgreSQL from your hosting service.";
  }
  if (code === "P1000") {
    return "Database login failed. Check the username and password in your connection string.";
  }

  if (code === "P2021") {
    return "A required database table is missing. Run prisma db push (or deploy migrations) on the production database.";
  }
  if (code === "P2022") {
    return "The database schema is out of date (a column is missing). Run prisma db push (or deploy migrations) on the production database.";
  }
  if (code === "VALIDATION") {
    return "Invalid signup data. Check all fields and try again.";
  }

  if (
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT") ||
    message.includes("timeout") ||
    message.includes("Can't reach database") ||
    (message.includes("connection") && message.includes("refused"))
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
    const email = typeof raw.email === "string" ? normalizeLoginEmail(raw.email) : "";
    const password = typeof raw.password === "string" ? raw.password : "";
    const full_name =
      typeof raw.full_name === "string" ? raw.full_name.trim() : undefined;
    const phone =
      typeof raw.phone === "string" ? raw.phone.trim() || null : raw.phone ?? null;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const existing = await prisma.profile.findFirst({ where: { email, role: "user" } });
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

    const portalUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
    // Awaited so the email actually sends on serverless (the handler would
    // otherwise return and the function freezes before delivery). Failures are
    // logged but never block account creation.
    await sendHtmlEmail({
      to: email,
      subject: "welcome to The Studio by Copper + Cloves",
      html: welcomeEmail({ memberName: full_name || email, portalUrl }),
    })
      .then((result) => {
        if (!result.ok) logger.error({ result }, "[signup] welcome email failed");
      })
      .catch((err) => logger.error({ err }, "[signup] welcome email threw"));

    return res.status(201).json({ message: "Account created successfully." });
  } catch (e: unknown) {
    const { code, message } = prismaMeta(e);

    logger.error({ code: code || undefined }, "[signup] " + message);

    if (code === "P2002") {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const msgLower = message.toLowerCase();
    if (msgLower.includes("72 bytes") || msgLower.includes("data must be utf-8")) {
      return res.status(400).json({
        error: "Password is too long for our system. Use a shorter password (max 72 characters).",
      });
    }

    const friendly = userFacingDbMessage(code, message);
    if (friendly) {
      return res.status(503).json({
        error: friendly,
        ...(code && /^P[0-9]+$/.test(code) ? { code } : {}),
        ...(process.env.NODE_ENV === "development" ? { detail: message } : {}),
      });
    }

    return res.status(500).json({
      error:
        "Something went wrong while creating your account. Please try again later or contact the studio.",
      ...(code && /^P[0-9]+$/.test(code) ? { code } : {}),
      ...(process.env.NODE_ENV === "development"
        ? {
            detail: message,
            hint: "Use STUDIO_DATABASE_URL in .env.local (and on Amplify) if DATABASE_URL is wrong on Windows.",
          }
        : {}),
    });
  }
}
