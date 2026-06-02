import { SEO } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { ClassCard } from "@/components/classes/ClassCard";
import { ClassDetailDialog } from "@/components/classes/ClassDetailDialog";
import { CategoryFilter } from "@/components/classes/CategoryFilter";
import type { GetStaticProps } from "next";
import prisma from "@/lib/prisma";
import { cdnUrl } from "@/lib/cdnUrl";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  mondayBasedWeekBoundsInMonth,
  defaultPortalWeekSelection,
} from "@/lib/calendarWeek";

// Class catalog moved to `getStaticProps` + 5-min ISR — `fetchClassesList` is
// no longer needed. The schedule fetcher below still dedupes in-flight requests
// (Strict Mode + tab refetch) without AbortController.
const scheduleListPromises = new Map<string, Promise<unknown[]>>();

function fetchScheduleList(fromMs: number, toMs: number): Promise<unknown[]> {
  const key = `${fromMs}-${toMs}`;
  let promise = scheduleListPromises.get(key);
  if (!promise) {
    const params = new URLSearchParams({
      fromMs: String(fromMs),
      toMs: String(toMs),
    });
    promise = fetch(`/api/class-schedules?${params}`, { credentials: "omit" })
      .then((res) => (res.ok ? res.json() : []))
      .finally(() => {
        scheduleListPromises.delete(key);
      });
    scheduleListPromises.set(key, promise);
  }
  return promise;
}

interface ScheduleClass {
  time: string;
  name: string;
  instructor: string;
}

interface DaySchedule {
  day: string;
  date: string;
  classes: ScheduleClass[];
}

