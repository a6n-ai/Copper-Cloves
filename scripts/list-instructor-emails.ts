import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

// READ-ONLY: lists instructor emails and which Profile rows (by role) exist for
// each, so we can see which instructors were mistakenly added as `user` accounts.
async function main() {
  const prisma = (await import("../src/lib/prisma")).default;

  const instructors = await prisma.instructor.findMany({
    select: { name: true, email: true, is_active: true, profile_id: true },
    orderBy: { name: "asc" },
  });

  console.log(`\nInstructors in DB: ${instructors.length}\n`);

  const emails: string[] = [];
  for (const inst of instructors) {
    const em = inst.email?.trim().toLowerCase() ?? null;
    if (em) emails.push(em);
    let roles = "—";
    if (em) {
      const profiles = await prisma.profile.findMany({ where: { email: em }, select: { role: true } });
      roles = profiles.map((p) => p.role).join(", ") || "—";
    }
    console.log(
      `${(inst.name || "").padEnd(24)} ${(em ?? "(no email)").padEnd(34)} profiles:[${roles}]  linked:${inst.profile_id ? "yes" : "no"}  active:${inst.is_active}`
    );
  }

  console.log("\n================ ALL INSTRUCTOR EMAILS ================");
  console.log(emails.join("\n"));

  const userDupes = await prisma.profile.findMany({
    where: { role: "user", email: { in: emails } },
    select: { email: true, full_name: true },
    orderBy: { email: "asc" },
  });
  console.log(`\n==== role="user" profiles matching instructor emails (candidates to separate): ${userDupes.length} ====`);
  for (const u of userDupes) console.log(`${u.email}   ${u.full_name ?? ""}`);

  const instProfiles = await prisma.profile.findMany({
    where: { role: "instructor", email: { in: emails } },
    select: { email: true },
  });
  console.log(`\n(For reference) instructor-role profiles already present: ${instProfiles.length}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
