import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import {
  COUPON_CONTEXTS,
  validateAndComputeCoupon,
  passCategoryForPackageType,
  type CouponContext,
  toFiniteNumber,
} from "@/lib/couponHelpers";

function parseContext(v: unknown): CouponContext | null {
  const s = typeof v === "string" ? v : "";
  return COUPON_CONTEXTS.some((c) => c.value === s) ? (s as CouponContext) : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const body = req.body ?? {};
  let context = parseContext(body.context);
  if (!context) {
    return res.status(400).json({ valid: false, error: "Invalid context" });
  }

  // For package coupons, derive the authoritative pass category from the package
  // itself (unlimited = studio pass) instead of trusting the client's hint, so the
  // Apply preview matches what create-order / user-packages will accept.
  if (
    (context === "class_pass" || context === "studio_pass") &&
    typeof body.package_type_id === "string" &&
    body.package_type_id.trim()
  ) {
    const pt = await prisma.packageType.findUnique({
      where: { id: body.package_type_id.trim() },
      select: { is_unlimited: true, type: true },
    });
    if (pt) context = passCategoryForPackageType(pt);
  }

  const session = await getStudioServerSession(req, res);
  const userId = session?.user ? (session.user as { id: string }).id : null;

  if ((context === "food" || context === "class_pass" || context === "studio_pass") && !userId) {
    return res.status(401).json({ valid: false, error: "Sign in to use this coupon" });
  }

  const subtotal = toFiniteNumber(body.subtotal);
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return res.status(400).json({ valid: false, error: "Invalid subtotal" });
  }

  const guestEmail = typeof body.email === "string" ? body.email : null;

  const result = await validateAndComputeCoupon(prisma, String(body.code ?? ""), context, subtotal, {
    userId,
    guestEmail: context === "ecommerce" ? guestEmail : null,
  });

  if ("error" in result) {
    return res.status(200).json({ valid: false, error: result.error });
  }

  return res.status(200).json({
    valid: true,
    discountInr: result.discountInr,
    discountType: result.coupon.discount_type,
    code: result.coupon.code,
    appliesTo: result.coupon.applies_to,
  });
}
