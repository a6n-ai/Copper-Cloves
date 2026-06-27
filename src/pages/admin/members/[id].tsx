import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import {
  Mail,
  Phone,
  MessageCircle,
  Calendar,
  CreditCard,
  Trophy,
  Flame,
  CalendarClock,
  UserX,
  ArrowLeft,
  ReceiptText,
  Pause,
  Play,
  Cake,
  Pencil,
  User as UserIcon,
  Banknote,
} from "lucide-react";
import { requireSessionSSP } from "@/lib/requireSessionSSP";
import { passCategoryForPackageType } from "@/lib/couponHelpers";
import { SEO } from "@/components/SEO";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { PassCard } from "@/components/dashboard/PassCard";
import { MetricCard } from "@/components/admin/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { paymentMethodPill, ticketStatusPill, bookingStatusPill, bookingPaymentPill } from "@/lib/pillMaps";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/filters";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListAvatar } from "@/components/admin/ListAvatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });

/* ──────────────────────────  Types  ────────────────────────── */

type PassCategory = "studio_pass" | "class_pass" | "none";

interface PackageRow {
  id: string;
  name: string;
  purchasedAt: string | null;
  expiresAt: string | null;
  creditsRemaining: number | null;
  isActive: boolean;
  isUnlimited: boolean;
  isPaused: boolean;
  passType: string | null;
  durationMonths: number | null;
}
interface BookingRow {
  id: string;
  name: string;
  when: number | null;
  status: "attended" | "no_show" | "missed" | "upcoming";
  lifecycle: string;
  checkedIn: boolean;
  checkInOutcome: string | null;
}
interface FoodRow {
  id: string;
  item: string;
  quantity: number;
  orderedAt: string | null;
  status: string;
}
interface BadgeRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  earnedAt: string | null;
}
interface PaymentRow {
  id: string;
  method: string;
  amountPaise: number;
  status: string;
  reference: string | null;
  proofUrl: string | null;
  createdAt: string | null;
  recordedBy: string | null;
}
interface TicketRow {
  id: string;
  type: string;
  reason: string;
  status: string;
  createdAt: string | null;
  pauseFrom: string | null;
  pauseTo: string | null;
}
interface MemberDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  whatsappPhone: string | null;
  avatarUrl: string | null;
  dob: string | null;
  gender: string | null;
  startDate: string | null;
  createdAt: string | null;
  passCategory: PassCategory;
  unlimited: boolean;
  credits: number;
  expiry: string | null;
  activePackageId: string | null;
  activePaused: boolean;
  stats: { totalClasses: number; currentStreak: number; longestStreak: number; lastClassDate: string | null };
  packages: PackageRow[];
  bookings: BookingRow[];
  food: FoodRow[];
  badges: BadgeRow[];
  payments: PaymentRow[];
  tickets: TicketRow[];
}

/* ──────────────────────────  Helpers  ────────────────────────── */

const PAYMENT_METHODS = [
  { v: "razorpay_online", l: "Razorpay (Online)" },
  { v: "pine_lab_card", l: "Pine Lab Card" },
  { v: "pine_lab_upi", l: "Pine Lab UPI" },
  { v: "direct_upi", l: "Direct UPI" },
  { v: "razorpay_completed", l: "Razorpay Completed" },
  { v: "cash", l: "Cash" },
] as const;


