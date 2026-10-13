import { format, parseISO } from "date-fns";

// Brand sage is 2.9:1 on white-warm and reads too close to terracotta for colour-blind
// viewers, so thin marks (lines, sparklines) use sage deepened with charcoal.
export const SAGE_DEEP = "color-mix(in srgb, var(--color-sage) 50%, var(--color-charcoal))";

export function fmtPct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v)}%`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

// Arrow + words, never color alone: for no-show rate "up" is bad, so color would mislead.
function changeLabel(d: number | null, unit: string): string | undefined {
  if (d === null) return undefined;
  const n = Math.abs(Math.round(d));
  if (n === 0) return "No change vs previous";
  return `${d > 0 ? "▲" : "▼"} ${n}${unit} vs previous`;
}

export const pointsLabel = (d: number | null) => changeLabel(d, " pts");
export const percentLabel = (d: number | null) => changeLabel(d, "%");

/** "2026-10-05" → "5 Oct" */
export function fmtBucket(bucket: string): string {
  return format(parseISO(bucket), "d MMM");
}

/** ("2026-09-13", "2026-10-12") → "13 Sep – 12 Oct 2026" */
export function fmtRange(from: string, to: string): string {
  const start = parseISO(from);
  const end = parseISO(to);
  if (from === to) return format(end, "d MMM yyyy");
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${format(start, sameYear ? "d MMM" : "d MMM yyyy")} – ${format(end, "d MMM yyyy")}`;
}

/** The report groups sessions either by class or by who taught them; only the wording and query differ. */
export const REPORT_KINDS = {
  class: { one: "class", many: "classes", title: "Classes", listQuery: "", idParam: "classId" },
  instructor: { one: "instructor", many: "instructors", title: "Instructors", listQuery: "groupBy=instructor", idParam: "instructorId" },
} as const;
export type ReportKind = keyof typeof REPORT_KINDS;
