/**
 * Orphan / duplicate payment review (Part B of orphan-payment healing).
 *
 * Lists money-in payments that never got linked to a booking or package, and
 * classifies each so the admin knows what to do with it:
 *  - matchable          — a unique stuck (payment_pending/expired) booking of
 *                         the same member, same amount, different order —
 *                         almost certainly the retry-order case Part A heals
 *                         automatically when unambiguous. Surfaced here when
 *                         ambiguous or otherwise unhealed.
 *  - duplicate          — the member already has ANOTHER linked payment of the
 *                         same amount within ±7 days — likely a double charge.
 *  - fulfilled_unlinked — the member has an active package or a confirmed
 *                         booking created near the payment time — they got
 *                         value, this row is just an unlinked ledger entry.
 *  - stranded           — none of the above; needs manual investigation.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";
import { BOOKING_STATUS } from "@/lib/bookingStatus";

export type OrphanPaymentType = "matchable" | "duplicate" | "fulfilled_unlinked" | "stranded";

export type OrphanPaymentRow = {
  paymentId: string;
  amountPaise: number;
  method: string | null;
  createdAt: string;
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  memberName: string | null;
  memberEmail: string | null;
  type: OrphanPaymentType;
  suggestedBookingId?: string;
  suggestedBookingLabel?: string;
};

export type OrphanPaymentsResponse = {
  rows: OrphanPaymentRow[];
  counts: Record<OrphanPaymentType, number>;
};

/** Window either side of a linked payment's timestamp to flag a same-amount duplicate. */
const DUPLICATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Window either side of the payment's timestamp to treat a confirmed booking as "the same purchase". */
const FULFILLED_WINDOW_MS = 6 * 60 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;
  if (req.method !== "GET") return res.status(405).end();

  const emptyCounts: Record<OrphanPaymentType, number> = {
    matchable: 0,
    duplicate: 0,
    fulfilled_unlinked: 0,
    stranded: 0,
  };

  const orphans = await prisma.payment.findMany({
    where: {
      status: "succeeded",
      direction: "credit",
      booking_id: null,
      user_package_id: null,
      method: { in: ["razorpay_online", "razorpay_completed"] },
    },
    orderBy: { created_at: "desc" },
    take: 200,
    select: {
      id: true,
      user_id: true,
      amount_paise: true,
      method: true,
      created_at: true,
      razorpay_payment_id: true,
      razorpay_order_id: true,
      profile: { select: { full_name: true, email: true } },
    },
  });

  if (orphans.length === 0) {
    return res.json({ rows: [], counts: emptyCounts } satisfies OrphanPaymentsResponse);
  }

  const userIds = Array.from(new Set(orphans.map((o) => o.user_id)));

  const [stuckBookings, linkedPayments, activePackages, confirmedBookings] = await Promise.all([
    prisma.booking.findMany({
      where: {
        user_id: { in: userIds },
        status: { in: [BOOKING_STATUS.payment_pending, BOOKING_STATUS.expired] },
      },
      select: {
        id: true,
        user_id: true,
        class_name: true,
        booking_date: true,
        razorpay_order: { select: { amount_paise: true, razorpay_order_id: true } },
      },
    }),
    prisma.payment.findMany({
      where: {
        user_id: { in: userIds },
        status: "succeeded",
        direction: "credit",
        OR: [{ booking_id: { not: null } }, { user_package_id: { not: null } }],
      },
      select: { user_id: true, amount_paise: true, created_at: true },
    }),
    prisma.userPackage.findMany({
      where: { user_id: { in: userIds }, is_active: true },
      select: { user_id: true },
    }),
    prisma.booking.findMany({
      where: { user_id: { in: userIds }, status: BOOKING_STATUS.confirmed },
      select: { user_id: true, created_at: true },
    }),
  ]);

  const activePackageUserIds = new Set(activePackages.map((p) => p.user_id));

  const counts: Record<OrphanPaymentType, number> = { ...emptyCounts };

  const rows: OrphanPaymentRow[] = orphans.map((o) => {
    const bookingCandidates = stuckBookings.filter(
      (b) =>
        b.user_id === o.user_id &&
        b.razorpay_order != null &&
        b.razorpay_order.amount_paise === o.amount_paise &&
        b.razorpay_order.razorpay_order_id !== o.razorpay_order_id,
    );

    let type: OrphanPaymentType;
    let suggestedBookingId: string | undefined;
    let suggestedBookingLabel: string | undefined;

    if (bookingCandidates.length === 1) {
      type = "matchable";
      const b = bookingCandidates[0];
      suggestedBookingId = b.id;
      suggestedBookingLabel = `${b.class_name ?? "Class"} · ${new Date(b.booking_date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`;
    } else {
      const isDuplicate = linkedPayments.some(
        (p) =>
          p.user_id === o.user_id &&
          p.amount_paise === o.amount_paise &&
          Math.abs(p.created_at.getTime() - o.created_at.getTime()) <= DUPLICATE_WINDOW_MS,
      );

      if (isDuplicate) {
        type = "duplicate";
      } else {
        const hasActivePackage = activePackageUserIds.has(o.user_id);
        const hasNearbyConfirmedBooking = confirmedBookings.some(
          (b) =>
            b.user_id === o.user_id &&
            Math.abs(b.created_at.getTime() - o.created_at.getTime()) <= FULFILLED_WINDOW_MS,
        );
        type = hasActivePackage || hasNearbyConfirmedBooking ? "fulfilled_unlinked" : "stranded";
      }
    }

    counts[type] += 1;

    return {
      paymentId: o.id,
      amountPaise: o.amount_paise,
      method: o.method,
      createdAt: o.created_at.toISOString(),
      razorpayPaymentId: o.razorpay_payment_id,
      razorpayOrderId: o.razorpay_order_id,
      memberName: o.profile?.full_name ?? null,
      memberEmail: o.profile?.email ?? null,
      type,
      suggestedBookingId,
      suggestedBookingLabel,
    };
  });

  return res.json({ rows, counts } satisfies OrphanPaymentsResponse);
}
