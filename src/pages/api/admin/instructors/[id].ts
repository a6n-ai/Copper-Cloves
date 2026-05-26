import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

/**
 * GET a single instructor by id. Admin-only.
 * Writes (PUT/PATCH/DELETE) continue to live on /api/admin/instructors so we
 * don't duplicate the bcrypt/profile-linking logic here.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") return res.status(403).json({ error: "Forbidden" });

  if (req.method !== "GET") return res.status(405).end();

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "id required" });

  const instructor = await prisma.instructor.findUnique({ where: { id } });
  if (!instructor) return res.status(404).json({ error: "Not found" });
  return res.json(instructor);
}
