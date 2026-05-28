import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { COUPON_CONTEXTS, normalizeCouponCode, type CouponContext } from "@/lib/couponHelpers";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { apiError } from "@/lib/apiError";

function isAdmin(session: unknown) {
  const role = (session as { user?: { role?: string } } | null | undefined)?.user?.role;
  return role === "admin";
}

function parseContext(v: unknown): CouponContext | null {
  const s = String(v ?? "");
  return COUPON_CONTEXTS.some((c) => c.value === s) ? (s as CouponContext) : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user || !isAdmin(session)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const rows = await prisma.coupon.findMany({
      orderBy: { created_at: "desc" },
    });
    return res.json(rows);
  }

  if (req.method === "POST") {
    const body = req.body ?? {};
    const code = normalizeCouponCode(body.code);
    if (!code) return res.status(400).json({ error: "Code is required" });
    const appliesTo = parseContext(body.applies_to);
    if (!appliesTo) return res.status(400).json({ error: "Invalid applies_to" });
    const discountType = String(body.discount_type ?? "");
    if (discountType !== "percent" && discountType !== "fixed") {
      return res.status(400).json({ error: "discount_type must be percent or fixed" });
    }
    const discountValue = Number(body.discount_value);
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      return res.status(400).json({ error: "Invalid discount_value" });
    }
    if (discountType === "percent" && discountValue > 100) {
      return res.status(400).json({ error: "Percent cannot exceed 100" });
    }

    const maxRedemptions =
      body.max_redemptions === "" || body.max_redemptions == null
        ? null
        : Math.max(0, Math.floor(Number(body.max_redemptions)));
    const maxUsesPerUser =
      body.max_uses_per_user === "" || body.max_uses_per_user == null
        ? null
        : Math.max(1, Math.floor(Number(body.max_uses_per_user)));

    let startsAt: Date | null = null;
    let endsAt: Date | null = null;
    if (body.starts_at) {
      const d = new Date(String(body.starts_at));
      if (!Number.isNaN(d.getTime())) startsAt = d;
    }
    if (body.ends_at) {
      const d = new Date(String(body.ends_at));
      if (!Number.isNaN(d.getTime())) endsAt = d;
    }

    try {
      const created = await prisma.coupon.create({
        data: {
          code,
          applies_to: appliesTo,
          discount_type: discountType,
          discount_value: discountValue,
          is_active: Boolean(body.is_active ?? true),
          max_redemptions: maxRedemptions,
          max_uses_per_user: maxUsesPerUser,
          starts_at: startsAt,
          ends_at: endsAt,
        },
      });
      return res.status(201).json(created);
    } catch (e) {
      return apiError(res, e, "[admin/coupons POST]", 400, "Could not create coupon (duplicate code?)");
    }
  }

  if (req.method === "PATCH") {
    const body = req.body ?? {};
    const id = String(body.id ?? "");
    if (!id) return res.status(400).json({ error: "id required" });

    const data: Record<string, unknown> = {};
    if (body.code != null) {
      const c = normalizeCouponCode(body.code);
      if (!c) return res.status(400).json({ error: "Invalid code" });
      data.code = c;
    }
    if (body.applies_to != null) {
      const ctx = parseContext(body.applies_to);
      if (!ctx) return res.status(400).json({ error: "Invalid applies_to" });
      data.applies_to = ctx;
    }
    if (body.discount_type != null) {
      const dt = String(body.discount_type);
      if (dt !== "percent" && dt !== "fixed") return res.status(400).json({ error: "Invalid discount_type" });
      data.discount_type = dt;
    }
    if (body.discount_value != null) {
      const dv = Number(body.discount_value);
      if (!Number.isFinite(dv) || dv < 0) return res.status(400).json({ error: "Invalid discount_value" });
      data.discount_value = dv;
    }
    if (body.is_active != null) data.is_active = Boolean(body.is_active);
    if (body.max_redemptions !== undefined) {
      data.max_redemptions =
        body.max_redemptions === "" || body.max_redemptions == null
          ? null
          : Math.max(0, Math.floor(Number(body.max_redemptions)));
    }
    if (body.max_uses_per_user !== undefined) {
      data.max_uses_per_user =
        body.max_uses_per_user === "" || body.max_uses_per_user == null
          ? null
          : Math.max(1, Math.floor(Number(body.max_uses_per_user)));
    }
    if (body.starts_at !== undefined) {
      data.starts_at =
        !body.starts_at || body.starts_at === ""
          ? null
          : new Date(String(body.starts_at));
    }
    if (body.ends_at !== undefined) {
      data.ends_at =
        !body.ends_at || body.ends_at === "" ? null : new Date(String(body.ends_at));
    }

    try {
      const updated = await prisma.coupon.update({
        where: { id },
        data: data as Prisma.CouponUpdateInput,
      });
      return res.json(updated);
    } catch (e) {
      return apiError(res, e, "[admin/coupons PATCH]", 400, "Could not update coupon");
    }
  }

  if (req.method === "DELETE") {
    const id = String(req.query.id ?? "");
    if (!id) return res.status(400).json({ error: "id query required" });
    try {
      await prisma.coupon.delete({ where: { id } });
      return res.status(204).end();
    } catch {
      return res.status(400).json({ error: "Could not delete coupon" });
    }
  }

  res.status(405).end();
}
