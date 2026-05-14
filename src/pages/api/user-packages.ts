import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { notifyPackagePurchase } from "@/lib/notifications/notifyPackagePurchase";
import type { CouponContext } from "@/lib/couponHelpers";
import {
import { getStudioServerSession } from "@/lib/getStudioServerSession";
  incrementCouponAndRecordRedemption,
  toFiniteNumber,
  validateAndComputeCoupon,
} from "@/lib/couponHelpers";
import type { Coupon } from "@/generated/prisma/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const { package_type_id, pass_type, coupon_code } = req.body as {
      package_type_id?: string;
      pass_type?: string;
      coupon_code?: string;
    };

    if (!package_type_id || typeof package_type_id !== "string") {
      return res.status(400).json({ error: "package_type_id required" });
    }

    const pass = pass_type === "studio_pass" ? "studio_pass" : "class_pass";
    const couponContext: CouponContext = pass === "studio_pass" ? "studio_pass" : "class_pass";

    try {
      const userPackage = await prisma.$transaction(async (tx) => {
        const packageType = await tx.packageType.findUnique({
          where: { id: package_type_id },
        });
        if (!packageType) throw new Error("NOT_FOUND");

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

        const expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + (packageType.duration_months ?? 1));

        const created = await tx.userPackage.create({
          data: {
            user_id: userId,
            package_type_id: package_type_id!,
            credits_remaining: packageType.is_unlimited ? null : (packageType.class_count ?? null),
            credits_total: packageType.is_unlimited ? null : (packageType.class_count ?? null),
            classes_remaining: packageType.class_count ?? null,
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

        return created;
      });

      void notifyPackagePurchase({
        userId,
        packageType: userPackage.package_type,
        expirationDate: userPackage.expiration_date,
      }).catch((err) => console.error("[user-packages] notifyPackagePurchase:", err));

      return res.status(201).json(userPackage);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "NOT_FOUND") return res.status(404).json({ error: "Package type not found" });
      if (msg === "BAD_PRICE") return res.status(400).json({ error: "Invalid package price" });
      if (msg.startsWith("COUPON:")) {
        return res.status(400).json({ error: msg.replace(/^COUPON:/, "") });
      }
      if (msg === "COUPON_EXHAUSTED") {
        return res.status(409).json({ error: "Coupon is no longer available" });
      }
      console.error("[user-packages] POST", e);
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
