import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthenticated" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
  const sid = (token as { sid?: string } | null)?.sid;
  if (!sid) return res.status(400).json({ error: "No session id" });

  const { latitude, longitude, accuracy } = req.body ?? {};
  const lat = Number(latitude);
  const lon = Number(longitude);
  const acc = Number(accuracy);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: "Invalid coordinates" });
  }

  // updateMany scopes strictly to the caller's own session row by sid — a caller
  // can never write GPS onto another account's session. No row (sid already
  // ended) => harmless zero-update.
  await prisma.userSession.updateMany({
    where: { session_id: sid },
    data: {
      latitude: lat,
      longitude: lon,
      accuracy: Number.isFinite(acc) ? acc : null,
      geo_captured_at: new Date(),
    },
  });

  return res.status(200).json({ ok: true });
}
