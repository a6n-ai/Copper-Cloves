import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "razorpayPersistence" });

export type DbTx = Prisma.TransactionClient;

type RazorpayOrderFetchClient = {
  orders: { fetch: (id: string) => Promise<unknown> };
};

/** Persist Orders API row when we create an order (idempotent). */
export async function persistRazorpayOrderOnCreate(params: {
  userId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  receipt: string;
  notes?: Record<string, unknown> | null;
}): Promise<void> {
  const notesJson =
    params.notes != null ? (params.notes as Prisma.InputJsonValue) : undefined;
  await prisma.razorpayOrder.upsert({
    where: { razorpay_order_id: params.razorpayOrderId },
    create: {
      user_id: params.userId,
      razorpay_order_id: params.razorpayOrderId,
      amount_paise: params.amountPaise,
      currency: params.currency,
      receipt: params.receipt,
      status: "created",
      notes: notesJson,
    },
    update: {
      amount_paise: params.amountPaise,
      currency: params.currency,
      receipt: params.receipt,
      ...(notesJson != null ? { notes: notesJson } : {}),
    },
  });
}

/**
 * If verify-payment runs before our create-order DB write succeeded, backfill from Razorpay Orders API.
 * Enforces `notes.user_id` matches the session user (same trust model as order creation).
 */
export async function ensureRazorpayOrderRowForUser(params: {
  userId: string;
  razorpayOrderId: string;
  razorpay: RazorpayOrderFetchClient;
}): Promise<void> {
  const existing = await prisma.razorpayOrder.findUnique({
    where: { razorpay_order_id: params.razorpayOrderId },
  });
  if (existing) {
    if (existing.user_id !== params.userId) {
      throw new Error("ORDER_USER_MISMATCH");
    }
    return;
  }

  const o = (await params.razorpay.orders.fetch(params.razorpayOrderId)) as {
    id?: string;
    amount?: number | string;
    currency?: string;
    receipt?: string | null;
    notes?: Record<string, unknown> | null;
  };

  const noteUser =
    o.notes && typeof o.notes.user_id === "string" ? o.notes.user_id.trim() : null;
  if (noteUser !== params.userId) {
    throw new Error("ORDER_USER_MISMATCH");
  }

  await prisma.razorpayOrder.create({
    data: {
      user_id: params.userId,
      razorpay_order_id: params.razorpayOrderId,
      amount_paise: Number(o.amount ?? 0),
      currency: o.currency ?? "INR",
      receipt: typeof o.receipt === "string" ? o.receipt : null,
      status: "created",
      notes: o.notes ?? undefined,
    },
  });
}

function normalizePaymentStatus(status: string): string {
  return status.trim().toLowerCase();
}

/** After HMAC + payments.fetch — store payment and roll order status forward. */
export async function persistVerifiedRazorpayPayment(params: {
  userId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  payment: {
    amount?: number | string | null;
    currency?: string | null;
    status?: string | null;
    method?: string | null;
  };
}): Promise<void> {
  const rawAmount = Number(params.payment.amount ?? 0);
  const amountPaise = Number.isFinite(rawAmount) ? Math.round(rawAmount) : null;
  const statusNorm = normalizePaymentStatus(
    params.payment.status != null ? String(params.payment.status) : "unknown",
  );
  const currency =
    params.payment.currency != null ? String(params.payment.currency) : "INR";
  const method =
    params.payment.method != null ? String(params.payment.method) : null;

  const paid = ["captured", "authorized"].includes(statusNorm);

  await prisma.$transaction(async (tx) => {
    await tx.razorpayPayment.upsert({
      where: { razorpay_payment_id: params.razorpayPaymentId },
      create: {
        razorpay_payment_id: params.razorpayPaymentId,
        razorpay_order_id: params.razorpayOrderId,
        amount_paise: amountPaise,
        currency,
        status: statusNorm,
        method,
        signature_verified: true,
        verified_at: new Date(),
      },
      update: {
        amount_paise: amountPaise ?? undefined,
        currency,
        status: statusNorm,
        method: method ?? undefined,
        signature_verified: true,
        verified_at: new Date(),
      },
    });

    // Unified Payment ledger: mirror this Razorpay capture so all readers (admin, reports) can use one table.
    await tx.payment.upsert({
      where: { razorpay_payment_id: params.razorpayPaymentId },
      create: {
        user_id: params.userId,
        method: "razorpay_online",
        status: paid ? "succeeded" : "failed",
        amount_paise: amountPaise ?? 0,
        currency,
        reference: params.razorpayPaymentId,
        razorpay_payment_id: params.razorpayPaymentId,
        razorpay_order_id: params.razorpayOrderId,
      },
      update: {
        status: paid ? "succeeded" : "failed",
        amount_paise: amountPaise ?? undefined,
        currency,
      },
    });

    await tx.razorpayOrder.updateMany({
      where: { razorpay_order_id: params.razorpayOrderId, user_id: params.userId },
      data: { status: paid ? "paid" : "failed" },
    });
  });
}

