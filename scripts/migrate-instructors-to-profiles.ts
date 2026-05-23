/**
 * One-time migration for the unified login. For each active instructor that has
 * an email + password, ensure a NextAuth login `Profile` exists and link it to
 * the Instructor via `Instructor.profile_id` (mirrors the PartnerMember pattern:
 * the link lives on the role-bearing record, not on Profile).
 *
 * Admin and partner accounts are never touched or downgraded — if an
 * instructor's email already belongs to one, the instructor is skipped.
 *
 * Idempotent — safe to re-run.
 *   npx tsx scripts/migrate-instructors-to-profiles.ts
 */
import prisma from "../src/lib/prisma";

async function main() {
  const instructors = await prisma.instructor.findMany({
    where: { email: { not: null }, hashed_password: { not: null }, is_active: true },
    select: { id: true, name: true, email: true, hashed_password: true, profile_id: true },
  });

  let created = 0, linked = 0, skipped = 0;
  for (const inst of instructors) {
    const email = inst.email!.trim().toLowerCase();
    if (!email) { skipped++; continue; }
    if (inst.profile_id) { skipped++; continue; }

    // Some instructors share the studio's admin email as a placeholder. That
    // address belongs to the admin login, so skip — they need a real personal
    // email before they can get an instructor login.
    const adminOwned = await prisma.profile.findFirst({ where: { email, role: "admin" }, select: { id: true } });
    if (adminOwned) {
      console.log("Skipped (email is the studio/admin address):", email, "-", inst.name);
      skipped++;
      continue;
    }

    // The instructor login is its own row (role "instructor"), separate from any
    // admin/partner/member row that shares this email — (email, role) is unique.
    const existing = await prisma.profile.findFirst({
      where: { email, role: "instructor" },
      select: { id: true },
    });

    if (existing) {
      await prisma.instructor.update({ where: { id: inst.id }, data: { profile_id: existing.id } });
      linked++;
      console.log("Linked existing profile:", email);
      continue;
    }

    const profile = await prisma.profile.create({
      data: {
        email,
        full_name: inst.name,
        hashedPassword: inst.hashed_password,
        role: "instructor",
        onboarding_completed: true,
      },
      select: { id: true },
    });
    await prisma.instructor.update({ where: { id: inst.id }, data: { profile_id: profile.id } });
    created++;
    console.log("Created instructor login:", email);
  }

  console.log(`\nDone. created=${created} linked=${linked} skipped=${skipped} (of ${instructors.length} eligible instructors)`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
