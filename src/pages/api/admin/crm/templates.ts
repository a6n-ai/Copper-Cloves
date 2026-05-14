import type { NextApiRequest, NextApiResponse } from "next";
import { ensureAdmin } from "@/lib/requireAdmin";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;

  if (req.method === "GET") {
    const templates = await prisma.crmTemplate.findMany({
      orderBy: { created_at: "desc" },
    });
    return res.json(templates);
  }

  if (req.method === "POST") {
    const template = await prisma.crmTemplate.create({ data: req.body });
    return res.status(201).json(template);
  }

  if (req.method === "PUT") {
    const { id, ...data } = req.body;
    const template = await prisma.crmTemplate.update({ where: { id }, data });
    return res.json(template);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    await prisma.crmTemplate.delete({ where: { id: String(id) } });
    return res.status(204).end();
  }

  res.status(405).end();
}
