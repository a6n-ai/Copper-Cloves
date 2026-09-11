import type { NextApiRequest, NextApiResponse } from "next";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";

/**
 * The session shape every API route and page already expects. `user.id` is a
 * PROFILE id — not a better-auth User id — because ~40 routes use it directly as
 * a Profile foreign key. This wrapper is the translation layer; keeping its
 * contract is what made the better-auth migration a one-file change server-side.
 */
export interface StudioSession {
  user: {
    id: string;
    role: string;
    // Optional/nullable so a client-held session object stays assignable here
    // when passed to sessionScalars. `id` and `role` stay required: those are
    // the two this wrapper guarantees.
    email?: string | null;
    name?: string | null;
    partner_id?: string | null;
    instructor_id?: string | null;
    onboarding_completed?: boolean;
  };
}

/**
 * Server-side session for API routes and SSR. The session cookie itself is
 * the trust boundary — no device/UA binding on top of it (dropped 2026-09-11:
 * the CDN that made a leaked cookie exploitable, Amplify/CloudFront in front
 * of /api/auth/session, no longer exists — prod is EC2 + Caddy, no cache in
 * front of the app — and no-store + Vary: Cookie headers stay regardless.
 * The binding's remaining cost was rejecting legitimate cross-browser session
 * reuse, e.g. a QR scan opening in a different browser/webview than the one
 * the member signed in on, which forced a re-login mid check-in).
 */
export async function getStudioServerSession(
  req: NextApiRequest,
  _res: NextApiResponse,
): Promise<StudioSession | null> {
  try {
    const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!result?.user || !result.session) return null;

    // No profile => the identity exists but has no studio membership row. Treat
    // as logged out rather than handing downstream code a null Profile id it
    // will happily use as a foreign key.
    if (!result.profile_id) {
      logger.warn(
        { userId: result.user.id },
        "[auth] session has no linked profile — treating as unauthenticated",
      );
      return null;
    }

    return {
      user: {
        id: result.profile_id,
        email: result.user.email,
        name: result.user.name ?? null,
        role: result.user.role ?? "user",
        partner_id: result.partner_id ?? null,
        instructor_id: result.instructor_id ?? null,
        onboarding_completed: result.onboarding_completed ?? false,
      },
    };
  } catch (e) {
    logger.error({ err: e }, "[auth] getStudioServerSession failed");
    return null;
  }
}
