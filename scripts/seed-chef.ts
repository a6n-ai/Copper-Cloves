/**
 * Ensures the kitchen/chef login exists (role "chef" → /admin/kitchen).
 * Writes the better-auth credential (User + `credential` Account).
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
  // findFirst-then-create: @@unique([email, role]) is gone, and there is nothing
  // to update anyway — the password lives on the credential Account now.
  const profile =
    (await prisma.profile.findFirst({ where: { email, role: "chef" }, select: { id: true } })) ??
    (await prisma.profile.create({
      data: { email, full_name: "Kitchen Team", role: "chef" },
      select: { id: true },
    }));
  // overwrite: true — re-running this seed is how the chef password is reset.
  await attachStudioCredential({ profileId: profile.id, password, overwrite: true });

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
