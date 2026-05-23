import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sess = await getStudioServerSession(req, res);
  const user = sess?.user as { id?: string; role?: string; partner_id?: string | null } | undefined;
  if (!user || user.role !== "partner" || !user.partner_id || !user.id) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const partnerId = user.partner_id;
  const profileId = user.id;

  if (req.method === "GET") {
    const [partner, me] = await Promise.all([
      prisma.partner.findUnique({
        where: { id: partnerId },
        select: { id: true, name: true, slug: true, logo_url: true, description: true },
      }),
      prisma.profile.findUnique({ where: { id: profileId }, select: { email: true, phone: true } }),
    ]);
    if (!partner) return res.status(404).json({ error: "Partner not found" });
    // Contact email/phone come from the signed-in user's account (not duplicated on Partner).
    return res.json({ ...partner, email: me?.email ?? "", phone: me?.phone ?? "" });
  }

  if (req.method === "PATCH") {
    const body = req.body ?? {};

    // Partner brand fields
    const partnerData: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) partnerData.name = body.name.trim();
    if (typeof body.logo_url === "string") partnerData.logo_url = body.logo_url.trim() || null;
    if (typeof body.description === "string") partnerData.description = body.description.trim() || null;

    // User account fields (email is the login identity)
    const profileData: Record<string, unknown> = {};
    if (typeof body.email === "string" && body.email.trim()) {
      const email = body.email.trim().toLowerCase();
      const clash = await prisma.profile.findFirst({ where: { email, role: "partner" } });
      if (clash && clash.id !== profileId) {
        return res.status(400).json({ error: "That email is already in use" });
      }
      profileData.email = email;
    }
    if (typeof body.phone === "string") profileData.phone = body.phone.trim() || null;

    if (Object.keys(partnerData).length === 0 && Object.keys(profileData).length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const [partner, me] = await Promise.all([
      Object.keys(partnerData).length
        ? prisma.partner.update({
            where: { id: partnerId },
            data: partnerData,
            select: { id: true, name: true, slug: true, logo_url: true, description: true },
          })
        : prisma.partner.findUnique({
            where: { id: partnerId },
            select: { id: true, name: true, slug: true, logo_url: true, description: true },
          }),
      Object.keys(profileData).length
        ? prisma.profile.update({ where: { id: profileId }, data: profileData, select: { email: true, phone: true } })
        : prisma.profile.findUnique({ where: { id: profileId }, select: { email: true, phone: true } }),
    ]);

    return res.json({ ...partner, email: me?.email ?? "", phone: me?.phone ?? "" });
  }

  return res.status(405).end();
}
