import type { NextApiRequest, NextApiResponse } from "next";
import { ensureAdmin } from "@/lib/requireAdmin";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;

  if (req.method === "GET") {
    const triggers = await prisma.crmTrigger.findMany({
      include: { template: true },
      orderBy: { created_at: "desc" },
    });
    return res.json(triggers);
  }

  if (req.method === "POST") {
    const trigger = await prisma.crmTrigger.create({
      data: req.body,
      include: { template: true },
    });
    return res.status(201).json(trigger);
  }

  if (req.method === "PUT") {
    const { id, ...data } = req.body;
    const trigger = await prisma.crmTrigger.update({
      where: { id },
      data,
      include: { template: true },
    });
    return res.json(trigger);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    await prisma.crmTrigger.delete({ where: { id: String(id) } });
    return res.status(204).end();
  }

  res.status(405).end();
}
