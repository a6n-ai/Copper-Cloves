import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { passCategoryForPackageType } from "@/lib/couponHelpers";
import { cafeDiscountPercent } from "@/lib/cafeDiscount";

/**
 * Kitchen view: members (role "user") with their active pass and the café food
 * discount derived from it. Read-only. Accessible to admin + chef.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "chef") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const now = new Date();
  const members = await prisma.profile.findMany({
    where: { role: "user" },
    select: {
      id: true,
      full_name: true,
      email: true,
      user_packages: {
        where: { is_active: true, expiration_date: { gt: now } },
        orderBy: { purchase_date: "desc" },
        take: 1,
        select: {
          expiration_date: true,
          package_type: { select: { name: true, type: true, is_unlimited: true } },
        },
      },
    },
    orderBy: { full_name: "asc" },
  });

  const rows = members.map((m) => {
    const active = m.user_packages[0];
    const pt = active?.package_type ?? null;
    const passName = pt?.name ?? null;
    const category = pt ? passCategoryForPackageType(pt) : null;
    const discountPercent = cafeDiscountPercent({ category, packageName: passName });
    return {
      id: m.id,
      name: m.full_name ?? "—",
      email: m.email,
      passType: passName ?? "—",
      passCategory: category,
      expiresAt: active?.expiration_date?.toISOString() ?? null,
      cafeDiscountPercent: discountPercent,
    };
  });

  return res.json({ members: rows });
}
