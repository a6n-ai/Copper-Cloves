import prisma from "@/lib/prisma";
import { serializeRoles, parseRoles, STUDIO_ROLES, type Role } from "@/lib/auth/roles";
import { packMultiHash, unpack, describeHash } from "@/lib/auth/password";

const APPLY = process.argv.includes("--apply");

/**
 * Profile -> better-auth User/Account backfill. Idempotent: re-running skips
 * profiles that already carry a user_id and upserts by email, so a partial run
 * — including a post-cutover sweep, run against a User row that admins/members
 * have since edited — can simply be re-run.
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

  let identities = 0, usersCreated = 0, accountsCreated = 0, merged = 0, linksCreated = 0;

  for (const [email, group] of byEmail) {
    // A group with an unrecognised role must not silently write a narrower
    // role string than the profiles actually hold — fail loudly instead.
    const distinctRoleTokens = [...new Set(group.map((p) => p.role.trim().toLowerCase()))];
    const parsedRoles = parseRoles(distinctRoleTokens.join(","));
    if (parsedRoles.length === 0) {
      throw new Error(`${email}: no recognised role among [${distinctRoleTokens.join(",")}]`);
    }
    if (parsedRoles.length !== distinctRoleTokens.length) {
      const unrecognised = distinctRoleTokens.filter((t) => !(STUDIO_ROLES as readonly string[]).includes(t));
      throw new Error(`${email}: unrecognised role(s) [${unrecognised.join(",")}] among profile roles`);
    }
    const profileRoles = serializeRoles(parsedRoles);

    // Oldest profile is the original account — it wins for display name on create only.
    const primary = group[0];
    const name = group.find((p) => p.full_name)?.full_name ?? email;

    // EVERY distinct password is kept. Where two profile rows for one person
    // carried different passwords, both continue to work — the identity merge
    // must not silently invalidate a password someone is still using.
    const hashes = group.map((p) => p.hashedPassword).filter((h): h is string => !!h);
    const password = hashes.length ? packMultiHash(hashes) : null;

    if (!APPLY) {
      console.log(`[dry] ${email} roles=${profileRoles} password=${password ? describeHash(password) : "none"} profiles=${group.length}`);
      continue;
    }

    identities++;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    let user;
    if (existingUser) {
      // A sweep re-run must not clobber post-cutover edits: role is UNIONED
      // (a newly linked profile role is still picked up, an admin grant on the
      // User row is never reverted) and name is left untouched (member-editable).
      const unionRoles = serializeRoles([...new Set([...parseRoles(existingUser.role), ...parsedRoles])]);
      user = await prisma.user.update({
        where: { id: existingUser.id },
        // emailVerified: true is LOAD-BEARING. See spec §7 — without it the magic
        // link plugin deletes migrated passwords on first use.
        data: { emailVerified: true, role: unionRoles },
      });
    } else {
      user = await prisma.user.create({
        data: { email, name, emailVerified: true, role: profileRoles, createdAt: primary.created_at },
      });
      usersCreated++;
    }

    if (password) {
      const existing = await prisma.account.findFirst({
        where: { userId: user.id, providerId: "credential" },
      });
      if (!existing) {
        await prisma.account.create({
          data: { userId: user.id, accountId: user.id, providerId: "credential", password },
        });
        accountsCreated++;
      } else {
        // A profile can gain a NEW password after the first apply (e.g. a
        // second-portal login created via /admin/partners). If any incoming
        // hash isn't already stored, repack the union — never drop a hash.
        const stored = new Set(unpack(existing.password ?? ""));
        const covered = hashes.every((h) => stored.has(h));
        if (!covered) {
          const repacked = packMultiHash([...stored, ...hashes]);
          await prisma.account.update({ where: { id: existing.id }, data: { password: repacked } });
          merged++;
        }
      }
    }

    for (const p of group) {
      if (p.user_id === user.id) continue;
      await prisma.profile.update({ where: { id: p.id }, data: { user_id: user.id } });
      linksCreated++;
    }
  }

  console.log(APPLY
    ? `applied: identities=${identities} usersCreated=${usersCreated} accountsCreated=${accountsCreated} merged=${merged} profileLinksCreated=${linksCreated}`
    : `dry run over ${byEmail.size} emails / ${profiles.length} profiles — re-run with --apply`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
