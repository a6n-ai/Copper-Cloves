import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getRazorpay, razorpayConfigured } from "@/lib/razorpayServer";
import logger from "@/lib/logger";

const PAGE_SIZE = 100;
const MAX_PAGES = 100; // safety cap → up to 10k payments / month

type RzpPayment = {
  id: string;
  order_id: string | null;
  amount: number;
  amount_refunded?: number;
  currency?: string;
  status: string;
  method?: string | null;
  description?: string | null;
  email?: string | null;
  contact?: string | null;
  notes?: Record<string, string> | unknown[];
  created_at: number; // unix seconds
};

export type ReconMatch =
  | "matched"
  | "amount_mismatch"
  | "status_mismatch"
  | "missing_from_website"
  | "website_only"
  | "external";

export type ReconRow = {
  paymentId: string;
  orderId: string | null;
  createdAtISO: string;
  amountPaise: number;
  amountRefundedPaise: number;
  method: string | null;
  razorpayStatus: string | null;
  websiteStatus: string | null;
  source: "website" | "external" | "unknown";
  match: ReconMatch;
  email: string | null;
  contact: string | null;
  description: string | null;
  notes: string;
};

// Razorpay returns `[]` for empty notes and an object when present.
function notesToString(notes: RzpPayment["notes"]): { str: string; hasWebsiteKeys: boolean } {
  if (!notes || Array.isArray(notes)) return { str: "", hasWebsiteKeys: false };
  const obj = notes;
  const hasWebsiteKeys = "purpose" in obj || "user_id" in obj;
  const str = Object.entries(obj)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return { str, hasWebsiteKeys };
}