/** Mirrors the class catalog Card: tall image with a badge, title, two-line copy, info row, benefit chips, button. */
function ClassCardSkeleton() {
  return (
    <Card className="border-0 bg-white-warm shadow-lg overflow-hidden">
      <div className="relative h-64 overflow-hidden bg-sage/5">
        <Skeleton className="h-full w-full rounded-none" />
        <Skeleton className="absolute top-4 right-4 h-6 w-20 rounded-full" />
      </div>
      <CardContent className="p-6">
        <Skeleton className="h-7 w-3/5 mb-3" />
        <Skeleton className="h-3.5 w-full mb-2" />
        <Skeleton className="h-3.5 w-4/5 mb-4" />
        <div className="flex items-center gap-4 mb-4">
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="mb-4">
          <Skeleton className="h-3.5 w-24 mb-2" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

function ClassesGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {Array.from({ length: count }).map((_, i) => (
        <ClassCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Mirrors one weekly-schedule day column: day header (title + date), then a few time/name rows. */
function ScheduleDaySkeleton() {
  return (
    <div className="p-6">
      <div className="mb-4 pb-3 border-b border-[#e5e4dc]">
        <Skeleton className="h-6 w-28 mb-2" />
        <Skeleton className="h-3.5 w-16" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-3.5 w-24 shrink-0" />
            <Skeleton className="h-3.5 w-40 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <ScheduleDaySkeleton key={i} />
      ))}
    </div>
  );
}

export interface PublicInstructor {
  name: string;
  title: string | null;
  imageUrl: string | null;
  specialties: string[];
}

export interface PublicClass {
  id: string;
  name: string;
  category: string;
  description: string;
  benefits: string[];
  duration: number;
  maxCapacity: number;
  imageUrl: string | null;
  instructor: PublicInstructor | null;
}

interface ClassesPageProps {
  initialClasses: PublicClass[];
}

export const getStaticProps: GetStaticProps<ClassesPageProps> = async () => {
  try {
    const rows = await prisma.classModel.findMany({
      orderBy: [{ display_order: "asc" }, { name: "asc" }],
      include: {
        instructor: {
          omit: { studio_payout_cut_percent: true, hashed_password: true },
        },
      },
    });
    const initialClasses: PublicClass[] = rows.map((cls) => ({
      id: cls.id,
      name: cls.name || "Class",
      category: cls.category || "General",
      description: cls.description || "",
      benefits: cls.benefits ?? [],
      duration: cls.duration ?? 60,
      maxCapacity: cls.max_capacity ?? 15,
      imageUrl: cls.image_url ?? null,
      instructor: cls.instructor
        ? {
            name: cls.instructor.name,
            title: cls.instructor.title ?? null,
            imageUrl: cls.instructor.image_url ?? null,
            specialties: cls.instructor.specialties ?? [],
          }
        : null,
    }));
    return { props: { initialClasses }, revalidate: 300 };
  } catch {
    return { props: { initialClasses: [] }, revalidate: 300 };
  }
};

export default function ClassesPage({ initialClasses }: ClassesPageProps) {
  const router = useRouter();
  const initialCalendar = defaultPortalWeekSelection();
  const [activeTab, setActiveTab] = useState("classes");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedClass, setSelectedClass] = useState<PublicClass | null>(null);
  const [classes] = useState<PublicClass[]>(initialClasses);
  const categories = useMemo(
    () => Array.from(new Set(classes.map((c) => c.category))).sort((a, b) => a.localeCompare(b)),
    [classes],
  );
  // Catalog is SSG'd via `getStaticProps` (5-min ISR); no client fetch.
  const loading = false;
  const [viewYear, setViewYear] = useState(initialCalendar.year);
  const [selectedWeek, setSelectedWeek] = useState(initialCalendar.week);
  const [selectedMonth, setSelectedMonth] = useState(initialCalendar.monthIndex);
  const [scheduleData, setScheduleData] = useState<DaySchedule[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const fetchScheduleData = useCallback(async (isStale?: () => boolean) => {
    try {
      setScheduleLoading(true);

      const { weekStart, weekEnd } = mondayBasedWeekBoundsInMonth(
        viewYear,
        selectedMonth,
        selectedWeek
      );

      const allData = await fetchScheduleList(weekStart.getTime(), weekEnd.getTime());
      if (isStale?.()) return;
      const data = allData.filter((item: { start_time: string; status?: string }) => {
        const t = new Date(item.start_time);
        return t >= weekStart && t <= weekEnd && item.status !== "cancelled" && item.status !== "inactive";
      });

      const instructorMap = new Map(
        data
          .filter((item: { instructor?: { id: string; name: string } }) => item.instructor)
          .map((item: { instructor: { id: string; name: string } }) => [item.instructor.id, item.instructor.name])
      );

      // Group by day in a single bucket pass (was 7 × N filter scans).
      const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const buckets: { day: string; date: string; classes: DaySchedule["classes"] }[] = [];
      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(weekStart);
        currentDay.setDate(currentDay.getDate() + i);
        buckets.push({
          day: daysOfWeek[i],
          date: currentDay.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
          classes: [],
        });
      }
      const weekStartMs = new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate(),
      ).getTime();
      const MS_PER_DAY = 86_400_000;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const item of (data || []) as any[]) {
        const itemDate = new Date(item.start_time);
        const itemDayMs = new Date(
          itemDate.getFullYear(),
          itemDate.getMonth(),
          itemDate.getDate(),
        ).getTime();
        const dayIdx = Math.floor((itemDayMs - weekStartMs) / MS_PER_DAY);
        if (dayIdx < 0 || dayIdx > 6) continue;
        const endTime = new Date(item.end_time);
        buckets[dayIdx].classes.push({
          time: `${itemDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} - ${endTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`,
          name: item.class_model?.name || "Class",
          instructor: item.instructor?.name || instructorMap.get(item.class_model?.instructor_id ?? "") || "",
        });
      }
      const daySchedules: DaySchedule[] = buckets;

      if (isStale?.()) return;
      setScheduleData(daySchedules);
    } catch (err) {
      console.error("Error fetching schedule:", err);
      if (!isStale?.()) setScheduleData([]);
    } finally {
      if (!isStale?.()) setScheduleLoading(false);
    }
  }, [viewYear, selectedMonth, selectedWeek]);

  useEffect(() => {
    if (activeTab !== "schedule") return;
    let stale = false;
    const isStale = () => stale;
    void fetchScheduleData(isStale);
    return () => {
      stale = true;
    };
  }, [activeTab, fetchScheduleData]);

  // Only the auth-status scalar is needed for the redirect decision; reading
  // the full session would re-render this page on every 4-min refetch tick.
  const { status: authStatus } = useSession();

  // Prefetch the booking route once we know the visitor is signed in — gives
  // the same perceived-speed win as a static `<Link>` without changing the
  // auth-conditional behaviour of `handleBookClass`.
  useEffect(() => {
    if (authStatus === "authenticated") {
      void router.prefetch("/portal/book");
      void router.prefetch("/portal/packages");
    } else if (authStatus === "unauthenticated") {
      void router.prefetch("/portal/login?redirect=/portal/book");
    }
  }, [authStatus, router]);

  function handleViewPackages() {
    if (authStatus !== "authenticated") {
      router.push("/portal/login?redirect=/portal/packages");
      return;
    }
    router.push("/portal/packages");
  }

  async function handleBookClass() {
    try {
      if (authStatus !== "authenticated") {
        router.push("/portal/login?redirect=/portal/book");
        return;
      }
      router.push("/portal/book");
    } catch (err) {
      console.error("Auth check error:", err);
      router.push("/portal/login?redirect=/portal/book");
    }
  }

  const filteredClasses = useMemo(
    () => selectedFilter === "all" ? classes : classes.filter((c) => c.category === selectedFilter),
    [classes, selectedFilter],
  );

  // Helper function to determine if time is morning (before 12:00 PM)
  function isMorningClass(timeString: string): boolean {
    // Extract first time from format "07:00 - 08:00"
    const firstTime = timeString.split(" - ")[0];
    const hour = parseInt(firstTime.split(":")[0]);
    return hour < 12;
  }

  // Use scalar `tab` — `router.query` is a fresh object each render and would
  // re-fire this effect needlessly.
  const queryTab = router.query.tab;
  useEffect(() => {
    if (queryTab === "schedule") setActiveTab("schedule");
  }, [queryTab]);

  return (
    <>
      <SEO 
        title="Our Classes | The Studio by Copper + Cloves"
        description="Explore our complete range of expert-led wellness classes. From Muay Thai to Aerial Yoga, find the perfect practice for your journey."
      />
      
      <Navigation />

      {/* Hero Section */}
      <section className="bg-cream pt-32 pb-12">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-[1.3fr_1fr] lg:px-8">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-sage">
              The Studio · Classes
            </p>
            <h1 className="mt-3 font-display text-5xl leading-[1.05] text-charcoal md:text-6xl">
              Find the practice that <em className="italic text-sage">moves</em> you.
            </h1>
            <p className="mt-5 max-w-[60ch] font-body text-lg leading-relaxed text-charcoal/70">
              From high-intensity circuits to restorative flows, every class is led by a real
              instructor and built to meet you where you are. Browse the studio, then book your first.
            </p>
          </div>
          <div className="relative h-64 overflow-hidden rounded-2xl shadow-[0_8px_48px_rgba(51,51,51,0.14)] lg:h-80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cdnUrl("/warriorrythm.jpg")}
              alt="A class in session at The Studio by Copper and Cloves"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Tabs Section */}
      <section className="py-8 bg-cream">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-white-warm border border-sage/20 p-1 rounded-full">
              <TabsTrigger 
                value="classes" 
                className="rounded-full data-[state=active]:bg-sage data-[state=active]:text-cream transition-all duration-300"
              >
                <Calendar className="mr-2" size={16} />
                Classes
              </TabsTrigger>
              <TabsTrigger 
                value="schedule" 
                className="rounded-full data-[state=active]:bg-sage data-[state=active]:text-cream transition-all duration-300"
              >
                <Clock className="mr-2" size={16} />
                Schedule
              </TabsTrigger>
            </TabsList>

            {/* Classes Tab Content */}
            <TabsContent value="classes" className="mt-8">
              {categories.length > 0 && (
                <div className="mb-8">
                  <CategoryFilter categories={categories} value={selectedFilter} onChange={setSelectedFilter} />
                </div>
              )}
              {loading ? (
                <ClassesGridSkeleton count={6} />
              ) : filteredClasses.length === 0 ? (
                <div className="text-center py-12">
                  <p className="font-body text-charcoal/60">No classes found for this category.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                  {filteredClasses.map((classItem) => (
                    <ClassCard key={classItem.id} classItem={classItem} onOpen={setSelectedClass} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Schedule Tab Content */}
            <TabsContent value="schedule" className="mt-8">
              <div className="bg-white-warm rounded-2xl shadow-[0_4px_24px_rgba(51,51,51,0.08)] border border-[#e5e4dc] overflow-hidden">
                {/* Schedule Header */}
                <div className="bg-cream p-6 border-b border-[#e5e4dc]">
                  <h2 className="font-display text-3xl text-charcoal text-center mb-2">
                    Weekly Schedule
                  </h2>
                  <p className="font-body text-charcoal/60 text-center text-sm">
                    Check our ticketed events on the page
                  </p>
                </div>

                {/* Week/Month Navigation */}
                <div className="bg-cream/30 border-b border-[#e5e4dc] p-4">
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
                      disabled={selectedWeek === 1}
                      className="border-sage/20 text-sage hover:bg-sage/5 disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex flex-wrap items-center gap-2">
                      <Select 
                        value={selectedMonth.toString()} 
                        onValueChange={(val) => {
                          const next = parseInt(val, 10);
                          setSelectedMonth((prev) => {
                            if (prev === 11 && next === 0) setViewYear((y) => y + 1);
                            return next;
                          });
                        }}
                      >
                        <SelectTrigger className="w-full sm:w-[180px] border-sage/20 bg-white-warm font-body text-charcoal rounded-xl focus:ring-sage">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, index) => (
                            <SelectItem key={index} value={index.toString()}>
                              {month} {viewYear}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select 
                        value={selectedWeek.toString()} 
                        onValueChange={(val) => setSelectedWeek(parseInt(val))}
                      >
                        <SelectTrigger className="w-full sm:w-[280px] border-sage/20 bg-white-warm font-body text-charcoal rounded-xl focus:ring-sage">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((week) => {
                            const { weekStart, weekEnd } = mondayBasedWeekBoundsInMonth(
                              viewYear,
                              selectedMonth,
                              week
                            );
                            return (
                              <SelectItem key={week} value={week.toString()}>
                                Week {week}: {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedWeek(Math.min(5, selectedWeek + 1))}
                      disabled={selectedWeek === 5}
                      className="border-sage/20 text-sage hover:bg-sage/5 disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Schedule Grid */}
                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#e5e4dc]">
                  {scheduleLoading ? (
                    <div className="col-span-2">
                      <ScheduleGridSkeleton count={4} />
                    </div>
                  ) : scheduleData.length === 0 ? (
                    <div className="col-span-2 text-center py-12">
                      <p className="font-body text-charcoal/60">No classes scheduled for this week</p>
                    </div>
                  ) : (
                    scheduleData.map((daySchedule, index) => (
                      <div 
                        key={index} 
                        className="p-6 hover:bg-sage/5 transition-colors duration-300"
                      >
                        {/* Day Header */}
                        <div className="mb-4 pb-3 border-b border-[#e5e4dc]">
                          <h3 className="font-display text-xl text-charcoal capitalize">
                            {daySchedule.day}
                          </h3>
                          <p className="font-body text-charcoal/50 text-sm">
                            {daySchedule.date}
                          </p>
                        </div>

                        {/* Classes List */}
                        <div className="space-y-3">
                          {daySchedule.classes.length === 0 ? (
                            <p className="font-body text-sm text-charcoal/40 italic">No classes scheduled</p>
                          ) : (
                            daySchedule.classes.map((classItem, classIndex) => (
                              <div 
                                key={classIndex}
                                className={`flex gap-3 ${
                                  classItem.name === "Class Cancelled" 
                                    ? "opacity-50" 
                                    : ""
                                }`}
                              >
                                <div className="shrink-0">
                                  <p className={`font-body text-xs whitespace-nowrap ${
                                    classItem.name === "Class Cancelled"
                                      ? "text-charcoal/70"
                                      : isMorningClass(classItem.time)
                                      ? "text-sage font-medium"
                                      : "text-charcoal/70"
                                  }`}>
                                    {classItem.time}
                                  </p>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`font-body text-sm ${
                                    classItem.name === "Class Cancelled"
                                      ? "text-charcoal/50 line-through"
                                      : isMorningClass(classItem.time)
                                      ? "text-sage font-medium"
                                      : "text-charcoal"
                                  }`}>
                                    {classItem.name}
                                    {classItem.instructor && (
                                      <span className={classItem.name === "Class Cancelled" ? "text-charcoal/50" : isMorningClass(classItem.time) ? "text-sage/80" : "text-charcoal/60"}> - {classItem.instructor}</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-sage text-cream relative overflow-hidden">
        <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="font-display text-4xl md:text-5xl mb-6">
            Ready to Begin?
          </h2>
          <p className="font-body text-lg text-cream/90 mb-8 leading-relaxed">
            Choose your package, book your first class, and step into your wellness journey today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={handleViewPackages}
              size="lg"
              className="bg-white-warm text-sage hover:bg-[#fafaf8]/90 px-8 transition-all duration-600 ease-in-out"
            >
              View Packages
            </Button>
            <Button 
              onClick={handleBookClass}
              size="lg"
              variant="outline"
              className="border-cream/40 text-cream hover:bg-[#fafaf8]/10 transition-all duration-600 ease-in-out"
            >
              Book Your First Class
            </Button>
          </div>
        </div>
      </section>

      <ClassDetailDialog
        classItem={selectedClass}
        authed={authStatus === "authenticated"}
        onClose={() => setSelectedClass(null)}
        onBook={handleBookClass}
      />

      <Footer />
    </>
  );
}