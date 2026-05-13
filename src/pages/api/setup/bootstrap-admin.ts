import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

/**
 * One-time (or rare) admin creation on live hosts without local psql.
 *
 * 1. In Amplify (or .env.local): set ADMIN_SETUP_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
 * 2. Deploy, then POST once:
 *    curl -X POST "https://YOUR_HOST/api/setup/bootstrap-admin" \
 *      -H "Content-Type: application/json" \
 *      -H "x-admin-setup-secret: YOUR_ADMIN_SETUP_SECRET" \
 *      -d "{}"
 * 3. Remove ADMIN_SETUP_SECRET and ADMIN_PASSWORD from Amplify afterward.
 *
 * If ADMIN_SETUP_SECRET is unset, this route returns 404 so the path is not advertised.
 */
function readSetupSecret(req: NextApiRequest): string | undefined {
  const header = req.headers["x-admin-setup-secret"];
  if (typeof header === "string" && header.length > 0) return header.trim();
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  return undefined;
}

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const setupSecret = process.env.ADMIN_SETUP_SECRET?.trim();
  if (!setupSecret) {
    return res.status(404).json({ error: "Not found" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sent = readSetupSecret(req);
  if (!sent || !secretsMatch(sent, setupSecret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";

  if (!email || !password) {
    return res.status(500).json({
      error: "Server misconfiguration",
      hint: "Set ADMIN_EMAIL and ADMIN_PASSWORD in the hosting environment (e.g. Amplify).",
    });
  }

  const hash = await bcrypt.hash(password, 12);

  try {
    await prisma.profile.upsert({
      where: { email },
      create: {
        email,
        full_name: "Studio Administrator",
        role: "admin",
        hashedPassword: hash,
      },
      update: {
        role: "admin",
        hashedPassword: hash,
      },
    });
  } catch (e) {
    console.error("bootstrap-admin:", e);
    return res.status(500).json({ error: "Database error" });
  }

  return res.status(200).json({
    ok: true,
    email,
    message: "Admin profile ready. Log in at /admin/login. Remove ADMIN_SETUP_SECRET and ADMIN_PASSWORD from env when done.",
  });
}
