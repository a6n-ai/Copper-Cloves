import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
async function main() {
  const prisma = (await import("../src/lib/prisma")).default;
  const email = process.argv[2] ?? "nidsglen5@gmail.com";
  const rows = await prisma.profile.findMany({
    where: { email },
    select: { id: true, full_name: true, email: true, role: true, user_id: true, created_at: true },
  });
  console.log(`Lookup: ${email}`);
  if (rows.length === 0) console.log("NO profile found");
  for (const r of rows) {
    // Passwords live on the credential Account now, keyed by identity.
    const hasPassword = r.user_id
      ? (await prisma.account.count({
          where: { userId: r.user_id, providerId: "credential", password: { not: null } },
        })) > 0
      : false;
    console.log(`- ${r.full_name ?? "(no name)"} | role=${r.role} | hasPassword=${hasPassword} | created=${r.created_at.toISOString()} | id=${r.id}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
