import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "node:crypto";
import { reconcileRazorpayPaymentFromWebhook } from "@/lib/razorpayPersistence";

/**
 * Razorpay webhooks — verify `X-Razorpay-Signature` against the **raw** body (see Razorpay docs).
 *
 * Dashboard URL (production): `https://<your-domain>/api/payments/razorpay/webhook`
 * Local testing: expose with ngrok/cloudflared and paste that HTTPS URL in Razorpay Dashboard → Webhooks.
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

function headerSignature(req: NextApiRequest): string {
  const h = req.headers["x-razorpay-signature"];
  if (typeof h === "string") return h.trim();
  if (Array.isArray(h) && h[0]) return String(h[0]).trim();
  return "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[razorpay/webhook] Missing RAZORPAY_WEBHOOK_SECRET");
    return res.status(503).json({ error: "Webhook secret not configured" });
  }

  let raw: Buffer;
  try {
    raw = await readRawBody(req);
  } catch (e) {
    console.error("[razorpay/webhook] body read", e);
    return res.status(400).end();
  }

  const sig = headerSignature(req);
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");

  let signatureOk = false;
  try {
    signatureOk =
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    signatureOk = false;
  }

  if (!signatureOk) {
    console.warn("[razorpay/webhook] Invalid signature");
    return res.status(400).json({ error: "Invalid signature" });
  }

  let body: { event?: string; payload?: unknown };
  try {
    body = JSON.parse(raw.toString("utf8")) as { event?: string; payload?: unknown };
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  try {
    await reconcileRazorpayPaymentFromWebhook(body);
  } catch (reconcileErr) {
    console.error("[razorpay/webhook] reconcile", reconcileErr);
  }

  res.status(200).json({ ok: true });
}
