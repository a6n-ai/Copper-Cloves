import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { reconcileRazorpayPaymentFromWebhook } from "@/lib/razorpayPersistence";
import { requestLogger } from "@/lib/logger";

/**
 * Razorpay webhooks — verify `X-Razorpay-Signature` against the **raw** body (see Razorpay docs).
 *
 * Dashboard URL (production): `https://www.thestudiobycopperandcloves.in/api/payments/razorpay/webhook`
 *   NOTE: must be the `www` host — the apex domain 302-redirects to www and a redirected POST
 *   is dropped, so apex deliveries silently fail.
 * Local testing: expose with ngrok/cloudflared and paste that HTTPS URL in Razorpay Dashboard → Webhooks.
 *
 * Every inbound event is persisted to `razorpay_webhook_logs` (raw body + signature) BEFORE
 * processing, so it can be replayed via `scripts/replay-webhook.ts` without re-calling Razorpay.
 */

export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function headerValue(req: NextApiRequest, name: string): string {
  const h = req.headers[name];
  if (typeof h === "string") return h.trim();
  if (Array.isArray(h) && h[0]) return String(h[0]).trim();
  return "";
}

/** Pull order/payment ids out of a parsed webhook body for log indexing (best-effort). */
function extractEntityIds(body: unknown): { orderId: string | null; paymentId: string | null } {
  let orderId: string | null = null;
  let paymentId: string | null = null;
  if (body && typeof body === "object") {
    const payload = (body as { payload?: unknown }).payload;
    if (payload && typeof payload === "object") {
      const payEntity = (payload as { payment?: { entity?: Record<string, unknown> } }).payment?.entity;
      if (payEntity) {
        if (typeof payEntity.id === "string") paymentId = payEntity.id;
        if (typeof payEntity.order_id === "string") orderId = payEntity.order_id;
      }
      const orderEntity = (payload as { order?: { entity?: Record<string, unknown> } }).order?.entity;
      if (orderEntity && !orderId && typeof orderEntity.id === "string") orderId = orderEntity.id;
    }
  }
  return { orderId, paymentId };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  if (req.method !== "POST") return res.status(405).end();

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    log.error("razorpay webhook missing secret");
    return res.status(503).json({ error: "Webhook secret not configured" });
  }

  let raw: Buffer;
  try {
    raw = await readRawBody(req);
  } catch (e) {
    log.error({ err: e }, "razorpay webhook body read failed");
    return res.status(400).end();
  }

  const sig = headerValue(req, "x-razorpay-signature");
  const eventId = headerValue(req, "x-razorpay-event-id") || null;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");

  let signatureOk = false;
  try {
    signatureOk =
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    signatureOk = false;
  }

  const rawBody = raw.toString("utf8");

  // Parse early (best-effort) so we can index event + entity ids on the log row.
  let body: { event?: string; payload?: unknown } | null = null;
  try {
    body = JSON.parse(rawBody) as { event?: string; payload?: unknown };
  } catch {
    body = null;
  }
  const { orderId, paymentId } = extractEntityIds(body);

  // Persist the raw event before processing. Idempotent on event_id (Razorpay redelivers
  // the same X-Razorpay-Event-Id); a logging failure must never block the ack to Razorpay.
  let logRowId: string | null = null;
  try {
    const initialStatus = !signatureOk ? "skipped" : body === null ? "skipped" : "received";
    const logRow = await prisma.razorpayWebhookLog.upsert({
      where: { event_id: eventId ?? `__noid_${expected}` },
      create: {
        event_id: eventId,
        event: body?.event ?? null,
        raw_body: rawBody,
        signature: sig || null,
        signature_valid: signatureOk,
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        status: initialStatus,
        error: !signatureOk ? "invalid_signature" : body === null ? "bad_json" : null,
      },
      update: {
        // Redelivery: refresh validity/status, keep the original row.
        event: body?.event ?? undefined,
        signature_valid: signatureOk,
        razorpay_order_id: orderId ?? undefined,
        razorpay_payment_id: paymentId ?? undefined,
      },
      select: { id: true },
    });
    logRowId = logRow.id;
  } catch (logErr) {
    log.error({ err: logErr, eventId }, "razorpay webhook log persist failed");
  }

  if (!signatureOk) {
    log.warn("razorpay webhook invalid signature");
    return res.status(400).json({ error: "Invalid signature" });
  }

  if (body === null) {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  log.info({ event: body.event, eventId }, "razorpay webhook received");
  try {
    await reconcileRazorpayPaymentFromWebhook(body);
    log.info({ event: body.event, eventId }, "razorpay webhook reconciled");
    if (logRowId) {
      await prisma.razorpayWebhookLog
        .update({ where: { id: logRowId }, data: { status: "processed", processed_at: new Date() } })
        .catch(() => {});
    }
  } catch (reconcileErr) {
    log.error({ err: reconcileErr, event: body.event, eventId }, "razorpay webhook reconcile failed");
    if (logRowId) {
      const msg = reconcileErr instanceof Error ? reconcileErr.message : String(reconcileErr);
      await prisma.razorpayWebhookLog
        .update({ where: { id: logRowId }, data: { status: "failed", error: msg, processed_at: new Date() } })
        .catch(() => {});
    }
  }

  res.status(200).json({ ok: true });
}