// captured ≈ succeeded for cross-status comparison.
function normalizeStatus(s: string | null | undefined): string {
  const v = (s ?? "").toLowerCase();
  if (v === "captured" || v === "succeeded") return "paid";
  return v;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  if (!razorpayConfigured()) {
    return res.status(400).json({ error: "Razorpay is not configured on the server." });
  }

  const monthRaw = typeof req.query.month === "string" ? req.query.month : "";
  const m = /^(\d{4})-(\d{2})$/.exec(monthRaw.trim());
  if (!m) return res.status(400).json({ error: "month must be YYYY-MM" });
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, month, 1, 0, 0, 0, 0);
  const from = Math.floor(monthStart.getTime() / 1000);
  const to = Math.floor(monthEnd.getTime() / 1000) - 1;

  try {
    const razorpay = getRazorpay();

    // 1. Pull every Razorpay payment in the window (paginated).
    const rzpPayments: RzpPayment[] = [];
    let partial = false;
    for (let page = 0; page < MAX_PAGES; page++) {
      const resp = (await razorpay.payments.all({
        from,
        to,
        count: PAGE_SIZE,
        skip: page * PAGE_SIZE,
      })) as unknown as { items?: RzpPayment[] };
      const items = Array.isArray(resp.items) ? resp.items : [];
      rzpPayments.push(...items);
      if (items.length < PAGE_SIZE) break;
      if (page === MAX_PAGES - 1) partial = true;
    }

    const paymentIds = rzpPayments.map((p) => p.id);
    const orderIds = Array.from(new Set(rzpPayments.map((p) => p.order_id).filter(Boolean)));

    // 2. Website-side rows for the month + any referenced by the gateway payments.
    const [dbPayments, dbOrders] = await Promise.all([
      prisma.razorpayPayment.findMany({
        where: {
          OR: [
            { razorpay_payment_id: { in: paymentIds.length ? paymentIds : ["__none__"] } },
            { created_at: { gte: monthStart, lt: monthEnd } },
          ],
        },
        select: {
          razorpay_payment_id: true,
          razorpay_order_id: true,
          amount_paise: true,
          status: true,
          method: true,
        },
      }),
      prisma.razorpayOrder.findMany({
        where: { razorpay_order_id: { in: orderIds.length ? orderIds : ["__none__"] } },
        select: { razorpay_order_id: true },
      }),
    ]);

    const dbByPaymentId = new Map(dbPayments.map((d) => [d.razorpay_payment_id, d]));
    const websiteOrderIds = new Set(dbOrders.map((o) => o.razorpay_order_id));
    const seenInRazorpay = new Set(paymentIds);

    const rows: ReconRow[] = [];

    // 3. Classify each Razorpay payment.
    for (const p of rzpPayments) {
      const db = dbByPaymentId.get(p.id);
      const { str: notesStr, hasWebsiteKeys } = notesToString(p.notes);
      const isWebsite = !!db || (p.order_id != null && websiteOrderIds.has(p.order_id)) || hasWebsiteKeys;

      let match: ReconMatch;
      let source: ReconRow["source"];
      if (db) {
        source = "website";
        if (db.amount_paise != null && db.amount_paise !== p.amount) match = "amount_mismatch";
        else if (normalizeStatus(p.status) !== normalizeStatus(db.status)) match = "status_mismatch";
        else match = "matched";
      } else if (isWebsite) {
        source = "website";
        match = "missing_from_website"; // captured at gateway, never persisted by the site
      } else {
        source = "external"; // Payment Page (meal subscription, etc.)
        match = "external";
      }

      rows.push({
        paymentId: p.id,
        orderId: p.order_id ?? null,
        createdAtISO: new Date(p.created_at * 1000).toISOString(),
        amountPaise: p.amount,
        amountRefundedPaise: p.amount_refunded ?? 0,
        method: p.method ?? null,
        razorpayStatus: p.status,
        websiteStatus: db?.status ?? null,
        source,
        match,
        email: p.email ?? null,
        contact: p.contact ?? null,
        description: p.description ?? null,
        notes: notesStr,
      });
    }

    // 4. Website rows that the gateway window didn't return → website-only.
    for (const d of dbPayments) {
      if (seenInRazorpay.has(d.razorpay_payment_id)) continue;
      rows.push({
        paymentId: d.razorpay_payment_id,
        orderId: d.razorpay_order_id ?? null,
        createdAtISO: monthStart.toISOString(),
        amountPaise: d.amount_paise ?? 0,
        amountRefundedPaise: 0,
        method: d.method ?? null,
        razorpayStatus: null,
        websiteStatus: d.status,
        source: "website",
        match: "website_only",
        email: null,
        contact: null,
        description: null,
        notes: "",
      });
    }

    rows.sort((a, b) => {
      if (a.createdAtISO < b.createdAtISO) return 1;
      if (a.createdAtISO > b.createdAtISO) return -1;
      return 0;
    });

    // 5. Summary.
    const counts: Record<ReconMatch, number> = {
      matched: 0,
      amount_mismatch: 0,
      status_mismatch: 0,
      missing_from_website: 0,
      website_only: 0,
      external: 0,
    };
    let razorpayCapturedPaise = 0;
    let websiteRecordedPaise = 0;
    for (const r of rows) {
      counts[r.match] += 1;
      if (normalizeStatus(r.razorpayStatus) === "paid") razorpayCapturedPaise += r.amountPaise;
      if (r.websiteStatus && normalizeStatus(r.websiteStatus) === "paid") websiteRecordedPaise += r.amountPaise;
    }

    return res.json({
      month: monthRaw,
      partial,
      rows,
      summary: {
        total: rows.length,
        counts,
        razorpayCapturedPaise,
        websiteRecordedPaise,
        gapPaise: razorpayCapturedPaise - websiteRecordedPaise,
      },
    });
  } catch (e) {
    logger.error({ err: e }, "[finance/razorpay-reconcile]");
    const msg = e instanceof Error && e.message === "RAZORPAY_MISSING_CONFIG"
      ? "Razorpay is not configured on the server."
      : "Failed to pull Razorpay payments.";
    return res.status(502).json({ error: msg });
  }
}
