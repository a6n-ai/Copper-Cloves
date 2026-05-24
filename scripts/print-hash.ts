import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
async function main() {
  const prisma = (await import("../src/lib/prisma")).default;
  const email = process.argv[2] ?? "nidsglen5@gmail.com";
  const rows = await prisma.profile.findMany({ where: { email }, select: { full_name: true, role: true, hashedPassword: true } });
  for (const r of rows) console.log(`${r.full_name ?? "(no name)"} | role=${r.role}\nhash: ${r.hashedPassword ?? "(none)"}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
