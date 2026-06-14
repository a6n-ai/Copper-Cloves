import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { PAYOUT_SETTINGS_ID, PAYOUT_SETTINGS_DEFAULTS } from "@/lib/payoutSettings";
import { PAYABLE_BASES, type PayableBasis } from "@/lib/payoutCalc";

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const adminId = (session.user as { id?: string }).id ?? null;

  if (req.method === "GET") {
    const row = await prisma.payoutSettings.findUnique({ where: { id: PAYOUT_SETTINGS_ID } });
    if (!row) {
      return res.json({
        settings: {
          rate_12_paise: PAYOUT_SETTINGS_DEFAULTS.rate12,
          rate_8_paise: PAYOUT_SETTINGS_DEFAULTS.rate8,
          rate_4_paise: PAYOUT_SETTINGS_DEFAULTS.rate4,
          rate_1_paise: PAYOUT_SETTINGS_DEFAULTS.rate1,
          gst_percent: PAYOUT_SETTINGS_DEFAULTS.gstPercent,
          default_studio_cut_percent: PAYOUT_SETTINGS_DEFAULTS.defaultStudioCutPercent,
          payable_basis: PAYOUT_SETTINGS_DEFAULTS.payableBasis,
        },
        seeded: false,
      });
    }
    return res.json({ settings: row, seeded: true });
  }

  if (req.method === "PUT") {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const rate12 = num(b.rate_12_paise);
    const rate8 = num(b.rate_8_paise);
    const rate4 = num(b.rate_4_paise);
    const rate1 = num(b.rate_1_paise);
    const gst = num(b.gst_percent);
    const cut = num(b.default_studio_cut_percent);
    if ([rate12, rate8, rate4, rate1].some((v) => v == null || v < 0)) {
      return res.status(400).json({ error: "All four package rates are required (paise, >= 0)" });
    }
    if (gst == null || gst < 0 || gst > 100) return res.status(400).json({ error: "gst_percent 0–100" });
    if (cut == null || cut < 0 || cut > 100)
      return res.status(400).json({ error: "default_studio_cut_percent 0–100" });

    const basisRaw = typeof b.payable_basis === "string" ? b.payable_basis : "all_booked";
    if (!PAYABLE_BASES.includes(basisRaw as PayableBasis)) {
      return res.status(400).json({ error: "payable_basis invalid" });
    }

    const data = {
      rate_12_paise: Math.round(rate12),
      rate_8_paise: Math.round(rate8),
      rate_4_paise: Math.round(rate4),
      rate_1_paise: Math.round(rate1),
      gst_percent: gst,
      default_studio_cut_percent: cut,
      payable_basis: basisRaw,
      updated_by: adminId,
    };
    const row = await prisma.payoutSettings.upsert({
      where: { id: PAYOUT_SETTINGS_ID },
      create: { id: PAYOUT_SETTINGS_ID, ...data },
      update: data,
    });
    return res.json({ settings: row });
  }

  return res.status(405).end();
}
