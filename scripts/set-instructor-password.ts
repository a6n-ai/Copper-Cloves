/**
 * Set or reset an instructor's login password.
 * Usage: npx tsx scripts/set-instructor-password.ts <email> <password>
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error("Usage: npx tsx scripts/set-instructor-password.ts <email> <password>");
    process.exit(1);
  }

  const prisma = (await import("../src/lib/prisma")).default;

  const instructor = await prisma.instructor.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
  });
  if (!instructor) {
    console.error(`No instructor found with email: ${email}`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.instructor.update({
    where: { id: instructor.id },
    data: { hashed_password: hashed },
  });

  console.log(`Password set for instructor: ${instructor.name} (${instructor.email})`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
