import assert from "node:assert/strict";
import {
  splitByMonth,
  buildPayoutSheet,
  sheetNamesFor,
  fetchPayoutDetails,
  type PayoutDetail,
} from "../src/lib/instructorPayoutExport";

// ── fixture ───────────────────────────────────────────────────────────────────
function item(dateISO: string, over: Partial<PayoutDetail["lineItems"][0]> = {}) {
  return {
    scheduleId: "s-" + dateISO,
    date: dateISO,
    startTime: dateISO,
    endTime: new Date(new Date(dateISO).getTime() + 3600_000).toISOString(),
    className: "WARRIOR Strength",
    member: "Alina Sheriff",
    membershipType: "12-class",
    count: 1,
    checkedIn: true,
    isPlaceholder: false,
    ...over,
  };
}

function detail(over: Partial<PayoutDetail> = {}): PayoutDetail {
  return {
    instructor: {
      id: "i1", name: "Usha", imageUrl: null, specialties: [],
      studioCutPercent: 40,
      rateOverride: { rate_12_paise: null, rate_8_paise: null, rate_4_paise: null, rate_1_paise: null },
    },
    window: "month",
    periodKey: "2026-05",
    periodStart: "2026-05-01T00:00:00.000Z",
    periodEnd: "2026-06-01T00:00:00.000Z",
    lineItems: [item("2026-05-02T13:00:00.000Z"), item("2026-05-09T13:00:00.000Z")],
    footer: {
      gstPercent: 5,
      instructorPct: 60,
      rateCard: { rate12: 850000, rate8: 601500, rate4: 317500, rate1: 83500 },
      netBreakdown: { net12: 40476, net8: 42964, net4: 45357, net1: 47714 },
      averageNetPaise: 44128,
      autoBlendedRatePaise: 44128,
      overrideBlendedRatePaise: null,
      blendedRatePaise: 46500,
      payableUnits: 2,
      computedPayableUnits: 2,
      extraPayableUnits: 0,
      totalPaise: 93000,
      overridePayoutPaise: null,
      status: "pending",
      paidAt: null,
    },
    ...over,
  };
}

// ── splitByMonth ──────────────────────────────────────────────────────────────
{
  const b = splitByMonth(detail());
  assert.equal(b.length, 1, "single month -> one bucket");
  assert.equal(b[0].monthKey, "2026-05");
  assert.equal(b[0].items.length, 2);
}
{
  // Q3-style: items in three calendar months, ascending, correctly bucketed.
  const d = detail({
    window: "quarter", periodKey: "2026-Q3",
    lineItems: [
      item("2026-09-02T13:00:00.000Z"),
      item("2026-07-02T13:00:00.000Z"),
      item("2026-08-02T13:00:00.000Z"),
      item("2026-07-20T13:00:00.000Z"),
    ],
  });
  const b = splitByMonth(d);
  assert.deepEqual(b.map((x) => x.monthKey), ["2026-07", "2026-08", "2026-09"], "ascending");
  assert.deepEqual(b.map((x) => x.items.length), [2, 1, 1]);
}
{
  assert.deepEqual(splitByMonth(detail({ lineItems: [] })), [], "no items -> no buckets");
}

// ── sheetNamesFor ─────────────────────────────────────────────────────────────
{
  // one bucket -> bare instructor name
  assert.deepEqual(sheetNamesFor([detail()]), [["Usha"]]);
}
{
  const d = detail({
    lineItems: [item("2026-07-02T13:00:00.000Z"), item("2026-08-02T13:00:00.000Z")],
  });
  assert.deepEqual(sheetNamesFor([d]), [["Usha — Jul 2026", "Usha — Aug 2026"]]);
}
{
  // two instructors with the SAME name must not collide (Excel silently overwrites)
  const a = detail();
  const b = detail({ instructor: { ...detail().instructor, id: "i2" } });
  const names = sheetNamesFor([a, b]).flat();
  assert.equal(new Set(names).size, names.length, "names must be unique");
  assert.deepEqual(names, ["Usha", "Usha (2)"]);
}
{
  // forbidden chars stripped, 31-char cap enforced
  const d = detail({ instructor: { ...detail().instructor, name: "A/B:C\\D?E*F[G]H" } });
  const n = sheetNamesFor([d])[0][0];
  assert.ok(!/[:\\/?*\[\]]/.test(n), `no forbidden chars in ${n}`);
  const long = detail({ instructor: { ...detail().instructor, name: "X".repeat(60) } });
  assert.ok(sheetNamesFor([long])[0][0].length <= 31, "31-char cap");
}

