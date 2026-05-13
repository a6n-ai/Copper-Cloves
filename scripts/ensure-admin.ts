/**
 * Ensures an admin profile exists (for /admin/login via NextAuth credentials).
 * Loads .env then .env.local before importing Prisma (imports are hoisted otherwise).
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { normalizeLoginEmail } from "../src/lib/loginEmail";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const DEFAULT_ADMIN_EMAIL = "admin@copperandcloves.local";
const DEFAULT_ADMIN_PASSWORD = "StudioAdmin!2026";

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;

  const email = normalizeLoginEmail(process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const hash = await bcrypt.hash(password, 12);

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

  console.log("");
  console.log("Admin profile is ready.");
  console.log("  • URL:   /admin/login");
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
