/**
 * Builds the studio's hand-made payout workbook layout (see `.llm/Usha.xlsx`) from the
 * response of /api/admin/instructor-payout-detail.
 *
 * Sheets are keyed on (instructor, calendar month) — Usha.xlsx has a May sheet and an April
 * sheet, so a single-month period yields exactly one sheet per instructor.
 *
 * All monetary values in the API response are PAISE. The workbook shows RUPEES, because the
 * source file does. Conversion happens here and nowhere earlier.
 */

export type CellValue = string | number | Date | null;

export type PayoutLineItem = {
  scheduleId: string;
  date: string;
  startTime: string;
  endTime: string | null;
  className: string;
  member: string;
  membershipType: string;
  count: number;
  checkedIn: boolean;
  isPlaceholder: boolean;
};

export type PayoutFooter = {
  gstPercent: number;
  instructorPct: number;
  rateCard: { rate12: number; rate8: number; rate4: number; rate1: number };
  netBreakdown: { net12: number; net8: number; net4: number; net1: number };
  averageNetPaise: number;
  autoBlendedRatePaise: number;
  overrideBlendedRatePaise: number | null;
  blendedRatePaise: number;
  payableUnits: number;
  computedPayableUnits: number;
  extraPayableUnits: number;
  totalPaise: number;
  overridePayoutPaise: number | null;
  status: "paid" | "pending";
  paidAt: string | null;
};

export type PayoutDetail = {
  instructor: {
    id: string;
    name: string;
    imageUrl: string | null;
    specialties: string[];
    studioCutPercent: number;
    rateOverride: Record<string, number | null>;
  };
  window: string;
  periodKey: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  lineItems: PayoutLineItem[];
  footer: PayoutFooter;
};

export type MonthBucket = { monthKey: string; label: string; items: PayoutLineItem[] };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** paise -> rupees, rounded to 2dp for display. */
const rupees = (paise: number): number => Math.round(paise) / 100;
/** paise -> rupees with 2dp, for derived values that are not whole paise. */
const rupees2 = (v: number): number => Math.round(v) / 100;

function monthKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabelOf(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Class times render in the STUDIO'S LOCAL timezone, not UTC.
 *
 * `.llm/Usha.xlsx` stores 0.7708333 for the evening class — 18:30, i.e. IST — and
 * InstructorPayoutLedger.tsx renders the same field with date-fns `format(…, "HH:mm")`,
 * which is also local. Using getUTCHours here would print 13:00 for that class and every
 * time in the workbook would be 5h30m adrift from what the admin sees on screen.
 *
 * `npm run test:payout-export` pins TZ so this cannot silently pass on a UTC CI box.
 */
function hhmm(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Split one instructor's line items into ascending calendar-month buckets. */
export function splitByMonth(detail: PayoutDetail): MonthBucket[] {
  const map = new Map<string, MonthBucket>();
  for (const it of detail.lineItems) {
    const key = monthKeyOf(it.date);
    let b = map.get(key);
    if (!b) {
      b = { monthKey: key, label: monthLabelOf(it.date), items: [] };
      map.set(key, b);
    }
    b.items.push(it);
  }
  return [...map.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

// Excel forbids these in a sheet name and caps the name at 31 chars. Duplicate names
// silently OVERWRITE one another, so two instructors called "Priya" must be disambiguated.
const FORBIDDEN = /[:\\/?*[\]]/g;

function sanitize(name: string): string {
  return name.replace(FORBIDDEN, "").trim().slice(0, 31) || "Sheet";
}

/**
 * One sheet name per (instructor, bucket), parallel to `details`.
 * A single-bucket instructor gets a bare name; several buckets get " — Mon YYYY".
 */
export function sheetNamesFor(details: PayoutDetail[]): string[][] {
  const used = new Set<string>();
  const claim = (base: string): string => {
    const n = sanitize(base);
    if (!used.has(n)) {
      used.add(n);
      return n;
    }
    for (let i = 2; ; i++) {
      const suffix = ` (${i})`;
      const candidate = sanitize(base).slice(0, 31 - suffix.length) + suffix;
      if (!used.has(candidate)) {
        used.add(candidate);
        return candidate;
      }
    }
  };

  return details.map((d) => {
    const buckets = splitByMonth(d);
    if (buckets.length <= 1) return [claim(d.instructor.name)];
    return buckets.map((b) => claim(`${d.instructor.name} — ${b.label}`));
  });
}

function rateCardRows(f: PayoutFooter): CellValue[][] {
  const tiers: [number, number, number][] = [
    [12, f.rateCard.rate12, f.netBreakdown.net12],
    [8, f.rateCard.rate8, f.netBreakdown.net8],
    [4, f.rateCard.rate4, f.netBreakdown.net4],
    [1, f.rateCard.rate1, f.netBreakdown.net1],
  ];
  return tiers.map(([n, ratePaise, netPaise]) => {
    const rate = rupees(ratePaise);
    const perClass = rate / n;
    const withoutGst = perClass / (1 + f.gstPercent / 100);
    return [n, rate, perClass, withoutGst, rupees(netPaise)];
  });
}

function adjustmentBlock(d: PayoutDetail, computedUnitsAcrossMonths: number): CellValue[][] {
  const f = d.footer;
  const rows: CellValue[][] = [
    [null, null, null, null, null, null],
    ["PERIOD ADJUSTMENT", d.periodKey ?? d.window],
    ["Computed units across months", computedUnitsAcrossMonths],
    ["Extra payable units", f.extraPayableUnits],
    ["Blended rate", rupees(f.blendedRatePaise)],
  ];
  if (f.overridePayoutPaise != null) {
    rows.push(["Override payout", rupees(f.overridePayoutPaise)]);
  }
  rows.push([
    "Status",
    f.status === "paid"
      ? `Paid${f.paidAt ? " " + new Date(f.paidAt).toISOString().slice(0, 10) : ""}`
      : "Pending",
  ]);
  rows.push(["PERIOD TOTAL", rupees(f.totalPaise)]);
  return rows;
}

/**
 * One month of one instructor's ledger, in the Usha layout.
 *
 * `useFooterTotals` is true only when the bucket IS the whole requested period. The footer
 * describes the period, so copying it onto each of several month sheets would print the
 * combined total N times.
 */
export function buildPayoutSheet(
  detail: PayoutDetail,
  bucket: MonthBucket,
  opts: { useFooterTotals: boolean; computedUnitsAcrossMonths: number; isLastBucket: boolean },
): CellValue[][] {
  const f = detail.footer;
  const rows: CellValue[][] = [
    ["Class Name", "Date", "Start Time", "End Time", "Member Name", "Count"],
  ];

  for (const it of bucket.items) {
    rows.push([
      it.className,
      new Date(it.date),
      hhmm(it.startTime),
      hhmm(it.endTime),
      it.member,
      it.count,
    ]);
  }

  const monthUnits = bucket.items.reduce((a, it) => a + it.count, 0);
  const totalRupees = opts.useFooterTotals
    ? rupees(f.totalPaise)
    : rupees2(monthUnits * f.blendedRatePaise);

  // total Count, in the Count column only — mirrors Usha.xlsx row 22.
  rows.push([null, null, null, null, null, null]);
  rows.push([null, null, null, null, null, monthUnits]);
  rows.push([null, null, null, null, null, null]);

  rows.push(["Classes", "Rate", "Per class rate", "without GST", `${f.instructorPct}% of class fee`]);
  rows.push(...rateCardRows(f));

  rows.push([null, null, null, "Average", rupees(f.averageNetPaise)]);
  rows.push([
    null, null, null,
    "Weighted average", rupees(f.blendedRatePaise),
    "TOTAL", totalRupees,
  ]);

  const adjusted =
    f.extraPayableUnits !== 0 || f.overridePayoutPaise != null || f.status === "paid";
  if (!opts.useFooterTotals && opts.isLastBucket && adjusted) {
    rows.push(...adjustmentBlock(detail, opts.computedUnitsAcrossMonths));
  }

  return rows;
}
