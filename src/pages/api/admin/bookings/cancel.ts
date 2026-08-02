import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { cancelBookingWithRefund } from "@/lib/classCancellation";
import { requestLogger } from "@/lib/logger";
import type { NextApiRequest, NextApiResponse } from "next";
import { hasRole } from "@/lib/auth/roles";

/**
 * Admin direct cancel of a member's booking. Reuses the shared
 * `cancelBookingWithRefund` primitive — group cascade, refund-as-`1 Class Pass`
 * (non-unlimited rows only), cancellation email, and paid-orphan flagging all
 * live there. Admin is the authority, so this works regardless of cutoff (the
 * after-cutoff member path exists precisely so an admin approves it).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!hasRole((session.user as { role?: string }).role, "admin")) return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "POST") return res.status(405).end();

  const { bookingId, reason } = req.body as { bookingId?: string; reason?: string };
  if (!bookingId) return res.status(400).json({ error: "bookingId required" });

  const result = await cancelBookingWithRefund(bookingId, {
    byAdmin: true,
    cancelledBy: (session.user as { id?: string }).id,
    reason,
  });

  if (!result.cancelled) return res.status(400).json({ error: "Booking not found or already cancelled" });

  log.info(
    { adminId: (session.user as { id?: string }).id, bookingId, refunded: result.refund.grantedUserPackageIds.length },
    "admin direct cancel",
  );
  return res.json({ ok: true, ...result });
}
