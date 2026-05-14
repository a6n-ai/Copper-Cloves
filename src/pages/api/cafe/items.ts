import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { available, name } = req.query;
    const where: Record<string, unknown> = {};
    if (available === "true") where.is_available = true;
    if (name) where.name = { contains: String(name), mode: "insensitive" };

    const items = await prisma.cafeItem.findMany({
      where,
      orderBy: { category: "asc" },
    });
    return res.json(items);
  }

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "POST") {
    const item = await prisma.cafeItem.create({ data: req.body });
    return res.status(201).json(item);
  }

  if (req.method === "PUT") {
    const { id, ...data } = req.body;
    const item = await prisma.cafeItem.update({ where: { id }, data });
    return res.json(item);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    await prisma.cafeItem.delete({ where: { id: String(id) } });
    return res.status(204).end();
  }

  res.status(405).end();
}
