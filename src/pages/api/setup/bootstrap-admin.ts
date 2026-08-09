import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "node:crypto";
import prisma from "@/lib/prisma";
import { normalizeLoginEmail } from "@/lib/loginEmail";
import { apiError } from "@/lib/apiError";
import { createStudioLogin } from "@/lib/auth/createStudioLogin";
import { LoginEmailTakenError } from "@/lib/auth/studioIdentity";
import { studioPassword } from "@/lib/auth/password";
import { hasRole, primaryRole, serializeRoles } from "@/lib/auth/roles";

/**
 * One-time (or rare) admin creation on live hosts without local psql.
 *
 * 1. In SSM /copper-cloves/prod (or .env.local): set ADMIN_SETUP_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
 * 2. Deploy, then POST once:
 *    curl -X POST "https://YOUR_HOST/api/setup/bootstrap-admin" \
 *      -H "Content-Type: application/json" \
 *      -H "x-admin-setup-secret: YOUR_ADMIN_SETUP_SECRET" \
 *      -d "{}"
 * 3. Delete the ADMIN_SETUP_SECRET and ADMIN_PASSWORD parameters afterward, then redeploy.
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

  const email = normalizeLoginEmail(process.env.ADMIN_EMAIL || "");
  const password = process.env.ADMIN_PASSWORD || "";

  if (!email || !password) {
    return res.status(500).json({
      error: "Server misconfiguration",
      hint: "Set ADMIN_EMAIL and ADMIN_PASSWORD in the server environment (prod: SSM /copper-cloves/prod).",
    });
  }

  // Checked here so a too-short ADMIN_PASSWORD says so, instead of surfacing as
  // a generic error from better-auth's minPasswordLength on the create path.
  if (password.length < 8) {
    return res.status(400).json({
      error: "ADMIN_PASSWORD must be at least 8 characters.",
    });
  }

  try {
    // Re-runnable by design (the documented way to reset a lost admin password),
    // and after the identity backfill the admin User usually already exists — so
    // the existing-identity branch is the normal one, not the edge case.
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
    // One email, one role: this route resets the ADMIN identity's password. If
    // the email belongs to some other portal it is refused outright — silently
    // promoting a member to admin is exactly what a leaked setup secret wants.
    if (existing && !hasRole(existing.role, "admin")) {
      return res.status(409).json({ error: new LoginEmailTakenError(email, primaryRole(existing.role)).message });
    }
    if (!existing) {
      await createStudioLogin({
        email,
        password,
        name: "Studio Administrator",
        role: "admin",
        profile: { full_name: "Studio Administrator" },
      });
    } else {
      // Written straight to the credential Account (same shape the backfill
      // writes) because better-auth's own set-password endpoint is behind the
      // admin plugin's adminMiddleware and this route has no session at all.
      // A plain overwrite, never a merge: the old password must stop working.
      const hash = await studioPassword.hash(password);
      const credential = await prisma.account.findFirst({
        where: { userId: existing.id, providerId: "credential" },
        select: { id: true },
      });
      await prisma.$transaction([
        credential
          ? prisma.account.update({ where: { id: credential.id }, data: { password: hash } })
          : prisma.account.create({
              data: { userId: existing.id, accountId: existing.id, providerId: "credential", password: hash },
            }),
        // Normalise, never union: the guard above only established that the
        // role set CONTAINS admin, so this rewrites it to exactly ["admin"],
        // dropping any other role a legacy multi-role row may still carry.
        prisma.user.update({ where: { id: existing.id }, data: { role: serializeRoles(["admin"]) } }),
        // Keyed on user_id, now @@unique: one Profile per identity. The old
        // email_role composite key is gone (one email holds one role).
        prisma.profile.upsert({
          where: { user_id: existing.id },
          create: { email, full_name: "Studio Administrator", role: "admin", user_id: existing.id },
          update: { role: "admin" },
        }),
      ]);
    }
  } catch (e) {
    return apiError(res, e, "bootstrap-admin", 500, "Database error");
  }

  return res.status(200).json({
    ok: true,
    email,
    message: "Admin profile ready. Log in at /login. Remove ADMIN_SETUP_SECRET and ADMIN_PASSWORD from env when done.",
  });
}
