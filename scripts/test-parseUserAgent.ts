import assert from "node:assert/strict";
import { parseUserAgent } from "../src/lib/parseUserAgent";

assert.equal(
  parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"),
  "iPhone · Safari",
);
assert.equal(
  parseUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36"),
  "Android · Chrome",
);
assert.equal(
  parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
  "Windows · Chrome",
);
assert.equal(
  parseUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"),
  "Mac · Safari",
);
assert.equal(
  parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0"),
  "Windows · Edge",
);
assert.equal(parseUserAgent(null), "Unknown");
assert.equal(parseUserAgent(""), "Unknown");
console.log("parseUserAgent: all assertions passed");