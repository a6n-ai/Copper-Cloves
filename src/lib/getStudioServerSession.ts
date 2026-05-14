import type { NextApiRequest, NextApiResponse } from "next";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ensureNextAuthUrlFromRequest } from "@/lib/ensureNextAuthUrlFromRequest";

/**
 * Server-side session for API routes. Ensures NEXTAUTH_URL matches the request host when needed
 * (Amplify branch URLs vs a single env NEXTAUTH_URL is a common source of 401/empty admin data).
 */
export async function getStudioServerSession(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<Session | null> {
  ensureNextAuthUrlFromRequest(req);
  return getServerSession(req, res, authOptions);
}
