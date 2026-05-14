import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

/** Class images may be data URLs (serverless upload) — default 1MB body limit breaks saves. */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "12mb",
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const classes = await prisma.classModel.findMany({
      include: { instructor: true },
      orderBy: { display_order: "asc" },
    });
    return res.json(classes);
  }

  const session = await getStudioServerSession(req, res);
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
