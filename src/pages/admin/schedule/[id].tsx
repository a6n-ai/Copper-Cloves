import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft, Trash2, Pencil, Loader2, UserPlus, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { QrZoomImage } from "@/components/checkin/QrZoomImage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
  className: string;
  instructor: string;
  actualInstructor: string | null;
  classNotes: string | null;
  startTime: string;
  capacity: number | null;
  bookings: RosterBooking[];
}
interface QrData {
  instructorQrUrl: string | null;
  memberQrUrl: string | null;
  withinWindow: boolean;
  startTime: string;
}

export default function AdminClassPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const [roster, setRoster] = useState<Roster | null>(null);
  const [qr, setQr] = useState<QrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    if (!id) return;
    const r = await fetch(`/api/admin/class-roster?scheduleId=${id}`);
    if (r.ok) setRoster(await r.json());
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const [rosterRes, qrRes] = await Promise.all([
        fetch(`/api/admin/class-roster?scheduleId=${id}`),
        fetch(`/api/admin/schedule-qr?scheduleId=${id}`),
      ]);
      if (cancelled) return;
      if (rosterRes.ok) setRoster(await rosterRes.json());
      if (qrRes.ok) setQr(await qrRes.json());
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
        alert(d.error ?? "Could not add member");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!confirm("Remove this class from the schedule?")) return;
    const res = await fetch(`/api/class-schedules?id=${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) router.push("/admin/schedule");
    else alert("Failed to delete class");
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl p-4 lg:p-6">
        <div className="flex items-center justify-center py-20 text-charcoal/50">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      </main>
    );
  }
  if (!roster) {
    return (
      <main className="mx-auto max-w-5xl p-4 lg:p-6">
        <p className="py-20 text-center text-charcoal/60">Class not found.</p>
      </main>
    );
  }

  const start = new Date(roster.startTime);
  const enrolled = roster.bookings.reduce((n, b) => n + 1 + (b.extraGuests ?? 0), 0);
  const checkedIn = roster.bookings.filter((b) => b.checkedIn).length;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 lg:p-6">
      <PageHeader
        title={roster.className}
        subtitle={`${start.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · ${roster.instructor}`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="border-sage/20 text-sage hover:bg-sage/10 font-body">
              <Link href={`/admin/schedule?edit=${id}`}><Pencil className="mr-2 h-4 w-4" /> Edit in scheduler</Link>
            </Button>
            <Button variant="outline" onClick={handleDelete} className="border-terracotta/30 text-terracotta hover:bg-terracotta/5 font-body">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </div>
        }
      />

      <Button asChild variant="ghost" size="sm" className="text-charcoal/60 font-body">
        <Link href="/admin/schedule"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to schedule</Link>
      </Button>

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
        <CardHeader>
          <CardTitle className="font-display text-xl text-charcoal">Check-in QR codes</CardTitle>
        </CardHeader>
        <CardContent>
          {!qr?.withinWindow ? (
            <p className="mb-4 rounded-lg bg-cream/60 px-4 py-2 text-sm text-charcoal/60">
              QR scanning is active from 30 minutes before until 30 minutes after class start.
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-sage/15 p-6">
              <p className="font-display text-lg text-charcoal">Instructor</p>
              {qr?.instructorQrUrl ? (
                <QrZoomImage url={qr.instructorQrUrl} label="Instructor check-in" caption="Tap to enlarge" />
              ) : (
                <p className="py-10 text-sm text-charcoal/50">QR unavailable</p>
              )}
            </div>
            <div className="flex flex-col items-center gap-2 rounded-xl border border-sage/15 p-6">
              <p className="font-display text-lg text-charcoal">Members</p>
              {qr?.memberQrUrl ? (
                <QrZoomImage url={qr.memberQrUrl} label="Member check-in" caption="Tap to enlarge" />
              ) : (
                <p className="py-10 text-sm text-charcoal/50">QR unavailable</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roster */}
      <Card className="rounded-2xl shadow-xs">
        <CardHeader>
          <CardTitle className="font-display text-xl text-charcoal">Roster ({roster.bookings.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add member */}
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
    </main>
  );
}
