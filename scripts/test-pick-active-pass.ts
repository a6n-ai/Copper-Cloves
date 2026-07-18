import assert from "node:assert";
import { pickActivePass } from "../src/lib/pickActivePass";

const d = (iso: string) => new Date(iso);

// Finite preferred over unlimited, soonest-expiry finite wins.
assert.equal(
  pickActivePass([
    { credits_remaining: null, expiration_date: d("2026-01-01"), id: "unlim" },
    { credits_remaining: 5, expiration_date: d("2026-12-01"), id: "far" },
    { credits_remaining: 1, expiration_date: d("2026-07-20"), id: "daypass" },
  ])?.id,
  "daypass",
  "should spend the soonest-expiring finite pass first",
);

// Only an unlimited pass available → use it (no decrement happens downstream).
assert.equal(
  pickActivePass([{ credits_remaining: null, expiration_date: d("2026-01-01"), id: "unlim" }])?.id,
  "unlim",
);

// No usable pass → null (caller throws NO_PASS).
assert.equal(pickActivePass([]), null);

console.log("pickActivePass: all assertions passed");
