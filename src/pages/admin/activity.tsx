import { useMemo, useState } from "react";
import { requireSessionSSP } from "@/lib/requireSessionSSP";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActivityLogList } from "@/components/activity/ActivityLogList";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });

const CATEGORIES = ["auth", "member", "admin", "instructor", "partner", "system"] as const;
const ROLES = ["user", "instructor", "partner", "admin"] as const;

export default function AdminActivityPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("");
  const [role, setRole] = useState<string>("");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (category) p.set("category", category);
    if (role) p.set("role", role);
    return p.toString();
  }, [q, category, role]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Activity Log" subtitle="Every major action across the platform" />

      <Card className="border-sage/20 bg-white-warm">
        <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="font-body text-xs text-charcoal/60 mb-1 block">Search name / email</label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
          </div>
          <div className="w-full sm:w-44">
            <label className="font-body text-xs text-charcoal/60 mb-1 block">Category</label>
            <Select value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-44">
            <label className="font-body text-xs text-charcoal/60 mb-1 block">Role</label>
            <Select value={role || "all"} onValueChange={(v) => setRole(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-sage/20 bg-white-warm">
        <CardContent className="p-4">
          <ActivityLogList endpoint="/api/admin/activity-log" query={query} emptyLabel="No matching activity." />
        </CardContent>
      </Card>
    </div>
  );
}
