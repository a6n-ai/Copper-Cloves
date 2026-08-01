/**
 * Drop-in class checkout → a real class pass.
 *
 * A member who pays the per-class rate without holding a pass used to get a booking
 * with `user_package_id = null`. Every refund rule keys on that column, so a
 * before-cutoff cancellation earned them nothing and the money had to be refunded
 * by hand at the gateway. Provisioning the pass they effectively bought puts them
 * on the same path as any pass holder: the cancel returns a credit, not cash.
 *
 * Studio policy: ₹945 drop-ins are refunded as credit, never as money.
 */
import type { Prisma } from "@/generated/prisma/client";
import { passCategoryForPackageType } from "@/lib/couponHelpers";
import logger from "@/lib/logger";

type TxClient = Prisma.TransactionClient;

/** The sellable single-class pass (₹945). Distinct from the ₹0 `1 Class Pass`
 *  comp/refund primitive in classCancellation.ts. */
export const DROP_IN_PASS_NAME = "1 Day Class Pass";

/**
 * How many credits a drop-in checkout buys: the seats the member was charged for.
 * `dayPassEquivalentCount` is the server-validated seat count on the finance
 * snapshot; `creditsToDeduct` is the client-declared fallback. Always at least 1 —
 * a confirmed booking consumed a seat whatever the snapshot claims.
 */
export function dropInPassCredits(
  financeSnapshot: unknown,
  creditsToDeduct?: number | null,
): number {
  const snap = financeSnapshot as { dayPassEquivalentCount?: unknown } | null;
  const seats = Number(snap?.dayPassEquivalentCount);
  if (Number.isInteger(seats) && seats > 0) return seats;
  const fallback = Number(creditsToDeduct);
  if (Number.isInteger(fallback) && fallback > 0) return fallback;
  return 1;
}

/**
 * Create the drop-in pass for `userId` inside an open transaction and return its id.
 *
 * Returns null (never throws) when the PackageType is absent: the payment is already
 * captured by the time this runs, so a catalog gap must not roll a confirmed booking
 * back to payment_pending. Same log-not-throw stance as the credit debit downstream.
 */
export async function provisionDropInPass(
  tx: TxClient,
  userId: string,
  credits: number,
): Promise<string | null> {
  const packageType = await tx.packageType.findFirst({ where: { name: DROP_IN_PASS_NAME } });
  if (!packageType) {
    logger.error(
      { userId, passName: DROP_IN_PASS_NAME },
      "[provisionDropInPass] PackageType not found — booking confirmed without a pass (run the package catalog seed)",
    );
    return null;
  }

  // Mirrors a direct purchase of this pass (razorpayServerCheckout package flow).
  const expirationDate = new Date();
  expirationDate.setMonth(expirationDate.getMonth() + (packageType.duration_months ?? 1));

  const created = await tx.userPackage.create({
    data: {
      user_id: userId,
      package_type_id: packageType.id,
      credits_remaining: credits,
      credits_total: credits,
      expiration_date: expirationDate,
      is_active: true,
      pass_type: passCategoryForPackageType(packageType),
      is_comp: false,
      origin: "checkout",
      grant_note: "Drop-in class checkout",
    },
    select: { id: true },
  });

  // Deliberately NOT updating Profile.pass_type: this pass is spent on the same
  // request, and flipping it would list a drop-in visitor as a class-pass member.
  return created.id;
}
