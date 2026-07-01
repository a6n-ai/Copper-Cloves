import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import {
  Calendar,
  Package,
  History,
  Lock,
  Target,
  BarChart3,
  Coffee,
  Activity as ActivityIcon,
  Flame,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatedIcon } from "@/components/dashboard/AnimatedIcon";
import { StatCardRow, type StatCardProps } from "@/components/dashboard/StatCard";
import { MedalJourney, type JourneyTier, type JourneyCustomBadge } from "@/components/dashboard/MedalJourney";
import { PassCard } from "@/components/dashboard/PassCard";
import { Card, CardContent } from "@/components/ui/card";
import { UpcomingScheduleCard, type ScheduleEntry } from "@/components/dashboard/UpcomingScheduleCard";
// recharts only loads when the member taps open the vitality dialog.
const VitalityAreaChart = dynamic(
  () => import("@/components/dashboard/VitalityAreaChart").then((m) => ({ default: m.VitalityAreaChart })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] w-full animate-pulse rounded-2xl bg-muted/40" />
    ),
  },
);
import { ActivityTimeline, type ActivityItem } from "@/components/dashboard/ActivityTimeline";
import { PeekTile } from "@/components/dashboard/mobile/PeekTile";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";

type PeekKey = "vitality" | "badges" | "activity" | null;

export interface MemberMobileDashboardProps {
  userName: string;
  userClassesCompleted: number;
  currentStreak: number;
  packageDetails: { name: string; isUnlimited: boolean; classCount: number | null } | null;
  creditsRemaining: number;
  activePasses: {
    id: string;
    name: string;
    isUnlimited: boolean;
    classesRemaining: number | null;
    expiry: string | null;
    durationMonths: number | null;
    status: string;
  }[];

  dailyIntention: string;
  isEditingIntention: boolean;
  onIntentionChange: (v: string) => void;
  onToggleEditIntention: (editing: boolean) => void;

  statItems: StatCardProps[];

  milestones: JourneyTier[];

  upcomingEntries: ScheduleEntry[];
  userBadges: (JourneyCustomBadge & { badge_type?: string })[];
  recentActivities: ActivityItem[];
  lastCafeOrder: string | null;

  vitality: {
    series: number[];
    totalMinutes: number;
    avgPerDay: number;
    vsLabel: string;
    vsTone: "neutral" | "up" | "down";
  };

  onShowOrderHistory: () => void;
}

