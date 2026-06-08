import { useMemo, useState } from "react";
import { startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { requireSessionSSP } from "@/lib/requireSessionSSP";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { ActivityLogList } from "@/components/activity/ActivityLogList";
import { ActivityInsights } from "@/components/activity/ActivityInsights";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });

const CATEGORIES = ["auth", "member", "admin", "instructor", "partner", "system"] as const;
const ROLES = ["user", "instructor", "partner", "admin"] as const;

export default function AdminActivityPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [range, setRange] = useState<DateRange | undefined>();

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (category) p.set("category", category);
    if (role) p.set("role", role);
    if (range?.from) p.set("from", startOfDay(range.from).toISOString());
    if (range?.to) p.set("to", endOfDay(range.to).toISOString());
    return p.toString();
  }, [q, category, role, range]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-linear-to-br from-cream via-cream to-sage/10">
      <main className="min-h-screen overflow-x-hidden">
        <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8 min-w-0">
          <AdminPageHeader title="Activity Log" subtitle="Every major action across the platform" />

          <ActivityInsights />

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="font-display text-2xl text-charcoal">Activity</CardTitle>
                  <CardDescription className="font-body text-charcoal/60">
                    Searchable log of every recorded action
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name, email, action…"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center border-b border-sage/10 pb-4">
                <div className="w-full sm:w-44">
                  <Select value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-44">
                  <Select value={role || "all"} onValueChange={(v) => setRole(v === "all" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="All roles" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-56">
                  <DateRangeFilter value={range} onChange={setRange} />
                </div>
              </div>
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
