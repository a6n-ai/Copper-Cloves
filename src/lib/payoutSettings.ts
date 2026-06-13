import prisma from "@/lib/prisma";

/** Resolved global payout settings (numbers, paise + percent). */
export interface ResolvedPayoutSettings {
  rate12: number; // paise
  rate8: number;
  rate4: number;
  rate1: number;
  gstPercent: number;
  defaultStudioCutPercent: number;
}

/** Code-level fallback used only if the singleton row is missing (matches seed). */
export const PAYOUT_SETTINGS_DEFAULTS: ResolvedPayoutSettings = {
  rate12: 850000,
  rate8: 601500,
  rate4: 317500,
  rate1: 83500,
  gstPercent: 5,
  defaultStudioCutPercent: 40,
};

export const PAYOUT_SETTINGS_ID = "default";

/** Load the singleton settings row, falling back to defaults if absent. */
export async function getPayoutSettings(): Promise<ResolvedPayoutSettings> {
  const row = await prisma.payoutSettings.findUnique({ where: { id: PAYOUT_SETTINGS_ID } });
  if (!row) return { ...PAYOUT_SETTINGS_DEFAULTS };
  return {
    rate12: row.rate_12_paise,
    rate8: row.rate_8_paise,
    rate4: row.rate_4_paise,
    rate1: row.rate_1_paise,
    gstPercent: Number(row.gst_percent),
    defaultStudioCutPercent: Number(row.default_studio_cut_percent),
  };
}
