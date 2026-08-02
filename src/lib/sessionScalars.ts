import type { StudioSession as Session } from "@/lib/getStudioServerSession";
import { primaryRole, parseRoles, type Role } from "@/lib/auth/roles";

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

/**
 * The HIGHEST-PRIVILEGE role this session holds. Roles are a comma-separated
 * string now (better-auth admin plugin), so a single value is a lossy view —
 * correct for "which portal am I in", wrong for "may I do X". Use
 * getSessionRoles or hasRole for permission checks.
 */
export function getSessionRole(session: Session | null | undefined): Role | undefined {
  return primaryRole((session?.user as { role?: string } | undefined)?.role);
}

/** Every role this session holds, privilege-sorted. */
export function getSessionRoles(session: Session | null | undefined): Role[] {
  return parseRoles((session?.user as { role?: string } | undefined)?.role);
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
