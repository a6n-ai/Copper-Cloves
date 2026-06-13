import assert from "node:assert";
import { canonicalPair } from "@/lib/friendship";

assert.deepStrictEqual(canonicalPair("b", "a"), { a: "a", b: "b" }, "sorts pair");
assert.deepStrictEqual(canonicalPair("a", "b"), { a: "a", b: "b" }, "already sorted");
assert.strictEqual(canonicalPair("x", "x"), null, "self → null");
assert.strictEqual(canonicalPair("", "y"), null, "empty → null");
console.log("canonicalPair OK");
process.exit(0);
