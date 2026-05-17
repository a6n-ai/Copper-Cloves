import { config } from "dotenv";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;

  const instructors = await prisma.instructor.findMany({
    select: { name: true, email: true, hashed_password: true },
    orderBy: { display_order: "asc" },
  });

  console.log("Instructor login status:\n");
  let ok = 0;
  let missing = 0;

  for (const inst of instructors) {
    if (!inst.hashed_password) {
      console.log(`✗ ${inst.name.padEnd(20)} ${inst.email ?? "(no email)"} — NO PASSWORD`);
      missing++;
      continue;
    }
    const valid = await bcrypt.compare("Qwerty@123", inst.hashed_password);
    if (valid) {
      console.log(`✓ ${inst.name.padEnd(20)} ${inst.email ?? "(no email)"}`);
      ok++;
    } else {
      console.log(`✗ ${inst.name.padEnd(20)} ${inst.email ?? "(no email)"} — WRONG HASH`);
    }
  }

  console.log(`\n${ok} ready, ${missing} missing password`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
