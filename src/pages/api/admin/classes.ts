import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const classes = await prisma.classModel.findMany({
      include: { instructor: true },
      orderBy: { display_order: "asc" },
    });
    return res.json(classes);
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });

  if (req.method === "POST") {
    const cls = await prisma.classModel.create({
      data: req.body,
      include: { instructor: true },
    });
    return res.status(201).json(cls);
  }

  if (req.method === "PUT") {
    const { id, ...data } = req.body;
    const cls = await prisma.classModel.update({
      where: { id },
      data,
      include: { instructor: true },
    });
    return res.json(cls);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    await prisma.classModel.delete({ where: { id: String(id) } });
    return res.status(204).end();
  }

  res.status(405).end();
}
