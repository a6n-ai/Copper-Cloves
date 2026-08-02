import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { auth } from "@/lib/auth";
import { serializeRoles, type Role } from "@/lib/auth/roles";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Thrown when the email already has a better-auth identity. Identity is keyed on
 * email ALONE now (User.email is unique), so unlike the old per-role Profile
 * check there is no second login row for the same person in another portal —
 * a second role is granted on the existing User, never re-registered.
 */
export class LoginEmailTakenError extends Error {
  constructor(public readonly email: string) {
    super("An account with this email already exists.");
    this.name = "LoginEmailTakenError";
  }
}

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
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new LoginEmailTakenError(email);
  }

  // Throws APIError on a password shorter than minPasswordLength / longer than
  // maxPasswordLength — callers surface it rather than swallowing it.
  const created = await auth.api.signUpEmail({ body: { email, password, name } });
  const userId = created?.user?.id;
  if (!userId) throw new Error("[auth] sign-up returned no user");

  try {
    // The admin plugin's own user.create.before already writes the default
    // "user"; anything else has to be set after the fact because `role` is an
    // input:false additional field and is stripped from the sign-up body.
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
