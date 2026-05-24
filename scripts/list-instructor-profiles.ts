import prisma from "@/lib/prisma";

async function main() {
  const instructors = await prisma.instructor.findMany({
    select: { id: true, name: true, email: true, profile_id: true },
    orderBy: { name: "asc" },
  });

  // Resolve which profile_ids actually still exist + any orphan role-instructor profiles.
  const linkedIds = instructors.map((i) => i.profile_id).filter((x): x is string => !!x);
  const existingProfiles = linkedIds.length
    ? await prisma.profile.findMany({
        where: { id: { in: linkedIds } },
        select: { id: true, email: true },
      })
    : [];
  const existingIds = new Set(existingProfiles.map((p) => p.id));

  const withProfile = instructors.filter((i) => i.profile_id && existingIds.has(i.profile_id));
  const danglingLink = instructors.filter((i) => i.profile_id && !existingIds.has(i.profile_id));
  const noProfile = instructors.filter((i) => !i.profile_id);

  console.log(`\nTotal instructors: ${instructors.length}\n`);

  console.log(`✅ WITH login profile (${withProfile.length}):`);
  for (const i of withProfile) console.log(`   - ${i.name ?? "(no name)"}  <${i.email ?? "no email"}>  profile_id=${i.profile_id}`);

  console.log(`\n❌ WITHOUT login profile (${noProfile.length}):`);
  for (const i of noProfile) console.log(`   - ${i.name ?? "(no name)"}  <${i.email ?? "no email"}>`);

  if (danglingLink.length) {
    console.log(`\n⚠️  profile_id set but Profile row missing (${danglingLink.length}):`);
    for (const i of danglingLink) console.log(`   - ${i.name ?? "(no name)"}  <${i.email ?? "no email"}>  profile_id=${i.profile_id}`);
  }
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
