import prisma from "@/lib/prisma";
import { attachStudioCredential } from "@/lib/auth/studioIdentity";

/** Instructors to provision a login for (matched by their Instructor.email). */
const TARGET_EMAILS = [
  "Gayatrishetts0910@gmail.com",
  "iris.socher@gmail.com",
  "julianitto@gmail.com",
  "Rayikatana@gmail.com",
  "Meghahothari05@gmail.com",
  "priya06ag@gmail.com",
  "arora.sanchika@gmail.com",
  "Sheralpereira@gmail.com",
];

const PASSWORD = "Qwerty@123";

async function main() {
  for (const rawEmail of TARGET_EMAILS) {
    const lower = rawEmail.toLowerCase();

    const inst = await prisma.instructor.findFirst({
      where: { email: { equals: rawEmail, mode: "insensitive" } },
      select: { id: true, name: true, email: true, profile_id: true },
    });

    if (!inst) {
      console.log(`❓ ${rawEmail} — no matching instructor row, skipped`);
      continue;
    }

    const existing = await prisma.profile.findFirst({
      where: { email: lower, role: "instructor" },
      select: { id: true },
    });

    const profile = existing
      ? await prisma.profile.update({
          where: { id: existing.id },
          data: { full_name: inst.name ?? undefined, onboarding_completed: true },
        })
      : await prisma.profile.create({
          data: {
            email: lower,
            full_name: inst.name ?? null,
            role: "instructor",
            onboarding_completed: true,
          },
        });

    // The credential lives on the better-auth Account; this also mints the
    // identity when the Profile has none.
    await attachStudioCredential({ profileId: profile.id, password: PASSWORD });

    if (inst.profile_id !== profile.id) {
      await prisma.instructor.update({ where: { id: inst.id }, data: { profile_id: profile.id } });
    }

    const action = existing ? "updated existing profile" : "created profile";
    console.log(`✅ ${inst.name ?? "(no name)"} <${lower}> — ${action} (${profile.id}), linked`);
  }

  console.log(`\nDone. Login password for all: ${PASSWORD}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
