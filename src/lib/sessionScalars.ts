import type { StudioSession as Session } from "@/lib/getStudioServerSession";
import { primaryRole, parseRoles, type Role } from "@/lib/auth/roles";

/**
 * Tiny typed accessors for `session.user` scalars. NextAuth ships its `User`
 * with a loose shape, so call-sites otherwise sprinkle
 * `(session?.user as { role?: string })?.role` everywhere — a quality-of-life
 * mess and a magnet for typos.
 *
 * Use these inside components/effects when you only need a primitive.
 * Returning primitives keeps `useEffect` dep arrays stable across the
 * session refetch tick (the wrapper `Session` object identity changes each
 * tick even when the underlying JWT is unchanged).
 *
 * SERVER SHAPE ONLY. `Session` here is `StudioSession` — the shape
 * `getStudioServerSession` returns, with `role`/`partner_id`/`instructor_id`/
 * `onboarding_completed` flattened onto `session.user`. Better Auth's client
 * `useSession().data` is a DIFFERENT shape (its `customSession` payload puts
 * `partner_id`/`instructor_id`/`onboarding_completed` at the top level, not
 * under `.user`) — passing it into these functions silently returns
 * `undefined` (optional properties, no tsc error). `getSessionRole` /
 * `getSessionRoles` / `getSessionUserId` work for both shapes because `role`
 * and `id` genuinely live on `.user` in both. Do not call
 * `getSessionPartnerId`/`getSessionInstructorId`/`getSessionOnboardingCompleted`
 * with a client `useSession().data` — read `session.partner_id` /
 * `session.instructor_id` / `session.onboarding_completed` directly instead.
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

/** SERVER-shape only — returns undefined for a client `useSession().data`. See the note at the top of this file. */
export function getSessionPartnerId(session: Session | null | undefined): string | undefined {
  return (session?.user as { partner_id?: string } | undefined)?.partner_id;
}

/** SERVER-shape only — returns undefined for a client `useSession().data`. See the note at the top of this file. */
export function getSessionInstructorId(session: Session | null | undefined): string | undefined {
  return (session?.user as { instructor_id?: string } | undefined)?.instructor_id;
}

/** SERVER-shape only — returns undefined for a client `useSession().data`. See the note at the top of this file. */
export function getSessionOnboardingCompleted(
  session: Session | null | undefined,
): boolean | undefined {
  return (session?.user as { onboarding_completed?: boolean } | undefined)?.onboarding_completed;
}
