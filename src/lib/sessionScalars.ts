import type { Session } from "next-auth";

type Role = "user" | "instructor" | "partner" | "admin" | "chef";

/**
 * Tiny typed accessors for `session.user` scalars. NextAuth ships its `User`
 * with a loose shape, so call-sites otherwise sprinkle
 * `(session?.user as { role?: string })?.role` everywhere — a quality-of-life
 * mess and a magnet for typos.
 *
 * Use these inside components/effects when you only need a primitive.
 * Returning primitives keeps `useEffect` dep arrays stable across the 4-min
 * session refetch tick (the wrapper `Session` object identity changes each
 * tick even when the underlying JWT is unchanged).
 */
export function getSessionRole(session: Session | null | undefined): Role | undefined {
  const role = (session?.user as { role?: string } | undefined)?.role;
  return role as Role | undefined;
}

export function getSessionUserId(session: Session | null | undefined): string | undefined {
  return (session?.user as { id?: string } | undefined)?.id;
}

export function getSessionPartnerId(session: Session | null | undefined): string | undefined {
  return (session?.user as { partner_id?: string } | undefined)?.partner_id;
}

export function getSessionInstructorId(session: Session | null | undefined): string | undefined {
  return (session?.user as { instructor_id?: string } | undefined)?.instructor_id;
}

export function getSessionOnboardingCompleted(
  session: Session | null | undefined,
): boolean | undefined {
  return (session?.user as { onboarding_completed?: boolean } | undefined)?.onboarding_completed;
}
