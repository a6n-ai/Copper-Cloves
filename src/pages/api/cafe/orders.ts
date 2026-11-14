import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { apiError } from "@/lib/apiError";
import { bestCafeDiscount } from "@/lib/cafeDiscount";
import { hasRole } from "@/lib/auth/roles";
import { getActivePassCafePercent } from "@/lib/couponHelpers";
import { createBookingCafeOrdersTx, spendFoodCreditForOrderTx } from "@/lib/foodCredit";
import { toPaise } from "@/lib/foodCreditMath";

const HISTORY_PAGE = 100;

async function handleGet(req: NextApiRequest, res: NextApiResponse, userId: string, isStaff: boolean) {
  const now = new Date();
  // Staff history tab: closed orders of any age, newest first, paged by `before` (last row id).
  const history = isStaff && req.query.scope === "history";
  const before = typeof req.query.before === "string" && req.query.before ? req.query.before : null;
  // Kitchen screen only needs recent/open orders, not the entire history.
  // 48h window is generous enough to always contain "today" (incl. late-night
  // service crossing midnight) while still bounding the scan; anything still
  // open (not completed/cancelled) is included regardless of age so a stale
  // pending order doesn't silently vanish from the queue.
  const recentCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const where = history
    ? {
        status: { in: ["completed", "cancelled"] },
      }
    : isStaff
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
          // Active passes drive the member's food discount so the kitchen sees the
          // same rate the member is charged at checkout: best percent across all
          // usable passes, read off package_types.cafe_discount_percent.
          user_packages: {
            where: { is_active: true, is_paused: false, expiration_date: { gt: now } },
            orderBy: { purchase_date: "desc" },
            select: {
              package_type: {
                select: { name: true, type: true, is_unlimited: true, cafe_discount_percent: true },
              },
            },
          },
        },
      },
      booking: {
        include: {
          class_schedule: { include: { class_model: true, instructor: true } },
        },
      },
    },
    orderBy: history ? [{ order_date: "desc" }, { id: "desc" }] : { order_date: "desc" },
    ...(history ? { take: HISTORY_PAGE, ...(before ? { cursor: { id: before }, skip: 1 } : {}) } : {}),
  });

  const withDiscount = orders.map((o) => {
    const best = bestCafeDiscount(o.profile?.user_packages ?? []);
    const passName = best.pass?.package_type?.name ?? null;
    return { ...o, member_pass_name: passName, member_cafe_discount_percent: best.percent };
  });
  return res.json(withDiscount);
}

// Members may only create counter (pay at studio) or food-credit orders here.
// Razorpay-paid orders are written server-side at booking confirm
// (createBookingCafeOrdersTx); a client "razorpay" POST is a no-op that returns them.
async function handlePost(req: NextApiRequest, res: NextApiResponse, userId: string) {
  const { cafe_item_id, booking_id, class_schedule_id, quantity, payment_method } = req.body;
  if (!cafe_item_id || typeof cafe_item_id !== "string") {
    return res.status(400).json({ error: "cafe_item_id is required" });
  }
  if (payment_method == null || String(payment_method).trim() === "") {
    return res.status(400).json({ error: "payment_method is required" });
  }
  const qty = Math.max(1, Math.floor(Number(quantity ?? 1)) || 1);

  let resolvedBookingId: string | null = null;
  if (booking_id) {
    const own = await prisma.booking.findFirst({ where: { id: String(booking_id), user_id: userId }, select: { id: true } });
    if (!own) return res.status(404).json({ error: "Booking not found" });
    resolvedBookingId = own.id;
  } else if (class_schedule_id) {
    const booking = await prisma.booking.findFirst({
      where: { user_id: userId, class_schedule_id: String(class_schedule_id) },
      orderBy: { created_at: "desc" },
    });
    resolvedBookingId = booking?.id ?? null;
  }

  const method = String(payment_method);
  if (method === "razorpay") {
    if (!resolvedBookingId) return res.status(400).json({ error: "booking_id is required" });
    const paidOrder = await prisma.razorpayOrder.findUnique({
      where: { booking_id: resolvedBookingId },
      select: { status: true },
    });
    if (paidOrder?.status === "paid") {
      // Same idempotent writer as the server confirm path; items come from the order notes.
      const bookingId = resolvedBookingId;
      await prisma.$transaction((tx) => createBookingCafeOrdersTx(tx, { userId, bookingId }));
    }
    const existing = await prisma.cafeOrder.findFirst({
      where: { booking_id: resolvedBookingId, cafe_item_id, payment_method: "razorpay" },
      include: { cafe_item: true },
    });
    if (!existing) return res.status(409).json({ error: "Paid café orders are added at checkout." });
    return res.status(200).json(existing);
  }

  const item = await prisma.cafeItem.findUnique({ where: { id: cafe_item_id } });
  if (!item?.is_available) return res.status(400).json({ error: "This menu item is unavailable" });
  const unit = Number(item.price);

  try {
    const order = await prisma.$transaction(async (tx) => {
      if (method !== "food_credit") {
        return tx.cafeOrder.create({
          data: {
            user_id: userId,
            cafe_item_id,
            booking_id: resolvedBookingId,
            quantity: qty,
            payment_method: "counter",
            status: "pending",
            unit_price_inr: unit,
          },
          include: { cafe_item: true },
        });
      }
      const percent = await getActivePassCafePercent(tx, userId, new Date());
      const grossPaise = toPaise(unit * qty);
      const discountPaise = Math.round((grossPaise * percent) / 100);
      const netPaise = grossPaise - discountPaise;
      const created = await tx.cafeOrder.create({
        data: {
          user_id: userId,
          cafe_item_id,
          booking_id: resolvedBookingId,
          quantity: qty,
          payment_method: "food_credit",
          status: "pending",
          unit_price_inr: unit,
          discount_inr: discountPaise / 100,
          credit_applied_paise: netPaise,
        },
        include: { cafe_item: true },
      });
      const applied = await spendFoodCreditForOrderTx(tx, {
        userId,
        cafeOrderId: created.id,
        bookingId: resolvedBookingId,
        amountPaise: netPaise,
      });
      if (applied === netPaise) return created;
      // Rounding drift absorbed: the order records only the credit actually debited.
      return tx.cafeOrder.update({
        where: { id: created.id },
        data: { credit_applied_paise: applied },
        include: { cafe_item: true },
      });
    });
    return res.status(201).json(order);
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_FOOD_CREDIT") {
      return res.status(402).json({ error: "Not enough food credit for this order." });
    }
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

  if (req.method === "GET") return handleGet(req, res, userId, isStaff);
  if (req.method === "POST") return handlePost(req, res, userId);
  if (req.method === "PATCH") return handlePatch(req, res, isStaff);

  res.status(405).end();
}
