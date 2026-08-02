import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { hashPassword as scryptHash } from "better-auth/crypto";
import { studioPassword, describeHash, packMultiHash } from "../src/lib/auth/password";

async function main() {
  const PLAIN = "correct-horse-battery";

  // Production has BOTH cost tiers: bcrypt(10)=128 rows, bcrypt(12)=474 rows.
  for (const cost of [10, 12]) {
    const hash = await bcrypt.hash(PLAIN, cost);
    assert.equal(await studioPassword.verify({ hash, password: PLAIN }), true, `bcrypt(${cost}) accepts correct password`);
    assert.equal(await studioPassword.verify({ hash, password: "wrong" }), false, `bcrypt(${cost}) rejects wrong password`);
  }

  const scrypt = await scryptHash(PLAIN);
  assert.equal(await studioPassword.verify({ hash: scrypt, password: PLAIN }), true, "scrypt accepts correct password");
  assert.equal(await studioPassword.verify({ hash: scrypt, password: "wrong" }), false, "scrypt rejects wrong password");

  // New passwords must be scrypt, never bcrypt.
  const fresh = await studioPassword.hash(PLAIN);
  assert.equal(describeHash(fresh), "scrypt", "new hashes are scrypt");
  assert.equal(await studioPassword.verify({ hash: fresh, password: PLAIN }), true, "round-trips its own output");

  // Multi-hash: the merged instructor+user identity keeps BOTH passwords working.
  const PLAIN_A = "instructor-side-password";
  const PLAIN_B = "member-side-password";
  const multi = packMultiHash([await bcrypt.hash(PLAIN_A, 10), await bcrypt.hash(PLAIN_B, 12)]);
  assert.equal(await studioPassword.verify({ hash: multi, password: PLAIN_A }), true, "multi accepts the first password");
  assert.equal(await studioPassword.verify({ hash: multi, password: PLAIN_B }), true, "multi accepts the second password");
  assert.equal(await studioPassword.verify({ hash: multi, password: "neither" }), false, "multi rejects a wrong password");

  // Mixed formats and a corrupt member must not break the survivors.
  const mixed = packMultiHash([await scryptHash(PLAIN_A), "garbage", await bcrypt.hash(PLAIN_B, 12)]);
  assert.equal(await studioPassword.verify({ hash: mixed, password: PLAIN_A }), true, "multi handles scrypt members");
  assert.equal(await studioPassword.verify({ hash: mixed, password: PLAIN_B }), true, "one corrupt member does not poison the rest");
  assert.equal(await studioPassword.verify({ hash: mixed, password: "neither" }), false, "mixed multi still rejects wrong passwords");

  // A single-entry pack must behave exactly like a bare hash.
  assert.equal(packMultiHash([await bcrypt.hash(PLAIN, 12)]).startsWith("multi:"), false, "single hash is not wrapped");
  // Duplicates collapse — the collision account may share one password across both rows.
  const dupe = await bcrypt.hash(PLAIN, 12);
  assert.equal(packMultiHash([dupe, dupe]), dupe, "identical hashes collapse to one");

  // Fail CLOSED on anything unreadable — never throw, never accept.
  for (const bad of ["", "not-a-hash", "$2a$12$truncated", "deadbeef:notscrypt", "multi:", "multi:garbage|junk"]) {
    assert.equal(await studioPassword.verify({ hash: bad, password: PLAIN }), false, `rejects malformed hash: ${JSON.stringify(bad)}`);
  }

  assert.equal(describeHash(""), "empty");
  assert.equal(describeHash("$2b$10$abcdefghijklmnopqrstuv"), "bcrypt");
  assert.equal(describeHash("zzz"), "unrecognised");
  assert.equal(describeHash(multi), "multi(2)");

  console.log("test-auth-password: all assertions passed");
  process.exit(0);
}

main();
