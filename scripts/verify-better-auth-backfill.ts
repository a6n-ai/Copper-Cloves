import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import { parseRoles } from "@/lib/auth/roles";
import { describeHash, unpack } from "@/lib/auth/password";

/** Structural assertions only — never touches plaintext. Run before cutover. */
async function main() {
  const profiles = await prisma.profile.findMany({
    select: { id: true, email: true, role: true, hashedPassword: true, user_id: true },
  });
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, emailVerified: true } });
  const accounts = await prisma.account.findMany({
    where: { providerId: "credential" },
    select: { userId: true, password: true },
  });

  const emails = new Set(profiles.map((p) => p.email.trim().toLowerCase()));
  assert.equal(users.length, emails.size, `one User per distinct email (${users.length} vs ${emails.size})`);

  for (const u of users) {
    assert.equal(u.emailVerified, true, `${u.email}: emailVerified must be true (spec §7 — magic link deletes unverified passwords)`);
    assert.ok(parseRoles(u.role).length > 0, `${u.email}: role string parses to at least one valid role (got ${JSON.stringify(u.role)})`);
  }

  const usersById = new Map(users.map((u) => [u.id, u]));
  for (const p of profiles) {
    assert.ok(p.user_id, `profile ${p.id} (${p.email}) has no user_id`);
    const u = usersById.get(p.user_id!);
    assert.ok(u, `profile ${p.id} points at a missing user`);
    assert.equal(u!.email, p.email.trim().toLowerCase(), `profile ${p.id} email mismatch`);
    assert.ok(parseRoles(u!.role).includes(p.role as never), `profile ${p.id} role "${p.role}" absent from user role "${u!.role}"`);
  }

  // Orphan check: every User must be pointed at by at least one Profile.
  // Shape/count assertions alone would only catch this incidentally (as a
  // perturbed total), and not at all if a profile were simultaneously missing.
  const linkedUserIds = new Set(profiles.map((p) => p.user_id).filter((id): id is string => !!id));
  for (const u of users) {
    assert.ok(linkedUserIds.has(u.id), `user ${u.id} (${u.email}) has no profile pointing at it — orphan`);
  }

  const withPassword = profiles.filter((p) => p.hashedPassword);
  const accountsByUser = new Map(accounts.map((a) => [a.userId, a]));
  for (const p of withPassword) {
    assert.ok(accountsByUser.has(p.user_id!), `profile ${p.id} (${p.email}) has a password but no credential account`);
  }

  // Exact hash-SET equality per identity — shape checks alone (bcrypt/scrypt/
  // multi(N)) pass on an under-packed merge, a truncated hash, or a hash
  // copied from the wrong profile. Compare in memory; never log a hash.
  const profilesByUser = new Map<string, typeof profiles>();
  for (const p of withPassword) {
    profilesByUser.set(p.user_id!, [...(profilesByUser.get(p.user_id!) ?? []), p]);
  }
  for (const [userId, group] of profilesByUser) {
    const expected = new Set(group.map((p) => p.hashedPassword).filter((h): h is string => !!h));
    const account = accountsByUser.get(userId);
    assert.ok(account, `user ${userId} has ${expected.size} password-holding profile(s) but no credential account`);
    const stored = new Set(unpack(account!.password ?? ""));
    assert.equal(
      stored.size,
      expected.size,
      `user ${userId}: stored credential hash count (${stored.size}) != expected from linked profiles (${expected.size})`,
    );
    for (const h of expected) {
      assert.ok(
        stored.has(h),
        `user ${userId}: a linked profile's password hash (${describeHash(h)}) is missing from the stored credential account`,
      );
    }
  }

  // Exactly one credential account per identity — a second would make sign-in
  // depend on which row better-auth happens to read first. Merged passwords are
  // packed INTO one row via packMultiHash instead.
  const perUser = new Map<string, number>();
  for (const a of accounts) perUser.set(a.userId, (perUser.get(a.userId) ?? 0) + 1);
  for (const [userId, n] of perUser) {
    assert.equal(n, 1, `user ${userId} has ${n} credential accounts — expected exactly 1`);
  }

  let merged = 0;
  for (const a of accounts) {
    const shape = a.password ? describeHash(a.password) : "empty";
    assert.ok(
      shape === "bcrypt" || shape === "scrypt" || shape.startsWith("multi("),
      `account for user ${a.userId} has an unreadable password hash (${shape})`,
    );
    if (shape.startsWith("multi(")) merged++;
  }

  // Every profile row that had a password must be represented in the packed hash.
  const expectedAccounts = new Set(withPassword.map((p) => p.user_id)).size;
  assert.equal(accounts.length, expectedAccounts, `one credential account per password-holding identity (${accounts.length} vs ${expectedAccounts})`);

  console.log(`verify: OK — ${users.length} users, ${accounts.length} credential accounts (${merged} merged multi-hash), ${profiles.length} profiles linked`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("verify FAILED:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
