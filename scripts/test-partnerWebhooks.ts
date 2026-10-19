import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import dns from "node:dns";
import { isPublicAddress, postWebhook, signWebhook, webhookUrlProblem } from "../src/lib/partnerWebhooks";

async function main() {
  // Private / special ranges are refused; public ones allowed.
  for (const ip of [
    "127.0.0.1", "10.1.2.3", "172.31.255.255", "192.168.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:169.254.169.254", "64:ff9b::a9fe:a9fe", "not-an-ip",
  ]) assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of ["8.8.8.8", "1.1.1.1", "13.235.22.94", "2606:4700:4700::1111"]) assert.equal(isPublicAddress(ip), true, ip);

  assert.equal(webhookUrlProblem("https://hooks.example.com/cc?x=1"), null);
  for (const bad of [
    "http://hooks.example.com", "https://user:pw@hooks.example.com", "https://127.0.0.1/x", "https://[::1]/x",
    "https://169.254.169.254/latest/meta-data", "https://localhost/x", "https://db.internal/x", "ftp://x", "nope", 42,
  ]) assert.notEqual(webhookUrlProblem(bad), null, String(bad));

  const sig = signWebhook("whsec_test", '{"a":1}', 1700000000);
  const expected = createHmac("sha256", "whsec_test").update('1700000000.{"a":1}').digest("hex");
  assert.equal(sig, `t=1700000000,v1=${expected}`);

  // A public-looking hostname that resolves to a private IP is refused at connect time (DNS rebinding guard).
  const realLookup = dns.lookup;
  (dns as { lookup: unknown }).lookup = (_h: string, _o: unknown, cb: (e: null, a: dns.LookupAddress[]) => void) =>
    cb(null, [{ address: "169.254.169.254", family: 4 }]);
  try {
    const r = await postWebhook("https://hooks.example.com/x", "s", { id: "x", type: "ping" });
    assert.equal(r.ok, false);
    assert.match(r.error ?? "", /non-public/);
  } finally {
    (dns as { lookup: unknown }).lookup = realLookup;
  }

  console.log("partnerWebhooks: all assertions passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
