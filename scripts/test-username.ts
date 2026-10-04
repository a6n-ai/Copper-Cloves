import assert from "node:assert/strict";
import { baseUsername, isAllowedUsername } from "../src/lib/auth/username";

assert.equal(baseUsername("Priya  Sharma"), "priya.sharma");
assert.equal(baseUsername("José Núñez"), "jose.nunez");
assert.equal(baseUsername("priya@gmail.com"), "member", "email-as-name must not leak any part of the address");
assert.equal(baseUsername(""), "member");
assert.equal(baseUsername("A"), "member");
assert.equal(baseUsername("रवि"), "member", "non-latin falls back");
assert.equal(baseUsername("Studio Admin"), "member", "reserved prefix never generated");
assert.ok(/^[a-z0-9_.]{3,30}$/.test(baseUsername("x".repeat(80))));

assert.ok(isAllowedUsername("priya.sharma"));
assert.ok(isAllowedUsername("member4821"), "generated fallback must pass the plugin validator");
for (const bad of ["admin", "Admin", "admin.priya", "studio_official", "support", "copper.cloves", "member", "has space", "émile"]) {
  assert.ok(!isAllowedUsername(bad), bad);
}
console.log("username ok");
process.exit(0);
