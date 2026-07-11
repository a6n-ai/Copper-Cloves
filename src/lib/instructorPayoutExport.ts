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
  granularity: string;
  key: string;
  periodStart: string | null;
  periodEnd: string | null;
  lineItems: PayoutLineItem[];
  footer: PayoutFooter;
};

export type MonthBucket = { monthKey: string; label: string; items: PayoutLineItem[] };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * paise -> rupees. Derived values (perClass, withoutGst) are deliberately NOT passed through
 * here — Usha.xlsx shows them unrounded (708.3333333) and so do we.
 */
const rupees = (paise: number): number => Math.round(paise) / 100;

function monthKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabelOf(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Class times render in the STUDIO'S timezone, pinned to Asia/Kolkata.
 *
 * `.llm/Usha.xlsx` stores 0.7708333 for the evening class — 18:30, i.e. IST. A 7pm IST class
 * is persisted as `…T13:30:00Z`, so getUTCHours would print "13:30" and every time in the
 * workbook would be 5h30m adrift. The machine's local zone is not a safe substitute either:
 * the export runs in the admin's browser, which may be anywhere. Every other display path in
 * this codebase pins the zone the same way (`fmtIstDateTime` in class-schedules.ts,
 * adminDashboardSections.ts) — India has no DST, so the mapping is unambiguous.
 */
const IST_TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Kolkata",
});

function hhmm(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return IST_TIME.format(d);
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
    ["PERIOD ADJUSTMENT", d.key],
    ["Computed units", computedUnitsAcrossMonths],
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
    : rupees(monthUnits * f.blendedRatePaise);

  // total Count, in the Count column only — mirrors Usha.xlsx row 22.
  rows.push([null, null, null, null, null, null]);
  rows.push([null, null, null, null, null, monthUnits]);
  rows.push([null, null, null, null, null, null]);

  rows.push(["Classes", "Rate", "Per class rate", "without GST", `${f.instructorPct}% of class fee`]);
  rows.push(...rateCardRows(f));

  rows.push([null, null, null, "Average", rupees(f.averageNetPaise)]);
  // In a multi-month export EVERY sheet holds one month's subtotal — including the last, whose
  // TOTAL row is still just that month. Labelling any of them "TOTAL" makes a sheet read in
  // isolation (printed, forwarded, opened on its own tab) misrepresent itself as the instructor's
  // final pay. The period figure is emitted once, below, on the last sheet.
  const totalLabel = opts.useFooterTotals ? "TOTAL" : "Month subtotal";
  rows.push([
    null, null, null,
    "Weighted average", rupees(f.blendedRatePaise),
    totalLabel, totalRupees,
  ]);

  // The Count column sums line items; TOTAL reflects footer.payableUnits, which also carries
  // extra_payable_units and any override. Whenever those differ, the sheet must say why —
  // otherwise it shows money for 3 units above a visible count of 2 and nothing explains it.
  // This applies to a single-bucket period too, where useFooterTotals is always true.
  const adjusted =
    f.extraPayableUnits !== 0 || f.overridePayoutPaise != null || f.status === "paid";
  if (opts.isLastBucket && adjusted) {
    rows.push(...adjustmentBlock(detail, opts.computedUnitsAcrossMonths));
  } else if (opts.isLastBucket && !opts.useFooterTotals) {
    // Multi-month, no adjustment: the months are subtotals, so the period total must still land
    // somewhere or the workbook never states what the instructor is actually owed.
    rows.push([null, null, null, null, null, null]);
    rows.push(["PERIOD TOTAL", rupees(f.totalPaise)]);
  }

  return rows;
}

/**
 * Build and download one workbook, sheets keyed on (instructor, calendar month).
 *
 * `xlsx` is ~600KB raw / ~150KB gzip and is pulled in dynamically here — a top-level import
 * would ship it to every admin page. Same pattern as `src/lib/financeReportExport.ts`.
 */
export async function downloadInstructorPayoutExcel(
  details: PayoutDetail[],
  filenameStem: string,
): Promise<void> {
  if (typeof window === "undefined") return;
  if (details.length === 0) return;

  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const names = sheetNamesFor(details);

  details.forEach((detail, di) => {
    const buckets = splitByMonth(detail);

    if (buckets.length === 0) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([["No classes in this period"]]),
        names[di][0],
      );
      return;
    }

    const computedUnitsAcrossMonths = buckets.reduce(
      (a, b) => a + b.items.reduce((s, it) => s + it.count, 0),
      0,
    );

    buckets.forEach((bucket, bi) => {
      const rows = buildPayoutSheet(detail, bucket, {
        useFooterTotals: buckets.length === 1,
        computedUnitsAcrossMonths,
        isLastBucket: bi === buckets.length - 1,
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), names[di][bi]);
    });
  });

  const safeStem = filenameStem.replace(/[^\w.-]+/g, "_").slice(0, 80);
  const datePart = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${safeStem}_${datePart}.xlsx`);
}

/**
 * Fetch one detail response per instructor, at most 4 in flight.
 *
 * Results are re-ordered to match `instructorIds` so the workbook's sheet order is the
 * admin's selection order, not whichever request happened to finish first.
 *
 * A failed instructor is dropped rather than thrown: one 500 must not cost the admin
 * the other nine sheets. `onProgress` fires once per settled request, success or not.
 */
export async function fetchPayoutDetails(
  instructorIds: string[],
  periodQuery: string,
  onProgress: (done: number, total: number) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<PayoutDetail[]> {
  const total = instructorIds.length;
  const results: (PayoutDetail | null)[] = new Array(total).fill(null);
  let done = 0;
  let next = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= total) return;
      const id = instructorIds[i];
      try {
        const res = await fetchImpl(
          `/api/admin/instructor-payout-detail?instructorId=${encodeURIComponent(id)}&${periodQuery}`,
        );
        if (res.ok) results[i] = (await res.json()) as PayoutDetail;
      } catch {
        // swallow: a dropped instructor is better than a dropped workbook
      } finally {
        done++;
        onProgress(done, total);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(4, total) }, worker));
  return results.filter(Boolean) as PayoutDetail[];
}
