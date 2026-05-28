import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const packages = await prisma.packageType.findMany({
      orderBy: { price: "asc" },
    });
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.json(packages);
  }

  if (req.method === "POST") {
    const data = req.body;
    const pkg = await prisma.packageType.create({ data });
    return res.status(201).json(pkg);
  }

  res.status(405).end();
}
