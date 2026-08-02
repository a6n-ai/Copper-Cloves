/**
 * Ensures an admin login exists — the documented recovery path if admin access
 * is lost. Writes the better-auth credential (User + `credential` Account), not
 * the legacy Profile.hashedPassword column that Task 13 drops.
 * Loads .env then .env.local before importing Prisma (imports are hoisted otherwise).
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { normalizeLoginEmail } from "../src/lib/loginEmail";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const DEFAULT_ADMIN_EMAIL = "admin@copperandcloves.local";
const DEFAULT_ADMIN_PASSWORD = "StudioAdmin!2026";

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;
  const { attachStudioCredential } = await import("../src/lib/auth/studioIdentity");

  const email = normalizeLoginEmail(process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

  // The Profile is upserted first, then attachStudioCredential resolves (or
  // creates) the identity behind it and writes the password. Splitting it that
  // way means re-running against an existing admin resets the password instead
  // of failing on User.email's unique index — which createStudioLogin would.
  const profile = await prisma.profile.upsert({
    where: { email_role: { email, role: "admin" } },
    create: { email, full_name: "Studio Administrator", role: "admin" },
    update: {},
    select: { id: true },
  });
  await attachStudioCredential({ profileId: profile.id, password });

  console.log("");
  console.log("Admin profile is ready.");
  console.log("  • URL:   /login");
  console.log(`  • Email: ${email}`);
  console.log(`  • Password: ${password}`);
  console.log("  (override with ADMIN_EMAIL / ADMIN_PASSWORD in .env.local)");
  console.log("");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
