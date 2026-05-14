import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { isStudioAdminProfileRole } from "@/lib/isStudioAdminProfile";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

const memberInclude = {
  user_packages: {
    include: { package_type: true },
    orderBy: { purchase_date: "desc" as const },
    take: 8,
  },
  user_stats: true,
} as const;

const memberDetailInclude = {
  user_stats: true,
  user_badges: { orderBy: { earned_at: "desc" as const }, take: 20 },
  bookings: {
    where: { status: "confirmed" as const },
    orderBy: { booking_date: "desc" as const },
    take: 60,
    include: {
      class_schedule: { include: { class_model: true } },
    },
  },
} as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    if (id) {
      const profile = await prisma.profile.findFirst({
        where: { id },
        include: memberDetailInclude,
      });
      if (!profile || isStudioAdminProfileRole(profile.role)) {
        return res.status(404).json({ error: "Member not found" });
      }
      return res.json(profile);
    }

    const rows = await prisma.profile.findMany({
      include: memberInclude,
      orderBy: { created_at: "desc" },
    });
    const members = rows.filter((p) => !isStudioAdminProfileRole(p.role));
    return res.json(members);
  }

  if (req.method === "PATCH") {
    const { profile_id, user_package_id, credits_delta, expiration_date, pass_type } = req.body ?? {};
    if (!profile_id || typeof profile_id !== "string") {
      return res.status(400).json({ error: "profile_id required" });
    }

    const profile = await prisma.profile.findFirst({
      where: { id: profile_id },
    });
    if (!profile || isStudioAdminProfileRole(profile.role)) {
      return res.status(404).json({ error: "Member not found" });
    }

    let pkgId: string | undefined = typeof user_package_id === "string" ? user_package_id : undefined;
    if (!pkgId) {
      const latest = await prisma.userPackage.findFirst({
        where: { user_id: profile_id, is_active: true },
        orderBy: { purchase_date: "desc" },
      });
      pkgId = latest?.id;
    }

    if (typeof credits_delta === "number" && credits_delta !== 0) {
      if (!pkgId) return res.status(400).json({ error: "No active package to adjust credits" });
      const pkg = await prisma.userPackage.findUnique({ where: { id: pkgId } });
      if (!pkg || pkg.user_id !== profile_id) return res.status(400).json({ error: "Invalid package" });
      const next = (pkg.credits_remaining ?? 0) + credits_delta;
      await prisma.userPackage.update({
        where: { id: pkgId },
        data: { credits_remaining: Math.max(0, next) },
      });
    }

    if (expiration_date && typeof expiration_date === "string") {
      if (!pkgId) return res.status(400).json({ error: "No active package for expiry update" });
      const pkg = await prisma.userPackage.findUnique({ where: { id: pkgId } });
      if (!pkg || pkg.user_id !== profile_id) return res.status(400).json({ error: "Invalid package" });
      const d = new Date(expiration_date);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Invalid date" });
      await prisma.userPackage.update({
        where: { id: pkgId },
        data: { expiration_date: d },
      });
    }

    if (pass_type === "studio_pass" || pass_type === "class_pass") {
      await prisma.profile.update({
        where: { id: profile_id },
        data: { pass_type },
      });
    }

    return res.json({ ok: true });
  }

  res.status(405).end();
}
