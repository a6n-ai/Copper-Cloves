import prisma from "@/lib/prisma";
import { serializeRoles, type Role } from "@/lib/auth/roles";
import { packMultiHash, describeHash } from "@/lib/auth/password";

const APPLY = process.argv.includes("--apply");

/**
 * Profile -> better-auth User/Account backfill. Idempotent: re-running skips
 * profiles that already carry a user_id and upserts by email, so a partial run
 * can simply be re-run.
 *
 * Passwords are COPIED VERBATIM. bcrypt hashes stay bcrypt; src/lib/auth/password.ts
 * verifies them in place. Nobody resets.
 */
async function main() {
  const profiles = await prisma.profile.findMany({
    select: { id: true, email: true, role: true, full_name: true, hashedPassword: true, created_at: true, user_id: true },
    orderBy: { created_at: "asc" },
  });

  const byEmail = new Map<string, typeof profiles>();
  for (const p of profiles) {
    const key = p.email.trim().toLowerCase();
    if (!key) throw new Error(`Profile ${p.id} has an empty email — cannot backfill`);
    byEmail.set(key, [...(byEmail.get(key) ?? []), p]);
  }

  let users = 0, accounts = 0, links = 0;

  for (const [email, group] of byEmail) {
    const roles = serializeRoles(group.map((p) => p.role as Role));
    if (!roles) throw new Error(`${email}: no recognised role among [${group.map((p) => p.role).join(",")}]`);

    // Oldest profile is the original account — it wins for display name.
    const primary = group[0];
    const name = group.find((p) => p.full_name)?.full_name ?? email;

    // EVERY distinct password is kept. Where two profile rows for one person
    // carried different passwords, both continue to work — the identity merge
    // must not silently invalidate a password someone is still using.
    const hashes = group.map((p) => p.hashedPassword).filter((h): h is string => !!h);
    const password = hashes.length ? packMultiHash(hashes) : null;

    if (!APPLY) {
      console.log(`[dry] ${email} roles=${roles} password=${password ? describeHash(password) : "none"} profiles=${group.length}`);
      continue;
    }

    const user = await prisma.user.upsert({
      where: { email },
      // emailVerified: true is LOAD-BEARING. See spec §7 — without it the magic
      // link plugin deletes these migrated passwords on first use. Set on BOTH
      // create and update so a re-run never leaves an existing user unverified.
      create: { email, name, emailVerified: true, role: roles, createdAt: primary.created_at },
      update: { name, role: roles, emailVerified: true },
    });
    users++;

    if (password) {
      const existing = await prisma.account.findFirst({
        where: { userId: user.id, providerId: "credential" },
      });
      if (!existing) {
        await prisma.account.create({
          data: { userId: user.id, accountId: user.id, providerId: "credential", password },
        });
        accounts++;
      }
    }

    for (const p of group) {
      if (p.user_id === user.id) continue;
      await prisma.profile.update({ where: { id: p.id }, data: { user_id: user.id } });
      links++;
    }
  }

  console.log(APPLY
    ? `applied: users=${users} accounts=${accounts} profileLinks=${links}`
    : `dry run over ${byEmail.size} emails / ${profiles.length} profiles — re-run with --apply`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
