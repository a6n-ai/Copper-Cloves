import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const packages = await prisma.packageType.findMany({
      orderBy: { price: "asc" },
    });
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.json(packages);
  }

  if (req.method === "POST" || req.method === "PATCH") {
    const session = await getStudioServerSession(req, res);
    if ((session?.user as { role?: string })?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "POST") {
    const data = req.body;
    const pkg = await prisma.packageType.create({ data });
    return res.status(201).json(pkg);
  }

  if (req.method === "PATCH") {
    const { id, price } = req.body ?? {};
    if (!id || typeof id !== "string") return res.status(400).json({ error: "id required" });
    const rupees = Number(price);
    if (!Number.isFinite(rupees) || rupees < 0) return res.status(400).json({ error: "price must be a non-negative number" });
    const updated = await prisma.packageType.update({
      where: { id },
      data: { price: rupees },
      select: { id: true, name: true, type: true, price: true, class_count: true, duration_months: true },
    });
    return res.json({ packageType: { ...updated, price: Number(updated.price) } });
  }

  res.status(405).end();
}
