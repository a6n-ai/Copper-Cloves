import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";
import { getRazorpay, razorpayConfigured } from "@/lib/razorpayServer";
import logger from "@/lib/logger";

export type RazorpayPaymentDetail = {
  id: string;
  order_id: string | null;
  amount: number;
  amount_refunded: number;
  currency: string;
  status: string;
  method: string | null;
  description: string | null;
  email: string | null;
  contact: string | null;
  notes: Record<string, string> | null;
  created_at: number;
  order_amount: number | null;
  order_receipt: string | null;
  order_status: string | null;
  order_notes: Record<string, string> | null;
};

function parseNotes(v: unknown): Record<string, string> | null {
  if (!v || Array.isArray(v) || typeof v !== "object") return null;
  const entries = Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, String(val)]);
  return entries.length ? Object.fromEntries(entries) : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;
  if (req.method !== "GET") return res.status(405).end();
  if (!razorpayConfigured()) return res.status(503).json({ error: "Razorpay not configured." });

  const paymentId = typeof req.query.paymentId === "string" ? req.query.paymentId.trim() : "";
  if (!paymentId.startsWith("pay_")) return res.status(400).json({ error: "Invalid paymentId — must start with pay_" });

  try {
    const rzp = getRazorpay();
    const payment = (await rzp.payments.fetch(paymentId)) as unknown as Record<string, unknown>;

    let order: Record<string, unknown> | null = null;
    if (typeof payment.order_id === "string" && payment.order_id) {
      order = (await rzp.orders.fetch(payment.order_id)) as unknown as Record<string, unknown>;
    }

    const detail: RazorpayPaymentDetail = {
      id: String(payment.id ?? ""),
      order_id: typeof payment.order_id === "string" ? payment.order_id : null,
      amount: Number(payment.amount ?? 0),
      amount_refunded: Number(payment.amount_refunded ?? 0),
      currency: String(payment.currency ?? "INR"),
      status: String(payment.status ?? ""),
      method: typeof payment.method === "string" ? payment.method : null,
      description: typeof payment.description === "string" && payment.description ? payment.description : null,
      email: typeof payment.email === "string" && payment.email ? payment.email : null,
      contact: typeof payment.contact === "string" && payment.contact ? payment.contact : null,
      notes: parseNotes(payment.notes),
      created_at: Number(payment.created_at ?? 0),
      order_amount: order ? Number(order.amount ?? 0) : null,
      order_receipt: order && typeof order.receipt === "string" ? order.receipt : null,
      order_status: order ? String(order.status ?? "") : null,
      order_notes: order ? parseNotes(order.notes) : null,
    };

    return res.json(detail);
  } catch (e) {
    logger.error({ err: e }, "[razorpay-payment-detail]");
    return res.status(502).json({ error: "Failed to fetch from Razorpay." });
  }
}
