import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { onboardGuestsForBooking } from "@/lib/guestOnboarding";
import type { GuestAttendee } from "@/lib/financeBookingCheckout";

/**
 * Guest onboarding is now performed server-side inside booking fulfillment
 * (see src/lib/guestOnboarding.ts, wired into /api/bookings and
 * razorpayServerCheckout) so it runs for every checkout path — including
 * Razorpay full-page redirects where the client never resumes.
 *
 * This endpoint is retained for backwards compatibility and manual re-runs; it
 * delegates to the same idempotent routine, so calling it is always safe.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const bookerId = (session.user as { id: string }).id;
  const { guests, classScheduleId } = req.body as {
    guests?: GuestAttendee[];
    classScheduleId?: string;
  };

  if (!Array.isArray(guests) || guests.length === 0) {
    return res.status(200).json({ processed: 0, results: [] });
  }
  if (!classScheduleId) {
    return res.status(400).json({ error: "classScheduleId required" });
  }

  const result = await onboardGuestsForBooking({ guests, classScheduleId, bookerId });
  return res.status(200).json(result);
}
