import { memo } from "react";
import { Coffee,ReceiptText, ShoppingBag, Wallet, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { FilterDateRange } from "@/components/filters/FilterDateRange";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { MetricCard } from "@/components/admin/MetricCard";
import { percentDelta } from "@/lib/classReport";
import type { CafeReport, PaymentChannel } from "@/lib/cafeReport";
import { fmtPct, fmtRange, percentLabel, plural } from "@/components/admin/class-report/format";
import { isObj, useReport } from "@/components/admin/class-report/useClassReport";
import { useReportRange } from "@/components/admin/class-report/useReportRange";
import { CafeMonthlyChart } from "./CafeMonthlyChart";

function isCafeReport(b: unknown): b is CafeReport {
  return (
    isObj(b) &&
    isObj(b.range) &&
    isObj(b.current) &&
    isObj(b.previous) &&
    isObj(b.attach) &&
    isObj(b.methods) &&
    isObj(b.cancellations) &&
    Array.isArray(b.monthly) &&
    Array.isArray(b.topItems)
  );
}

const CARD = "border-sage/20 bg-white-warm shadow-none";
const TITLE = "font-body font-semibold text-xl text-charcoal";
const DESC = "font-body text-charcoal/70";
const HEAD = "px-4 text-[11px] font-semibold tracking-wider text-muted-foreground";
const NUM = "font-body text-sm tabular-nums text-right";
const TOP_ITEMS = 10;

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrExact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const rupees = (paise: number) => inr.format(paise / 100);

const CHANNELS: { key: PaymentChannel; label: string; bar: string }[] = [
  { key: "online", label: "Online (Razorpay)", bar: "bg-sage" },
  { key: "credit", label: "Food credit", bar: "bg-sage/50" },
  { key: "counter", label: "Counter, collected at studio", bar: "bg-terracotta" },
];

function Stat({ label, value, hint }: Readonly<{ label: string; value: string; hint?: string }>) {
  return (
    <div className="space-y-0.5">
      <dt className="font-body text-xs text-charcoal/70">{label}</dt>
      <dd className="font-body text-xl font-semibold tabular-nums text-charcoal">{value}</dd>
      {hint && <p className="font-body text-xs text-charcoal/60">{hint}</p>}
    </div>
  );
}

function CafeTabImpl() {
  const { picked, onRangeChange, from, to, isDefault } = useReportRange();
  const { data, error, loading, retry } = useReport("cafe-report", isCafeReport, from, to);

  const firstLoad = loading && !data;
  const dim = `transition-opacity duration-200 motion-reduce:transition-none ${loading && data ? "opacity-60" : ""}`;
  const cur = data?.current;
  const prev = data?.previous;
  const flat = "shadow-none";
  const aov = cur && cur.orders > 0 ? Math.round(cur.netPaise / cur.orders / 100) : null;
  const prevAov = prev && prev.orders > 0 ? Math.round(prev.netPaise / prev.orders / 100) : null;
  const isEmpty = !!data && cur?.orders === 0 && data.cancellations.lines === 0;
  const methodTotal = data ? data.methods.online + data.methods.credit + data.methods.counter : 0;
  const canc = data?.cancellations;
  const needsAttention = (canc?.pending ?? 0) + (canc?.failed ?? 0);
  const topItems = data?.topItems.slice(0, TOP_ITEMS) ?? [];

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <FilterDateRange
          value={isDefault ? undefined : picked}
          onChange={onRangeChange}
          placeholder="Last 30 days"
          allTimeLabel="Reset to 30 days"
          className="w-full sm:w-[260px] text-charcoal"
        />
        {data && (
          <p className={`font-body text-xs text-charcoal/70 tabular-nums ${dim}`}>
            Showing {fmtRange(data.range.from, data.range.to)}, compared with {fmtRange(data.range.prevFrom, data.range.prevTo)}
          </p>
        )}
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/10 shadow-none">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p role="alert" className="font-body text-sm font-medium text-charcoal">{error}</p>
            <Button variant="outline" size="sm" onClick={retry} disabled={loading} className="font-body w-full sm:w-auto">
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      <div className={`space-y-6 ${dim}`} aria-busy={loading}>
        {(data || !error) && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <MetricCard
              label="Collected income"
              value={Math.round((cur?.collectedPaise ?? 0) / 100)}
              prefix="₹"
              icon={IndianRupee}
              tone="sage"
              loading={firstLoad}
              className={`${flat} col-span-2 md:col-span-1`}
              hint={percentLabel(cur && prev ? percentDelta(cur.collectedPaise, prev.collectedPaise) : null)}
              description="Net of discounts, for café orders paid online or with food credit. Cancelled orders excluded."
            />
            <MetricCard
              label="Orders"
              value={cur?.orders ?? 0}
              icon={ReceiptText}
              tone="sage"
              loading={firstLoad}
              className={flat}
              hint={percentLabel(cur && prev ? percentDelta(cur.orders, prev.orders) : null)}
              description="Checkouts placed, counting one per basket. Cancelled lines excluded."
            />
            <MetricCard
              label="Average order"
              value={aov ?? "—"}
              prefix={aov === null ? undefined : "₹"}
              icon={Coffee}
              tone="sage"
              loading={firstLoad}
              className={flat}
              hint={percentLabel(aov !== null && prevAov !== null ? percentDelta(aov, prevAov) : null)}
              description="Net value of all non-cancelled orders, including counter, divided by orders."
            />
            <MetricCard
              label="Items sold"
              value={cur?.items ?? 0}
              icon={ShoppingBag}
              tone="sage"
              loading={firstLoad}
              className={flat}
              hint={percentLabel(cur && prev ? percentDelta(cur.items, prev.items) : null)}
              description="Units across non-cancelled orders."
            />
            <MetricCard
              label="Food credit used"
              value={Math.round((cur?.creditUsedPaise ?? 0) / 100)}
              prefix="₹"
              icon={Wallet}
              tone="terracotta"
              loading={firstLoad}
              className={flat}
              hint={percentLabel(cur && prev ? percentDelta(cur.creditUsedPaise, prev.creditUsedPaise) : null)}
              description="Wallet credit spent at checkout."
            />
          </div>
        )}

        {firstLoad && <Skeleton className="h-[420px] w-full rounded-xl bg-sage/10" />}

        {isEmpty && (
          <Card className={CARD}>
            <CardContent className="py-12 text-center">
              <p className="font-body text-base text-charcoal">No café orders in this range.</p>
              <p className="font-body text-sm text-charcoal/70 mt-1">Pick a wider range to see café income.</p>
            </CardContent>
          </Card>
        )}

        {data && cur && canc && (
          <>
            <Card className={`${CARD} min-w-0`}>
              <CardHeader>
                <CardTitle role="heading" aria-level={2} className={TITLE}>Monthly income</CardTitle>
                <CardDescription className={DESC}>
                  Collected income for the 12 months to the end of the range. Not tied to the range start.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CafeMonthlyChart monthly={data.monthly} />
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className={`${CARD} min-w-0`}>
                <CardHeader>
                  <CardTitle role="heading" aria-level={2} className={TITLE}>How people paid</CardTitle>
                  <CardDescription className={DESC}>
                    Counter orders are paid at the studio, so they are shown apart from collected income.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {CHANNELS.map((c) => {
                    const v = data.methods[c.key];
                    const pct = methodTotal > 0 ? (v / methodTotal) * 100 : 0;
                    return (
                      <div key={c.key} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-3 font-body text-sm text-charcoal">
                          <span>{c.label}</span>
                          <span className="tabular-nums">
                            {rupees(v)} <span className="text-charcoal/60">({fmtPct(pct)})</span>
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-sand">
                          <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <p className="font-body text-xs text-charcoal/70 pt-1">
                    Counter orders, collected at studio: {rupees(cur.counterPaise)}
                  </p>
                </CardContent>
              </Card>

              <Card className={`${CARD} min-w-0`}>
                <CardHeader>
                  <CardTitle role="heading" aria-level={2} className={TITLE}>Café with class</CardTitle>
                  <CardDescription className={DESC}>
                    Confirmed bookings in the range that also ordered from the café.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-body text-4xl font-semibold tabular-nums text-charcoal">{fmtPct(data.attach.rate)}</p>
                  <p className="font-body text-sm text-charcoal/70 mt-1 tabular-nums">
                    {data.attach.withCafe} of {plural(data.attach.bookings, "confirmed booking")}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className={`${CARD} min-w-0 lg:col-span-2`}>
                <CardHeader>
                  <CardTitle role="heading" aria-level={2} className={TITLE}>Top items</CardTitle>
                  <CardDescription className={DESC}>By net value, counting every payment method</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveTable>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className={HEAD}>Item</TableHead>
                          <TableHead className={`${HEAD} text-right`}>Qty</TableHead>
                          <TableHead className={`${HEAD} text-right`}>Net</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topItems.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="font-body text-sm text-charcoal/70 text-center py-8">
                              No items sold in this range.
                            </TableCell>
                          </TableRow>
                        )}
                        {topItems.map((i) => (
                          <TableRow key={i.name}>
                            <TableCell className="font-body text-sm text-charcoal">{i.name}</TableCell>
                            <TableCell className={NUM}>{i.quantity}</TableCell>
                            <TableCell className={NUM}>{inrExact.format(i.netPaise / 100)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ResponsiveTable>
                </CardContent>
              </Card>

              <Card className={`${CARD} min-w-0`}>
                <CardHeader>
                  <CardTitle role="heading" aria-level={2} className={`${TITLE} flex flex-wrap items-center gap-2`}>
                    Cancellations
                    {canc.failed > 0 && <Pill tone="danger" noIcon className="font-body">{canc.failed} failed</Pill>}
                    {canc.pending > 0 && <Pill tone="warning" noIcon className="font-body">{canc.pending} pending</Pill>}
                  </CardTitle>
                  <CardDescription className={DESC}>
                    {needsAttention > 0
                      ? `${plural(needsAttention, "refund")} need attention.`
                      : "Orders cancelled in this range."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                    <Stat label="Value cancelled" value={rupees(canc.valuePaise)} hint={plural(canc.lines, "line")} />
                    <Stat label="Refunded to Razorpay" value={rupees(canc.refunded.paise)} hint={plural(canc.refunded.lines, "line")} />
                    <Stat label="Credited to wallet" value={rupees(canc.credited.paise)} hint={plural(canc.credited.lines, "line")} />
                    <Stat label="No refund due" value={String(canc.none)} hint="Nothing was paid" />
                  </dl>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export const CafeTab = memo(CafeTabImpl);
