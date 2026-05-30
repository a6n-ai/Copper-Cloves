import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { notifyPackagePurchase } from "@/lib/notifications/notifyPackagePurchase";
import type { CouponContext } from "@/lib/couponHelpers";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import {
  incrementCouponAndRecordRedemption,
  passCategoryForPackageType,
  toFiniteNumber,
  validateAndComputeCoupon,
} from "@/lib/couponHelpers";
import type { Coupon } from "@/generated/prisma/client";
import { linkRazorpayOrderToUserPackageTx } from "@/lib/razorpayPersistence";
import { requestLogger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const userId = (session.user as { id: string }).id;

  if (req.method === "GET") {
    const { active } = req.query;
    const where: Record<string, unknown> = { user_id: userId };
    if (active === "true") where.is_active = true;

    const packages = await prisma.userPackage.findMany({
      where,
      include: { package_type: true },
      orderBy: { purchase_date: "desc" },
    });
    return res.json(packages);
  }

  if (req.method === "POST") {
    const { package_type_id, coupon_code, razorpay_order_id } = req.body as {
      package_type_id?: string;
      pass_type?: string;
      coupon_code?: string;
      razorpay_order_id?: string | null;
    };

    if (!package_type_id || typeof package_type_id !== "string") {
      return res.status(400).json({ error: "package_type_id required" });
    }

    const rpOrderRaw =
      razorpay_order_id != null && String(razorpay_order_id).trim()
        ? String(razorpay_order_id).trim()
        : null;

    /** Matches /api/payments/razorpay/create-order `purpose: "package"` rounding. */
    function expectedCheckoutPaise(subtotalInr: number, discountInr: number): number {
      const payableInr = Math.max(0, subtotalInr - discountInr);
      if (payableInr <= 0) return 0;
      const amountInr = Math.min(Math.max(Math.round(payableInr), 1), 100_000);
      return Math.round(amountInr * 100);
    }

    try {
      const userPackage = await prisma.$transaction(async (tx) => {
        const packageType = await tx.packageType.findUnique({
          where: { id: package_type_id },
        });
        if (!packageType) throw new Error("NOT_FOUND");

        // Authoritative pass category from the package (type column, then
        // is_unlimited) — not the client-sent pass_type — keeps coupon matching correct.
        const pass = passCategoryForPackageType(packageType);
        const couponContext: CouponContext = pass;

        const subtotal = toFiniteNumber(packageType.price);
        if (!Number.isFinite(subtotal) || subtotal <= 0) {
          throw new Error("BAD_PRICE");
        }

        let coupon: Coupon | null = null;
        let discountInr = 0;
        if (coupon_code && String(coupon_code).trim()) {
          const v = await validateAndComputeCoupon(tx, String(coupon_code), couponContext, subtotal, {
            userId,
            guestEmail: null,
          });
          if ("error" in v) throw new Error(`COUPON:${v.error}`);
          coupon = v.coupon;
          discountInr = v.discountInr;
        }

        const expectedPaise = expectedCheckoutPaise(subtotal, discountInr);

        let razorpayOrderIdForLink: string | null = rpOrderRaw;

        if (expectedPaise > 0) {
          if (!razorpayOrderIdForLink) {
            throw new Error("PAYMENT_REQUIRED");
          }
          const rpOrder = await tx.razorpayOrder.findFirst({
            where: {
              razorpay_order_id: razorpayOrderIdForLink,
              user_id: userId,
            },
          });
          if (!rpOrder) throw new Error("RAZORPAY_ORDER_NOT_FOUND");
          if (rpOrder.amount_paise !== expectedPaise) throw new Error("AMOUNT_MISMATCH");
          if (rpOrder.booking_id != null || rpOrder.user_package_id != null) {
            throw new Error("RAZORPAY_ORDER_USED");
          }
          if (rpOrder.status !== "paid") throw new Error("PAYMENT_NOT_CONFIRMED");
        } else {
          razorpayOrderIdForLink = null;
        }

        const expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + (packageType.duration_months ?? 1));

        const created = await tx.userPackage.create({
          data: {
            user_id: userId,
            package_type_id: package_type_id!,
            credits_remaining: packageType.is_unlimited ? null : (packageType.class_count ?? null),
            credits_total: packageType.is_unlimited ? null : (packageType.class_count ?? null),
            expiration_date: expirationDate,
            is_active: true,
            pass_type: pass,
            coupon_id: coupon?.id ?? null,
            purchase_discount_inr: discountInr > 0 ? discountInr : null,
          },
          include: { package_type: true },
        });

        await tx.profile.update({
          where: { id: userId },
          data: { pass_type: pass },
        });

        if (coupon && discountInr > 0) {
          await incrementCouponAndRecordRedemption(tx, coupon, discountInr, couponContext, {
            userId,
            guestEmail: null,
          });
        }

        if (expectedPaise > 0 && razorpayOrderIdForLink) {
          await linkRazorpayOrderToUserPackageTx(tx, {
            userId,
            razorpayOrderId: razorpayOrderIdForLink,
            userPackageId: created.id,
          });
        }

        return created;
      });

      await notifyPackagePurchase({
        userId,
        packageType: userPackage.package_type,
        expirationDate: userPackage.expiration_date,
      }).catch((err) => log.error({ err, userId, packageTypeId: userPackage.package_type_id }, "notifyPackagePurchase failed"));

      return res.status(201).json(userPackage);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "NOT_FOUND") return res.status(404).json({ error: "Package type not found" });
      if (msg === "BAD_PRICE") return res.status(400).json({ error: "Invalid package price" });
      if (msg === "PAYMENT_REQUIRED") {
        return res.status(400).json({ error: "Online payment is required for this purchase." });
      }
      if (msg === "RAZORPAY_ORDER_NOT_FOUND") {
        return res.status(400).json({ error: "Payment order not found. Start checkout again." });
      }
      if (msg === "AMOUNT_MISMATCH") {
        return res.status(400).json({ error: "Payment amount does not match this package. Try again." });
      }
      if (msg === "RAZORPAY_ORDER_USED") {
        return res.status(400).json({ error: "This payment was already used for another purchase." });
      }
      if (msg === "PAYMENT_NOT_CONFIRMED") {
        return res.status(400).json({ error: "Payment is not confirmed yet. Try again in a moment." });
      }
      if (msg.startsWith("COUPON:")) {
        return res.status(400).json({ error: msg.replace(/^COUPON:/, "") });
      }
      if (msg === "COUPON_EXHAUSTED") {
        return res.status(409).json({ error: "Coupon is no longer available" });
      }
      if (msg === "RAZORPAY_PACKAGE_LINK_INVALID") {
        return res.status(400).json({
          error:
            "Online payment could not be linked to this purchase. Contact support if you were charged.",
        });
      }
      log.error({ err: e, userId }, "user-packages POST failed");
      return res.status(500).json({ error: "Could not complete purchase" });
    }
  }

  if (req.method === "PATCH") {
    const { id, ...data } = req.body;
    const updated = await prisma.userPackage.update({
      where: { id, user_id: userId },
      data,
      include: { package_type: true },
    });
    return res.json(updated);
  }

  res.status(405).end();
}
