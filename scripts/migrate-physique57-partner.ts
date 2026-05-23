/**
 * One-time migration: turn "Physique 57" into a Partner.
 * - Creates the Partner row.
 * - Creates a partner-manager login (Profile role="partner") scoped to it.
 * - Tags the existing "57" classes (Barre 57, Mat 57, FIT 57, …) with partner_id.
 *
 * Idempotent — safe to re-run.
 *   npx tsx scripts/migrate-physique57-partner.ts
 */
import prisma from "../src/lib/prisma";
import bcrypt from "bcryptjs";

const PARTNER_NAME = "Physique 57";
const PARTNER_SLUG = "physique57";
const MANAGER_EMAIL = "physique57@thestudiobycopperandcloves.in";
const MANAGER_PASSWORD = "physique57";

async function main() {
  // 1. Partner
  const partner = await prisma.partner.upsert({
    where: { slug: PARTNER_SLUG },
    update: { name: PARTNER_NAME, is_active: true },
    create: { name: PARTNER_NAME, slug: PARTNER_SLUG, is_active: true },
  });
  console.log("Partner:", partner.id, partner.name);

  // 2. Manager login (Profile with role "partner") linked via PartnerMember
  const hashed = await bcrypt.hash(MANAGER_PASSWORD, 12);
  const profile = await prisma.profile.upsert({
    where: { email_role: { email: MANAGER_EMAIL, role: "partner" } },
    update: {},
    create: {
      email: MANAGER_EMAIL,
      full_name: "Physique 57 Manager",
      hashedPassword: hashed,
      role: "partner",
      onboarding_completed: true,
    },
  });
  await prisma.partnerMember.upsert({
    where: { partner_id_profile_id: { partner_id: partner.id, profile_id: profile.id } },
    update: { role: "manager" },
    create: { partner_id: partner.id, profile_id: profile.id, role: "manager" },
  });
  console.log("Manager:", MANAGER_EMAIL, "/", MANAGER_PASSWORD, "→ linked to partner");

  // 3. Tag the "57" classes
  const classes = await prisma.classModel.findMany({ select: { id: true, name: true } });
  const p57 = classes.filter((c) => /57/.test(c.name));
  if (p57.length) {
    await prisma.classModel.updateMany({
      where: { id: { in: p57.map((c) => c.id) } },
      data: { partner_id: partner.id },
    });
  }
  console.log("Tagged classes:", p57.map((c) => c.name).join(", ") || "(none)");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
