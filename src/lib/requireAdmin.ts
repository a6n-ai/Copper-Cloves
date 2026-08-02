import type { NextApiResponse } from "next";
import type { StudioSession as Session } from "@/lib/getStudioServerSession";
import { hasRole } from "@/lib/auth/roles";

/**
 * Enforce admin-only access for API routes under /api/admin/* (and similar).
 * Returns false after sending 401/403; caller should `return` immediately.
 */
export function ensureAdmin(session: Session | null, res: NextApiResponse): boolean {
  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  const role = (session.user as { role?: string }).role;
  if (!hasRole(role, "admin")) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}
