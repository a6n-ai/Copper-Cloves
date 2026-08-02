import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { apiError } from "@/lib/apiError";
import { passCategoryForPackageType } from "@/lib/couponHelpers";
import { cafeDiscountPercent } from "@/lib/cafeDiscount";
import { hasRole } from "@/lib/auth/roles";

async function handleGet(res: NextApiResponse, userId: string, isStaff: boolean) {
  const now = new Date();
  // Kitchen screen only needs recent/open orders, not the entire history.
  // 48h window is generous enough to always contain "today" (incl. late-night
  // service crossing midnight) while still bounding the scan; anything still
  // open (not completed/cancelled) is included regardless of age so a stale
  // pending order doesn't silently vanish from the queue.
  const recentCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const where = isStaff
    ? {
        OR: [
          { order_date: { gte: recentCutoff } },
          { status: { notIn: ["completed", "cancelled"] } },
        ],
      }
    : { user_id: userId };
  const orders = await prisma.cafeOrder.findMany({
    where,
    include: {
      cafe_item: true,
      profile: {
        select: {
          id: true,
          full_name: true,
          email: true,
          // Active pass drives the member's food discount so the kitchen sees the
          // same rate the member is charged at checkout (cafeDiscount.ts).
          user_packages: {
            where: { is_active: true, expiration_date: { gt: now } },
            orderBy: { purchase_date: "desc" },
            take: 1,
            select: { package_type: { select: { name: true, type: true, is_unlimited: true } } },
          },
        },
      },
      booking: {
        include: {
          class_schedule: { include: { class_model: true, instructor: true } },
        },
      },
    },
    orderBy: { order_date: "desc" },
  });

  const withDiscount = orders.map((o) => {
    const pt = o.profile?.user_packages?.[0]?.package_type ?? null;
    const passName = pt?.name ?? null;
    const cafe_discount_percent = pt
      ? cafeDiscountPercent({ category: passCategoryForPackageType(pt), packageName: passName })
      : 0;
    return { ...o, member_pass_name: passName, member_cafe_discount_percent: cafe_discount_percent };
  });
  return res.json(withDiscount);
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, userId: string) {
  const { cafe_item_id, booking_id, class_schedule_id, quantity, payment_method } = req.body;
  if (!cafe_item_id || typeof cafe_item_id !== "string") {
    return res.status(400).json({ error: "cafe_item_id is required" });
  }
  if (payment_method == null || String(payment_method).trim() === "") {
    return res.status(400).json({ error: "payment_method is required" });
  }

  let resolvedBookingId: string | null = booking_id ?? null;
  if (!resolvedBookingId && class_schedule_id) {
    const booking = await prisma.booking.findFirst({
      where: { user_id: userId, class_schedule_id: String(class_schedule_id) },
      orderBy: { created_at: "desc" },
    });
    resolvedBookingId = booking?.id ?? null;
  }

  try {
    const order = await prisma.cafeOrder.create({
      data: {
        user_id: userId,
        cafe_item_id,
        booking_id: resolvedBookingId,
        quantity: quantity ?? 1,
        payment_method: String(payment_method),
        status: "pending",
      },
      include: { cafe_item: true },
    });
    return res.status(201).json(order);
  } catch (e) {
    return apiError(res, e, "cafeOrder.create", 400, "Could not create order. Check item id and try again.");
  }
}

async function handlePatch(req: NextApiRequest, res: NextApiResponse, isStaff: boolean) {
  if (!isStaff) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { id, status } = req.body;
  if (!id || !status) {
    return res.status(400).json({ error: "id and status are required" });
  }
  try {
    const order = await prisma.cafeOrder.update({
      where: { id },
      data: { status },
      include: { cafe_item: true },
    });
    return res.json(order);
  } catch (e) {
    return apiError(res, e, "cafeOrder.update", 400, "Could not update order");
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const userId = (session.user as { id: string }).id;
  const userRole = (session.user as { role?: string }).role;
  // Admin + kitchen staff see and manage every order; members see only their own.
  const isStaff = hasRole(userRole, "admin") || hasRole(userRole, "chef");

  if (req.method === "GET") return handleGet(res, userId, isStaff);
  if (req.method === "POST") return handlePost(req, res, userId);
  if (req.method === "PATCH") return handlePatch(req, res, isStaff);

  res.status(405).end();
}
