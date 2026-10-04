/**
 * Backfill: give every User without a username one, derived from their Profile
 * full_name (fallback: User.name, then "member" + digits). Never from email or phone.
 *
 * Idempotent — only touches rows where username IS NULL. Dry run by default;
 * pass --apply to write.
 *
 * Run: npx tsx scripts/backfill-usernames.ts [--apply]
 */
import { config } from "dotenv";
import { resolve } from "node:path";

// .env.local is loaded with override, so an explicit prod tunnel URL must win after it.
const tunnel = process.env.PROD_TUNNEL_DATABASE_URL;
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
if (tunnel) process.env.STUDIO_DATABASE_URL = process.env.DATABASE_URL = tunnel;

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = (await import("../src/lib/prisma")).default;
  const { generateUniqueUsername } = await import("../src/lib/auth/username");

  const users = await prisma.user.findMany({
    where: { username: null },
    select: { id: true, name: true, profile: { select: { full_name: true } } },
    orderBy: { createdAt: "asc" },
  });
  console.log(`${users.length} user(s) without a username. ${apply ? "APPLYING" : "DRY RUN"}`);

  // Dry run can't rely on the DB for collisions between rows it hasn't written.
  const planned = new Set<string>();
  let done = 0;
  for (const u of users) {
    let username = await generateUniqueUsername(u.profile?.full_name || u.name);
    while (planned.has(username)) username = await generateUniqueUsername(`${username} x`);
    planned.add(username);
    if (apply) {
      await prisma.user.update({ where: { id: u.id }, data: { username, displayUsername: username } });
    }
    done++;
    if (done <= 15) console.log(`  ${u.id.slice(0, 8)}  ->  @${username}`);
  }
  console.log(`${apply ? "Assigned" : "Would assign"} ${done} username(s).`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
