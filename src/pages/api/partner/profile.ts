import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { hasRole } from "@/lib/auth/roles";

const PARTNER_SELECT = { id: true, name: true, slug: true, logo_url: true, description: true } as const;

async function handleGet(res: NextApiResponse, partnerId: string, profileId: string) {
  const [partner, me] = await Promise.all([
    prisma.partner.findUnique({ where: { id: partnerId }, select: PARTNER_SELECT }),
    prisma.profile.findUnique({ where: { id: profileId }, select: { email: true, phone: true } }),
  ]);
  if (!partner) return res.status(404).json({ error: "Partner not found" });
  // Contact email/phone come from the signed-in user's account (not duplicated on Partner).
  return res.json({ ...partner, email: me?.email ?? "", phone: me?.phone ?? "" });
}

function collectPartnerData(body: Record<string, unknown>): Record<string, unknown> {
  const partnerData: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) partnerData.name = body.name.trim();
  if (typeof body.logo_url === "string") partnerData.logo_url = body.logo_url.trim() || null;
  if (typeof body.description === "string") partnerData.description = body.description.trim() || null;
  return partnerData;
}

async function collectProfileData(
  body: Record<string, unknown>,
  profileId: string,
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  const profileData: Record<string, unknown> = {};
  if (typeof body.email === "string" && body.email.trim()) {
    const email = body.email.trim().toLowerCase();
    const clash = await prisma.profile.findFirst({ where: { email, role: "partner" } });
    if (clash && clash.id !== profileId) {
      return { ok: false, error: "That email is already in use" };
    }
    profileData.email = email;
  }
  if (typeof body.phone === "string") profileData.phone = (body.phone as string).trim() || null;
  return { ok: true, data: profileData };
}

async function handlePatch(req: NextApiRequest, res: NextApiResponse, partnerId: string, profileId: string) {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const partnerData = collectPartnerData(body);
  const profileResult = await collectProfileData(body, profileId);
  if (!profileResult.ok) {
    return res.status(400).json({ error: profileResult.error });
  }
  const profileData = profileResult.data;

  if (Object.keys(partnerData).length === 0 && Object.keys(profileData).length === 0) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  const [partner, me] = await Promise.all([
    Object.keys(partnerData).length
      ? prisma.partner.update({ where: { id: partnerId }, data: partnerData, select: PARTNER_SELECT })
      : prisma.partner.findUnique({ where: { id: partnerId }, select: PARTNER_SELECT }),
    Object.keys(profileData).length
      ? prisma.profile.update({ where: { id: profileId }, data: profileData, select: { email: true, phone: true } })
      : prisma.profile.findUnique({ where: { id: profileId }, select: { email: true, phone: true } }),
  ]);

  return res.json({ ...partner, email: me?.email ?? "", phone: me?.phone ?? "" });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sess = await getStudioServerSession(req, res);
  const user = sess?.user as { id?: string; role?: string; partner_id?: string | null } | undefined;
  if (!user || !hasRole(user.role, "partner") || !user.partner_id || !user.id) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const partnerId = user.partner_id;
  const profileId = user.id;

  if (req.method === "GET") return handleGet(res, partnerId, profileId);
  if (req.method === "PATCH") return handlePatch(req, res, partnerId, profileId);

  return res.status(405).end();
}