export function MemberMobileDashboard({
  userName,
  userClassesCompleted,
  currentStreak,
  packageDetails,
  creditsRemaining: _creditsRemaining,
  activePasses,
  dailyIntention,
  isEditingIntention,
  onIntentionChange,
  onToggleEditIntention,
  statItems,
  milestones,
  upcomingEntries,
  userBadges,
  recentActivities,
  lastCafeOrder,
  vitality,
  onShowOrderHistory,
}: MemberMobileDashboardProps) {
  const router = useRouter();
  const [peek, setPeek] = useState<PeekKey>(null);

  // Memoized so the inline tile array doesn't allocate 4 fresh closures per
  // render of the mobile dashboard (state changes here are frequent: peek,
  // pull-to-refresh, etc.).
  const quickBookTiles = useMemo(
    () => [
      { icon: Calendar, label: "Book", action: () => router.push("/portal/book") },
      { icon: Package, label: "Packages", action: () => router.push("/portal/packages") },
      { icon: History, label: "History", action: onShowOrderHistory },
      { icon: Lock, label: "Password", action: () => router.push("/account#reset-password") },
    ],
    [router, onShowOrderHistory],
  );

  const nextClass = upcomingEntries[0];
  const creditsLabel = packageDetails
    ? packageDetails.isUnlimited
      ? packageDetails.name
      : `${packageDetails.classCount ?? 0} classes left`
    : "No active package";

  const peekTitle =
    peek === "vitality" ? "Movement Vitality" : peek === "badges" ? "Achievements" : "Recent Activity";

  return (
    <div className="space-y-5 px-4 py-5">
      {/* Hero */}
      <section className="rounded-3xl border border-sage/20 bg-linear-to-br from-sage to-sage/80 p-5 text-cream">
        <h1 className="font-body font-semibold text-2xl leading-tight">
          Welcome home, {userName || "Member"}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-body text-sm text-cream/85">
          <span className="tabular-nums">{userClassesCompleted} classes</span>
          {currentStreak > 0 && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Flame size={13} /> {currentStreak}-day streak
            </span>
          )}
          <span>· {creditsLabel}</span>
        </p>

        {/* Today's intention */}
        <div className="mt-4 rounded-2xl bg-white-warm/15 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 font-body text-xs uppercase tracking-wide text-cream/70">
            <Target size={13} /> Today's intention
          </div>
          {isEditingIntention ? (
            <div className="flex gap-2">
              <Input
                value={dailyIntention}
                onChange={(e) => onIntentionChange(e.target.value)}
                className="h-9 flex-1 border-cream/30 bg-card/90 text-charcoal font-body text-sm"
                placeholder="Set your focus for today..."
              />
              <Button
                size="sm"
                onClick={() => onToggleEditIntention(false)}
                className="bg-white-warm text-sage hover:bg-card/90 font-body"
              >
                Save
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="font-body text-sm italic text-cream/90">{dailyIntention}</p>
              <button
                type="button"
                onClick={() => onToggleEditIntention(true)}
                className="shrink-0 font-body text-xs text-cream/80 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Next class CTA (doubles as check-in) */}
      {nextClass ? (
        <button
          type="button"
          onClick={nextClass.onClick}
          className="flex w-full items-center gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/10 p-4 text-left active:scale-[0.98] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-terracotta">
            <Calendar size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-body text-xs uppercase tracking-wide text-terracotta">
              Next class · tap to check in
            </span>
            <span className="block truncate font-body text-base leading-tight text-charcoal">{nextClass.title}</span>
            <span className="block font-body text-xs text-muted-text">
              {nextClass.whenISO
                ? new Date(nextClass.whenISO).toLocaleString("en-US", {
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}
            </span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-terracotta/60" />
        </button>
      ) : (
        <Button
          onClick={() => router.push("/portal/book")}
          variant="outline"
          className="w-full border-terracotta/30 bg-terracotta/10 py-6 text-terracotta hover:bg-terracotta/15 font-body"
        >
          Book your next class
        </Button>
      )}

      {/* Your passes — lead card */}
      {activePasses.length > 0 && (
        <Card className="border-border bg-white-warm shadow-none">
          <CardContent className="p-4">
            <h2 className="mb-3 px-0.5 font-body text-xs uppercase tracking-wide text-charcoal/45">Your passes</h2>
            <div className="space-y-3">
              {activePasses.map((p) => (
                <PassCard
                  key={p.id}
                  name={p.name}
                  isUnlimited={p.isUnlimited}
                  classesRemaining={p.classesRemaining}
                  expiry={p.expiry}
                  durationMonths={p.durationMonths}
                  status={p.status}
                  className="w-full"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Your journey — badges (lead card, paired with passes) */}
      <section>
        <h2 className="mb-2 px-1 font-body text-xs uppercase tracking-wide text-charcoal/45">Your journey</h2>
        <MedalJourney
          milestones={milestones}
          classesCompleted={userClassesCompleted}
          earnedCustom={userBadges.filter((b: { badge_type?: string }) => b.badge_type === "custom")}
        />
      </section>

      {/* Quick Book — 4 icon tiles */}
      <section>
        <h2 className="mb-2 px-1 font-body text-xs uppercase tracking-wide text-charcoal/45">Quick book</h2>
        <div className="grid grid-cols-2 min-[360px]:grid-cols-4 gap-2">
          {quickBookTiles.map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              type="button"
              onClick={action}
              className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-lg border border-sage/15 bg-white-warm px-1 py-2 active:scale-[0.96] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1"
            >
              <AnimatedIcon icon={Icon} size={20} className="text-sage" />
              <span className="text-center text-[10px] font-body leading-tight text-charcoal/70">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Stat mini-grid */}
      <StatCardRow items={statItems} />

      {/* Upcoming classes */}
      {upcomingEntries.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 font-body text-xs uppercase tracking-wide text-charcoal/45">Upcoming</h2>
          <UpcomingScheduleCard entries={upcomingEntries} />
        </section>
      )}

      {/* Explore — peek tiles */}
      <section>
        <h2 className="mb-2 px-1 font-body text-xs uppercase tracking-wide text-charcoal/45">Explore</h2>
        <div className="space-y-2">
          <PeekTile
            icon={BarChart3}
            label="Movement Vitality"
            hint={`${vitality.totalMinutes} min in 30 days`}
            onClick={() => setPeek("vitality")}
          />
          <PeekTile
            icon={Coffee}
            label="Nourish café"
            hint={lastCafeOrder ? `Last: ${lastCafeOrder}` : "Browse the menu"}
            onClick={() => router.push("/portal/menu")}
          />
          <PeekTile
            icon={History}
            label="Order history"
            hint="Your café orders"
            onClick={onShowOrderHistory}
          />
          <PeekTile
            icon={ActivityIcon}
            label="Recent activity"
            hint={recentActivities.length > 0 ? `${recentActivities.length} updates` : "Nothing yet"}
            onClick={() => setPeek("activity")}
          />
        </div>
      </section>

      {/* Spacer so bottom-nav doesn't cover content */}
      <div className="h-4" />

      {/* Peek sheet */}
      <ResponsiveDialog open={peek !== null} onOpenChange={(o) => !o && setPeek(null)}>
        <ResponsiveDialogContent className="max-h-[85vh] overflow-y-auto">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{peekTitle}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>

          <div className="pt-2">
            {peek === "vitality" && (
              <VitalityAreaChart
                series={vitality.series}
                totalMinutes={vitality.totalMinutes}
                avgPerDay={vitality.avgPerDay}
                vsLabel={vitality.vsLabel}
                vsTone={vitality.vsTone}
              />
            )}

            {peek === "activity" && (
              <ActivityTimeline
                items={recentActivities}
                emptyCta={
                  <Button
                    onClick={() => router.push("/portal/book")}
                    size="sm"
                    variant="sage"
                  >
                    Book Your First Class
                  </Button>
                }
              />
            )}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
