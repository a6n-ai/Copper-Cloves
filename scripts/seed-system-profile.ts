/**
 * Ensures the single system "Studio" profile exists (is_system = true).
 * Studio-funded expense debit rows (rent, supplies, vendor costs, and payouts
 * to instructors without a login) point Payment.user_id at this profile so
 * user_id is never null. role "admin" + is_system keep it out of member lists.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const SYSTEM_EMAIL = "system@thestudio.internal";

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;

  const existing = await prisma.profile.findFirst({ where: { is_system: true } });
  if (existing) {
    console.log(`System profile already exists: ${existing.id} (${existing.email})`);
    await prisma.$disconnect();
    process.exit(0);
  }

  // Plain create — the is_system guard above already established there is none,
  // and @@unique([email, role]) no longer exists to upsert on.
  const created = await prisma.profile.create({
    data: {
      email: SYSTEM_EMAIL,
      full_name: "The Studio (system)",
      role: "admin",
      is_system: true,
    },
  });

  console.log(`System profile ready: ${created.id} (${created.email})`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
