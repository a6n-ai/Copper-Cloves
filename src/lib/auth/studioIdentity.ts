import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { studioPassword } from "./password";
import { parseRoles, serializeRoles, type Role } from "./roles";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The ADOPT-CAPABLE counterpart to createStudioLogin.
 *
 * createStudioLogin's first act is to throw if a User exists for the email, so
 * it can only ever mint a brand-new identity — right for self-signup, wrong for
 * everything here. Identity is keyed on email ALONE, so a person who already
 * has one portal login and is being given another must land on the SAME User
 * with the second role unioned on, never a second identity and never a 409.
 */

/**
 * The User id for `email`, creating a PASSWORDLESS User if there is none.
 *
 * Passwordless is deliberate: better-auth's /sign-in/email verifies against the
 * `credential` Account, so a User with none simply cannot sign in until
 * attachStudioCredential writes one. That is exactly what an invite placeholder
 * wants — an identity to hang the Profile off (so `user_id` is never null and
 * Task 13's @@unique([user_id, role]) has something to key on), with no way in
 * until the invitee sets a password.
 *
 * An existing User is ADOPTED and the role UNIONED onto whatever it already
 * holds — never serializeRoles([role]), which would drop the others.
 *
 * `created` is load-bearing: it is the ONLY thing that makes a rollback safe.
 * Deleting an adopted User would destroy a real member's identity, sessions and
 * every Profile hanging off it.
 */
export async function resolveStudioUser({
  email,
  name,
  role,
}: {
  email: string;
  name: string;
  role: Role;
}): Promise<{ userId: string; created: boolean }> {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existing) {
    const roles = parseRoles(existing.role);
    if (!roles.includes(role)) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: serializeRoles([...roles, role]) },
      });
    }
    return { userId: existing.id, created: false };
  }
  // Written straight to the table rather than through auth.api.signUpEmail:
  // that endpoint demands a password, which is the one thing this User must
  // not have. The admin plugin's create.before only supplies the default role,
  // which is set explicitly here.
  //
  // emailVerified: true matches the 616 identities the backfill created and
  // satisfies scripts/verify-better-auth-backfill.ts. It is not cosmetic — the
  // magic-link plugin DELETES the password of a pre-existing account whose
  // email was never confirmed. Everyone created through this path was reached
  // BY email (an invite, an onboarding, an admin who typed their address), so
  // the address is as confirmed as the backfilled ones.
  const created = await prisma.user.create({
    data: { email, name, emailVerified: true, role: serializeRoles([role]) },
  });
  return { userId: created.id, created: true };
}

type ProfileFields = Omit<Prisma.ProfileUncheckedCreateInput, "email" | "role" | "user_id">;

export type CreatedStudioProfile = {
  profile: { id: string; email: string; role: string; full_name: string | null; user_id: string | null };
  /** False when the identity was adopted and already had a password — see attachStudioCredential. */
  passwordApplied: boolean;
  /** True only if this call minted the User. Feed it to rollbackStudioProfile. */
  userCreated: boolean;
};

/**
 * Create a Profile on the identity for `email`, adopting an existing User.
 *
 * With `password`, the credential is written NON-destructively: an adopted
 * identity that already has a working password keeps it, and `passwordApplied`
 * comes back false so the caller can say so instead of mailing out a password
 * that does nothing.
 *
 * A minted User is rolled back if the Profile insert fails — that state is
 * unrecoverable from the app (the session gate refuses an identity with no
 * Profile, and signup can never be retried because the email is taken). An
 * ADOPTED User is never deleted.
 */
