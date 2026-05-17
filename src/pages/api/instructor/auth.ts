import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import {
  createInstructorToken,
  setInstructorCookie,
  clearInstructorCookie,
  getInstructorSession,
} from "@/lib/instructorAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const instructor = await prisma.instructor.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" } },
    });
    if (!instructor || !instructor.hashed_password)
      return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, instructor.hashed_password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = createInstructorToken({
      instructorId: instructor.id,
      name: instructor.name,
      email: instructor.email ?? null,
    });
    setInstructorCookie(res, token);
    return res.json({ instructorId: instructor.id, name: instructor.name });
  }

  if (req.method === "GET") {
    const session = getInstructorSession(req);
    if (!session) return res.status(401).json({ error: "Not authenticated" });
    return res.json(session);
  }

  if (req.method === "DELETE") {
    clearInstructorCookie(res);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
