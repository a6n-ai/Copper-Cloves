import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ANALYTICS_VIEWER_EMAIL } from "@/lib/analyticsViewer";
import { parseUserAgent } from "@/lib/parseUserAgent";

export interface AccessRow {
  id: string;
  email: string | null;
  time: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  device: string;
  ip: string | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getStudioServerSession(req, res);
  const email = (session?.user as { email?: string } | undefined)?.email;
  if (!session?.user || email !== ANALYTICS_VIEWER_EMAIL) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const sessions = await prisma.userSession.findMany({
    orderBy: { created_at: "desc" },
    take: 100,
    select: {
      id: true,
      ip: true,
      user_agent: true,
      created_at: true,
      latitude: true,
      longitude: true,
      accuracy: true,
      profile: { select: { email: true } },
    },
  });

  const rows: AccessRow[] = sessions.map((s) => ({
    id: s.id,
    email: s.profile?.email ?? null,
    time: s.created_at.toISOString(),
    latitude: s.latitude ?? null,
    longitude: s.longitude ?? null,
    accuracy: s.accuracy ?? null,
    device: parseUserAgent(s.user_agent),
    ip: s.ip ?? null,
  }));

  return res.status(200).json({ rows });
}
