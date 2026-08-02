/**
 * Bulk-reset every linked instructor login to a shared password.
 *
 * Credentials are per-IDENTITY now, not per-Profile. An instructor whose email
 * is also a member login shares one User, so this script would replace that
 * person's real password with the literal below. Those identities are SKIPPED
 * unless --force is passed, and every one is named before anything is written.
 *
 * Usage: npx tsx scripts/reset-instructor-passwords.ts [--force]
 */
import prisma from "@/lib/prisma";
import { attachStudioCredential } from "@/lib/auth/studioIdentity";
import { parseRoles } from "@/lib/auth/roles";

const PASSWORD = "Qwerty@123";

async function main() {
  const force = process.argv.includes("--force");

  const instructors = await prisma.instructor.findMany({
    where: { profile_id: { not: null } },
    select: { id: true, name: true, email: true, profile_id: true },
    orderBy: { name: "asc" },
  });

  const targets: { name: string; email: string; profileId: string; otherRoles: string[]; unlinked: boolean }[] = [];
  for (const inst of instructors) {
    const profile = await prisma.profile.findUnique({
      where: { id: inst.profile_id! },
      select: { id: true, email: true, user_id: true, identity: { select: { role: true } } },
    });
    if (!profile) continue;
    // A Profile with no user_id is NOT risk-free: attachStudioCredential will
    // adopt whatever User owns this email and overwrite ITS password. Resolve
    // the identity the same way (by email) before deciding, or the guard misses
    // precisely the case it exists for.
    const identityRole =
      profile.identity?.role ??
      (await prisma.user.findUnique({ where: { email: profile.email }, select: { role: true } }))?.role;
    targets.push({
      name: inst.name ?? "(no name)",
      email: profile.email,
      profileId: profile.id,
      otherRoles: parseRoles(identityRole).filter((r) => r !== "instructor"),
      unlinked: !profile.user_id,
    });
  }
  targets.sort((a, b) => a.name.localeCompare(b.name));

  // Say what is about to happen BEFORE writing anything.
  const shared = targets.filter((t) => t.otherRoles.length > 0);
  console.log(`\n${targets.length} instructor logins found.`);
  if (shared.length) {
    console.log(
      `\n⚠  ${shared.length} of them share an identity with another portal — resetting these ` +
        `replaces that person's own password:\n`,
    );
    for (const t of shared) {
      console.log(
        `   ${t.name} <${t.email}> also: ${t.otherRoles.join(", ")}` +
          (t.unlinked ? "  (profile has no user_id — identity matched by email)" : ""),
      );
    }
    console.log(force ? "\n--force given: these WILL be overwritten.\n" : "\nSkipping them. Pass --force to overwrite.\n");
  }

  const done: { name: string; email: string }[] = [];
  for (const t of targets) {
    if (t.otherRoles.length && !force) continue;
    await prisma.profile.update({ where: { id: t.profileId }, data: { onboarding_completed: true } });
    // Writes the better-auth credential Account (and clears the legacy column),
    // which is the only thing sign-in reads. overwrite: true — resetting is the
    // entire point of this script.
    await attachStudioCredential({ profileId: t.profileId, password: PASSWORD, overwrite: true });
    done.push({ name: t.name, email: t.email });
  }

  console.log(`Reset ${done.length} instructor logins to: ${PASSWORD}\n`);
  console.log("| Name | Email | Password |");
  console.log("|---|---|---|");
  for (const r of done) console.log(`| ${r.name} | ${r.email} | ${PASSWORD} |`);
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
