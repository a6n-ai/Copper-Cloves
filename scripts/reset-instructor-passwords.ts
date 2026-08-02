import prisma from "@/lib/prisma";
import { attachStudioCredential } from "@/lib/auth/studioIdentity";

const PASSWORD = "Qwerty@123";

async function main() {
  const instructors = await prisma.instructor.findMany({
    where: { profile_id: { not: null } },
    select: { id: true, name: true, email: true, profile_id: true },
    orderBy: { name: "asc" },
  });

  const rows: { name: string; email: string }[] = [];

  for (const inst of instructors) {
    const profile = await prisma.profile.update({
      where: { id: inst.profile_id! },
      data: { onboarding_completed: true },
      select: { id: true, email: true },
    });
    // Writes the better-auth credential Account (and clears the legacy column),
    // which is the only thing sign-in reads.
    await attachStudioCredential({ profileId: profile.id, password: PASSWORD });
    rows.push({ name: inst.name ?? "(no name)", email: profile.email });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`\nReset ${rows.length} instructor logins to: ${PASSWORD}\n`);
  console.log("| Name | Email | Password |");
  console.log("|---|---|---|");
  for (const r of rows) console.log(`| ${r.name} | ${r.email} | ${PASSWORD} |`);
  console.log("");
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
