import assert from "node:assert/strict";
import { baseUsername } from "../src/lib/auth/username";

assert.equal(baseUsername("Priya  Sharma", "x@y.com"), "priya.sharma");
assert.equal(baseUsername("José Núñez", "x@y.com"), "jose.nunez");
assert.equal(baseUsername("priya@gmail.com", "priya@gmail.com"), "priya", "email-as-name must not leak domain");
assert.equal(baseUsername("", "ab@y.com"), "member");
assert.equal(baseUsername("A", "rahul_k99@y.com"), "rahul.k99");
assert.equal(baseUsername(null, "रवि@y.com"), "member", "non-latin falls back");
assert.ok(/^[a-z0-9_.]{3,30}$/.test(baseUsername("x".repeat(80), "a@b.c")));
console.log("username ok");
process.exit(0);
