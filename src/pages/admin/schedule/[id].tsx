import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { UserPlus, UserMinus, CheckCircle2, User as UserIcon, Users } from "lucide-react";
import { MetricCard } from "@/components/admin/MetricCard";
import { AddWalkInDialog } from "@/components/admin/AddWalkInDialog";
import { SEO as Seo } from "@/components/SEO";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ClassCheckinQr } from "@/components/checkin/ClassCheckinQr";
import { ClassCountdownPill } from "@/components/checkin/ClassCountdownPill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditButton, ManageButton, DeleteButton } from "@/components/ui/quick-actions";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pill } from "@/components/ui/pill";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";
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
  status: string;
  holdExpiresAt?: string | null;
  invitedByUserId?: string | null;
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
  historical?: boolean;
}
interface NamedRow {
  id: string;
  name: string;
}

const NONE = "__none__";

function getQrRefreshLabel(refreshing: boolean, windowOpensAt?: string) {
  if (refreshing) return "Generating…";
  return windowOpensAt ? "Generate now" : "Try again";
}

function QrWindowBanner({ qr }: Readonly<{ qr: QrData | null }>) {
  if (qr?.historical) {
    return (
      <p className="mb-4 rounded-lg bg-cream/60 px-4 py-2 text-sm text-charcoal/60">
        Class is closed. Showing the historical QR for reference — scans no longer check in.
      </p>
    );
  }
  if (!qr?.withinWindow) {
    return (
      <p className="mb-4 rounded-lg bg-cream/60 px-4 py-2 text-sm text-charcoal/60">
        QR scanning is active from 30 minutes before until 30 minutes after class start.
        {qr?.windowOpensAt
          ? ` Opens at ${new Date(qr.windowOpensAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Asia/Kolkata",
            })}.`
          : null}
      </p>
    );
  }
  return null;
}

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

      {/* Metric cards — capacity / enrolled / spots / checked-in */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {["m1", "m2", "m3", "m4"].map((sk) => (
          <Card key={sk} className="rounded-2xl shadow-xs">
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-7 w-16 bg-sage/10" />
              <Skeleton className="h-3 w-20 bg-sage/10" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Instructor hero card */}
      <div className="relative overflow-hidden rounded-2xl border border-sage/15 bg-linear-to-br from-sage/8 via-card to-cream/30 shadow-xs">
        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[1fr_auto_1fr] md:items-center relative">
          <div className="flex items-center gap-5">
            <Skeleton className="size-16 rounded-full bg-sage/15" />
            <div className="space-y-2 min-w-0 flex-1">
              <Skeleton className="h-3 w-24 bg-sage/10" />
              <Skeleton className="h-6 w-40 bg-sage/15" />
              <Skeleton className="h-3 w-32 bg-sage/10" />
            </div>
          </div>
          <div className="md:px-6 md:border-x md:border-sage/15 flex flex-col items-center gap-2">
            <Skeleton className="h-7 w-32 rounded-full bg-sage/10" />
            <Skeleton className="h-3 w-28 bg-sage/10" />
            <Skeleton className="h-3 w-36 bg-sage/10" />
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <Skeleton className="h-3 w-24 bg-sage/10" />
            <Skeleton className="h-8 w-36 rounded-full bg-sage/10" />
            <Skeleton className="h-3 w-48 bg-sage/10" />
          </div>
        </div>
      </div>

      {/* QR codes card */}
      <Card className="rounded-2xl shadow-xs">
        <CardHeader>
          <Skeleton className="h-6 w-48 bg-sage/10" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {["qr1", "qr2"].map((sk) => (
              <div key={sk} className="flex flex-col items-center gap-3 rounded-xl border border-sage/15 p-6">
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
            {["r1", "r2", "r3", "r4", "r5", "r6"].map((sk) => (
              <li key={sk} className="flex items-center justify-between gap-3 py-2.5">
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

  const [walkInOpen, setWalkInOpen] = useState(false);

  const [statusEditOpen, setStatusEditOpen] = useState(false);
  const [statusDraft, setStatusDraft] = useState<string>("available");
  const [statusSaving, setStatusSaving] = useState(false);

  function openStatusEdit() {
    if (!roster) return;
    setStatusDraft(roster.status || "available");
    setStatusEditOpen(true);
  }

  async function saveStatus() {
    if (!roster) return;
    if (statusDraft === roster.status) {
      setStatusEditOpen(false);
      return;
    }
    setStatusSaving(true);
    try {
      const res = await fetch(`/api/class-schedules`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: roster.scheduleId, status: statusDraft }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Could not change status");
        return;
      }
      toast.success("Status updated");
      setStatusEditOpen(false);
      await loadRoster();
    } finally {
      setStatusSaving(false);
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

  async function paymentAction(bookingId: string, action: "remind" | "reconcile") {
    setBusyId(bookingId);
    try {
      const res = await fetch("/api/admin/booking-payment-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, action }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error ?? "Action failed");
        return;
      }
      if (action === "remind") {
        toast.success("Reminder sent");
        return;
      }
      // reconcile
      if (d.reconciled) {
        toast.success("Payment found — booking confirmed");
        await loadRoster();
      } else {
        toast("No completed payment found yet");
      }
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
    // Confirmation handled by <DeleteButton/>'s built-in AlertDialog.
    const res = await fetch(`/api/class-schedules?id=${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) router.push("/admin/schedule");
    else toast.error("Failed to delete class");
  }

  const start = roster ? new Date(roster.startTime) : null;
  // Single pass over bookings — was reduce + filter (two scans). Memoize so
  // these don't recompute on every render of this large detail page.
  const { enrolled, checkedIn } = useMemo(() => {
    if (!roster) return { enrolled: 0, checkedIn: 0 };
    let e = 0;
    let c = 0;
    for (const b of roster.bookings) {
      e += 1 + (b.extraGuests ?? 0);
      if (b.checkedIn) c += 1;
    }
    return { enrolled: e, checkedIn: c };
  }, [roster]);
  // Locked for edits once terminal OR the scheduled end has passed (the class
  // is over). Roster check-in/add stays available below — only class details
  // and status/delete are gated.
  const isLocked =
    roster?.status === "completed" ||
    roster?.status === "abandoned" ||
    (!!roster && new Date(roster.endTime).getTime() < Date.now());
  // Past/completed classes let a walk-in be recorded over capacity (real attendee
  // after the fact). The roster itself stays editable even when locked.
  const isPastClass =
    !!roster &&
    (new Date(roster.endTime).getTime() < Date.now() ||
      roster.status === "completed" ||
      roster.status === "abandoned");
  const atCapacity = !!roster && roster.capacity != null && enrolled >= roster.capacity;

  return (
    <>
      <Seo title="Class — Admin" description="Class details, check-in and roster" />
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
            {loading || !roster || !start ? (
              <ClassDetailSkeleton />
            ) : (
              <>
                <PageHeader
                  title={roster.className}
                  subtitle={`${start.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} · ${roster.instructor}`}
                  crumbs={[
                    { label: "Dashboard", href: "/admin/dashboard" },
                    { label: "Schedule", href: "/admin/schedule" },
                    { label: roster.className },
                  ]}
                />

                {/* Metrics — 2x2 on mobile, 4-up on desktop for symmetry */}
                {(() => {
                  const cap = roster.capacity ?? 0;
                  const spotsLeft = cap > 0 ? Math.max(0, cap - enrolled) : 0;
                  const fillPct = cap > 0 ? Math.min(100, Math.round((enrolled / cap) * 100)) : 0;
                  return (
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                      <MetricCard label="Capacity" value={roster.capacity ?? "—"} icon={Users} tone="charcoal" />
                      <MetricCard label="Enrolled" value={enrolled} icon={UserPlus} tone="terracotta" />
                      <MetricCard label="Spots left" value={cap > 0 ? spotsLeft : "—"} icon={UserMinus} tone="clay" hint={cap > 0 ? `${fillPct}% full` : undefined} />
                      <MetricCard label="Checked in" value={checkedIn} icon={CheckCircle2} tone="sage" />
                    </div>
                  );
                })()}

                {/* Instructor hero card — richer than a MetricCard */}
                {(() => {
                  const statusLabel =
                    roster.status === "available" ? "Open for booking"
                    : roster.status === "inactive" ? "Paused"
                    : roster.status === "started" ? "In session"
                    : roster.status === "completed" ? "Class complete"
                    : roster.status === "cancelled" ? "Cancelled"
                    : roster.status === "abandoned" ? "Cancelled & past"
                    : roster.status || "—";
                  const statusPillTone =
                    roster.status === "inactive" ? "warning"
                    : roster.status === "cancelled" || roster.status === "abandoned" ? "danger"
                    : roster.status === "completed" ? "neutral"
                    : roster.status === "started" ? "warning"
                    : ("success" as const);
                  const statusDot =
                    statusPillTone === "warning" ? "bg-pill-warning-dot"
                    : statusPillTone === "danger" ? "bg-pill-danger-dot"
                    : statusPillTone === "neutral" ? "bg-pill-neutral-dot"
                    : "bg-pill-success-dot";
                  const statusPulsing = roster.status === "available" || roster.status === "started";
                  const statusHint =
                    roster.status === "available" ? "Members can book and check in."
                    : roster.status === "inactive" ? "Hidden from members. Existing bookings keep their seat."
                    : roster.status === "started" ? "Check-in window is open."
                    : roster.status === "completed" ? "Class ended. Roster archived."
                    : roster.status === "cancelled" ? "Bookings blocked. Reactivate before class ends."
                    : roster.status === "abandoned" ? "Cancelled class is past — locked for edits."
                    : "";
                  const isSub = !!roster.actualInstructor && roster.actualInstructor !== roster.instructor;
                  const taught = roster.actualInstructor ?? roster.instructor;
                  const initial = (taught ?? "I").slice(0, 1).toUpperCase();
                  return (
                    <div className="relative overflow-hidden rounded-2xl border border-sage/20 bg-linear-to-br from-sage/8 via-card to-cream/30 shadow-xs">
                      <div className="relative grid grid-cols-1 gap-6 p-6 md:grid-cols-[1fr_auto_1fr] md:items-center">
                        {/* Instructor identity — clickable to profile */}
                        {(() => {
                          const targetId = roster.actualInstructorId ?? roster.instructorId;
                          const inner = (
                            <>
                              <div className="relative shrink-0">
                                <div className="size-16 rounded-full bg-linear-to-br from-sage to-sage/70 text-cream font-body font-semibold text-2xl flex items-center justify-center ring-4 ring-cream shadow-md">
                                  {initial}
                                </div>
                                <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-white-warm shadow-sm flex items-center justify-center">
                                  <UserIcon className="h-3 w-3 text-sage" />
                                </div>
                              </div>
                              <div className="min-w-0">
                                <p className="font-body text-[11px] uppercase tracking-[0.18em] text-charcoal/50">Teaching today</p>
                                <p className="font-body font-semibold text-2xl text-charcoal truncate mt-0.5 group-hover:text-sage transition-colors">{taught}</p>
                                {isSub ? (
                                  <p className="font-body text-xs text-terracotta mt-1 inline-flex items-center gap-1.5">
                                    <span className="size-1.5 rounded-full bg-terracotta" />
                                    Substituting for {roster.instructor}
                                  </p>
                                ) : (
                                  <p className="font-body text-xs text-charcoal/55 mt-1">Originally scheduled</p>
                                )}
                              </div>
                            </>
                          );
                          return targetId ? (
                            <button
                              type="button"
                              onClick={() => router.push(`/admin/instructors/${targetId}`)}
                              className="group flex items-center gap-5 min-w-0 text-left rounded-xl -m-2 p-2 hover:bg-sage/5 transition-colors cursor-pointer"
                              aria-label={`Open profile for ${taught}`}
                            >
                              {inner}
                            </button>
                          ) : (
                            <div className="flex items-center gap-5 min-w-0">{inner}</div>
                          );
                        })()}

                        {/* Center: live countdown + class window */}
                        <div className="md:px-6 md:border-x md:border-sage/15 flex flex-col items-center gap-2 text-center min-w-0">
                          <ClassCountdownPill startIso={roster.startTime} endIso={roster.endTime} size="sm" />
                          <div className="font-body text-xs text-charcoal/55">
                            {new Date(roster.startTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                            {" – "}
                            {new Date(roster.endTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                            <span className="text-charcoal/35"> · </span>
                            {(() => {
                              const mins = Math.max(0, Math.round((new Date(roster.endTime).getTime() - new Date(roster.startTime).getTime()) / 60000));
                              return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
                            })()}
                          </div>
                          {roster.classNotes && (
                            <p className="font-body text-xs text-charcoal/60 line-clamp-2 max-w-xs italic">
                              &ldquo;{roster.classNotes}&rdquo;
                            </p>
                          )}
                        </div>

                        {/* Status + actions block */}
                        <div className="flex flex-col gap-2 md:items-end md:min-w-[200px]">
                          <p className="font-body text-[11px] uppercase tracking-[0.18em] text-charcoal/50">Class status</p>
                          <div className="flex items-center gap-2 flex-wrap md:justify-end">
                            <Pill
                              tone={statusPillTone}
                              size="md"
                              className="font-body"
                              icon={
                                <span className={cn("size-1.5 rounded-full", statusDot, statusPulsing && "animate-pulse")} />
                              }
                            >
                              {statusLabel}
                            </Pill>
                          </div>
                          {statusHint && (
                            <p className="font-body text-xs text-charcoal/55 max-w-xs md:text-right">{statusHint}</p>
                          )}
                          <div className="flex items-center gap-1.5 md:justify-end mt-2">
                            {isLocked ? (
                              <span className="text-[10px] uppercase tracking-wide text-charcoal/40 font-body">Locked</span>
                            ) : (
                              <>
                                <EditButton onClick={openStatusEdit} label="Edit status" />
                                <ManageButton onClick={openEdit} label="Edit class" />
                                <DeleteButton
                                  onClick={handleDelete}
                                  confirmTitle="Delete this class?"
                                  confirmDescription={`${roster.className} at ${start.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} will be removed from the schedule. Bookings will be cancelled.`}
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {/* QR codes — historical (read-only) for completed/abandoned, live otherwise */}
                {isLocked && !qr?.instructorQrUrl && !qr?.memberQrUrl ? (
                  <Card className="rounded-2xl shadow-xs">
                    <CardContent className="p-6 text-center">
                      <p className="font-body font-semibold text-lg text-charcoal/70">
                        Check-in is closed
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Class is {roster.status}. No QR was generated for this class.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                <Card className="rounded-2xl shadow-xs">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="font-body font-semibold text-xl text-charcoal">Check-in QR codes</CardTitle>
                    {!isLocked && !qr?.historical && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => refreshQr(true)}
                        disabled={qrRefreshing}
                        className="border-sage/40 text-sage bg-white-warm hover:bg-sage! hover:text-cream! hover:border-sage! font-body"
                      >
                        {qrRefreshing ? "Refreshing…" : "Refresh QR"}
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <QrWindowBanner qr={qr} />
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      {(["instructor", "member"] as const).map((kind) => (
                        <div
                          key={kind}
                          className="flex flex-col items-center gap-3 rounded-xl border border-sage/15 p-6"
                        >
                          <ClassCheckinQr kind={kind} qr={qr} size={220} />
                          {!qr?.withinWindow && !qr?.historical && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => refreshQr(true)}
                              disabled={qrRefreshing}
                              className="border-sage/40 text-sage bg-white-warm hover:bg-sage! hover:text-cream! hover:border-sage! font-body"
                            >
                              {getQrRefreshLabel(qrRefreshing, qr?.windowOpensAt)}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                )}

                {/* Roster */}
                <Card className="rounded-2xl shadow-xs">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="font-body font-semibold text-xl text-charcoal">Roster ({roster.bookings.length})</CardTitle>
                    <Button
                      type="button"
                      size="sm"
                      variant="sage"
                      onClick={() => setWalkInOpen(true)}
                      className="font-body"
                    >
                      <UserPlus className="h-4 w-4" /> Add walk-in
                    </Button>
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
                        <div className="absolute z-10 mt-1 w-full rounded-lg border border-sage/20 bg-white-warm shadow-md">
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
                        {roster.bookings.map((b) => {
                          const isPending = b.status === "payment_pending";
                          const heldFuture = !!b.holdExpiresAt && new Date(b.holdExpiresAt).getTime() > Date.now();
                          return (
                          <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                            <div className="min-w-0">
                              <p className="font-body text-sm font-medium text-charcoal flex items-center gap-2 flex-wrap">
                                <span className="truncate">
                                  {b.name}
                                  {b.extraGuests > 0 ? <span className="font-normal text-charcoal/50"> +{b.extraGuests}</span> : null}
                                </span>
                                {isPending ? (
                                  <Pill tone="warning" className="font-body shrink-0">Payment pending</Pill>
                                ) : null}
                              </p>
                              <p className="font-body text-xs text-charcoal/50">
                                {(() => {
                                  // Derive grouping from ids using the co-present roster rows.
                                  const bookerName = b.invitedByUserId
                                    ? roster.bookings.find((x) => x.userId === b.invitedByUserId)?.name ?? null
                                    : null;
                                  const brought = b.invitedByUserId
                                    ? []
                                    : roster.bookings.filter((x) => x.invitedByUserId === b.userId).map((x) => x.name);
                                  if (bookerName) return `Guest of ${bookerName} · `;
                                  if (brought.length > 0) return `Brought ${brought.join(", ")} · `;
                                  return "";
                                })()}
                                {b.email}
                                {isPending && heldFuture ? (
                                  <span className="text-charcoal/40">
                                    {" · held until "}
                                    {new Date(b.holdExpiresAt as string).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                                  </span>
                                ) : null}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {isPending ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busyId === b.id}
                                    onClick={() => paymentAction(b.id, "remind")}
                                    className="h-8 border-terracotta/30 text-terracotta hover:bg-terracotta/5 font-body text-xs hover:text-terracotta!"
                                  >
                                    Remind
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busyId === b.id}
                                    onClick={() => paymentAction(b.id, "reconcile")}
                                    className="h-8 border-sage/20 text-sage hover:bg-sage/10 font-body text-xs hover:text-sage!"
                                  >
                                    Reconcile
                                  </Button>
                                </>
                              ) : (
                                <>
                                  {b.checkedIn ? (
                                    <Pill tone="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />} className="font-body">
                                      {b.checkInOutcome === "late" ? "Late" : "In"}
                                    </Pill>
                                  ) : null}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busyId === b.id}
                                    onClick={() => applyOutcome(b.id, b.checkedIn ? "not_checked_in" : "on_time")}
                                    className="h-8 border-sage/20 text-sage hover:bg-sage/10 font-body text-xs hover:text-sage!"
                                  >
                                    {b.checkedIn ? "Undo" : "Check in"}
                                  </Button>
                                  {!b.checkedIn ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={busyId === b.id}
                                      onClick={() => applyOutcome(b.id, "no_show")}
                                      className="h-8 border-terracotta/30 text-terracotta hover:bg-terracotta/5 font-body text-xs hover:text-terracotta!"
                                    >
                                      No-show
                                    </Button>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </li>
                          );
                        })}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Edit dialog — gated so the JSX subtree only evaluates while open.
          Radix unmounts Content when closed but the surrounding render path
          still pays for the dozens of Select/Input expressions otherwise. */}
      {editOpen && (
      <ResponsiveDialog open={editOpen} onOpenChange={setEditOpen}>
        <ResponsiveDialogContent className="max-w-lg bg-white-warm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-body font-semibold text-2xl text-charcoal">Edit class</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
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
                    <SelectItem value="inactive">Inactive (hidden from members)</SelectItem>
                    <SelectItem value="started">Started</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
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
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="font-body">Cancel</Button>
            <Button onClick={saveEdit} disabled={saving} variant="sage">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
      )}

      {/* Status edit dialog — gated identically. */}
      {statusEditOpen && (
      <ResponsiveDialog open={statusEditOpen} onOpenChange={setStatusEditOpen}>
        <ResponsiveDialogContent className="sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-body font-semibold text-charcoal">Change class status</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-1 gap-2">
              {([
                { value: "available", label: "Available", desc: "Bookable. Members see it on the schedule.", tone: "bg-sage/10 text-sage border-sage/30", active: "bg-sage text-cream border-sage" },
                { value: "inactive", label: "Inactive", desc: "Hidden from members. Existing bookings keep their seat.", tone: "bg-terracotta/10 text-terracotta border-terracotta/20", active: "bg-terracotta text-cream border-terracotta/50" },
                { value: "started", label: "Started", desc: "Check-in window is open.", tone: "bg-terracotta/10 text-terracotta border-terracotta/20", active: "bg-terracotta text-cream border-terracotta/50" },
                { value: "completed", label: "Completed", desc: "Class ended. Roster archived.", tone: "bg-charcoal/5 text-charcoal/70 border-charcoal/15", active: "bg-charcoal text-cream border-charcoal" },
                { value: "cancelled", label: "Cancelled", desc: "Blocks all bookings. Members notified.", tone: "bg-terracotta/10 text-terracotta border-terracotta/30", active: "bg-terracotta text-cream border-terracotta" },
              ] as const).map((opt) => {
                const selected = statusDraft === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatusDraft(opt.value)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                      selected ? cn(opt.active, "shadow-sm") : cn(opt.tone, "hover:brightness-95"),
                    )}
                  >
                    <span className={cn(
                      "inline-flex items-center justify-center size-5 rounded-full border-2 shrink-0 transition-colors",
                      selected ? "bg-card/95 border-cream/95" : "bg-white-warm border-current/40",
                    )}>
                      {selected && <span className="size-2 rounded-full bg-current opacity-80" style={{ color: "var(--color-sage)" }} />}
                    </span>
                    <div className="min-w-0">
                      <p className="font-body text-sm font-medium capitalize">{opt.label}</p>
                      <p className={cn("font-body text-xs mt-0.5", selected ? "opacity-85" : "opacity-70")}>{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setStatusEditOpen(false)} disabled={statusSaving} className="font-body">Cancel</Button>
            <Button onClick={saveStatus} disabled={statusSaving} variant="sage">
              {statusSaving ? "Saving…" : "Save status"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
      )}

      {walkInOpen && roster && (
        <AddWalkInDialog
          open={walkInOpen}
          onOpenChange={setWalkInOpen}
          scheduleId={roster.scheduleId}
          className={roster.className}
          classStartTime={roster.startTime}
          allowOverCapacity={isPastClass}
          capacityNote={atCapacity && isPastClass ? "Class is full — this walk-in will be recorded over capacity." : undefined}
          onAdded={loadRoster}
        />
      )}
    </>
  );
}
