import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const userId = (session.user as { id: string }).id;

  if (req.method === "GET") {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, full_name: true, phone: true, whatsapp_phone: true,
        avatar_url: true, movement_streak: true, pass_type: true,
        dob: true, gender: true, questionnaire: true,
        created_at: true, updated_at: true,
      },
    });
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    return res.json(profile);
  }

  if (req.method === "PATCH") {
    const { full_name, phone, whatsapp_phone, avatar_url, dob, gender, questionnaire } = req.body;

    const data: Record<string, unknown> = {};
    if (full_name !== undefined) data.full_name = full_name;
    if (phone !== undefined) data.phone = phone;
    if (whatsapp_phone !== undefined) data.whatsapp_phone = whatsapp_phone;
    if (avatar_url !== undefined) data.avatar_url = avatar_url;
    if (gender !== undefined) data.gender = gender;
    if (questionnaire !== undefined) data.questionnaire = questionnaire;
    if (dob !== undefined) {
      const d = dob ? new Date(dob) : null;
      data.dob = d && !Number.isNaN(d.getTime()) ? d : null;
    }

    const profile = await prisma.profile.update({
      where: { id: userId },
      data,
      select: {
        id: true, email: true, full_name: true, phone: true, whatsapp_phone: true,
        avatar_url: true, movement_streak: true, pass_type: true,
        dob: true, gender: true, questionnaire: true,
        created_at: true, updated_at: true,
      },
    });
    return res.json(profile);
  }

  res.status(405).end();
}
