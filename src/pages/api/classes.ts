import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const classes = await prisma.classModel.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      include: {
        // `studio_payout_cut_percent` (internal-only) is omitted via `omit`
        // to plug the leak that the previous `include: instructor` had.
        instructor: {
          omit: { studio_payout_cut_percent: true },
        },
      },
    });
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.json(classes);
  }
  res.status(405).end();
}
