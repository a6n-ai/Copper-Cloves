import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { dedupeInstructorRows } from "@/lib/instructorIdentity";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "12mb",
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const session = await getStudioServerSession(req, res);
    const isAdmin = (session?.user as { role?: string })?.role === "admin";
    const instructors = await prisma.instructor.findMany({
      where: isAdmin ? undefined : { is_active: true },
      orderBy: { display_order: "asc" },
    });
    return res.json(dedupeInstructorRows(instructors));
  }

  const session = await getStudioServerSession(req, res);
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

  if (req.method === "PATCH") {
    const { id } = req.query;
    const { is_active } = req.body as { is_active: boolean };
    if (!id) return res.status(400).json({ error: "id required" });
    const instructor = await prisma.instructor.update({
      where: { id: String(id) },
      data: { is_active },
    });
    return res.json(instructor);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    await prisma.instructor.delete({ where: { id: String(id) } });
    return res.status(204).end();
  }

  res.status(405).end();
}
