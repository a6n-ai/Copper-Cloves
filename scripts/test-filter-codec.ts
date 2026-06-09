// scripts/test-filter-codec.ts
import { format } from "date-fns";
import {
  stringCodec,
  dateRangeCodec,
  serializeFilters,
  deserializeFilters,
} from "../src/components/filters/urlFilterCodec";

let failures = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.error(`FAIL ${label}\n  expected ${e}\n  actual   ${a}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

const codecs = {
  search: stringCodec("search", ""),
  status: stringCodec("status", "all"),
  range: dateRangeCodec("from", "to"),
};
const defaults = { search: "", status: "all", range: undefined as any };

eq("strip defaults", serializeFilters({ search: "", status: "all", range: undefined }, codecs), {});

eq(
  "serialize values",
  serializeFilters({ search: "amy", status: "active", range: undefined }, codecs),
  { search: "amy", status: "active" },
);

const range = { from: new Date(2026, 0, 5), to: new Date(2026, 0, 9) };
eq("serialize range", serializeFilters({ search: "", status: "all", range }, codecs), {
  from: "2026-01-05",
  to: "2026-01-09",
});

const back = deserializeFilters({ search: "amy", status: "active", from: "2026-01-05", to: "2026-01-09" }, codecs, defaults);
eq("deserialize search", back.search, "amy");
eq("deserialize status", back.status, "active");
eq("deserialize range from", format((back.range as any).from, "yyyy-MM-dd"), "2026-01-05");
eq("deserialize range to", format((back.range as any).to, "yyyy-MM-dd"), "2026-01-09");

const empty = deserializeFilters({}, codecs, defaults);
eq("empty → default status", empty.status, "all");
eq("empty → default range", empty.range, undefined);

if (failures) {
  console.error(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("\nall codec assertions passed");
process.exit(0);
