/**
 * Ensures the kitchen/chef login exists (role "chef" → /admin/kitchen).
 * Writes the better-auth credential, not the legacy Profile.hashedPassword.
 * Loads .env then .env.local before importing Prisma (imports are hoisted otherwise).
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { normalizeLoginEmail } from "../src/lib/loginEmail";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const DEFAULT_CHEF_EMAIL = "chefs@copperandcloves.com";
const DEFAULT_CHEF_PASSWORD = "Qwerty@123!";

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;
  const { attachStudioCredential } = await import("../src/lib/auth/studioIdentity");

  const email = normalizeLoginEmail(process.env.CHEF_EMAIL || DEFAULT_CHEF_EMAIL);
  const password = process.env.CHEF_PASSWORD || DEFAULT_CHEF_PASSWORD;

  // Profile first, then the credential: attachStudioCredential resolves (or
  // creates) the identity behind it, so re-running resets the password instead
  // of failing on User.email's unique index.
  const profile = await prisma.profile.upsert({
    where: { email_role: { email, role: "chef" } },
    create: { email, full_name: "Kitchen Team", role: "chef" },
    update: {},
    select: { id: true },
  });
  await attachStudioCredential({ profileId: profile.id, password });

  console.log("");
  console.log("Chef (kitchen) profile is ready.");
  console.log("  • URL:   /login");
  console.log(`  • Email: ${email}`);
  console.log(`  • Password: ${password}`);
  console.log("  (override with CHEF_EMAIL / CHEF_PASSWORD in .env.local)");
  console.log("");
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0)) // pg Pool (idleTimeoutMillis:0, keepAlive) keeps the loop alive otherwise
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
