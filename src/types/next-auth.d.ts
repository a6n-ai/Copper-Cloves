import type { DefaultSession } from "next-auth";

/**
 * Augments the NextAuth session so `session.user.id` (and the studio-specific
 * scope fields) are typed everywhere — they are populated in the `session`
 * callback in `src/lib/auth.ts`. Replaces ad-hoc `(session.user as { id?: string })`
 * casts scattered across API routes.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      partner_id?: string | null;
      instructor_id?: string | null;
      onboarding_completed?: boolean;
      available_roles?: string[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    partner_id?: string | null;
    instructor_id?: string | null;
    onboarding_completed?: boolean;
    available_roles?: string[];
    sid?: string;
  }
}
