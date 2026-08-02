import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { studioPassword } from "./password";
import { hasRole, parseRoles, primaryRole, serializeRoles, type Role } from "./roles";
import type { Prisma } from "@/generated/prisma/client";

const ROLE_LABEL: Record<Role, string> = {
  admin: "admin",
  chef: "kitchen",
  partner: "partner manager",
  instructor: "instructor",
  user: "member",
};

/**
 * Thrown when the email already has a better-auth identity in a role other than
 * the one being provisioned. ONE EMAIL = ONE ROLE (user ruling 2026-08-02):
 * identity is keyed on email alone and may hold exactly one role, so this is a
 * hard reject — every route maps it to 409. The admin uses a different email,
 * or converts the existing identity in a separate deliberate action.
 *
 * Re-exported from createStudioLogin.ts, where it used to live, so the routes
 * that already import it from there are unchanged. It is declared HERE because
 * createStudioLogin.ts pulls in `@/lib/auth` (the whole better-auth instance)
 * and the seed scripts that use studioIdentity must not.
 */
export class LoginEmailTakenError extends Error {
  constructor(
    public readonly email: string,
    public readonly existingRole?: Role,
  ) {
    super(
      existingRole
        ? `This email already has a ${ROLE_LABEL[existingRole]} account. One email can hold only one role — use a different email address.`
        : "An account with this email already exists.",
    );
    this.name = "LoginEmailTakenError";
  }
}

/**
 * The SAME-ROLE-ADOPTING counterpart to createStudioLogin.
 *
 * createStudioLogin's first act is to throw if a User exists for the email at
 * all, so it can only ever mint a brand-new identity — right for self-signup,
 * wrong for the idempotent re-provisioning paths here. Identity is keyed on
 * email ALONE, and under the one-email-one-role ruling it may hold exactly one
 * role: re-provisioning the SAME role lands on the same User (that is what lets
 * ensure-admin.ts / seed-chef.ts be re-run), and a DIFFERENT role is a
 * LoginEmailTakenError, never a union.
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
 * An existing User is ADOPTED only when it already holds the requested role
 * (idempotent re-provisioning). Any other role throws LoginEmailTakenError —
 * the role is never unioned on, and the existing identity, its role and its
 * password are left completely untouched.
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
    // hasRole, not a substring test: "administrator" must not satisfy "admin".
    // It also still reads a legacy comma role correctly, so an identity that
    // somehow holds two roles is adopted for either rather than being locked
    // out of both.
    if (!hasRole(existing.role, role)) {
      const conflicting = primaryRole(existing.role);
      // No parseable role means the 409 carries no role at all and the operator
      // is left with a generic message — log the raw value so it is diagnosable.
      if (!conflicting) {
        logger.warn({ userId: existing.id, rawRole: existing.role }, "[auth] identity has an unparseable role");
      }
      throw new LoginEmailTakenError(email, conflicting);
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
 * Create a Profile on the identity for `email`, adopting an existing User only
 * when it holds the SAME role. A different role throws LoginEmailTakenError
 * (409 at every caller) and nothing is written.
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
 * per-IDENTITY, not per-Profile: a provisioning route re-run against an email
 * that already has a working login is writing to that person's User. Silently
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
    select: { id: true, email: true, role: true, full_name: true, user_id: true },
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
  if (!overwrite && (await hasStudioCredential({ user_id: userId }))) {
    return { userId, written: false };
  }

  const credential = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { id: true },
  });

  const hashedPassword = await studioPassword.hash(password);
  if (credential) {
    await prisma.account.update({ where: { id: credential.id }, data: { password: hashedPassword } });
  } else {
    await prisma.account.create({
      data: { userId, accountId: userId, providerId: "credential", password: hashedPassword },
    });
  }

  return { userId, written: true };
}

/** True once the identity behind this Profile has a password it can sign in with. */
export async function hasStudioCredential(profile: {
  user_id: string | null;
}): Promise<boolean> {
  if (!profile.user_id) return false;
  const count = await prisma.account.count({
    where: { userId: profile.user_id, providerId: "credential", password: { not: null } },
  });
  return count > 0;
}
