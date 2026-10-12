import { memo, useState, type KeyboardEvent } from "react";
import { emptyTotals, rates, type ClassReport, type Totals } from "@/lib/classReport";
import { fmtPct, plural } from "./format";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EMPTY = emptyTotals();
const LEGEND_STEPS = [0, 25, 50, 75, 100];
const MOVES: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

function hourLabel(h: number): string {
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${h < 12 ? "AM" : "PM"}`;
}

// Stops at 85% sage: charcoal text is 5:1 there and drops under AA on full sage.
function shade(utilization: number): string {
  const sage = Math.round(8 + Math.min(100, utilization) * 0.77);
  return `color-mix(in srgb, var(--color-sage) ${sage}%, var(--color-white-warm))`;
}

function detail(totals: Totals): string {
  if (totals.sessions === 0) return "no sessions";
  return `${fmtPct(rates(totals).utilization)} full, ${totals.signups} of ${totals.seatsOffered} seats, ${plural(totals.sessions, "session")}`;
}

function ClassHeatmapImpl({ heatmap }: Readonly<{ heatmap: ClassReport["heatmap"] }>) {
  const [current, setCurrent] = useState<[number, number] | null>(null);

  if (heatmap.hours.length === 0) {
    return <p className="font-body text-sm text-charcoal/70 py-10 text-center">No sessions in this range.</p>;
  }

  const [curRow, curCol] = current ?? [0, 0];
  const tabRow = Math.min(curRow, heatmap.hours.length - 1);
  const totalsAt = (row: number, col: number) => heatmap.cells[`${heatmap.hours[row]}-${col}`] ?? EMPTY;

  const onKeyDown = (e: KeyboardEvent<HTMLTableCellElement>, row: number, col: number) => {
    const move = MOVES[e.key];
    if (!move) return;
    e.preventDefault();
    const nextRow = Math.min(heatmap.hours.length - 1, Math.max(0, row + move[0]));
    const nextCol = Math.min(DAYS.length - 1, Math.max(0, col + move[1]));
    e.currentTarget
      .closest("table")
      ?.querySelector<HTMLElement>(`[data-cell="${nextRow}-${nextCol}"]`)
      ?.focus();
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        {/* One tab stop, arrow keys inside: a grid of 70 tabbable cells would bury everything after it. */}
        <table role="grid" className="w-full min-w-[26rem] table-fixed border-separate border-spacing-1 font-body">
          <caption className="sr-only">
            How full classes run by weekday and start time, India time. Arrow keys move between time slots.
          </caption>
          <thead>
            <tr>
              <td className="sticky left-0 z-10 w-14 bg-white-warm" />
              {DAYS.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className="pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-charcoal/70"
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.hours.map((hour, row) => (
              <tr key={hour}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white-warm pr-2 text-right text-[11px] font-normal text-charcoal/70 whitespace-nowrap"
                >
                  {hourLabel(hour)}
                </th>
                {DAYS.map((day, col) => {
                  const totals = totalsAt(row, col);
                  const utilization = rates(totals).utilization;
                  const hasSessions = totals.sessions > 0;
                  const isCurrent = current !== null && row === tabRow && col === curCol;
                  return (
                    <td
                      key={day}
                      data-cell={`${row}-${col}`}
                      tabIndex={row === tabRow && col === curCol ? 0 : -1}
                      onFocus={() => setCurrent([row, col])}
                      onPointerEnter={() => setCurrent([row, col])}
                      onClick={() => setCurrent([row, col])}
                      onKeyDown={(e) => onKeyDown(e, row, col)}
                      className={`h-11 md:h-10 rounded-md text-center text-xs font-medium tabular-nums text-charcoal cursor-default ring-offset-white-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 ${
                        isCurrent ? "ring-1 ring-charcoal/40 ring-offset-1" : ""
                      }`}
                      style={hasSessions ? { backgroundColor: shade(utilization ?? 0) } : undefined}
                    >
                      {hasSessions ? (
                        <>
                          {fmtPct(utilization)}
                          <span className="sr-only">
                            {" "}
                            full, {totals.signups} of {totals.seatsOffered} seats, {plural(totals.sessions, "session")}
                          </span>
                        </>
                      ) : (
                        <>
                          <span aria-hidden className="text-charcoal/40">·</span>
                          <span className="sr-only">No sessions</span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Hidden from screen readers: each cell already carries the same numbers. */}
        <p aria-hidden className="font-body text-xs text-charcoal/70 tabular-nums">
          {current
            ? `${DAYS[curCol]} ${hourLabel(heatmap.hours[tabRow])}: ${detail(totalsAt(tabRow, curCol))}`
            : "Point at or tap a slot to see seats and sessions."}
        </p>
        <div aria-hidden className="flex items-center gap-2">
          <span className="font-body text-[11px] text-charcoal/70 tabular-nums">0%</span>
          {LEGEND_STEPS.map((p) => (
            <div key={p} className="h-3 w-5 rounded-sm" style={{ backgroundColor: shade(p) }} />
          ))}
          <span className="font-body text-[11px] text-charcoal/70 tabular-nums">100% full</span>
        </div>
      </div>
    </div>
  );
}

export const ClassHeatmap = memo(ClassHeatmapImpl);