/**
 * Attach Razorpay order + verified payments to a booking inside an existing transaction.
 * Caller must only pass `razorpay_order_id` when the member paid online for this checkout.
 */
export async function linkRazorpayOrderToBookingTx(
  tx: DbTx,
  params: { userId: string; razorpayOrderId: string; bookingId: string },
): Promise<void> {
  const order = await tx.razorpayOrder.findFirst({
    where: {
      razorpay_order_id: params.razorpayOrderId,
      user_id: params.userId,
      booking_id: null,
      user_package_id: null,
    },
  });

  const verified = await tx.razorpayPayment.findFirst({
    where: {
      razorpay_order_id: params.razorpayOrderId,
      signature_verified: true,
      status: { in: ["captured", "authorized"] },
    },
  });

  if (!order || !verified) {
    throw new Error("RAZORPAY_BOOKING_LINK_INVALID");
  }

  await tx.razorpayOrder.update({
    where: { razorpay_order_id: params.razorpayOrderId },
    data: { booking_id: params.bookingId },
  });

  // Attach booking to all Payment rows for this order so finance/booking-detail queries can join via Booking.payments.
  await tx.payment.updateMany({
    where: { razorpay_order_id: params.razorpayOrderId, user_id: params.userId },
    data: { booking_id: params.bookingId },
  });
}

/** Attach Razorpay order + verified payments to a package purchase (`user_packages`) inside an existing transaction. */
export async function linkRazorpayOrderToUserPackageTx(
  tx: DbTx,
  params: { userId: string; razorpayOrderId: string; userPackageId: string },
): Promise<void> {
  const order = await tx.razorpayOrder.findFirst({
    where: {
      razorpay_order_id: params.razorpayOrderId,
      user_id: params.userId,
      user_package_id: null,
      booking_id: null,
    },
  });

  const verified = await tx.razorpayPayment.findFirst({
    where: {
      razorpay_order_id: params.razorpayOrderId,
      signature_verified: true,
      status: { in: ["captured", "authorized"] },
    },
  });

  if (!order || !verified) {
    throw new Error("RAZORPAY_PACKAGE_LINK_INVALID");
  }

  await tx.razorpayOrder.update({
    where: { razorpay_order_id: params.razorpayOrderId },
    data: { user_package_id: params.userPackageId },
  });

  await tx.payment.updateMany({
    where: { razorpay_order_id: params.razorpayOrderId, user_id: params.userId },
    data: { user_package_id: params.userPackageId },
  });
}

function paymentEntityFromWebhookPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const pay = p.payment;
  if (!pay || typeof pay !== "object") return null;
  const entity = (pay as Record<string, unknown>).entity;
  if (!entity || typeof entity !== "object") return null;
  return entity as Record<string, unknown>;
}

