import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { auth } from "@/lib/auth";
import { primaryRole, serializeRoles, type Role } from "@/lib/auth/roles";
import { LoginEmailTakenError } from "@/lib/auth/studioIdentity";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Thrown when the email already has a better-auth identity in ANY role.
 * Identity is keyed on email ALONE (User.email is unique) and holds exactly one
 * role, so there is no second login row for the same person in another portal
 * and no role to union on — this is a hard 409. Declared in studioIdentity.ts
 * (which resolveStudioUser can import without dragging in `@/lib/auth`) and
 * re-exported here for the routes that already import it from this module.
 */
export { LoginEmailTakenError };

type ProfileFields = Omit<Prisma.ProfileUncheckedCreateInput, "email" | "role" | "user_id">;

/**
 * The one way to create a studio login. better-auth owns the credential
 * (User + `credential` Account); Profile owns studio membership.
 *
 * ORDERING (load-bearing): `emailAndPassword.autoSignIn` is false, so
 * `signUpEmail` does NOT open a session. That is what lets the Profile be
 * created here, after the call — `session.create.before` in src/lib/auth/index.ts
 * refuses any identity with no Profile row, and a `user.create.after` hook
 * cannot beat it (better-auth queues create.after hooks until the sign-up
 * handler's transaction wrapper resolves, i.e. after the session gate has
 * already run). See the Task 11 report.
 *
 * FAILURE: a User with no Profile is unrecoverable from the app — it can never
 * sign in (the gate) and signup can never be retried (the email is taken). So
 * anything that fails after the User exists rolls the User back; the credential
 * Account cascades with it.
 */
export async function createStudioLogin({
  email,
  password,
  name,
  role,
  profile,
}: {
  email: string;
  password: string;
  name: string;
  role: Role;
  profile?: ProfileFields;
}) {
  const taken = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (taken) throw new LoginEmailTakenError(email, primaryRole(taken.role));

  // Throws APIError on a password shorter than minPasswordLength / longer than
  // maxPasswordLength — callers surface it rather than swallowing it.
  const created = await auth.api.signUpEmail({ body: { email, password, name } });
  const userId = created?.user?.id;
  if (!userId) throw new Error("[auth] sign-up returned no user");

  try {
    // The admin plugin's own user.create.before already writes the default
    // "user"; anything else has to be set after the fact because `role` is an
    // input:false additional field and is stripped from the sign-up body.
    //
    // serializeRoles REPLACES the role set, which is safe because the pre-check
    // above guarantees a brand-new User with nothing to lose — and under
    // one-email-one-role there is never a second role to preserve anyway.
    if (role !== "user") {
      await prisma.user.update({ where: { id: userId }, data: { role: serializeRoles([role]) } });
    }
    return await prisma.profile.create({
      data: { ...profile, email, role, user_id: userId },
    });
  } catch (e) {
    await prisma.user
      .delete({ where: { id: userId } })
      .catch((err) => logger.error({ err, userId }, "[auth] orphaned user rollback failed"));
    throw e;
  }
}
