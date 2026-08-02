import type { NextApiRequest, NextApiResponse } from "next";
import { fromNodeHeaders } from "better-auth/node";
import { auth, computeFingerprint } from "@/lib/auth";
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
 * Server-side session for API routes and SSR. A valid session cookie is not
 * enough: the session must still be bound to the device it was issued to.
 *
 * Fingerprint MISMATCH REJECTS — it does not rebind. Rebinding is what allowed
 * the 2026-06-30 incident, where a CDN-cached /api/auth/session response served
 * to another user let a leaked cookie take over the account. Cost of rejecting:
 * one re-login after a genuine User-Agent change (e.g. a browser auto-update).
 */
export async function getStudioServerSession(
  req: NextApiRequest,
  _res: NextApiResponse,
): Promise<StudioSession | null> {
  try {
    const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!result?.user || !result.session) return null;

    // No fingerprint => this row did NOT come through databaseHooks.session.create
    // (which sets one unconditionally, and the field is `input: false` so nothing
    // else can). A direct DB write, a script, or a future plugin path that bypasses
    // the hook is exactly what must not be trusted. Reject, same as the retired
    // session guard rejected a token with no `sid`. There is no legacy population to drain — the
    // sessions table was created empty and better-auth has never served production.
    const stored = result.session.fingerprint;
    const ua = (req.headers["user-agent"] as string | undefined) ?? "";
    if (!stored || stored !== computeFingerprint(ua)) {
      logger.warn(
        { sessionId: result.session.id, hasFingerprint: Boolean(stored) },
        "[auth] session fingerprint missing or mismatched — rejecting",
      );
      return null;
    }

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
