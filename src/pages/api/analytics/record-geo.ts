import type { NextApiRequest, NextApiResponse } from "next";
import { fromNodeHeaders } from "better-auth/node";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthenticated" });

  // StudioSession doesn't carry the raw better-auth session id (it's a Profile-
  // shaped view ~40 routes rely on), so this is a second getSession round trip.
  const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  const sessionId = result?.session?.id;
  if (!sessionId) return res.status(400).json({ error: "No session id" });

  const { latitude, longitude, accuracy } = req.body ?? {};
  const lat = Number(latitude);
  const lon = Number(longitude);
  const acc = Number(accuracy);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: "Invalid coordinates" });
  }

  // Scoped strictly to the caller's own session row by id — a caller can never
  // write GPS onto another account's session. No row (session already ended)
  // => harmless zero-update.
  await prisma.session.updateMany({
    where: { id: sessionId },
    data: {
      latitude: lat,
      longitude: lon,
      accuracy: Number.isFinite(acc) ? acc : null,
      geoCapturedAt: new Date(),
    },
  });

  return res.status(200).json({ ok: true });
}
