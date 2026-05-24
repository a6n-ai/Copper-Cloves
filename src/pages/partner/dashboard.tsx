import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { startOfMondayWeekLocal, endOfSundayWeekLocal } from "@/lib/calendarWeek";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/admin/MetricCard";
import { DayScheduleList, type ScheduleRow } from "@/components/admin/DayScheduleList";
import { CalendarDays, Users, Hourglass, CheckCircle2, ArrowRight } from "lucide-react";
import { PartnerDashboardSkeleton } from "@/components/dashboard/skeletons";
import { PageHeader } from "@/components/dashboard/PageHeader";

interface ClassRow {
  id: string;
  className: string;
  instructorName: string;
  startTime: string;
  capacity: number;
  signups: number;
  checkedInCount: number;
  bookings: { confirmationStatus: string | null }[];
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function PartnerDashboard() {
  const router = useRouter();
  const [weekClasses, setWeekClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const from = startOfMondayWeekLocal(now);
        const to = endOfSundayWeekLocal(from);
        const res = await fetch(`/api/partner/classes?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
        if (res.status === 401) { router.replace("/partner/login"); return; }
        if (res.ok) setWeekClasses(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const stats = useMemo(() => {
    let signups = 0, pending = 0, checkedIn = 0;
    for (const c of weekClasses) {
      signups += c.signups;
      checkedIn += c.checkedInCount;
      pending += c.bookings.filter((b) => b.confirmationStatus === "pending").length;
    }
    return { classes: weekClasses.length, signups, pending, checkedIn };
  }, [weekClasses]);

  const todayItems: ScheduleRow[] = useMemo(() => {
    const now = new Date();
    return weekClasses
      .filter((c) => isSameDay(new Date(c.startTime), now))
      .map((c) => ({
        id: c.id,
        name: c.className,
        time: new Date(c.startTime).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
        instructor: c.instructorName,
        enrolled: c.signups,
        capacity: c.capacity,
      }));
  }, [weekClasses]);

  return (
    <main className="max-w-5xl mx-auto p-4 lg:p-6 space-y-6">
      <PageHeader
        title="Dashboard"
        actions={
          <Button asChild className="bg-sage hover:bg-sage/90 text-white font-body">
            <Link href="/partner/classes">View classes <ArrowRight className="h-4 w-4 ml-1.5" /></Link>
          </Button>
        }
      />

      {loading ? (
        <PartnerDashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Classes this week" value={stats.classes} icon={CalendarDays} tone="sage" />
            <MetricCard label="Signed up" value={stats.signups} icon={Users} tone="sage" hint="Across this week" />
            <MetricCard label="Pending confirmation" value={stats.pending} icon={Hourglass} tone="amber" />
            <MetricCard label="Checked in" value={stats.checkedIn} icon={CheckCircle2} tone="sage" />
          </div>

          <Card className="border-sage/20 bg-white/95">
            <CardHeader>
              <CardTitle className="font-display text-xl text-charcoal">Today&apos;s classes</CardTitle>
              <CardDescription className="font-body text-charcoal/60">Your sessions scheduled for today</CardDescription>
            </CardHeader>
            <CardContent>
              <DayScheduleList
                items={todayItems}
                emptyText="No classes scheduled today"
                onSelect={() => router.push("/partner/classes")}
              />
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const sess = await getStudioServerSession(context.req as never, context.res as never);
  const user = sess?.user as { role?: string; partner_id?: string | null } | undefined;
  if (!user || user.role !== "partner" || !user.partner_id) {
    return { redirect: { destination: "/partner/login", permanent: false } };
  }
  return { props: {} };
};
