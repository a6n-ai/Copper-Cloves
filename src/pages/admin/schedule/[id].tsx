import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Trash2, Pencil, UserPlus, CheckCircle2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AnimatedIcon } from "@/components/dashboard/AnimatedIcon";
import { QrZoomImage } from "@/components/checkin/QrZoomImage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RosterBooking {
  id: string;
  userId: string;
  name: string;
  email: string;
  checkedIn: boolean;
  checkInOutcome: string | null;
  extraGuests: number;
}
interface Roster {
  scheduleId: string;
  classId: string;
  className: string;
  instructor: string;
  instructorId: string | null;
  actualInstructor: string | null;
  actualInstructorId: string | null;
  instructorCheckInOutcome: string | null;
  classNotes: string | null;
  startTime: string;
  endTime: string;
  status: string;
  capacity: number | null;
  bookings: RosterBooking[];
}
interface QrData {
  instructorQrUrl: string | null;
  memberQrUrl: string | null;
  withinWindow: boolean;
  startTime: string;
  windowOpensAt?: string;
}
interface NamedRow {
  id: string;
  name: string;
}

const NONE = "__none__";

/** Shape-matched loading state mirroring the class header, info stats, QR card, and roster list. */
function ClassDetailSkeleton() {
  return (
    <>
      {/* PageHeader */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-64 bg-sage/10" />
          <Skeleton className="h-8 w-72 max-w-full bg-sage/10" />
          <Skeleton className="h-4 w-56 bg-sage/10" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24 rounded-md bg-sage/10" />
          <Skeleton className="h-10 w-24 rounded-md bg-sage/10" />
        </div>
      </div>

      {/* Info stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="rounded-2xl shadow-xs">
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-7 w-16 bg-sage/10" />
              <Skeleton className="h-3 w-20 bg-sage/10" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* QR codes card */}
      <Card className="rounded-2xl shadow-xs">
        <CardHeader>
          <Skeleton className="h-6 w-48 bg-sage/10" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-3 rounded-xl border border-sage/15 p-6">
                <Skeleton className="h-5 w-24 bg-sage/10" />
                <Skeleton className="h-40 w-40 rounded-lg bg-sage/10" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Roster card */}
      <Card className="rounded-2xl shadow-xs">
        <CardHeader>
          <Skeleton className="h-6 w-32 bg-sage/10" />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add-member search */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded bg-sage/10 shrink-0" />
            <Skeleton className="h-10 flex-1 rounded-md bg-sage/10" />
          </div>
          {/* Roster rows */}
          <ul className="divide-y divide-sage/10">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 space-y-1.5">
                  <Skeleton className="h-4 w-40 bg-sage/10" />
                  <Skeleton className="h-3 w-52 bg-sage/10" />
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Skeleton className="h-8 w-20 rounded-md bg-sage/10" />
                  <Skeleton className="h-8 w-20 rounded-md bg-sage/10" />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function QrPlaceholder({ caption }: { caption: string }) {
  // 13x13 pseudo-QR pattern: three finder squares in corners + sparse data dots.
  const size = 13;
  const isFinder = (r: number, c: number) => {
    const inBox = (br: number, bc: number) =>
      r >= br && r <= br + 6 && c >= bc && c <= bc + 6;
    const onRing = (br: number, bc: number) =>
      r === br || r === br + 6 || c === bc || c === bc + 6;
    const inCenter = (br: number, bc: number) =>
      r >= br + 2 && r <= br + 4 && c >= bc + 2 && c <= bc + 4;
    const corners: [number, number][] = [[0, 0], [0, size - 7], [size - 7, 0]];
    return corners.some(([br, bc]) => inBox(br, bc) && (onRing(br, bc) || inCenter(br, bc)));
  };
  const cells = Array.from({ length: size * size }, (_, i) => {
    const r = Math.floor(i / size);
    const c = i % size;
    if (isFinder(r, c)) return true;
    return ((r * 31 + c * 17 + r * c) % 5) === 0;
  });
  return (
    <div className="relative flex h-[200px] w-[200px] items-center justify-center">
      <div
        className="grid h-full w-full gap-[2px] rounded-md bg-white p-2 blur-[3px]"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {cells.map((on, i) => (
          <div key={i} className={on ? "bg-charcoal" : "bg-transparent"} />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-md bg-cream/40 px-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/70">
          QR generates in
        </p>
        <p className="text-sm font-medium text-charcoal">{caption}</p>
      </div>
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function AdminClassPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const [roster, setRoster] = useState<Roster | null>(null);
  const [qr, setQr] = useState<QrData | null>(null);
  const [qrRefreshing, setQrRefreshing] = useState(false);

  const refreshQr = useCallback(
    async (force: boolean) => {
      if (!id) return;
      setQrRefreshing(true);
      try {
        const r = force
          ? await fetch(`/api/admin/schedule-qr`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scheduleId: id }),
            })
          : await fetch(`/api/admin/schedule-qr?scheduleId=${id}`);
        if (r.ok) setQr(await r.json());
      } finally {
        setQrRefreshing(false);
      }
    },
    [id],
  );
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [instructors, setInstructors] = useState<NamedRow[]>([]);
  const [classTypes, setClassTypes] = useState<NamedRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    classId: "",
    instructorId: NONE,
    actualInstructorId: NONE,
    start: "",
    capacity: "",
    status: "available",
    classNotes: "",
  });

  const loadRoster = useCallback(async () => {
    if (!id) return;
    const r = await fetch(`/api/admin/class-roster?scheduleId=${id}`);
    if (r.ok) setRoster(await r.json());
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const [rosterRes, qrRes, instRes, clsRes] = await Promise.all([
        fetch(`/api/admin/class-roster?scheduleId=${id}`),
        fetch(`/api/admin/schedule-qr?scheduleId=${id}`),
        fetch(`/api/admin/instructors`),
        fetch(`/api/classes`),
      ]);
      if (cancelled) return;
      if (rosterRes.ok) setRoster(await rosterRes.json());
      if (qrRes.ok) setQr(await qrRes.json());
      if (instRes.ok) {
        const d = await instRes.json();
        setInstructors(Array.isArray(d) ? d.map((i: NamedRow) => ({ id: i.id, name: i.name })) : []);
      }
      if (clsRes.ok) {
        const d = await clsRes.json();
        setClassTypes(Array.isArray(d) ? d.map((c: NamedRow) => ({ id: c.id, name: c.name })) : []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function openEdit() {
    if (!roster) return;
    setForm({
      classId: roster.classId,
      instructorId: roster.instructorId ?? NONE,
      actualInstructorId: roster.actualInstructorId ?? NONE,
      start: toLocalInput(roster.startTime),
      capacity: roster.capacity != null ? String(roster.capacity) : "",
      status: roster.status || "available",
      classNotes: roster.classNotes ?? "",
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!roster) return;
    setSaving(true);
    try {
      // End auto-derives: keep the original class duration relative to the new start.
      const durationMs = Math.max(
        30 * 60000,
        new Date(roster.endTime).getTime() - new Date(roster.startTime).getTime(),
      );
      const startIso = new Date(form.start).toISOString();
      const endIso = new Date(new Date(form.start).getTime() + durationMs).toISOString();
      const res = await fetch(`/api/class-schedules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          class_id: form.classId,
          instructor_id: form.instructorId === NONE ? "" : form.instructorId,
          actual_instructor_id: form.actualInstructorId === NONE ? "" : form.actualInstructorId,
          start_time: startIso,
          end_time: endIso,
          capacity: form.capacity,
          status: form.status,
          class_notes: form.classNotes,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Could not save changes");
        return;
      }
      setEditOpen(false);
      await loadRoster();
    } finally {
      setSaving(false);
    }
  }

  async function applyOutcome(bookingId: string, outcome: "on_time" | "no_show" | "not_checked_in") {
    setBusyId(bookingId);
    try {
      const res = await fetch("/api/admin/manual-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, outcome }),
      });
      if (res.ok) await loadRoster();
    } finally {
      setBusyId(null);
    }
  }

  async function searchMembers(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const r = await fetch(`/api/admin/members-search?q=${encodeURIComponent(q)}`);
    if (r.ok) setResults(await r.json());
  }

  async function addMember(userId: string) {
    setBusyId(userId);
    try {
      const res = await fetch("/api/admin/add-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: id, userId }),
      });
      if (res.ok) {
        setQuery("");
        setResults([]);
        await loadRoster();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Could not add member");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!confirm("Remove this class from the schedule?")) return;
    const res = await fetch(`/api/class-schedules?id=${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) router.push("/admin/schedule");
    else toast.error("Failed to delete class");
  }

  const start = roster ? new Date(roster.startTime) : null;
  const enrolled = roster ? roster.bookings.reduce((n, b) => n + 1 + (b.extraGuests ?? 0), 0) : 0;
  const checkedIn = roster ? roster.bookings.filter((b) => b.checkedIn).length : 0;

  return (
    <>
      <SEO title="Class — Admin" description="Class details, check-in and roster" />
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
            {loading || !roster || !start ? (
              <ClassDetailSkeleton />
            ) : (
              <>
                <PageHeader
                  title={roster.className}
                  subtitle={`${start.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · ${roster.instructor}`}
                  crumbs={[
                    { label: "Dashboard", href: "/admin/dashboard" },
                    { label: "Schedule", href: "/admin/schedule" },
                    { label: roster.className },
                  ]}
                  actions={
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={openEdit}
                        className="bg-sage hover:bg-sage/90 text-white font-body transition-transform hover:scale-[1.03] active:scale-95"
                      >
                        <AnimatedIcon icon={Pencil} size={16} animateOnMount={false} hover="wiggle" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleDelete}
                        className="font-body transition-transform hover:scale-[1.03] active:scale-95"
                      >
                        <AnimatedIcon icon={Trash2} size={16} animateOnMount={false} hover="wiggle" />
                        Delete
                      </Button>
                    </div>
                  }
                />

                {/* Info */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: "Instructor", value: roster.actualInstructor ? `${roster.actualInstructor} (sub)` : roster.instructor },
                    { label: "Capacity", value: roster.capacity ?? "—" },
                    { label: "Enrolled", value: enrolled },
                    { label: "Checked in", value: checkedIn },
                  ].map((s) => (
                    <Card key={s.label} className="rounded-2xl shadow-xs">
                      <CardContent className="p-4">
                        <p className="font-display text-2xl text-charcoal">{s.value}</p>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* QR codes */}
                <Card className="rounded-2xl shadow-xs">
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <CardTitle className="font-display text-xl text-charcoal">Check-in QR codes</CardTitle>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => refreshQr(true)}
                      disabled={qrRefreshing}
                    >
                      {qrRefreshing ? "Refreshing…" : "Refresh QR"}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {!qr?.withinWindow ? (
                      <p className="mb-4 rounded-lg bg-cream/60 px-4 py-2 text-sm text-charcoal/60">
                        QR scanning is active from 30 minutes before until 30 minutes after class start.
                        {qr?.windowOpensAt
                          ? ` Opens at ${new Date(qr.windowOpensAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}.`
                          : null}
                      </p>
                    ) : null}
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      {(["instructor", "member"] as const).map((kind) => {
                        const url = kind === "instructor" ? qr?.instructorQrUrl : qr?.memberQrUrl;
                        const label = kind === "instructor" ? "Instructor" : "Members";
                        const preWindow = qr?.windowOpensAt && !qr?.withinWindow;
                        return (
                          <div
                            key={kind}
                            className="flex flex-col items-center gap-2 rounded-xl border border-sage/15 p-6"
                          >
                            <p className="font-display text-lg text-charcoal">{label}</p>
                            {url ? (
                              <QrZoomImage
                                url={url}
                                label={`${label} check-in`}
                                caption="Tap to enlarge"
                              />
                            ) : preWindow ? (
                              <div className="flex flex-col items-center gap-3">
                                <QrPlaceholder
                                  caption={new Date(qr!.windowOpensAt!).toLocaleTimeString(undefined, {
                                    timeStyle: "short",
                                  })}
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => refreshQr(true)}
                                  disabled={qrRefreshing}
                                >
                                  {qrRefreshing ? "Generating…" : "Generate now"}
                                </Button>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-2 py-10">
                                <p className="text-sm text-charcoal/50">QR temporarily unavailable</p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => refreshQr(true)}
                                  disabled={qrRefreshing}
                                >
                                  Try again
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Roster */}
                <Card className="rounded-2xl shadow-xs">
                  <CardHeader>
                    <CardTitle className="font-display text-xl text-charcoal">Roster ({roster.bookings.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="relative">
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-charcoal/40" />
                        <Input
                          value={query}
                          onChange={(e) => searchMembers(e.target.value)}
                          placeholder="Add a member by name or email…"
                          className="border-sage/20"
                        />
                      </div>
                      {results.length > 0 ? (
                        <div className="absolute z-10 mt-1 w-full rounded-lg border border-sage/20 bg-white shadow-lg">
                          {results.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              disabled={busyId === m.id}
                              onClick={() => addMember(m.id)}
                              className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-sage/5"
                            >
                              <span className="font-body text-sm text-charcoal">{m.full_name ?? m.email}</span>
                              <span className="font-body text-xs text-charcoal/50">{m.email}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {roster.bookings.length === 0 ? (
                      <p className="py-6 text-center text-sm text-charcoal/50">No one booked yet.</p>
                    ) : (
                      <ul className="divide-y divide-sage/10">
                        {roster.bookings.map((b) => (
                          <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                            <div className="min-w-0">
                              <p className="font-body text-sm font-medium text-charcoal">
                                {b.name}
                                {b.extraGuests > 0 ? <span className="font-normal text-charcoal/50"> +{b.extraGuests}</span> : null}
                              </p>
                              <p className="font-body text-xs text-charcoal/50">{b.email}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {b.checkedIn ? (
                                <Badge className="bg-sage/10 text-sage border-sage/20 font-body">
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                  {b.checkInOutcome === "late" ? "Late" : "In"}
                                </Badge>
                              ) : null}
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === b.id}
                                onClick={() => applyOutcome(b.id, b.checkedIn ? "not_checked_in" : "on_time")}
                                className="h-8 border-sage/20 text-sage hover:bg-sage/10 font-body text-xs"
                              >
                                {b.checkedIn ? "Undo" : "Check in"}
                              </Button>
                              {!b.checkedIn ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busyId === b.id}
                                  onClick={() => applyOutcome(b.id, "no_show")}
                                  className="h-8 border-terracotta/30 text-terracotta hover:bg-terracotta/5 font-body text-xs"
                                >
                                  No-show
                                </Button>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">Edit class</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-body text-sm">Class type</Label>
              <Select value={form.classId} onValueChange={(v) => setForm((f) => ({ ...f, classId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classTypes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-sm">Date &amp; time</Label>
              <Input type="datetime-local" value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} />
              <p className="text-xs text-charcoal/40">End time keeps the class&apos;s usual duration.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-body text-sm">Instructor</Label>
                <Select value={form.instructorId} onValueChange={(v) => setForm((f) => ({ ...f, instructorId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Instructor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {instructors.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-sm">Substitute</Label>
                <Select value={form.actualInstructorId} onValueChange={(v) => setForm((f) => ({ ...f, actualInstructorId: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {instructors.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-body text-sm">Capacity</Label>
                <Input type="number" min={0} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-sm">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-sm">Class notes</Label>
              <Textarea value={form.classNotes} onChange={(e) => setForm((f) => ({ ...f, classNotes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="font-body">Cancel</Button>
            <Button onClick={saveEdit} disabled={saving} className="bg-sage hover:bg-sage/90 text-white font-body">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
