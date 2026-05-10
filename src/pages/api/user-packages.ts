import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notifyPackagePurchase } from "@/lib/notifications/notifyPackagePurchase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
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
    const { package_type_id, pass_type } = req.body;

    const packageType = await prisma.packageType.findUnique({
      where: { id: package_type_id },
    });
    if (!packageType) return res.status(404).json({ error: "Package type not found" });

    const expirationDate = new Date();
    expirationDate.setMonth(
      expirationDate.getMonth() + (packageType.duration_months ?? 1)
    );

    const userPackage = await prisma.userPackage.create({
      data: {
        user_id: userId,
        package_type_id,
        credits_remaining: packageType.is_unlimited ? null : (packageType.class_count ?? null),
        credits_total: packageType.is_unlimited ? null : (packageType.class_count ?? null),
        classes_remaining: packageType.class_count ?? null,
        expiration_date: expirationDate,
        is_active: true,
        pass_type: pass_type ?? "class_pass",
      },
      include: { package_type: true },
    });

    // Update profile pass_type
    await prisma.profile.update({
      where: { id: userId },
      data: { pass_type: pass_type ?? "class_pass" },
    });

    void notifyPackagePurchase({
      userId,
      packageType,
      expirationDate: userPackage.expiration_date,
    }).catch((err) => console.error("[user-packages] notifyPackagePurchase:", err));

    return res.status(201).json(userPackage);
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
