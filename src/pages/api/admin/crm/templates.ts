import type { NextApiRequest, NextApiResponse } from "next";
import { ensureAdmin } from "@/lib/requireAdmin";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;

  if (req.method === "GET") {
    const templates = await prisma.crmTemplate.findMany({
      orderBy: [{ is_system: "desc" }, { created_at: "desc" }],
    });
    return res.json(templates);
  }

  if (req.method === "POST") {
    // Strip server-controlled fields — admins cannot create system templates.
    const { is_system: _ignoreIsSystem, template_key: _ignoreKey, ...body } = req.body ?? {};
    const template = await prisma.crmTemplate.create({ data: body });
    return res.status(201).json(template);
  }

  if (req.method === "PUT") {
    const { id, is_system: _ignoreIsSystem, template_key: _ignoreKey, ...data } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "id required" });
    const template = await prisma.crmTemplate.update({ where: { id }, data });
    return res.json(template);
  }

  if (req.method === "DELETE") {
    const id = String(req.query.id ?? "");
    if (!id) return res.status(400).json({ error: "id required" });
    const existing = await prisma.crmTemplate.findUnique({ where: { id } });
    if (existing?.is_system) {
      return res.status(403).json({ error: "System templates cannot be deleted" });
    }
    await prisma.crmTemplate.delete({ where: { id } });
    return res.status(204).end();
  }

  res.status(405).end();
}