function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string | number | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(d: string | number | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/* maps the raw `/api/admin/members?id=` payload into the page's view model */
function mapDetail(data: Record<string, unknown>): MemberDetail {
  const now = Date.now();
  const pkgsRaw = Array.isArray(data.user_packages) ? (data.user_packages as Array<Record<string, unknown>>) : [];
  const packages: PackageRow[] = pkgsRaw.map((p) => {
    const pt = (p.package_type ?? null) as { name?: string; is_unlimited?: boolean; duration_months?: number | null } | null;
    const exp = p.expiration_date ? String(p.expiration_date) : null;
    return {
      id: String(p.id),
      name: pt?.name ?? "Package",
      purchasedAt: p.purchase_date ? String(p.purchase_date) : null,
      expiresAt: exp,
      creditsRemaining: typeof p.credits_remaining === "number" ? p.credits_remaining : null,
      isActive: !!p.is_active && (exp ? new Date(exp).getTime() > now : true),
      isUnlimited: !!pt?.is_unlimited,
      isPaused: !!p.is_paused,
      passType: p.pass_type ? String(p.pass_type) : null,
      durationMonths: typeof pt?.duration_months === "number" ? pt.duration_months : null,
    };
  });
  const activePkg = packages.find((p) => p.isActive) ?? packages[0] ?? null;

  let passCategory: PassCategory = "none";
  if (activePkg) {
    const raw = pkgsRaw.find((r) => String(r.id) === activePkg.id);
    const pt = (raw?.package_type ?? null) as Parameters<typeof passCategoryForPackageType>[0];
    passCategory = pt ? passCategoryForPackageType(pt) : "none";
  }

  const bookingsRaw = Array.isArray(data.bookings) ? (data.bookings as Array<Record<string, unknown>>) : [];
  const bookings: BookingRow[] = bookingsRaw
    .map((b) => {
      const sched = (b.class_schedule ?? null) as { start_time?: string; class_model?: { name?: string } } | null;
      const startRaw = sched?.start_time ?? (b.booking_date ? String(b.booking_date) : null);
      const when = startRaw ? new Date(startRaw).getTime() : null;
      const name = sched?.class_model?.name ?? "Class";
      const checkedIn = !!b.checked_in;
      const outcome = b.check_in_outcome ? String(b.check_in_outcome) : null;
      let status: BookingRow["status"];
      if (checkedIn) status = "attended";
      else if (outcome === "no_show") status = "no_show";
      else if (when != null && when < now) status = "missed";
      else status = "upcoming";
      const lifecycle = b.status ? String(b.status) : "confirmed";
      return { id: String(b.id), name, when, status, lifecycle, checkedIn, checkInOutcome: outcome };
    })
    .sort((a, b) => (b.when ?? 0) - (a.when ?? 0));

  const foodRaw = Array.isArray(data.cafe_orders) ? (data.cafe_orders as Array<Record<string, unknown>>) : [];
  const food: FoodRow[] = foodRaw.map((o) => ({
    id: String(o.id),
    item: ((o.cafe_item ?? null) as { name?: string } | null)?.name ?? "Item",
    quantity: typeof o.quantity === "number" ? o.quantity : 1,
    orderedAt: o.order_date ? String(o.order_date) : null,
    status: o.status ? String(o.status) : "—",
  }));

  const badgesRaw = Array.isArray(data.user_badges) ? (data.user_badges as Array<Record<string, unknown>>) : [];
  const badges: BadgeRow[] = badgesRaw.map((b) => ({
    id: String(b.id),
    name: b.badge_name ? String(b.badge_name) : "Badge",
    description: b.badge_description ? String(b.badge_description) : null,
    icon: b.icon ? String(b.icon) : null,
    earnedAt: b.earned_at ? String(b.earned_at) : null,
  }));

  const paymentsRaw = Array.isArray(data.payments) ? (data.payments as Array<Record<string, unknown>>) : [];
  const payments: PaymentRow[] = paymentsRaw.map((p) => {
    const admin = (p.recorded_by_admin ?? null) as { full_name?: string; email?: string } | null;
    return {
      id: String(p.id),
      method: p.method ? String(p.method) : "—",
      amountPaise: typeof p.amount_paise === "number" ? p.amount_paise : 0,
      status: p.status ? String(p.status) : "—",
      reference: p.reference ? String(p.reference) : null,
      proofUrl: p.proof_url ? String(p.proof_url) : null,
      createdAt: p.created_at ? String(p.created_at) : null,
      recordedBy: admin ? admin.full_name ?? admin.email ?? null : null,
    };
  });

  const ticketsRaw = Array.isArray(data.member_tickets) ? (data.member_tickets as Array<Record<string, unknown>>) : [];
  const tickets: TicketRow[] = ticketsRaw.map((t) => ({
    id: String(t.id),
    type: t.type ? String(t.type) : "request",
    reason: t.reason ? String(t.reason) : "",
    status: t.status ? String(t.status) : "open",
    createdAt: t.created_at ? String(t.created_at) : null,
    pauseFrom: t.pause_from ? String(t.pause_from) : null,
    pauseTo: t.pause_to ? String(t.pause_to) : null,
  }));

  const stats = (data.user_stats ?? null) as {
    total_classes_attended?: number;
    current_streak?: number;
    longest_streak?: number;
    last_class_date?: string | null;
  } | null;

  return {
    id: String(data.id),
    name: (data.full_name as string) || (data.email as string) || "Member",
    email: String(data.email ?? ""),
    phone: data.phone ? String(data.phone) : null,
    whatsappPhone: data.whatsapp_phone ? String(data.whatsapp_phone) : null,
    avatarUrl: data.avatar_url ? String(data.avatar_url) : null,
    dob: data.dob ? String(data.dob) : null,
    gender: data.gender ? String(data.gender) : null,
    startDate: data.start_date ? String(data.start_date) : null,
    createdAt: data.created_at ? String(data.created_at) : null,
    passCategory,
    unlimited: !!activePkg?.isUnlimited || passCategory === "studio_pass",
    credits: activePkg?.creditsRemaining ?? 0,
    expiry: activePkg?.expiresAt ?? null,
    activePackageId: activePkg?.id ?? null,
    activePaused: !!activePkg?.isPaused,
    stats: {
      totalClasses: stats?.total_classes_attended ?? 0,
      currentStreak: stats?.current_streak ?? 0,
      longestStreak: stats?.longest_streak ?? 0,
      lastClassDate: stats?.last_class_date ?? null,
    },
    packages,
    bookings,
    food,
    badges,
    payments,
    tickets,
  };
}

/* ──────────────────────────  Page  ────────────────────────── */

export default function MemberDetailPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const { status } = useSession();

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [savingBookingId, setSavingBookingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/admin/members?id=${encodeURIComponent(id)}`, { credentials: "include" });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMember(mapDetail(await res.json()));
    } catch {
      toast.error("Could not load member");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

  const noShowCount = useMemo(
    () => (member?.bookings ?? []).filter((b) => b.status === "no_show").length,
    [member],
  );

  /* — manual check-in outcome — */
  async function applyOutcome(bookingId: string, outcome: "on_time" | "late" | "no_show" | "not_checked_in") {
    setSavingBookingId(bookingId);
    try {
      const res = await fetch("/api/admin/manual-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bookingId, outcome }),
      });
      if (!res.ok) throw new Error();
      setMember((m) => {
        if (!m) return m;
        return {
          ...m,
          bookings: m.bookings.map((r) => {
            if (r.id !== bookingId) return r;
            const checkedIn = outcome === "on_time" || outcome === "late";
            let st: BookingRow["status"];
            if (checkedIn) st = "attended";
            else if (outcome === "no_show") st = "no_show";
            else st = r.when != null && r.when < Date.now() ? "missed" : "upcoming";
            return { ...r, checkedIn, checkInOutcome: outcome === "not_checked_in" ? null : outcome, status: st };
          }),
        };
      });
    } catch {
      toast.error("Could not update status");
    } finally {
      setSavingBookingId(null);
    }
  }

  /* — pause / resume active pass — */
  async function togglePause(next: boolean) {
    if (!member) return;
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          profile_id: member.id,
          user_package_id: member.activePackageId ?? undefined,
          action: next ? "pause" : "resume",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed");
      }
      toast.success(next ? "Pass paused" : "Pass resumed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update pass");
    }
  }

  return (
    <>
      <SEO title={`${member?.name ?? "Member"} — Admin`} description="Member profile and management" />
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
            <PageHeader
              title={member?.name ?? "Member"}
              subtitle={member?.email ?? "Member profile"}
              crumbs={[
                { label: "Dashboard", href: "/admin/dashboard" },
                { label: "Members", href: "/admin/members" },
                { label: member?.name ?? "—" },
              ]}
            />

            {(() => {
              if (notFound) {
                return (
                  <Card className="border-terracotta/30 bg-terracotta/5 rounded-2xl">
                    <CardContent className="p-8 text-center space-y-3">
                      <p className="font-body text-charcoal">This member could not be found.</p>
                      <Button variant="outline" onClick={() => router.push("/admin/members")} className="font-body">
                        <ArrowLeft className="h-4 w-4 mr-1.5" />
                        Back to members
                      </Button>
                    </CardContent>
                  </Card>
                );
              }
              if (loading || !member) return <DetailSkeleton />;
              return (
                <MemberBody
                  member={member}
                  noShowCount={noShowCount}
                  savingBookingId={savingBookingId}
                  onApplyOutcome={applyOutcome}
                  onTogglePause={togglePause}
                  onReload={load}
                />
              );
            })()}
          </div>
        </main>
      </div>
    </>
  );
}

/* ──────────────────────────  Body  ────────────────────────── */

function MemberBody({
  member,
  noShowCount,
  savingBookingId,
  onApplyOutcome,
  onTogglePause,
  onReload,
}: {
  member: MemberDetail;
  noShowCount: number;
  savingBookingId: string | null;
  onApplyOutcome: (id: string, o: "on_time" | "late" | "no_show" | "not_checked_in") => void;
  onTogglePause: (next: boolean) => void;
  onReload: () => Promise<void>;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  let passLabel: string;
  if (member.passCategory === "studio_pass") passLabel = "Studio pass";
  else if (member.passCategory === "class_pass") passLabel = "Class pass";
  else passLabel = "No active pass";

  return (
    <>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-sage/20 bg-linear-to-br from-sage/8 via-[#fafaf8] to-cream/30 shadow-xs">
        <div className="relative grid grid-cols-1 gap-6 p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
          <div className="shrink-0">
            <ListAvatar name={member.name} src={member.avatarUrl} size="lg" />
          </div>
          <div className="min-w-0">
            <p className="font-body text-[11px] uppercase tracking-[0.18em] text-charcoal/50">{passLabel}</p>
            <h2 className="font-display text-3xl text-charcoal truncate mt-0.5">{member.name}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3 font-body text-xs text-charcoal/65">
              {member.email && (
                <a href={`mailto:${member.email}`} className="inline-flex items-center gap-1.5 hover:text-sage">
                  <Mail className="h-3.5 w-3.5" />
                  {member.email}
                </a>
              )}
              {member.phone && (
                <a href={`tel:${member.phone}`} className="inline-flex items-center gap-1.5 hover:text-sage">
                  <Phone className="h-3.5 w-3.5" />
                  {member.phone}
                </a>
              )}
              {member.whatsappPhone && (
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {member.whatsappPhone}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Member since {fmtDate(member.createdAt)}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <Button variant="sage" onClick={() => setManageOpen(true)} className="font-body">
              <CreditCard className="h-4 w-4 mr-1.5" />
              Manage pass / payment
            </Button>
            <Button
              variant="outline"
              onClick={() => setEditOpen(true)}
              className="font-body border-sage/30 text-sage hover:bg-sage hover:text-cream"
            >
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit profile
            </Button>
            {member.activePackageId && (
              <Button
                variant="outline"
                onClick={() => onTogglePause(!member.activePaused)}
                className="font-body border-sage/30 text-sage hover:bg-sage hover:text-cream"
              >
                {member.activePaused ? <Play className="h-4 w-4 mr-1.5" /> : <Pause className="h-4 w-4 mr-1.5" />}
                {member.activePaused ? "Resume pass" : "Pause pass"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard label="Classes" value={member.stats.totalClasses} icon={Trophy} tone="sage" hint="Total attended" />
        <MetricCard label="Streak" value={member.stats.currentStreak} icon={Flame} tone="clay" hint={`Best ${member.stats.longestStreak}`} />
        <MetricCard label="Credits" value={member.unlimited ? "∞" : member.credits} icon={CreditCard} tone="sage" hint="On active pass" />
        <MetricCard label="Expiry" value={member.expiry ? fmtDate(member.expiry) : "—"} icon={CalendarClock} tone="charcoal" hint="Active pass" />
        <MetricCard label="No-shows" value={noShowCount} icon={UserX} tone="clay" hint="Recent bookings" />
      </div>

      {/* About + Current pass */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="rounded-2xl shadow-xs">
          <CardHeader>
            <CardTitle className="font-display text-lg text-charcoal flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-sage" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <InfoLine icon={Cake} label="Date of birth" value={member.dob ? fmtDate(member.dob) : null} />
            <InfoLine icon={UserIcon} label="Gender" value={member.gender} />
            <InfoLine icon={Calendar} label="Start date" value={member.startDate ? fmtDate(member.startDate) : null} />
            <InfoLine icon={MessageCircle} label="WhatsApp" value={member.whatsappPhone} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-xs">
          <CardHeader>
            <CardTitle className="font-display text-lg text-charcoal flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-sage" /> Current pass
            </CardTitle>
          </CardHeader>
          <CardContent>
            {member.activePackageId ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-display text-2xl text-charcoal">{passLabel}</span>
                  {member.activePaused && (
                    <Pill tone="warning" className="font-body">Paused</Pill>
                  )}
                </div>
                <p className="font-body text-sm text-charcoal/70">
                  {member.unlimited ? "Unlimited classes" : `${member.credits} classes remaining`}
                  {member.expiry ? ` · expires ${fmtDate(member.expiry)}` : ""}
                </p>
              </div>
            ) : (
              <p className="font-body text-sm text-charcoal/40 italic">No active pass. Use Manage to assign one.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Class history + Packages */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Class history" icon={Calendar} count={member.bookings.length}>
          {member.bookings.length === 0 ? (
            <EmptyNote text="No class history yet." />
          ) : (
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Check-in</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {member.bookings.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-body text-charcoal">{row.name}</TableCell>
                      <TableCell className="font-body text-charcoal/60">{fmtDateTime(row.when)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Pill {...bookingStatusPill(row.lifecycle)}>{bookingStatusPill(row.lifecycle).label}</Pill>
                          {(row.lifecycle === "payment_pending" || row.lifecycle === "expired") && (
                            <Pill {...bookingPaymentPill(row.lifecycle)}>{bookingPaymentPill(row.lifecycle).label}</Pill>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {savingBookingId === row.id && <Spinner className="size-3" />}
                          <Select
                            value={
                              row.checkedIn
                                ? row.checkInOutcome === "late" ? "late" : "on_time"
                                : row.checkInOutcome === "no_show" ? "no_show" : "not_checked_in"
                            }
                            onValueChange={(v) => onApplyOutcome(row.id, v as "on_time" | "late" | "no_show" | "not_checked_in")}
                            disabled={savingBookingId === row.id}
                          >
                            <SelectTrigger className="h-8 w-[150px] border-sage/20 font-body text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="on_time">On time</SelectItem>
                              <SelectItem value="late">Late</SelectItem>
                              <SelectItem value="no_show">No-show</SelectItem>
                              <SelectItem value="not_checked_in">Not checked in</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </SectionCard>

        <SectionCard title="Packages" icon={CreditCard} count={member.packages.length}>
          {member.packages.length === 0 ? (
            <EmptyNote text="No packages purchased." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {member.packages.map((p) => {
                let status: "active" | "expired" | "paused";
                if (p.isPaused) status = "paused";
                else if (p.isActive) status = "active";
                else status = "expired";
                return (
                  <PassCard
                    key={p.id}
                    name={p.name}
                    isUnlimited={p.isUnlimited}
                    classesRemaining={p.creditsRemaining}
                    expiry={p.expiresAt}
                    durationMonths={p.durationMonths}
                    status={status}
                    className="w-full"
                  />
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Payments */}
      <SectionCard title="Payments" icon={ReceiptText} count={member.payments.length}>
        {member.payments.length === 0 ? (
          <EmptyNote text="No payments recorded." />
        ) : (
          <ResponsiveTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Recorded by</TableHead>
                  <TableHead className="text-right">Proof</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {member.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {(() => {
                        const pm = paymentMethodPill(p.method);
                        return (
                          <Pill
                            tone={pm.tone}
                            brand={pm.brand}
                            icon={pm.label === "Cash" ? <Banknote className="h-3 w-3" /> : undefined}
                            className="font-body"
                          >
                            {pm.label}
                          </Pill>
                        );
                      })()}
                      {p.reference && <div className="font-body text-xs text-charcoal/50 mt-1">{p.reference}</div>}
                    </TableCell>
                    <TableCell className="text-right font-body text-charcoal tabular-nums">{rupees(p.amountPaise)}</TableCell>
                    <TableCell className="font-body text-charcoal/60">{fmtDate(p.createdAt)}</TableCell>
                    <TableCell className="font-body text-charcoal/60">{p.recordedBy ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {p.proofUrl ? (
                        <a href={p.proofUrl} target="_blank" rel="noreferrer" className="font-body text-xs text-sage underline">view</a>
                      ) : (
                        <span className="font-body text-xs text-charcoal/30">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTable>
        )}
      </SectionCard>

      {/* Café + Badges */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Café orders" icon={ReceiptText} count={member.food.length}>
          {member.food.length === 0 ? (
            <EmptyNote text="No café orders." />
          ) : (
            <ul className="divide-y divide-sage/10">
              {member.food.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="font-body font-medium text-charcoal truncate">
                      {o.item} <span className="text-charcoal/50 font-normal">× {o.quantity}</span>
                    </div>
                    <div className="font-body text-xs text-charcoal/50">{fmtDate(o.orderedAt)}</div>
                  </div>
                  <Pill tone="neutral" className="font-body capitalize">{o.status}</Pill>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Badges" icon={Trophy} count={member.badges.length}>
          {member.badges.length === 0 ? (
            <EmptyNote text="No badges earned yet." />
          ) : (
            <ul className="divide-y divide-sage/10">
              {member.badges.map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-3">
                  <span className="text-2xl leading-none">{b.icon || "🏆"}</span>
                  <div className="min-w-0">
                    <div className="font-body font-medium text-charcoal truncate">{b.name}</div>
                    {b.description && <div className="font-body text-xs text-charcoal/50 truncate">{b.description}</div>}
                    {b.earnedAt && <div className="font-body text-xs text-charcoal/40">Earned {fmtDate(b.earnedAt)}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Support tickets */}
      <SectionCard title="Support tickets" icon={MessageCircle} count={member.tickets.length}>
        {member.tickets.length === 0 ? (
          <EmptyNote text="No support tickets." />
        ) : (
          <ul className="divide-y divide-sage/10">
            {member.tickets.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="font-body font-medium text-charcoal capitalize">{t.type.replace(/_/g, " ")}</div>
                  {t.reason && <div className="font-body text-xs text-charcoal/60 truncate">{t.reason}</div>}
                  <div className="font-body text-xs text-charcoal/40">
                    {fmtDate(t.createdAt)}
                    {t.pauseFrom ? ` · pause ${fmtDate(t.pauseFrom)}→${fmtDate(t.pauseTo)}` : ""}
                  </div>
                </div>
                <TicketStatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <ManagePassDialog member={member} open={manageOpen} onOpenChange={setManageOpen} onDone={onReload} />
      <EditProfileDialog member={member} open={editOpen} onOpenChange={setEditOpen} onDone={onReload} />
    </>
  );
}

/* ──────────────────────────  Edit profile dialog  ────────────────────────── */

function EditProfileDialog({
  member,
  open,
  onOpenChange,
  onDone,
}: {
  member: MemberDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(member.whatsappPhone ?? "");
  const [gender, setGender] = useState(member.gender ?? "");
  const [dob, setDob] = useState(member.dob ? member.dob.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName(member.name);
      setPhone(member.phone ?? "");
      setWhatsapp(member.whatsappPhone ?? "");
      setGender(member.gender ?? "");
      setDob(member.dob ? member.dob.slice(0, 10) : "");
    }
  }, [open, member]);

  async function save() {
    if (!fullName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          profile_id: member.id,
          profile_fields: {
            full_name: fullName,
            phone,
            whatsapp_phone: whatsapp,
            gender,
            dob,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Update failed");
      }
      toast.success("Profile updated");
      onOpenChange(false);
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[440px] bg-white-warm border-sage/20">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="font-display text-2xl text-charcoal">Edit profile</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="font-body text-charcoal/60">
            Update {member.name}&apos;s contact details. Email and login are unchanged.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="border-sage/20 focus:border-sage font-body" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="border-sage/20 focus:border-sage font-body" placeholder="+91 …" />
            </div>
            <div>
              <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">WhatsApp</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="border-sage/20 focus:border-sage font-body" placeholder="+91 …" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">Gender</Label>
              <Select value={gender || "unset"} onValueChange={(v) => setGender(v === "unset" ? "" : v)}>
                <SelectTrigger className="border-sage/20 font-body">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">—</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">Date of birth</Label>
              <DatePicker value={dob} onChange={setDob} placeholder="Select date" />
            </div>
          </div>
        </div>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="border-charcoal/20 text-charcoal hover:bg-charcoal/5 font-body">
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving} variant="sage">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/* ──────────────────────────  Manage dialog (pass config → payment)  ────────────────────────── */

function ManagePassDialog({
  member,
  open,
  onOpenChange,
  onDone,
}: {
  member: MemberDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => Promise<void>;
}) {
  const [step, setStep] = useState<"config" | "payment">("config");
  const [passType, setPassType] = useState<"class_pass" | "studio_pass">(
    member.passCategory === "studio_pass" ? "studio_pass" : "class_pass",
  );
  const [credits, setCredits] = useState<number | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(member.startDate ? member.startDate.slice(0, 10) : "");
  const [method, setMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofUploading, setProofUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isComp, setIsComp] = useState(false);
  const [grantNote, setGrantNote] = useState("");
  const [expiry, setExpiry] = useState("");
  const [defaultValidityDays, setDefaultValidityDays] = useState(30);

  // Reset when (re)opening so a stale selection never carries over between members.
  useEffect(() => {
    if (open) {
      setStep("config");
      setPassType(member.passCategory === "studio_pass" ? "studio_pass" : "class_pass");
      setCredits(null);
      setDays(null);
      setStartDate(member.startDate ? member.startDate.slice(0, 10) : "");
      setMethod("");
      setAmount("");
      setReference("");
      setProofUrl("");
      setIsComp(false);
      setGrantNote("");
    }
  }, [open, member]);

  // Pull the global default validity (fallback when a pass has no own duration).
  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/studio-settings", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const v = d?.settings?.default_package_validity_days;
        if (typeof v === "number" && v > 0) setDefaultValidityDays(v);
      })
      .catch(() => {});
  }, [open]);

  // Default the editable expiry from the selected duration (studio days) or the
  // global default validity. Admin can override the date afterwards.
  useEffect(() => {
    const base = new Date();
    if (passType === "studio_pass" && days) base.setDate(base.getDate() + days);
    else base.setDate(base.getDate() + defaultValidityDays);
    setExpiry(base.toISOString().slice(0, 10));
  }, [passType, days, defaultValidityDays, open]);

  const studioBlocksClass = member.passCategory === "studio_pass" && member.activePackageId !== null;

  async function patch(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? "Update failed");
    }
  }

  async function uploadProof(file: File) {
    setProofUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", "payment_proof");
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
      setProofUrl(json.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProofUploading(false);
    }
  }

  function goToPayment() {
    if (passType === "class_pass" && credits === null) {
      toast.error("Select number of classes first");
      return;
    }
    if (passType === "studio_pass" && days === null) {
      toast.error("Select number of days first");
      return;
    }
    setStep("payment");
  }

  async function applyPassConfig() {
    const body: Record<string, unknown> = {
      profile_id: member.id,
      pass_type: passType,
      is_comp: isComp,
      grant_note: grantNote.trim() || undefined,
      expiration_date: expiry || undefined,
    };
    // A comp grant always creates a fresh package; a paid grant may top up the
    // member's existing active pass.
    if (!isComp && member.activePackageId) body.user_package_id = member.activePackageId;
    if (passType === "class_pass" && credits !== null) body.class_count = credits;
    await patch(body);
  }

  async function persistStartDate() {
    if (startDate && startDate !== (member.startDate ? member.startDate.slice(0, 10) : "")) {
      await patch({ profile_id: member.id, start_date: startDate });
    }
  }

  // Comp path — no payment recorded; a grant note is required.
  async function grantComp() {
    if (passType === "class_pass" && credits === null) {
      toast.error("Select number of classes first");
      return;
    }
    if (!grantNote.trim()) {
      toast.error("A grant note is required for a comp pass");
      return;
    }
    setSubmitting(true);
    try {
      await persistStartDate();
      await applyPassConfig();
      toast.success(`Comp pass granted to ${member.name}`);
      onOpenChange(false);
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not grant comp pass");
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    if (!method) {
      toast.error("Select a payment method");
      return;
    }
    const rupeeVal = Number(amount);
    if (!Number.isFinite(rupeeVal) || rupeeVal <= 0) {
      toast.error("Enter a valid amount in INR");
      return;
    }
    if (!proofUrl) {
      toast.error("Upload proof of payment before assigning the pass");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          user_id: member.id,
          user_package_id: member.activePackageId ?? undefined,
          method,
          amount_paise: Math.round(rupeeVal * 100),
          reference: reference || undefined,
          proof_url: proofUrl,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to record payment");
      }
      await persistStartDate();
      const hasPassSelection = (passType === "class_pass" && credits !== null) || passType === "studio_pass";
      if (hasPassSelection) await applyPassConfig();
      toast.success(`Payment recorded for ${member.name}`);
      onOpenChange(false);
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record payment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[480px] bg-white-warm border-sage/20">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="font-display text-2xl text-charcoal">Manage {member.name}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="font-body text-charcoal/60">
            {step === "config" ? "Step 1 of 2 — pass configuration" : "Step 2 of 2 — payment"}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex items-center gap-2 px-1">
          <div className="h-1.5 flex-1 rounded-full bg-sage" />
          <div className={`h-1.5 flex-1 rounded-full ${step === "payment" ? "bg-sage" : "bg-sage/20"}`} />
        </div>

        {step === "config" && (
          <div className="space-y-6 py-4">
            <div>
              <Label className="font-body text-charcoal/80 mb-3 block">Pass type</Label>
              <div className="flex gap-2">
                {(["class_pass", "studio_pass"] as const).map((pt) => {
                  const blocked = pt === "class_pass" && studioBlocksClass;
                  return (
                    <button
                      key={pt}
                      type="button"
                      disabled={blocked}
                      onClick={() => { setPassType(pt); setCredits(null); setDays(null); }}
                      className={`flex-1 py-2.5 rounded-full text-sm font-body font-medium border transition-colors ${
                        blocked
                          ? "bg-charcoal/5 text-charcoal/35 border-charcoal/10 cursor-not-allowed"
                          : passType === pt
                            ? "bg-sage text-cream border-sage"
                            : "bg-white-warm text-charcoal/70 border-charcoal/20 hover:border-sage/40"
                      }`}
                    >
                      {pt === "class_pass" ? "Class pass" : "Studio pass"}
                    </button>
                  );
                })}
              </div>
              {studioBlocksClass && (
                <p className="font-body text-xs text-charcoal/50 mt-2">
                  Studio pass is unlimited — a class pass can&apos;t be added until it expires.
                </p>
              )}
            </div>

            {passType === "class_pass" && (
              <div>
                <Label className="font-body text-charcoal/80 mb-3 block">
                  Classes remaining
                  <span className="ml-2 text-charcoal/40 font-normal">(currently {member.credits})</span>
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[1, 4, 8, 12].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCredits(n)}
                      className={`h-14 rounded-xl text-base font-display border transition-colors flex items-center justify-center ${
                        credits === n ? "bg-sage text-cream border-sage" : "bg-sage/5 text-charcoal border-sage/20 hover:bg-sage/10"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {passType === "studio_pass" && (
              <div>
                <Label className="font-body text-charcoal/80 mb-3 block">Days remaining (from today)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[30, 90, 180, 365].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays(d)}
                      className={`h-14 rounded-xl text-base font-display border transition-colors flex items-center justify-center ${
                        days === d ? "bg-sage text-cream border-sage" : "bg-sage/5 text-charcoal border-sage/20 hover:bg-sage/10"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-sage/10 pt-4">
              <Label className="font-body text-charcoal/80 mb-2 block">Pass expiry</Label>
              <DatePicker value={expiry} onChange={setExpiry} className="h-11" />
              <p className="font-body text-xs text-charcoal/50 mt-1">
                Defaulted from the pass validity{passType === "class_pass" ? ` (${defaultValidityDays} days)` : ""}. Editable.
              </p>
            </div>

            <div className="border-t border-sage/10 pt-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={isComp}
                  onCheckedChange={(v) => setIsComp(v === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-body text-charcoal/90 text-sm block">Comp pass (no payment)</span>
                  <span className="font-body text-charcoal/50 text-xs block">
                    Grants the pass for free. A grant note is required; no payment is recorded.
                  </span>
                </span>
              </label>
              {isComp && (
                <div className="mt-3">
                  <Label className="font-body text-charcoal/70 text-sm mb-1 block">Grant note (required)</Label>
                  <Textarea
                    value={grantNote}
                    onChange={(e) => setGrantNote(e.target.value)}
                    placeholder="Reason for the comp grant…"
                    className="border-charcoal/20 focus:border-sage font-body"
                    rows={3}
                  />
                </div>
              )}
            </div>

            <div className="border-t border-sage/10 pt-4">
              <Label className="font-body text-charcoal/80 mb-2 block">Member start date</Label>
              <DatePicker value={startDate} onChange={setStartDate} className="h-11" />
              <p className="font-body text-xs text-charcoal/50 mt-1">
                {isComp ? "Saved together with the comp grant." : "Saved together with payment at the next step."}
              </p>
            </div>
          </div>
        )}

        {step === "payment" && (
          <div className="space-y-4 py-4">
            {((passType === "class_pass" && credits !== null) || (passType === "studio_pass" && days !== null)) && (
              <div className="rounded-xl bg-sage/5 border border-sage/20 p-3">
                <div className="font-body text-xs text-charcoal/60 uppercase tracking-wide mb-1">Selected pass</div>
                <div className="font-display text-lg text-charcoal">
                  {passType === "class_pass" ? `Class pass — ${credits} classes` : `Studio pass — ${days} days`}
                </div>
              </div>
            )}

            <div>
              <Label className="font-body text-charcoal/70 text-sm mb-2 block">Payment method</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.v}
                    type="button"
                    onClick={() => setMethod(m.v)}
                    className={`h-11 rounded-lg text-sm font-body border transition-colors flex items-center justify-center px-2 ${
                      method === m.v ? "bg-sage text-cream border-sage" : "bg-sage/5 text-charcoal border-sage/20 hover:bg-sage/10"
                    }`}
                  >
                    {m.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="font-body text-charcoal/70 text-sm mb-1 block">Amount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-11 border-charcoal/20 focus:border-sage font-body"
                  placeholder="e.g. 6015"
                />
              </div>
              <div>
                <Label className="font-body text-charcoal/70 text-sm mb-1 block">Reference (opt.)</Label>
                <Input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="h-11 border-charcoal/20 focus:border-sage font-body"
                  placeholder="txn id / slip #"
                />
              </div>
            </div>

            <div>
              <Label className="font-body text-charcoal/70 text-sm mb-1 block">Proof of payment (required)</Label>
              <Input
                type="file"
                accept="image/*"
                disabled={proofUploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadProof(f);
                }}
                className="h-11 border-charcoal/20 focus:border-sage font-body file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-sage/10 file:text-sage"
              />
              {proofUploading && <p className="font-body text-xs text-charcoal/50 mt-1">Uploading…</p>}
              {proofUrl && !proofUploading && (
                <p className="font-body text-xs text-sage mt-1">
                  Proof uploaded ✓ <a href={proofUrl} target="_blank" rel="noreferrer" className="underline">view</a>
                </p>
              )}
            </div>
          </div>
        )}

        <ResponsiveDialogFooter className="gap-2 sm:gap-2">
          {step === "config" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="border-charcoal/20 text-charcoal hover:bg-charcoal/5 font-body">
                Cancel
              </Button>
              {isComp ? (
                <Button onClick={() => void grantComp()} disabled={submitting} variant="sage">
                  {submitting ? "Granting…" : "Grant comp pass"}
                </Button>
              ) : (
                <Button onClick={goToPayment} variant="sage">Continue</Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("config")} className="border-charcoal/20 text-charcoal hover:bg-charcoal/5 font-body">
                Back
              </Button>
              <Button onClick={() => void submit()} disabled={proofUploading || submitting} variant="sage">
                {submitting ? "Processing…" : "Record payment & apply pass"}
              </Button>
            </>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/* ──────────────────────────  Small components  ────────────────────────── */

function SectionCard({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl shadow-xs">
      <CardHeader>
        <CardTitle className="font-display text-lg text-charcoal flex items-center gap-2">
          <Icon className="h-4 w-4 text-sage" />
          {title}
          <span className="font-body text-sm text-charcoal/40">({count})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function InfoLine({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-3 font-body text-sm">
      <Icon className="h-4 w-4 text-sage shrink-0" />
      <span className="text-charcoal/55 w-28 shrink-0">{label}</span>
      {value ? <span className="text-charcoal/80 truncate capitalize">{value}</span> : <span className="text-charcoal/40 italic">—</span>}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="font-body text-sm text-charcoal/40 italic py-4">{text}</p>;
}

function TicketStatusBadge({ status }: { status: string }) {
  const tp = ticketStatusPill(status);
  return (
    <Pill tone={tp.tone} className="font-body capitalize shrink-0">
      {status.replace(/_/g, " ")}
    </Pill>
  );
}

function DetailSkeleton() {
  return (
    <>
      <div className="rounded-2xl border border-sage/15 bg-white-warm p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr_auto] md:items-center">
          <Skeleton className="size-24 rounded-full bg-sage/10" />
          <div className="space-y-2 min-w-0">
            <Skeleton className="h-3 w-32 bg-sage/10" />
            <Skeleton className="h-8 w-56 bg-sage/15" />
            <Skeleton className="h-4 w-64 bg-sage/10" />
          </div>
          <Skeleton className="h-9 w-40 bg-sage/10" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {["s1", "s2", "s3", "s4", "s5"].map((s) => (
          <Card key={s} className="border-sage/20 bg-white-warm">
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-3 w-20 bg-sage/10" />
              <Skeleton className="h-7 w-12 bg-sage/15" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {["c1", "c2", "c3", "c4"].map((s) => (
          <Card key={s} className="rounded-2xl shadow-xs">
            <CardHeader><Skeleton className="h-5 w-32 bg-sage/10" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full bg-sage/10" />
              <Skeleton className="h-4 w-5/6 bg-sage/10" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
