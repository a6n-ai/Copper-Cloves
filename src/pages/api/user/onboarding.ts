import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const userId = (session.user as { id?: string }).id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { dob, gender, questionnaire } = req.body as {
    dob: string;
    gender: string;
    questionnaire: Record<string, unknown>;
  };

  if (!dob || !gender) {
    return res.status(400).json({ error: "Date of birth and gender are required" });
  }

  const dobDate = new Date(dob);
  if (isNaN(dobDate.getTime())) {
    return res.status(400).json({ error: "Invalid date of birth" });
  }

  await prisma.profile.update({
    where: { id: userId },
    data: {
      dob: dobDate,
      gender,
      questionnaire,
      onboarding_completed: true,
    },
  });

  return res.status(200).json({ ok: true });
}