/** Idempotent webhook reconciliation (signature already verified on the route). */
export async function reconcileRazorpayPaymentFromWebhook(body: {
  event?: string;
  payload?: unknown;
}): Promise<void> {
  const entity = paymentEntityFromWebhookPayload(body.payload);
  if (!entity) return;

  const payId = typeof entity.id === "string" ? entity.id : null;
  const ordId = typeof entity.order_id === "string" ? entity.order_id : null;
  if (!payId || !ordId) return;

  const amountRaw = entity.amount;
  const amountPaise =
    amountRaw !== undefined && Number.isFinite(Number(amountRaw))
      ? Math.round(Number(amountRaw))
      : null;
  const statusNorm = normalizePaymentStatus(
    entity.status != null ? String(entity.status) : "unknown",
  );
  const currency = entity.currency != null ? String(entity.currency) : "INR";
  const method = entity.method != null ? String(entity.method) : null;

  const orderRow = await prisma.razorpayOrder.findUnique({
    where: { razorpay_order_id: ordId },
  });
  if (!orderRow) {
    log.warn({ razorpayOrderId: ordId }, "no local razorpay_orders row for webhook");
    return;
  }

  const event = body.event ?? "";
  const failed = event === "payment.failed" || statusNorm === "failed";

  let failureReason: string | null = null;
  if (failed) {
    const err = entity.error;
    const nestedDesc =
      err && typeof err === "object" && err !== null && "description" in err
        ? String((err as { description?: unknown }).description ?? "")
        : "";
    failureReason = nestedDesc || event || statusNorm || null;
  }

  await prisma.razorpayPayment.upsert({
    where: { razorpay_payment_id: payId },
    create: {
      razorpay_payment_id: payId,
      razorpay_order_id: ordId,
      amount_paise: amountPaise,
      currency,
      status: statusNorm,
      method,
      signature_verified: false,
      failure_reason: failureReason,
    },
    update: {
      amount_paise: amountPaise ?? undefined,
      currency,
      status: statusNorm,
      method: method ?? undefined,
      failure_reason: failed ? failureReason : null,
    },
  });

  // Mirror to unified Payment ledger (status pending until verified).
  const paymentStatus = failed ? "failed" : ["captured", "authorized"].includes(statusNorm) ? "succeeded" : "pending";
  await prisma.payment.upsert({
    where: { razorpay_payment_id: payId },
    create: {
      user_id: orderRow.user_id,
      booking_id: orderRow.booking_id,
      user_package_id: orderRow.user_package_id,
      method: "razorpay_online",
      status: paymentStatus,
      amount_paise: amountPaise ?? 0,
      currency,
      reference: payId,
      razorpay_payment_id: payId,
      razorpay_order_id: ordId,
    },
    update: {
      status: paymentStatus,
      amount_paise: amountPaise ?? undefined,
      currency,
      booking_id: orderRow.booking_id,
      user_package_id: orderRow.user_package_id,
    },
  });

  if (["captured", "authorized"].includes(statusNorm)) {
    await prisma.razorpayPayment.updateMany({
      where: { razorpay_payment_id: payId },
      data: { signature_verified: true, verified_at: new Date() },
    });
    await prisma.razorpayOrder.updateMany({
      where: { razorpay_order_id: ordId },
      data: { status: "paid" },
    });
    await tryFulfillCheckoutAfterWebhook(ordId);
  } else if (failed) {
    await prisma.razorpayOrder.updateMany({
      where: { razorpay_order_id: ordId, booking_id: null, user_package_id: null },
      data: { status: "failed" },
    });
  }
}

async function tryFulfillCheckoutAfterWebhook(razorpayOrderId: string): Promise<void> {
  const { fulfillCheckoutFromPaidOrder } = await import("@/lib/razorpayServerCheckout");
  try {
    const outcome = await fulfillCheckoutFromPaidOrder(razorpayOrderId);
    if (outcome === "booking" || outcome === "package") {
      log.info({ razorpayOrderId, outcome }, "webhook fulfilled checkout");
    } else {
      log.warn({ razorpayOrderId, outcome }, "webhook fulfill returned no-op");
    }
  } catch (e) {
    log.error({ err: e, razorpayOrderId }, "webhook fulfill checkout failed — payment captured but not fulfilled");
  }
}
