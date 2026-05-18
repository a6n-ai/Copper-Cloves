import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { PaymentMethod, PaymentStatus } from "@/generated/prisma/client";

const ALLOWED_METHODS: PaymentMethod[] = [
  PaymentMethod.razorpay_online,
  PaymentMethod.razorpay_completed,
  PaymentMethod.pine_lab_card,
  PaymentMethod.pine_lab_upi,
  PaymentMethod.direct_upi,
  PaymentMethod.cash,
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const adminId = (session.user as { id?: string }).id ?? null;

  if (req.method === "GET") {
    const userId = typeof req.query.user_id === "string" ? req.query.user_id : "";
    const where = userId ? { user_id: userId } : {};
    const rows = await prisma.payment.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: 200,
    });
    return res.json(rows);
  }

  if (req.method === "POST") {
    const {
      user_id,
      user_package_id,
      booking_id,
      method,
      amount_paise,
      currency,
      reference,
      proof_url,
      notes,
    } = req.body ?? {};

    if (!user_id || typeof user_id !== "string") {
      return res.status(400).json({ error: "user_id required" });
    }
    if (!ALLOWED_METHODS.includes(method)) {
      return res.status(400).json({ error: "Invalid method" });
    }
    const amount = Number(amount_paise);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: "amount_paise must be non-negative integer" });
    }

    const payment = await prisma.payment.create({
      data: {
        user_id,
        user_package_id: user_package_id || null,
        booking_id: booking_id || null,
        method,
        status: PaymentStatus.succeeded,
        amount_paise: Math.round(amount),
        currency: typeof currency === "string" && currency ? currency : "INR",
        reference: typeof reference === "string" ? reference : null,
        proof_url: typeof proof_url === "string" ? proof_url : null,
        notes: typeof notes === "string" ? notes : null,
        recorded_by: adminId,
      },
    });
    return res.status(201).json(payment);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).end();
}
