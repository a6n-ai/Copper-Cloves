import prisma from "@/lib/prisma";
import { studioPassword } from "./password";
import { parseRoles, serializeRoles, type Role } from "./roles";

/**
 * The counterpart to createStudioLogin, for identities that ALREADY exist.
 *
 * createStudioLogin's first act is to throw if a User exists for the email, so
 * it can only ever mint a brand-new identity. Everything else — activating a
 * placeholder, changing a password, giving an existing member a second portal
 * role — needs this file instead.
 */

/**
 * The User id for `email`, creating a PASSWORDLESS User if there is none.
 *
 * Passwordless is deliberate: better-auth's /sign-in/email needs a `credential`
 * Account to verify against, so a User with none simply cannot sign in until
 * attachStudioCredential writes one. That is exactly what an invite placeholder
 * wants — an identity to hang the Profile off (so `user_id` is never null and
 * Task 13's @@unique([user_id, role]) has something to key on), with no way in
 * until the invitee sets a password.
 *
 * An existing User is ADOPTED, not rejected: identity is keyed on email alone,
 * so a person invited as a member who already has an instructor login must end
 * up on the same User. The role is UNIONED onto whatever they already hold —
 * never serializeRoles([role]), which would drop the others.
 */
export async function resolveStudioUser({
  email,
  name,
  role,
}: {
  email: string;
  name: string;
  role: Role;
}): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existing) {
    const roles = parseRoles(existing.role);
    if (!roles.includes(role)) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: serializeRoles([...roles, role]) },
      });
    }
    return existing.id;
  }
  // Written straight to the table rather than through auth.api.signUpEmail:
  // that endpoint demands a password, which is the one thing this User must
  // not have. The admin plugin's create.before only supplies the default role,
  // which is set explicitly here.
  const created = await prisma.user.create({
    data: { email, name, role: serializeRoles([role]) },
  });
  return created.id;
}

/**
 * Give an existing Profile a working password.
 *
 * Writes `Account.password` directly, the way api/auth/reset-password.ts does:
 * better-auth's own set-password endpoint sits behind the admin plugin's
 * adminMiddleware and is unusable from a member-facing route.
 *
 * A Profile with no `user_id` (every placeholder created before this landed)
 * gets an identity here first, so activation heals the row instead of writing a
 * password nothing can read.
 *
 * A plain overwrite, never a packMultiHash merge — after a change the OLD
 * password must stop verifying, and studioPassword.verify accepts EVERY packed
 * candidate. The legacy `Profile.hashedPassword` column is cleared for the same
 * reason: until Task 13 deletes nextAuthOptions.ts it is still a live sign-in
 * path, and a stale hash there would keep the old password alive.
 *
 * @returns the User id the credential was written to.
 */
export async function attachStudioCredential({
  profileId,
  password,
}: {
  profileId: string;
  password: string;
}): Promise<string> {
  // 8 = emailAndPassword.minPasswordLength. Every caller validates too, but
  // this path bypasses better-auth entirely so the floor is enforced here as
  // well — a route that forgets cannot write a weaker password than sign-up
  // would have accepted.
  if (!password || password.length < 8) {
    throw new Error("[auth] attachStudioCredential: password must be at least 8 characters");
  }

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { id: true, email: true, role: true, full_name: true, user_id: true },
  });
  if (!profile) throw new Error("[auth] attachStudioCredential: profile not found");

  let userId = profile.user_id;
  if (!userId) {
    userId = await resolveStudioUser({
      email: profile.email,
      name: profile.full_name || profile.email,
      role: parseRoles(profile.role)[0] ?? "user",
    });
    await prisma.profile.update({ where: { id: profile.id }, data: { user_id: userId } });
  }

  const hashedPassword = await studioPassword.hash(password);
  const credential = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { id: true },
  });

  await prisma.$transaction([
    credential
      ? prisma.account.update({ where: { id: credential.id }, data: { password: hashedPassword } })
      : prisma.account.create({
          data: { userId, accountId: userId, providerId: "credential", password: hashedPassword },
        }),
    // NOT filtered by role: the credential above is per-identity, so a second
    // Profile for the same person would otherwise keep the old password alive
    // for its portal on the NextAuth path. Mirrors reset-password.ts.
    prisma.profile.updateMany({ where: { email: profile.email }, data: { hashedPassword: null } }),
  ]);

  return userId;
}

/** True once the identity behind this Profile has a password it can sign in with. */
export async function hasStudioCredential(profile: {
  user_id: string | null;
  hashedPassword: string | null;
}): Promise<boolean> {
  // The legacy column still authenticates until Task 13 deletes nextAuthOptions.ts,
  // so it counts as activated. Drop that clause when the column goes.
  if (profile.hashedPassword) return true;
  if (!profile.user_id) return false;
  const count = await prisma.account.count({
    where: { userId: profile.user_id, providerId: "credential", password: { not: null } },
  });
  return count > 0;
}
