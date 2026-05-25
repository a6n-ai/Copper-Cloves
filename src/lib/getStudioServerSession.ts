import type { NextApiRequest, NextApiResponse } from "next";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ensureNextAuthUrlFromRequest } from "@/lib/ensureNextAuthUrlFromRequest";
import { isRequestSessionValid } from "@/lib/sessionGuard";

/**
 * Server-side session for API routes + SSR. Ensures NEXTAUTH_URL matches the request host when
 * needed (Amplify branch URLs vs a single env NEXTAUTH_URL is a common source of 401/empty admin
 * data), then enforces the server-side session record: a valid JWT is not enough — its `sid` must
 * still be the profile's active session, bound to this device, and not idle-expired. A superseded,
 * revoked, replayed, or stale token resolves to null (treated as logged out).
 */
export async function getStudioServerSession(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<Session | null> {
  ensureNextAuthUrlFromRequest(req);
  const session = await getServerSession(req, res, authOptions);
  if (!session) return null;
  if (!(await isRequestSessionValid(req))) return null;
  return session;
}