// ── buildPayoutSheet: single bucket uses footer totals ────────────────────────
{
  const d = detail();
  const [bucket] = splitByMonth(d);
  const rows = buildPayoutSheet(d, bucket, {
    useFooterTotals: true, computedUnitsAcrossMonths: 2, isLastBucket: true,
  });

  assert.deepEqual(rows[0], ["Class Name", "Date", "Start Time", "End Time", "Member Name", "Count"]);
  assert.equal(rows[1][0], "WARRIOR Strength");
  assert.ok(rows[1][1] instanceof Date, "Date cell is a real Date");
  assert.equal(typeof rows[1][2], "string", "time is an HH:mm string");
  assert.match(rows[1][2] as string, /^\d{2}:\d{2}$/);
  assert.equal(rows[1][5], 1);

  // The Count column must sum to footer.computedPayableUnits.
  const dataRows = rows.slice(1).filter((r) => typeof r[5] === "number" && r[0] !== null);
  const sum = dataRows.reduce((a, r) => a + (r[5] as number), 0);
  assert.equal(sum, d.footer.computedPayableUnits, "Count column reconciles");

  // total-count row: only the Count column is populated
  const totalRow = rows.find((r) => r[0] === null && typeof r[5] === "number");
  assert.ok(totalRow, "total count row exists");
  assert.equal(totalRow![5], 2);

  // rate-card header, with instructorPct interpolated
  const hdr = rows.find((r) => r[0] === "Classes");
  assert.deepEqual(hdr, ["Classes", "Rate", "Per class rate", "without GST", "60% of class fee"]);

  // rate card in RUPEES, not paise
  const r12 = rows[rows.indexOf(hdr!) + 1];
  assert.equal(r12[0], 12);
  assert.equal(r12[1], 8500);            // 850000 paise -> 8500 rupees
  assert.equal(Math.round((r12[2] as number) * 100) / 100, 708.33);
  assert.equal(r12[4], 404.76);          // net12 40476 paise -> 404.76

  // Average / Weighted average / TOTAL
  const avg = rows.find((r) => r[3] === "Average");
  assert.equal(avg![4], 441.28);
  const wavg = rows.find((r) => r[3] === "Weighted average");
  assert.equal(wavg![4], 465);
  assert.equal(wavg![5], "TOTAL");
  assert.equal(wavg![6], 930);           // footer.totalPaise 93000 -> 930
}

// ── buildPayoutSheet: multi-bucket recomputes, no adjustment block ────────────
{
  const d = detail({
    window: "quarter", periodKey: "2026-Q3",
    lineItems: [item("2026-07-02T13:00:00.000Z"), item("2026-08-02T13:00:00.000Z")],
    footer: { ...detail().footer, payableUnits: 2, computedPayableUnits: 2, totalPaise: 93000 },
  });
  const buckets = splitByMonth(d);
  assert.equal(buckets.length, 2);

  const jul = buildPayoutSheet(d, buckets[0], {
    useFooterTotals: false, computedUnitsAcrossMonths: 2, isLastBucket: false,
  });
  const wavg = jul.find((r) => r[3] === "Weighted average");
  assert.equal(wavg![6], 465, "monthTotal = 1 unit x 465, NOT the period total 930");
  assert.ok(!jul.some((r) => r[0] === "PERIOD ADJUSTMENT"), "no block when footer is unadjusted");

  const aug = buildPayoutSheet(d, buckets[1], {
    useFooterTotals: false, computedUnitsAcrossMonths: 2, isLastBucket: true,
  });
  assert.ok(!aug.some((r) => r[0] === "PERIOD ADJUSTMENT"), "still none: no extras/override/paid");
}

// ── buildPayoutSheet: multi-bucket WITH adjustment -> block on LAST sheet only ─
{
  const d = detail({
    window: "quarter", periodKey: "2026-Q3",
    lineItems: [item("2026-07-02T13:00:00.000Z"), item("2026-08-02T13:00:00.000Z")],
    footer: {
      ...detail().footer,
      computedPayableUnits: 2, extraPayableUnits: 7, payableUnits: 9,
      overridePayoutPaise: 12345600, totalPaise: 12345600,
      status: "paid", paidAt: "2026-07-09T00:00:00.000Z",
    },
  });
  const buckets = splitByMonth(d);

  const jul = buildPayoutSheet(d, buckets[0], {
    useFooterTotals: false, computedUnitsAcrossMonths: 2, isLastBucket: false,
  });
  assert.ok(!jul.some((r) => r[0] === "PERIOD ADJUSTMENT"), "block NOT on a non-last sheet");

  const aug = buildPayoutSheet(d, buckets[1], {
    useFooterTotals: false, computedUnitsAcrossMonths: 2, isLastBucket: true,
  });
  const i = aug.findIndex((r) => r[0] === "PERIOD ADJUSTMENT");
  assert.ok(i > 0, "block present on last sheet");
  assert.equal(aug[i][1], "2026-Q3");
  const label = (s: string) => aug.slice(i).find((r) => r[0] === s);
  assert.equal(label("Computed units")![1], 2);
  assert.equal(label("Extra payable units")![1], 7);
  assert.equal(label("Blended rate")![1], 465);
  assert.equal(label("Override payout")![1], 123456);
  assert.equal(label("PERIOD TOTAL")![1], 123456, "period total = footer.totalPaise / 100");
  assert.match(String(label("Status")![1]), /^Paid/);
}

