import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useInstructors } from "@/hooks/useInstructors";
import {
  Award,
  CheckCircle2,
  GraduationCap,
  Plus,
  Power,
  PowerOff,
  Search,
  Star,
  Users,
} from "lucide-react";
import { SEO as Seo } from "@/components/SEO";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MetricCard } from "@/components/admin/MetricCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useTableSort } from "@/components/admin/sortable-table";
import { ManageButton, DeleteButton } from "@/components/ui/quick-actions";
import { AnimatedIcon } from "@/components/dashboard/AnimatedIcon";
import { Pagination, usePagination } from "@/components/Pagination";
import {
  InstructorTable,
  type InstructorTableInstructor,
} from "@/components/admin/InstructorTable";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Instructor = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  image_url: string | null;
  specialties: string[];
  certifications: string[];
  years_of_experience: string | null;
  is_active: boolean;
};

export default function AdminInstructorsPage() {
  const router = useRouter();
  // Roster shared through SWR (one cached copy across admin pages). Optimistic
  // toggle/delete write straight to the cache via `mutateInstructors`.
  const { data, isLoading, mutate: mutateInstructors } = useInstructors<Instructor[]>();
  const instructors = useMemo(() => data ?? [], [data]);
  const loading = isLoading && !data;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", title: "", email: "", phone: "" });

  const filtered = useMemo(() => {
    let list = instructors;
    if (statusFilter !== "all") {
      const want = statusFilter === "active";
      list = list.filter((i) => i.is_active !== false === want);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((i) =>
        [i.name, i.email, i.title].some((f) => String(f ?? "").toLowerCase().includes(q)),
      );
    }
    return list;
  }, [instructors, search, statusFilter]);

  const {
    sorted,
    sortKey,
    sortDir,
    toggle: toggleSort,
  } = useTableSort<Instructor, "name" | "specialties" | "status">(filtered, {
    getValue: (row, key) => {
      switch (key) {
        case "name":
          return row.name?.toLowerCase() ?? "";
        case "specialties":
          return row.specialties?.length ?? 0;
        case "status":
          return row.is_active !== false ? 1 : 0;
        default:
          return null;
      }
    },
    defaultDirFor: (key) => (key === "name" ? "asc" : "desc"),
  });

  const pg = usePagination(sorted, 10, `${search}|${statusFilter}|${sortKey}|${sortDir}`);

  const stats = useMemo(() => {
    const active = instructors.filter((i) => i.is_active !== false).length;
    const years = instructors
      .map((i) => parseInt(i.years_of_experience ?? "") || 0)
      .filter((y) => y > 0);
    const avgYears = years.length ? Math.round(years.reduce((s, y) => s + y, 0) / years.length) : 0;
    const certifiedCount = instructors.filter((i) => (i.certifications?.length ?? 0) > 0).length;
    return {
      total: instructors.length,
      active,
      inactive: instructors.length - active,
      avgYears,
      certified: certifiedCount,
    };
  }, [instructors]);

  async function handleToggle(id: string, active: boolean) {
    const r = await fetch(`/api/admin/instructors?id=${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !active }),
    });
    if (r.ok) {
      mutateInstructors(
        (prev) => (prev ?? []).map((i) => (i.id === id ? { ...i, is_active: !active } : i)),
        { revalidate: false },
      );
      toast.success(active ? "Instructor deactivated" : "Instructor activated");
    } else {
      toast.error("Could not update status");
    }
  }

  async function handleDelete(id: string) {
    const r = await fetch(`/api/admin/instructors?id=${id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) {
      mutateInstructors((prev) => (prev ?? []).filter((i) => i.id !== id), { revalidate: false });
      toast.success("Instructor removed");
    } else {
      toast.error("Could not delete");
    }
  }

  async function handleAdd() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setAdding(true);
    try {
      const r = await fetch("/api/admin/instructors", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          title: form.title.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          specialties: [],
          certifications: [],
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const created = await r.json();
      toast.success("Instructor added — opening profile");
      setAddOpen(false);
      setForm({ name: "", title: "", email: "", phone: "" });
      router.push(`/admin/instructors/${created.id}`);
    } catch (err) {
      toast.error(`Could not add: ${(err as Error).message}`);
    } finally {
      setAdding(false);
    }
  }

  const tableInstructors: (InstructorTableInstructor & { _row: Instructor })[] = pg.pageItems.map(
    (instructor) => ({
      id: instructor.id,
      name: instructor.name,
      title: instructor.title,
      email: instructor.email,
      phone: instructor.phone,
      imageUrl: instructor.image_url,
      specialties: instructor.specialties,
      isActive: instructor.is_active,
      _row: instructor,
    }),
  );

  function renderRowActions(row: { id: string; name: string; isActive?: boolean }) {
    const active = row.isActive !== false;
    return (
      <div className="flex gap-1.5 justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleToggle(row.id, active)}
          aria-label={active ? "Deactivate instructor" : "Activate instructor"}
          title={active ? "Deactivate instructor" : "Activate instructor"}
          className={cn(
            "h-8 w-8 p-0 font-body transition-all hover:scale-110 active:scale-95",
            active
              ? "border-terracotta/40 text-terracotta bg-white-warm hover:!bg-terracotta hover:!text-cream hover:!border-terracotta"
              : "border-sage/60 text-sage bg-white-warm hover:!bg-sage hover:!text-cream hover:!border-sage",
          )}
        >
          <AnimatedIcon icon={active ? PowerOff : Power} size={14} animateOnMount={false} hover="wiggle" />
        </Button>
        <ManageButton onClick={() => router.push(`/admin/instructors/${row.id}`)} label="Open profile" />
        <DeleteButton
          onClick={() => handleDelete(row.id)}
          label="Delete instructor"
          confirmTitle={`Delete ${row.name}?`}
          confirmDescription="The instructor will be permanently removed. Past class history is preserved."
        />
      </div>
    );
  }

  return (
    <>
      <Seo title="Instructors — Admin" description="Instructor roster management" />
      <div className="min-h-screen overflow-x-hidden bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen overflow-x-hidden">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8 min-w-0">
            <AdminPageHeader
              title="Instructor Management"
              subtitle="Manage your instructor roster, profiles, and activation status"
            />

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
              <MetricCard label="Total Instructors" value={stats.total} icon={Users} tone="sage" loading={loading} />
              <MetricCard label="Active" value={stats.active} icon={CheckCircle2} tone="sage" loading={loading} hint="Visible to schedule" />
              <MetricCard label="Inactive" value={stats.inactive} icon={PowerOff} tone="terracotta" loading={loading} hint="Hidden from members" />
              <MetricCard label="Avg Experience" value={stats.avgYears} icon={Star} tone="amber" loading={loading} hint="years" />
              <MetricCard label="Certified" value={stats.certified} icon={Award} tone="sage" loading={loading} hint="Has certifications" />
            </div>

            <Card className="border-sage/20 bg-white-warm">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-display text-2xl text-charcoal">
                      Instructors <span className="font-body text-base text-charcoal/40">({filtered.length})</span>
                    </CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Click Manage to open a profile and edit details
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, email, title…"
                        className="h-9 pl-9 border-sage/20 focus:border-sage font-body"
                      />
                    </div>
                    <Button onClick={() => setAddOpen(true)} variant="sage" className="h-9 shrink-0">
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Instructor
                    </Button>
                  </div>
                </div>

                {/* Status filter chips */}
                <div className="flex items-center gap-1.5">
                  {(["all", "active", "inactive"] as const).map((opt) => {
                    const chipCounts = {
                      all: instructors.length,
                      active: stats.active,
                      inactive: stats.inactive,
                    } as const;
                    const chipLabel = `${opt[0].toUpperCase()}${opt.slice(1)} (${chipCounts[opt]})`;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setStatusFilter(opt)}
                        className={cn(
                          "rounded-full border px-3 py-1 font-body text-xs capitalize transition-colors",
                          statusFilter === opt
                            ? "bg-sage text-cream border-sage shadow-sm"
                            : "bg-white-warm text-charcoal/65 border-sage/20 hover:bg-sage/10 hover:text-sage",
                        )}
                      >
                        {chipLabel}
                      </button>
                    );
                  })}
                </div>
              </CardHeader>

              <CardContent>
                {loading ? (
                  <ResponsiveTable>
                    <Table>
                      <TableBody>
                        {["s1", "s2", "s3", "s4", "s5"].map((sk) => (
                          <TableRow key={sk}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Skeleton className="h-11 w-11 rounded-lg bg-sage/10" />
                                <div className="space-y-1.5">
                                  <Skeleton className="h-4 w-32 bg-sage/10" />
                                  <Skeleton className="h-3 w-24 bg-sage/10" />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell><Skeleton className="h-4 w-40 bg-sage/10" /></TableCell>
                            <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-32 bg-sage/10 rounded-full" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-20 bg-sage/10 rounded-full" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-24 bg-sage/10 ml-auto" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ResponsiveTable>
                ) : (
                  <InstructorTable
                    instructors={tableInstructors}
                    columns={["instructor", "contact", "specialties", "status"]}
                    sort={{
                      sortKey,
                      sortDir,
                      onToggle: (k) => toggleSort(k as "name" | "specialties" | "status"),
                      sortableKeys: ["instructor", "specialties", "status"],
                    }}
                    onRowClick={(i) => router.push(`/admin/instructors/${i.id}`)}
                    renderActions={renderRowActions}
                    emptyState={
                      <div className="flex flex-col items-center gap-3 py-2">
                        <GraduationCap className="h-10 w-10 text-charcoal/25" />
                        <p className="font-body text-sm text-charcoal/55">
                          {search ? "No instructors match your search." : "No instructors yet — add your first one."}
                        </p>
                      </div>
                    }
                    caption="Instructor roster"
                  />
                )}
                <Pagination page={pg.page} total={pg.total} onChange={pg.setPage} />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Add dialog — minimal; full edit lives on the profile page */}
      <ResponsiveDialog open={addOpen} onOpenChange={setAddOpen}>
        <ResponsiveDialogContent className="sm:max-w-md bg-white-warm border-sage/20">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-charcoal">Add instructor</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="font-body text-xs text-charcoal/65">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs text-charcoal/65">Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Senior Pilates Instructor" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/65">Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/65">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 …" />
              </div>
            </div>
            <p className="font-body text-xs text-charcoal/50">Bio, certifications, photo and more are editable on the profile after creation.</p>
          </div>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding} className="font-body">Cancel</Button>
            <Button onClick={handleAdd} disabled={adding} variant="sage">
              {adding ? "Adding…" : "Add instructor"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
