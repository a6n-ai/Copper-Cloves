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

  // Unified login: the actual login lives on the linked role "instructor" Profile.
  const lower = (instructor.email ?? email).trim().toLowerCase();
  let profileId = instructor.profile_id;
  if (!profileId) {
    const existing = await prisma.profile.findFirst({ where: { email: lower, role: "instructor" }, select: { id: true } });
    profileId = existing?.id ?? null;
  }
  if (profileId) {
    await prisma.profile.update({ where: { id: profileId }, data: { hashedPassword: hashed } });
  } else {
    const created = await prisma.profile.create({
      data: { email: lower, full_name: instructor.name, hashedPassword: hashed, role: "instructor", onboarding_completed: true },
    });
    profileId = created.id;
  }
  if (instructor.profile_id !== profileId) {
    await prisma.instructor.update({ where: { id: instructor.id }, data: { profile_id: profileId } });
  }

  console.log(`Password set for instructor login: ${instructor.name} (${lower})`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
