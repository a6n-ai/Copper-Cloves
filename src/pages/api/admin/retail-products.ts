import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

function num(v: unknown) {
  if (v == null) return 0;
  const n = Number(v as number | string);
  return Number.isFinite(n) ? n : 0;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const { all } = req.query;
    const products = await prisma.retailProduct.findMany({
      where: all === "true" ? {} : { is_active: true },
      orderBy: { created_at: "desc" },
    });
    return res.json(products.map(serializeProduct));
  }

  if (req.method === "POST") {
    const body = req.body ?? {};
    const p = await prisma.retailProduct.create({
      data: {
        name: String(body.name ?? "").trim() || "Unnamed",
        category: String(body.category ?? "general").trim() || "general",
        description: body.description ? String(body.description) : null,
        price: num(body.price),
        stock: Math.max(0, Math.floor(num(body.stock))),
        image_url: body.image_url ? String(body.image_url) : null,
        featured: Boolean(body.featured),
        is_active: body.is_active !== false,
      },
    });
    return res.status(201).json(serializeProduct(p));
  }

  if (req.method === "PUT") {
    const { id, ...body } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "id required" });
    const data: Record<string, unknown> = {};
    if (body.name != null) data.name = String(body.name).trim();
    if (body.category != null) data.category = String(body.category).trim();
    if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
    if (body.price != null) data.price = num(body.price);
    if (body.stock != null) data.stock = Math.max(0, Math.floor(num(body.stock)));
    if (body.image_url !== undefined) data.image_url = body.image_url ? String(body.image_url) : null;
    if (body.featured != null) data.featured = Boolean(body.featured);
    if (body.is_active != null) data.is_active = Boolean(body.is_active);
    const updated = await prisma.retailProduct.update({ where: { id: String(id) }, data });
    return res.json(serializeProduct(updated));
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id required" });
    await prisma.retailProduct.delete({ where: { id: String(id) } });
    return res.status(204).end();
  }

  res.status(405).end();
}

function serializeProduct(p: {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: unknown;
  stock: number;
  image_url: string | null;
  featured: boolean;
  sales_count: number;
  is_active: boolean;
}) {
  return {
    ...p,
    price: num(p.price),
  };
}
