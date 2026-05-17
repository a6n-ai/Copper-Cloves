/**
 * Sets the password for all 21 instructors to Qwerty@123
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const PASSWORD = "Qwerty@123";

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;

  const instructors = await prisma.instructor.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { display_order: "asc" },
  });

  console.log(`Found ${instructors.length} instructors. Setting password…\n`);

  const hashed = await bcrypt.hash(PASSWORD, 12);

  for (const inst of instructors) {
    await prisma.instructor.update({
      where: { id: inst.id },
      data: { hashed_password: hashed },
    });
    console.log(`✓ ${inst.name.padEnd(20)} ${inst.email ?? "(no email)"}`);
  }

  console.log(`\nDone. All ${instructors.length} instructors can now log in with password: ${PASSWORD}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
