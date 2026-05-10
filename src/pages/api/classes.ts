import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const classes = await prisma.classModel.findMany({
      orderBy: { name: "asc" },
      include: { instructor: true },
    });
    return res.json(classes);
  }
  res.status(405).end();
}
