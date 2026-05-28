import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

function num(v: unknown) {
  if (v == null) return 0;
  const n = Number(v as number | string);
  return Number.isFinite(n) ? n : 0;
}

/** Public storefront catalog (active products only). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const { id } = req.query;

  if (id && typeof id === "string") {
    const p = await prisma.retailProduct.findFirst({
      where: { id, is_active: true },
    });
    if (!p) return res.status(404).json({ error: "Not found" });
    // Per-product detail rarely changes; safe to CDN-cache for a minute with
    // a longer SWR window so the page hydrates without a fresh round-trip.
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.json({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      price: num(p.price),
      stock: p.stock,
      image_url: p.image_url,
      featured: p.featured,
      sales_count: p.sales_count,
    });
  }

  const rows = await prisma.retailProduct.findMany({
    where: { is_active: true },
    orderBy: [{ featured: "desc" }, { created_at: "desc" }],
  });

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return res.json(
    rows.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      price: num(p.price),
      stock: p.stock,
      image_url: p.image_url,
      featured: p.featured,
      sales_count: p.sales_count,
    }))
  );
}