export async function createStudioProfile({
  email,
  name,
  role,
  password,
  profile,
}: {
  email: string;
  name: string;
  role: Role;
  password?: string;
  profile?: ProfileFields;
}): Promise<CreatedStudioProfile> {
  const { userId, created } = await resolveStudioUser({ email, name, role });
  try {
    const row = await prisma.profile.create({
      data: { ...profile, email, role, user_id: userId },
      select: { id: true, email: true, role: true, full_name: true, user_id: true },
    });
    const passwordApplied = password
      ? (await attachStudioCredential({ profileId: row.id, password, overwrite: false })).written
      : false;
    return { profile: row, passwordApplied, userCreated: created };
  } catch (e) {
    if (created) {
      await prisma.user
        .delete({ where: { id: userId } })
        .catch((err) => logger.error({ err, userId }, "[auth] orphaned user rollback failed"));
    }
    throw e;
  }
}

/**
 * Undo a createStudioProfile when a later step in the same request fails.
 * Deletes the User (cascading its Account, Sessions and Profile) ONLY if this
 * request minted it; otherwise just the Profile, leaving the real identity be.
 */
export async function rollbackStudioProfile(created: CreatedStudioProfile | undefined): Promise<void> {
  if (!created) return;
  if (created.userCreated && created.profile.user_id) {
    await prisma.user.delete({ where: { id: created.profile.user_id } }).catch(() => {});
    return;
  }
  await prisma.profile.delete({ where: { id: created.profile.id } }).catch(() => {});
}

/**
 * Set the password on an existing Profile's identity.
 *
 * Writes `Account.password` directly, the way api/auth/reset-password.ts does:
 * better-auth's own set-password endpoint sits behind the admin plugin's
 * adminMiddleware and is unusable from a member-facing route.
 *
 * A Profile with no `user_id` (every placeholder created before this landed)
 * gets an identity here first, so activation heals the row instead of writing a
 * password nothing can read.
 *
 * `overwrite` is REQUIRED, with no default, on purpose. Credentials are
 * per-IDENTITY, not per-Profile: an admin adding an instructor for an email
 * that already has a member login is writing to that member's User. Silently
 * replacing their chosen password — and clearing the legacy column, killing it
 * on the NextAuth path too — is what an unconditional overwrite does. Every
 * caller must say which it means:
 *   overwrite: false — provisioning. Existing password wins; `written` is false.
 *   overwrite: true  — the caller IS the reset (change-password, reset tools).
 *
 * When it does write it is a plain overwrite, never a packMultiHash merge:
 * after a change the OLD password must stop verifying, and studioPassword.verify
 * accepts EVERY packed candidate.
 */
export async function attachStudioCredential({
  profileId,
  password,
  overwrite,
}: {
  profileId: string;
  password: string;
  overwrite: boolean;
}): Promise<{ userId: string; written: boolean }> {
  // 8 = emailAndPassword.minPasswordLength. Every caller validates too, but
  // this path bypasses better-auth entirely so the floor is enforced here as
  // well — a route that forgets cannot write a weaker password than sign-up
  // would have accepted.
  if (!password || password.length < 8) {
    throw new Error("[auth] attachStudioCredential: password must be at least 8 characters");
  }

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { id: true, email: true, role: true, full_name: true, user_id: true, hashedPassword: true },
  });
  if (!profile) throw new Error("[auth] attachStudioCredential: profile not found");

  let userId = profile.user_id;
  if (!userId) {
    const resolved = await resolveStudioUser({
      email: profile.email,
      name: profile.full_name || profile.email,
      role: parseRoles(profile.role)[0] ?? "user",
    });
    userId = resolved.userId;
    await prisma.profile.update({ where: { id: profile.id }, data: { user_id: userId } });
  }

  // The SAME predicate the activation guard uses, so the two cannot disagree.
  // A narrower "does an Account row exist" test would overwrite — and legacy-
  // clear — an identity whose only password is still in the legacy column,
  // which is exactly what these provisioning callers must not do.
  if (!overwrite && (await hasStudioCredential({ user_id: userId, hashedPassword: profile.hashedPassword }))) {
    return { userId, written: false };
  }

  const credential = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { id: true },
  });

  const hashedPassword = await studioPassword.hash(password);
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

  return { userId, written: true };
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
