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
  // Gateway-specific detail (the "entire information" Razorpay returns).
  fee: number | null;
  tax: number | null;
  bank: string | null;
  wallet: string | null;
  vpa: string | null;
  card_network: string | null;
  card_last4: string | null;
  card_type: string | null;
  rrn: string | null;
  international: boolean | null;
  captured: boolean | null;
  refund_status: string | null;
  error_description: string | null;
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

    const card = payment.card && typeof payment.card === "object" ? (payment.card as Record<string, unknown>) : null;
    const acquirer =
      payment.acquirer_data && typeof payment.acquirer_data === "object"
        ? (payment.acquirer_data as Record<string, unknown>)
        : null;

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
      fee: payment.fee != null ? Number(payment.fee) : null,
      tax: payment.tax != null ? Number(payment.tax) : null,
      bank: typeof payment.bank === "string" && payment.bank ? payment.bank : null,
      wallet: typeof payment.wallet === "string" && payment.wallet ? payment.wallet : null,
      vpa: typeof payment.vpa === "string" && payment.vpa ? payment.vpa : null,
      card_network: card && typeof card.network === "string" ? card.network : null,
      card_last4: card && typeof card.last4 === "string" ? card.last4 : null,
      card_type: card && typeof card.type === "string" ? card.type : null,
      rrn: acquirer && typeof acquirer.rrn === "string" ? acquirer.rrn : null,
      international: typeof payment.international === "boolean" ? payment.international : null,
      captured: typeof payment.captured === "boolean" ? payment.captured : null,
      refund_status: typeof payment.refund_status === "string" && payment.refund_status ? payment.refund_status : null,
      error_description: typeof payment.error_description === "string" && payment.error_description ? payment.error_description : null,
    };

    return res.json(detail);
  } catch (e) {
    logger.error({ err: e }, "[razorpay-payment-detail]");
    return res.status(502).json({ error: "Failed to fetch from Razorpay." });
  }
}