// ── placeholder + null endTime ────────────────────────────────────────────────
{
  const d = detail({
    lineItems: [item("2026-05-02T13:00:00.000Z", {
      member: "No attendees", isPlaceholder: true, endTime: null, membershipType: "", count: 1,
    })],
    footer: { ...detail().footer, computedPayableUnits: 1, payableUnits: 1, totalPaise: 46500 },
  });
  const rows = buildPayoutSheet(d, splitByMonth(d)[0], {
    useFooterTotals: true, computedUnitsAcrossMonths: 1, isLastBucket: true,
  });
  assert.equal(rows[1][4], "No attendees");
  assert.equal(rows[1][3], "", "null endTime renders as empty string, never 'Invalid Date'");
}

// ── times render in STUDIO-LOCAL tz, matching Usha.xlsx and the ledger UI ─────
// Usha.xlsx stores 0.7708333 (=18:30 IST) for the evening class. 13:00Z IS 18:30 IST.
// If this ever reads "13:00", someone swapped getHours() back to getUTCHours().
{
  const d = detail({
    lineItems: [item("2026-05-02T13:00:00.000Z", { endTime: "2026-05-02T13:55:00.000Z" })],
    footer: { ...detail().footer, computedPayableUnits: 1, payableUnits: 1, totalPaise: 46500 },
  });
  const rows = buildPayoutSheet(d, splitByMonth(d)[0], {
    useFooterTotals: true, computedUnitsAcrossMonths: 1, isLastBucket: true,
  });
  assert.equal(rows[1][2], "18:30", "start renders IST regardless of machine TZ");
  assert.equal(rows[1][3], "19:25", "end renders IST regardless of machine TZ");
}

// ── single bucket + adjusted -> block MUST still appear (Count != TOTAL otherwise) ────
// Reviewer-found: gating on !useFooterTotals made this unreachable, so a one-month period
// with extra units showed money for N+extra units above a visible Count of N, unexplained.
{
  const d = detail({
    footer: {
      ...detail().footer,
      computedPayableUnits: 2, extraPayableUnits: 1, payableUnits: 3,
      blendedRatePaise: 46500, totalPaise: 139500,
    },
  });
  const buckets = splitByMonth(d);
  assert.equal(buckets.length, 1, "single bucket");
  const rows = buildPayoutSheet(d, buckets[0], {
    useFooterTotals: true, computedUnitsAcrossMonths: 2, isLastBucket: true,
  });
  const countRow = rows.find((r) => r[0] === null && typeof r[5] === "number");
  assert.equal(countRow![5], 2, "Count column shows line-item units");
  const wavg = rows.find((r) => r[3] === "Weighted average");
  assert.equal(wavg![6], 1395, "TOTAL uses footer (3 units)");
  const i = rows.findIndex((r) => r[0] === "PERIOD ADJUSTMENT");
  assert.ok(i > 0, "adjustment block present on a single adjusted bucket");
  const label = (s: string) => rows.slice(i).find((r) => r[0] === s);
  assert.equal(label("Computed units")![1], 2);
  assert.equal(label("Extra payable units")![1], 1);
  assert.equal(label("PERIOD TOTAL")![1], 1395);
}

// sheetNamesFor must return exactly one name per bucket (>=1 even with no items)
{
  const empty = detail({ lineItems: [] });
  const multi = detail({ lineItems: [item("2026-07-02T13:00:00.000Z"), item("2026-08-02T13:00:00.000Z")] });
  const names = sheetNamesFor([empty, multi]);
  assert.equal(names[0].length, 1, "no items -> still one sheet name");
  assert.equal(names[1].length, splitByMonth(multi).length);
}

// ── fetchPayoutDetails: order, concurrency cap, progress ──────────────────────
async function main() {
{
  const ids = ["a", "b", "c", "d", "e", "f"];
  let inFlight = 0;
  let maxInFlight = 0;
  const seen: number[] = [];

  const fakeFetch = (async (url: string) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    // resolve in REVERSE id order so completion order != input order
    const id = new URL(url, "http://x").searchParams.get("instructorId")!;
    await new Promise((r) => setTimeout(r, (ids.length - ids.indexOf(id)) * 5));
    inFlight--;
    return {
      ok: true,
      json: async () => detail({ instructor: { ...detail().instructor, id, name: id } }),
    };
  }) as unknown as typeof fetch;

  const out = await fetchPayoutDetails(ids, "month", (done) => seen.push(done), fakeFetch);

  assert.deepEqual(out.map((d) => d.instructor.id), ids, "results ordered by input, not completion");
  assert.ok(maxInFlight <= 4, `concurrency capped at 4, saw ${maxInFlight}`);
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 6], "progress reported once per completion, monotonic");
}
{
  // a failing instructor must not abort the whole export
  const fakeFetch = (async (url: string) => {
    const id = new URL(url, "http://x").searchParams.get("instructorId")!;
    if (id === "bad") return { ok: false, json: async () => ({ error: "boom" }) };
    return { ok: true, json: async () => detail({ instructor: { ...detail().instructor, id } }) };
  }) as unknown as typeof fetch;

  const out = await fetchPayoutDetails(["good", "bad"], "month", () => {}, fakeFetch);
  assert.equal(out.length, 1, "failed fetch is dropped, not thrown");
  assert.equal(out[0].instructor.id, "good");
}

console.log("payoutExport tests passed");
process.exit(0);
}

main();
