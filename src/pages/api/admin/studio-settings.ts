/**
 * Admin studio-settings singleton (spec §4).
 *   GET → current StudioSettings (upsert-on-read defaults).
 *   PUT → update cancellation_cutoff_hours / default_package_validity_days /
 *         cancelled_pass_validity_days (each a positive integer).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getStudioSettings, STUDIO_SETTINGS_ID, STUDIO_SETTINGS_DEFAULTS } from "@/lib/studioSettings";

/** Returns a positive integer or null if the value is missing/invalid. */
function posInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

const FIELDS = [
  "cancellation_cutoff_hours",
  "default_package_validity_days",
  "cancelled_pass_validity_days",
] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const settings = await getStudioSettings();
    return res.json({ settings });
  }

  if (req.method === "PUT") {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: Record<string, number> = {};
    for (const field of FIELDS) {
      if (body[field] === undefined) continue;
      const val = posInt(body[field]);
      if (val === null) return res.status(400).json({ error: `${field} must be a positive integer` });
      data[field] = val;
    }

    const settings = await prisma.studioSettings.upsert({
      where: { id: STUDIO_SETTINGS_ID },
      update: data,
      create: { id: STUDIO_SETTINGS_ID, ...STUDIO_SETTINGS_DEFAULTS, ...data },
    });
    return res.json({ settings });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).end();
}
