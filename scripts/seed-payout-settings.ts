import prisma from "../src/lib/prisma";
import { PAYOUT_SETTINGS_ID, PAYOUT_SETTINGS_DEFAULTS } from "../src/lib/payoutSettings";

async function main() {
  const d = PAYOUT_SETTINGS_DEFAULTS;
  const row = await prisma.payoutSettings.upsert({
    where: { id: PAYOUT_SETTINGS_ID },
    update: {}, // preserve admin edits on re-run
    create: {
      id: PAYOUT_SETTINGS_ID,
      rate_12_paise: d.rate12,
      rate_8_paise: d.rate8,
      rate_4_paise: d.rate4,
      rate_1_paise: d.rate1,
      gst_percent: d.gstPercent,
      default_studio_cut_percent: d.defaultStudioCutPercent,
    },
  });
  console.log("payout_settings ready:", row.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
