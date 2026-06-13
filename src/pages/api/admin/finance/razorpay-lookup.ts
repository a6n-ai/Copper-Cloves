import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";
import { getRazorpay, razorpayConfigured } from "@/lib/razorpayServer";
import logger from "@/lib/logger";

export type LookupPayment = {
  id: string;
  orderId: string | null;
  amountPaise: number;
  amountRefundedPaise: number;
  status: string;
  method: string | null;
  email: string | null;
  contact: string | null;
  description: string | null;
  notes: Record<string, string> | null;
  createdAt: number; // unix seconds
};

export type LookupDbState = "missing" | "exists_unfulfilled" | "matched";

export type LookupResult = {
  queryType: "payment" | "order";
  payments: LookupPayment[];
  orderId: string | null;
  orderReceipt: string | null;
  orderStatus: string | null;
  orderAmountPaise: number | null;
  dbState: LookupDbState;
  internalPaymentId: string | null;
  existingBookingId: string | null;
  existingUserPackageId: string | null;
};

function parseNotes(v: unknown): Record<string, string> | null {
  if (!v || Array.isArray(v) || typeof v !== "object") return null;
  const entries = Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, String(val)]);
  return entries.length ? Object.fromEntries(entries) : null;
}

function mapRzpPayment(raw: Record<string, unknown>): LookupPayment {
  return {
    id: String(raw.id ?? ""),
    orderId: typeof raw.order_id === "string" ? raw.order_id : null,
    amountPaise: Number(raw.amount ?? 0),
    amountRefundedPaise: Number(raw.amount_refunded ?? 0),
    status: String(raw.status ?? ""),
    method: typeof raw.method === "string" ? raw.method : null,
    email: typeof raw.email === "string" && raw.email ? raw.email : null,
    contact: typeof raw.contact === "string" && raw.contact ? raw.contact : null,
    description: typeof raw.description === "string" && raw.description ? raw.description : null,
    notes: parseNotes(raw.notes),
    createdAt: Number(raw.created_at ?? 0),
  };
}

async function resolveDbState(razorpayPaymentId: string): Promise<{
  dbState: LookupDbState;
  internalPaymentId: string | null;
  existingBookingId: string | null;
  existingUserPackageId: string | null;
}> {
  // Primary lookup: razorpay_payment_id unique field
  const payment = await prisma.payment.findUnique({
    where: { razorpay_payment_id: razorpayPaymentId },
    select: { id: true, booking_id: true, user_package_id: true },
  });

  if (payment) {
    const unfulfilled = !payment.booking_id && !payment.user_package_id;
    return {
      dbState: unfulfilled ? "exists_unfulfilled" : "matched",
      internalPaymentId: payment.id,
      existingBookingId: payment.booking_id,
      existingUserPackageId: payment.user_package_id,
    };
  }

  // Fallback: reference field (used for pay_* ids during reconcile import)
  const byRef = await prisma.payment.findUnique({
    where: { reference: razorpayPaymentId },
    select: { id: true, booking_id: true, user_package_id: true },
  });

  if (!byRef) {
    return { dbState: "missing", internalPaymentId: null, existingBookingId: null, existingUserPackageId: null };
  }

  const unfulfilled = !byRef.booking_id && !byRef.user_package_id;
  return {
    dbState: unfulfilled ? "exists_unfulfilled" : "matched",
    internalPaymentId: byRef.id,
    existingBookingId: byRef.booking_id,
    existingUserPackageId: byRef.user_package_id,
  };
}

async function lookupByPaymentId(
  rzp: ReturnType<typeof getRazorpay>,
  paymentId: string,
): Promise<LookupResult> {
  const raw = (await rzp.payments.fetch(paymentId)) as unknown as Record<string, unknown>;
  const payment = mapRzpPayment(raw);

  let order: { receipt: string | null; status: string; amount: number } | null = null;
  if (payment.orderId) {
    try {
      const o = (await rzp.orders.fetch(payment.orderId)) as unknown as Record<string, unknown>;
      order = {
        receipt: typeof o.receipt === "string" ? o.receipt : null,
        status: String(o.status ?? ""),
        amount: Number(o.amount ?? 0),
      };
    } catch {
      // order fetch is best-effort
    }
  }

  const dbState = await resolveDbState(paymentId);

  return {
    queryType: "payment",
    payments: [payment],
    orderId: payment.orderId,
    orderReceipt: order?.receipt ?? null,
    orderStatus: order?.status ?? null,
    orderAmountPaise: order?.amount ?? null,
    ...dbState,
  };
}

async function lookupByOrderId(
  rzp: ReturnType<typeof getRazorpay>,
  orderId: string,
): Promise<LookupResult> {
  const [rawOrder, rawPaymentsResp] = await Promise.all([
    rzp.orders.fetch(orderId) as unknown as Promise<Record<string, unknown>>,
    (rzp.orders as unknown as { fetchPayments: (id: string) => Promise<unknown> }).fetchPayments(orderId),
  ]);

  const rawPayments = (rawPaymentsResp as { items?: unknown[] })?.items ?? [];
  const payments = rawPayments.map((p) => mapRzpPayment(p as Record<string, unknown>));

  const primary = payments.find((p) => p.status === "captured" || p.status === "authorized") ?? payments[0];
  const dbState = primary
    ? await resolveDbState(primary.id)
    : { dbState: "missing" as const, internalPaymentId: null, existingBookingId: null, existingUserPackageId: null };

  return {
    queryType: "order",
    payments,
    orderId,
    orderReceipt: typeof (rawOrder as Record<string, unknown>).receipt === "string"
      ? String((rawOrder as Record<string, unknown>).receipt)
      : null,
    orderStatus: String((rawOrder as Record<string, unknown>).status ?? ""),
    orderAmountPaise: Number((rawOrder as Record<string, unknown>).amount ?? 0),
    ...dbState,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;
  if (req.method !== "GET") return res.status(405).end();
  if (!razorpayConfigured()) return res.status(503).json({ error: "Razorpay not configured." });

  const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
  if (!id.startsWith("pay_") && !id.startsWith("order_")) {
    return res.status(400).json({ error: "id must start with pay_ or order_" });
  }

  try {
    const rzp = getRazorpay();
    if (id.startsWith("pay_")) {
      return res.json(await lookupByPaymentId(rzp, id));
    }
    return res.json(await lookupByOrderId(rzp, id));
  } catch (e) {
    logger.error({ err: e }, "[razorpay-lookup]");
    const msg = e instanceof Error ? e.message : "Lookup failed.";
    return res.status(502).json({ error: msg });
  }
}
