import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  const me = session?.user?.id;
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const packages = await prisma.userPackage.findMany({
    where: {
      user_id: me,
      is_active: true,
      is_paused: false,
      expiration_date: { gt: new Date() },
      credits_total: { not: null, gt: 0 },
    },
    include: { package_type: { select: { name: true, is_unlimited: true } } },
    orderBy: { expiration_date: "asc" },
  });

  const shareable = packages.filter((p) => !p.package_type?.is_unlimited);
  if (shareable.length === 0) return res.status(200).json([]);

  const grants = await prisma.sharedCredit.groupBy({
    by: ["source_user_package_id"],
    where: { source_user_package_id: { in: shareable.map((p) => p.id) }, status: "active" },
    _sum: { credits_total: true },
  });
  const alreadySharedByPkg = new Map(grants.map((g) => [g.source_user_package_id, g._sum.credits_total ?? 0]));

  const result = shareable.map((p) => ({
    id: p.id,
    name: p.package_type?.name ?? "Class Pass",
    creditsRemaining: p.credits_remaining ?? 0,
    creditsTotal: p.credits_total ?? 0,
    expiresAt: p.expiration_date.toISOString(),
    alreadyShared: alreadySharedByPkg.get(p.id) ?? 0,
  }));

  return res.status(200).json(result);
}
