import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import type { Prisma } from "@/generated/prisma/client";

function isAdmin(session: Awaited<ReturnType<typeof getStudioServerSession>>): boolean {
  return (session?.user as { role?: string } | undefined)?.role === "admin";
}

/** Build a PackageType write payload from the request body, only for provided keys. */
function buildPackageData(body: Record<string, unknown>, create: boolean): Prisma.PackageTypeUncheckedCreateInput | Prisma.PackageTypeUncheckedUpdateInput {
  const data: Record<string, unknown> = {};

  if (create || body.name !== undefined) data.name = String(body.name ?? "");
  if (create || body.type !== undefined) data.type = String(body.type ?? "");
  if (body.class_count !== undefined) data.class_count = body.class_count === null ? null : Number(body.class_count);
  if (body.duration_months !== undefined) data.duration_months = body.duration_months === null ? null : Number(body.duration_months);
  if (create || body.price !== undefined) data.price = Number(body.price ?? 0);
  if (body.is_unlimited !== undefined) data.is_unlimited = Boolean(body.is_unlimited);
  if (body.includes_physique_57 !== undefined) data.includes_physique_57 = Boolean(body.includes_physique_57);
  if (body.benefits !== undefined) data.benefits = Array.isArray(body.benefits) ? body.benefits.map(String) : [];
  if (body.featured !== undefined) data.featured = Boolean(body.featured);
  if (body.badge !== undefined) data.badge = body.badge === null || body.badge === "" ? null : String(body.badge);
  if (body.display_order !== undefined) data.display_order = Number(body.display_order);
  if (body.is_published !== undefined) data.is_published = Boolean(body.is_published);
  if (body.description !== undefined) data.description = body.description === null || body.description === "" ? null : String(body.description);

  return data;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  const admin = isAdmin(session);

  if (req.method === "GET") {
    if (admin) {
      // Admin catalog: everything, never cached.
      const packages = await prisma.packageType.findMany({
        orderBy: [{ display_order: "asc" }, { price: "asc" }],
      });
      res.setHeader("Cache-Control", "private, no-store");
      return res.json(packages);
    }
    // Public/member list: published only, cacheable.
    const packages = await prisma.packageType.findMany({
      where: { is_published: true },
      orderBy: [{ display_order: "asc" }, { price: "asc" }],
    });
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.json(packages);
  }

  // Everything below is admin-only.
  if (req.method === "POST" || req.method === "PATCH" || req.method === "DELETE") {
    if (!admin) return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "POST") {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!body.name || typeof body.name !== "string") return res.status(400).json({ error: "name required" });
    if (!body.type || typeof body.type !== "string") return res.status(400).json({ error: "type required" });
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "price must be a non-negative number" });
    const data = buildPackageData(body, true) as Prisma.PackageTypeUncheckedCreateInput;
    const pkg = await prisma.packageType.create({ data });
    return res.status(201).json(pkg);
  }

  if (req.method === "PATCH") {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const id = body.id;
    if (!id || typeof id !== "string") return res.status(400).json({ error: "id required" });
    if (body.price !== undefined) {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "price must be a non-negative number" });
    }
    const data = buildPackageData(body, false) as Prisma.PackageTypeUncheckedUpdateInput;
    const updated = await prisma.packageType.update({ where: { id }, data });
    return res.json(updated);
  }

  if (req.method === "DELETE") {
    const id = (req.query.id as string) || ((req.body ?? {}) as { id?: string }).id;
    if (!id || typeof id !== "string") return res.status(400).json({ error: "id required" });
    const inUse = await prisma.userPackage.count({ where: { package_type_id: id } });
    if (inUse > 0) {
      // FK is Restrict — soft-delete (unpublish) rather than hard delete.
      const updated = await prisma.packageType.update({
        where: { id },
        data: { is_published: false },
      });
      return res.json({ softDeleted: true, packageType: updated });
    }
    await prisma.packageType.delete({ where: { id } });
    return res.json({ deleted: true });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).end();
}
