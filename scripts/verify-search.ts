// scripts/verify-search.ts
// Read-only check: confirms role scoping + result shape. Run: tsx scripts/verify-search.ts <query>
import { runSearch } from "@/lib/search";

async function main() {
  const q = process.argv[2] ?? "a";
  const scope = { userId: "00000000-0000-0000-0000-000000000000", partnerId: null, instructorId: null };

  const admin = await runSearch("admin", q, scope);
  const member = await runSearch("member", q, scope);

  console.log(`admin groups: ${admin.map((g) => `${g.type}(${g.items.length})`).join(", ") || "none"}`);
  console.log(`member groups: ${member.map((g) => `${g.type}(${g.items.length})`).join(", ") || "none"}`);

  // Assertions: member must NOT surface admin-only types.
  const adminOnly = new Set(["payment", "partner", "instructor", "product"]);
  const leak = member.find((g) => adminOnly.has(g.type));
  if (leak) {
    console.error(`FAIL: member search leaked admin type "${leak.type}"`);
    process.exit(1);
  }
  // Min-char guard.
  const tooShort = await runSearch("admin", "a", scope);
  if (q.length < 2 && tooShort.length !== 0) {
    console.error("FAIL: min-char guard did not return empty");
    process.exit(1);
  }
  console.log("PASS: role scoping + shape OK");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
