/**
 * Ensures the kitchen/chef login exists (role "chef" → /admin/kitchen).
 * Loads .env then .env.local before importing Prisma (imports are hoisted otherwise).
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { normalizeLoginEmail } from "../src/lib/loginEmail";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const DEFAULT_CHEF_EMAIL = "chefs@copperandcloves.com";
const DEFAULT_CHEF_PASSWORD = "Qwerty@123!";

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;

  const email = normalizeLoginEmail(process.env.CHEF_EMAIL || DEFAULT_CHEF_EMAIL);
  const password = process.env.CHEF_PASSWORD || DEFAULT_CHEF_PASSWORD;
  const hash = await bcrypt.hash(password, 12);

  await prisma.profile.upsert({
    where: { email_role: { email, role: "chef" } },
    create: {
      email,
      full_name: "Kitchen Team",
      role: "chef",
      hashedPassword: hash,
    },
    update: {
      hashedPassword: hash,
    },
  });

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
