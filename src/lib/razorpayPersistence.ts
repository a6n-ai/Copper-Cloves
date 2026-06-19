import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { captureAuthorizedPayment, getRazorpay, razorpayConfigured } from "@/lib/razorpayServer";

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
  bookingId?: string | null;
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
      booking_id: params.bookingId ?? null,
    },
    update: {
      amount_paise: params.amountPaise,
      currency: params.currency,
      receipt: params.receipt,
      ...(notesJson != null ? { notes: notesJson } : {}),
      ...(params.bookingId != null ? { booking_id: params.bookingId } : {}),
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
      notes: o.notes != null ? (o.notes as Prisma.InputJsonValue) : undefined,
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
        direction: "credit",
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
      user_package_id: null,
      // Booking-first checkout pre-links the order to the pending booking at create-order
      // time, then confirmPreCreatedBookingFlow calls this again to confirm + link the
      // Payment rows. So accept an order that is unlinked OR already linked to THIS booking
      // (idempotent); only reject one already bound to a different booking or a package.
      OR: [{ booking_id: null }, { booking_id: params.bookingId }],
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

type WebhookEntityFields = {
  payId: string;
  ordId: string;
  amountPaise: number | null;
  statusNorm: string;
  currency: string;
  method: string | null;
};

/** Extract the normalized fields we care about from a webhook payment entity. */
function parseWebhookEntityFields(entity: Record<string, unknown>): WebhookEntityFields | null {
  const payId = typeof entity.id === "string" ? entity.id : null;
  const ordId = typeof entity.order_id === "string" ? entity.order_id : null;
  if (!payId || !ordId) return null;

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
  return { payId, ordId, amountPaise, statusNorm, currency, method };
}

/** Derive a failure reason string from the entity error / event / status (failed path only). */
function deriveFailureReason(
  entity: Record<string, unknown>,
  event: string,
  statusNorm: string,
): string | null {
  const err = entity.error;
  const nestedDesc =
    err && typeof err === "object" && err !== null && "description" in err
      ? String((err as { description?: unknown }).description ?? "")
      : "";
  return nestedDesc || event || statusNorm || null;
}

/**
 * Capture authorized funds so they settle to the studio. This is the only path
 * that runs for netbanking/UPI when the member closes the tab before the browser
 * verify call — an uncaptured authorization auto-voids after the capture window.
 * Returns the effective status (captured status on success, unchanged on no-op/error).
 */
async function captureAuthorizedForWebhook(args: {
  failed: boolean;
  statusNorm: string;
  amountPaise: number | null;
  payId: string;
  ordId: string;
  currency: string;
}): Promise<string> {
  const { failed, statusNorm, amountPaise, payId, ordId, currency } = args;
  if (failed || statusNorm !== "authorized" || !razorpayConfigured() || amountPaise == null) {
    return statusNorm;
  }
  try {
    const result = await captureAuthorizedPayment({
      razorpay: getRazorpay(),
      paymentId: payId,
      amountPaise,
      currency,
    });
    return result.status;
  } catch (capErr) {
    log.error({ err: capErr, razorpayOrderId: ordId, paymentId: payId }, "razorpay capture failed (webhook)");
    return statusNorm;
  }
}

/** Resolve the unified Payment ledger status from the gateway-effective status. */
function paymentLedgerStatus(failed: boolean, effectiveStatus: string): "failed" | "succeeded" | "pending" {
  if (failed) return "failed";
  if (["captured", "authorized"].includes(effectiveStatus)) return "succeeded";
  return "pending";
}

/** Idempotent webhook reconciliation (signature already verified on the route). */
export async function reconcileRazorpayPaymentFromWebhook(body: {
  event?: string;
  payload?: unknown;
}): Promise<void> {
  const entity = paymentEntityFromWebhookPayload(body.payload);
  if (!entity) return;

  const fields = parseWebhookEntityFields(entity);
  if (!fields) return;
  const { payId, ordId, amountPaise, statusNorm, currency, method } = fields;

  const orderRow = await prisma.razorpayOrder.findUnique({
    where: { razorpay_order_id: ordId },
  });
  if (!orderRow) {
    log.warn({ razorpayOrderId: ordId }, "no local razorpay_orders row for webhook");
    return;
  }

  const event = body.event ?? "";
  const failed = event === "payment.failed" || statusNorm === "failed";

  const failureReason = failed ? deriveFailureReason(entity, event, statusNorm) : null;

  const effectiveStatus = await captureAuthorizedForWebhook({
    failed,
    statusNorm,
    amountPaise,
    payId,
    ordId,
    currency,
  });

  await prisma.razorpayPayment.upsert({
    where: { razorpay_payment_id: payId },
    create: {
      razorpay_payment_id: payId,
      razorpay_order_id: ordId,
      amount_paise: amountPaise,
      currency,
      status: effectiveStatus,
      method,
      signature_verified: false,
      failure_reason: failureReason,
    },
    update: {
      amount_paise: amountPaise ?? undefined,
      currency,
      status: effectiveStatus,
      method: method ?? undefined,
      failure_reason: failed ? failureReason : null,
    },
  });

  // Mirror to unified Payment ledger (status pending until verified).
  const paymentStatus = paymentLedgerStatus(failed, effectiveStatus);
  await prisma.payment.upsert({
    where: { razorpay_payment_id: payId },
    create: {
      direction: "credit",
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

  if (["captured", "authorized"].includes(effectiveStatus)) {
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

type RazorpayOrderPaymentsClient = {
  orders: { fetchPayments: (id: string) => Promise<{ items?: unknown[] }> };
};

export type StuckOrderReconcileResult = {
  scanned: number;
  fulfilled: number;
  persistedOnly: number;
  stillUnpaid: number;
  /** Paid orders whose fulfillment never completed (booking stuck payment_pending), healed in the second sweep. */
  healedPaid: number;
  errors: number;
  details: Array<{ orderId: string; outcome: "fulfilled" | "persisted_only" | "unpaid" | "healed_paid" | "error" }>;
};

/**
 * Pull-based backstop for the webhook. Polls Razorpay for the authoritative state of
 * every website order that is still unfulfilled (no booking / no package) and feeds any
 * captured/authorized payment back through the same webhook reconcile path
 * (capture-if-authorized → idempotent persist → fulfil).
 *
 * Covers the common mobile failure mode: the member pays via UPI then closes the tab
 * before the browser verify call, AND the webhook never lands (delivery/signature/config).
 * Idempotent — safe to run on a schedule; already-fulfilled orders are filtered out by the query.
 */
export async function reconcileStuckRazorpayOrders(opts?: {
  lookbackHours?: number;
  limit?: number;
}): Promise<StuckOrderReconcileResult> {
  const result: StuckOrderReconcileResult = {
    scanned: 0,
    fulfilled: 0,
    persistedOnly: 0,
    stillUnpaid: 0,
    healedPaid: 0,
    errors: 0,
    details: [],
  };
  if (!razorpayConfigured()) {
    log.warn("reconcileStuckRazorpayOrders skipped — razorpay not configured");
    return result;
  }

  const lookbackHours = opts?.lookbackHours ?? 72;
  const limit = opts?.limit ?? 200;
  const cutoff = new Date(Date.now() - lookbackHours * 3_600_000);

  const orders = await prisma.razorpayOrder.findMany({
    where: {
      status: { in: ["created", "attempted"] },
      booking_id: null,
      user_package_id: null,
      created_at: { gte: cutoff },
    },
    orderBy: { created_at: "asc" },
    take: limit,
  });

  const rzp = getRazorpay() as unknown as RazorpayOrderPaymentsClient;

  for (const order of orders) {
    // Only website-originated orders carry a `purpose` in notes; skip Payment-Page/external orders.
    const notes =
      order.notes != null && typeof order.notes === "object"
        ? (order.notes as Record<string, unknown>)
        : null;
    if (!notes || !("purpose" in notes)) continue;

    result.scanned += 1;
    try {
      const resp = await rzp.orders.fetchPayments(order.razorpay_order_id);
      const items = Array.isArray(resp.items) ? resp.items : [];
      const entity =
        items.find((p) => (p as { status?: string }).status === "captured") ??
        items.find((p) => (p as { status?: string }).status === "authorized");

      if (!entity) {
        result.stillUnpaid += 1;
        result.details.push({ orderId: order.razorpay_order_id, outcome: "unpaid" });
        continue;
      }

      const status = (entity as { status?: string }).status;
      // Reuse the webhook path: captures authorized funds, persists rows, flips order → paid, fulfils.
      await reconcileRazorpayPaymentFromWebhook({
        event: status === "captured" ? "payment.captured" : "payment.authorized",
        payload: { payment: { entity } },
      });

      const after = await prisma.razorpayOrder.findUnique({
        where: { razorpay_order_id: order.razorpay_order_id },
        select: { booking_id: true, user_package_id: true },
      });
      const fulfilled = Boolean(after?.booking_id || after?.user_package_id);
      if (fulfilled) {
        result.fulfilled += 1;
        result.details.push({ orderId: order.razorpay_order_id, outcome: "fulfilled" });
      } else {
        result.persistedOnly += 1;
        result.details.push({ orderId: order.razorpay_order_id, outcome: "persisted_only" });
      }
    } catch (e) {
      result.errors += 1;
      result.details.push({ orderId: order.razorpay_order_id, outcome: "error" });
      log.error({ err: e, razorpayOrderId: order.razorpay_order_id }, "stuck-order reconcile failed");
    }
  }

  // ── Second sweep: PAID orders whose fulfillment never completed ──────────────
  // The scan above only catches created/attempted orders with no booking/package.
  // The booking-first checkout pre-creates a payment_pending booking, links it to the
  // order, and flips the order → paid on capture. If the browser finish-checkout never
  // runs AND the webhook is missed, the booking stays payment_pending forever — and the
  // order is now status=paid with booking_id set, so the scan above skips it on BOTH
  // filters. Catch those here. fulfillCheckoutFromPaidOrder is idempotent (no-ops once
  // the booking is confirmed / package linked), so this is safe to run every cycle.
  const { fulfillCheckoutFromPaidOrder } = await import("@/lib/razorpayServerCheckout");
  const paidStuck = await prisma.razorpayOrder.findMany({
    where: {
      status: "paid",
      created_at: { gte: cutoff },
      OR: [
        // Pre-created booking that never flipped to confirmed.
        { booking: { is: { status: { in: ["payment_pending", "expired"] } } } },
        // Paid but nothing linked yet — finish-checkout never ran (notes carry the context).
        { booking_id: null, user_package_id: null },
      ],
    },
    orderBy: { created_at: "asc" },
    take: limit,
  });

  for (const order of paidStuck) {
    const notes =
      order.notes != null && typeof order.notes === "object"
        ? (order.notes as Record<string, unknown>)
        : null;
    if (!notes || !("purpose" in notes)) continue; // skip Payment-Page/external orders

    result.scanned += 1;
    try {
      const outcome = await fulfillCheckoutFromPaidOrder(order.razorpay_order_id);
      if (outcome === "booking" || outcome === "package") {
        result.healedPaid += 1;
        result.details.push({ orderId: order.razorpay_order_id, outcome: "healed_paid" });
      }
    } catch (e) {
      result.errors += 1;
      result.details.push({ orderId: order.razorpay_order_id, outcome: "error" });
      log.error({ err: e, razorpayOrderId: order.razorpay_order_id }, "paid-stuck order heal failed");
    }
  }

  log.info(
    { scanned: result.scanned, fulfilled: result.fulfilled, persistedOnly: result.persistedOnly, stillUnpaid: result.stillUnpaid, healedPaid: result.healedPaid, errors: result.errors },
    "reconcileStuckRazorpayOrders complete",
  );
  return result;
}
