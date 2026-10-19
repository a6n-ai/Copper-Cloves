import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePartner } from "@/lib/partnerAuth";
import { pingPayload, postWebhook } from "@/lib/partnerWebhooks";

/** Sends a signed `ping` to the configured URL right now and reports what came back. Not queued or retried. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const auth = await requirePartner(req, res);
  if (!auth) return;

  const hook = await prisma.partnerWebhook.findUnique({
    where: { partner_id: auth.partnerId },
    select: { url: true, secret: true },
  });
  if (!hook) return res.status(404).json({ error: "No webhook configured" });

  const payload = pingPayload();
  const r = await postWebhook(hook.url, hook.secret, payload);
  return res.json({ deliveryId: payload.id, ok: r.ok, responseStatus: r.status, error: r.error, durationMs: r.durationMs });
}
