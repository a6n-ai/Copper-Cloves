/**
 * Issue / list / revoke partner API keys.
 *   tsx scripts/partner-api-key.ts create <partner-slug> <key-name>
 *   tsx scripts/partner-api-key.ts list <partner-slug>
 *   tsx scripts/partner-api-key.ts revoke <key-id>
 * The plaintext key is printed ONCE on create; only its sha256 is stored.
 */
import prisma from "../src/lib/prisma";
import { generatePartnerKey, hashPartnerKey } from "../src/lib/partnerAuth";

async function partnerBySlug(slug: string | undefined) {
  if (!slug) throw new Error("partner slug required");
  const p = await prisma.partner.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!p) throw new Error(`no partner with slug "${slug}"`);
  return p;
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2);

  if (cmd === "create") {
    const partner = await partnerBySlug(a);
    if (!b) throw new Error("key name required");
    const key = generatePartnerKey();
    const row = await prisma.partnerApiKey.create({
      data: { partner_id: partner.id, name: b, prefix: key.slice(0, 12), key_hash: hashPartnerKey(key) },
    });
    console.log(`Created key ${row.id} for ${partner.name}. Copy it now, it is not shown again:\n\n${key}\n`);
  } else if (cmd === "list") {
    const partner = await partnerBySlug(a);
    const rows = await prisma.partnerApiKey.findMany({
      where: { partner_id: partner.id },
      orderBy: { created_at: "desc" },
      select: { id: true, name: true, prefix: true, created_at: true, last_used_at: true, revoked_at: true },
    });
    console.table(rows);
  } else if (cmd === "revoke") {
    if (!a) throw new Error("key id required");
    await prisma.partnerApiKey.update({ where: { id: a }, data: { revoked_at: new Date() } });
    console.log(`Revoked ${a}`);
  } else {
    throw new Error("usage: create <slug> <name> | list <slug> | revoke <key-id>");
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit();
  });
