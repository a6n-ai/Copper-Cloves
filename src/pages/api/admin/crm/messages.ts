import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ensureAdmin } from "@/lib/requireAdmin";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!ensureAdmin(session, res)) return;

  if (req.method === "GET") {
    const messages = await prisma.crmMessage.findMany({
      include: {
        template: true,
        profile: { select: { id: true, full_name: true, email: true } },
      },
      orderBy: { created_at: "desc" },
    });
    return res.json(messages);
  }

  if (req.method === "POST") {
    const message = await prisma.crmMessage.create({ data: req.body });
    return res.status(201).json(message);
  }

  res.status(405).end();
}
