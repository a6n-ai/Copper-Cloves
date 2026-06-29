import { useMemo } from "react";
import { startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { requireSessionSSP } from "@/lib/requireSessionSSP";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityLogList } from "@/components/activity/ActivityLogList";
import { ActivityInsights } from "@/components/activity/ActivityInsights";
import {
  FilterBar,
  FilterSearch,
  FilterSelect,
  FilterDateRange,
  useFilterState,
  dateRangeCodec,
} from "@/components/filters";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });

const CATEGORIES = ["auth", "member", "admin", "instructor", "partner", "system"] as const;
const ROLES = ["user", "instructor", "partner", "admin"] as const;

export default function AdminActivityPage() {
  const f = useFilterState(
    { search: "", category: "all", role: "all", range: undefined as DateRange | undefined },
    { urlSync: true, codecs: { range: dateRangeCodec("from", "to") } },
  );

  const query = useMemo(() => {
    const { search, category, role, range } = f.values;
    const p = new URLSearchParams();
    if (search.trim()) p.set("q", search.trim());
    if (category && category !== "all") p.set("category", category);
    if (role && role !== "all") p.set("role", role);
    if (range?.from) p.set("from", startOfDay(range.from).toISOString());
    if (range?.to) p.set("to", endOfDay(range.to).toISOString());
    return p.toString();
  }, [f.values]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-linear-to-br from-cream via-cream to-sage/10">
      <main className="min-h-screen overflow-x-hidden">
        <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8 min-w-0">
          <AdminPageHeader title="Activity Log" subtitle="Every major action across the platform" />

          <ActivityInsights />

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader className="space-y-4">
              <div className="space-y-1">
                <CardTitle className="font-body font-semibold text-2xl text-charcoal">Activity</CardTitle>
                <CardDescription className="font-body text-charcoal/60">
                  Searchable log of every recorded action
                </CardDescription>
              </div>
              <FilterBar reset={f.isActive ? f.reset : undefined}>
                <FilterSearch
                  value={f.values.search}
                  onChange={(v) => f.set("search", v)}
                  placeholder="Search name, email, action…"
                  aria-label="Search activity"
                />
                <FilterSelect
                  value={f.values.category}
                  onChange={(v) => f.set("category", v)}
                  options={[
                    { value: "all", label: "All categories" },
                    ...CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
                  ]}
                  placeholder="All categories"
                  className="w-full sm:w-44"
                />
                <FilterSelect
                  value={f.values.role}
                  onChange={(v) => f.set("role", v)}
                  options={[
                    { value: "all", label: "All roles" },
                    ...ROLES.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) })),
                  ]}
                  placeholder="All roles"
                  className="w-full sm:w-44"
                />
                <FilterDateRange
                  value={f.values.range}
                  onChange={(v) => f.set("range", v)}
                  className="w-full sm:w-56"
                />
              </FilterBar>
            </CardHeader>
            <CardContent>
              <ActivityLogList endpoint="/api/admin/activity-log" query={query} emptyLabel="No matching activity." />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
