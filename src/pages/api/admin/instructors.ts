import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const instructors = await prisma.instructor.findMany({
      orderBy: { display_order: "asc" },
    });
    return res.json(instructors);
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });

  if (req.method === "POST") {
    const instructor = await prisma.instructor.create({ data: req.body });
    return res.status(201).json(instructor);
  }

  if (req.method === "PUT") {
    const { id, ...data } = req.body;
    const instructor = await prisma.instructor.update({ where: { id }, data });
    return res.json(instructor);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    await prisma.instructor.delete({ where: { id: String(id) } });
    return res.status(204).end();
  }

  res.status(405).end();
}
