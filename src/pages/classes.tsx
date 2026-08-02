import { SEO } from "@/components/SEO";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { ClassCard } from "@/components/classes/ClassCard";
import { ClassDetailDialog } from "@/components/classes/ClassDetailDialog";
import { CategoryFilter } from "@/components/classes/CategoryFilter";
import { ScheduleDayFilter } from "@/components/classes/ScheduleDayFilter";
import { ScheduleClassRow } from "@/components/classes/ScheduleClassRow";
import type { GetStaticProps } from "next";
import prisma from "@/lib/prisma";
import { cdnUrl } from "@/lib/cdnUrl";
import Image from "next/image";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/auth/client";
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
      visibleOnly: "1",
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
  instructorImageUrl: string | null;
}

interface DaySchedule {
  day: string;
  date: string;
  isToday: boolean;
  classes: ScheduleClass[];
}

/** Mirrors the class catalog Card: tall image with a badge, title, two-line copy, info row, benefit chips, button. */
function ClassCardSkeleton() {
  return (
    <Card className="border bg-white-warm shadow-sm overflow-hidden">
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
      <div className="mb-4 pb-3 border-b border-border">
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
  const [selectedDay, setSelectedDay] = useState<number | "all">("all");

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
      const todayStr = new Date().toDateString();
      const buckets: { day: string; date: string; isToday: boolean; classes: DaySchedule["classes"] }[] = [];
      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(weekStart);
        currentDay.setDate(currentDay.getDate() + i);
        buckets.push({
          day: daysOfWeek[i],
          date: currentDay.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
          isToday: currentDay.toDateString() === todayStr,
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
          instructorImageUrl: item.instructor?.image_url ?? null,
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

  // Only the auth-status scalar is needed for the redirect decision.
  const { data: authSession, isPending: authPending } = useSession();
  const authStatus = authSession?.user ? "authenticated" : authPending ? "loading" : "unauthenticated";

  // Prefetch the booking route once we know the visitor is signed in — gives
  // the same perceived-speed win as a static `<Link>` without changing the
  // auth-conditional behaviour of `handleBookClass`.
  useEffect(() => {
    if (authStatus === "authenticated") {
      void router.prefetch("/portal/book");
      void router.prefetch("/portal/packages");
    } else if (authStatus === "unauthenticated") {
      void router.prefetch("/login?redirect=/portal/book");
    }
  }, [authStatus, router]);

  function handleSignupToBook() {
    router.push("/portal/signup?redirect=/portal/book");
  }

  function handleViewPackages() {
    if (authStatus !== "authenticated") {
      router.push("/login?redirect=/portal/packages");
      return;
    }
    router.push("/portal/packages");
  }

  async function handleBookClass() {
    try {
      if (authStatus !== "authenticated") {
        router.push("/login?redirect=/portal/book");
        return;
      }
      router.push("/portal/book");
    } catch (err) {
      console.error("Auth check error:", err);
      router.push("/login?redirect=/portal/book");
    }
  }

  const filteredClasses = useMemo(
    () => selectedFilter === "all" ? classes : classes.filter((c) => c.category === selectedFilter),
    [classes, selectedFilter],
  );

  const dayOptions = useMemo(
    () => scheduleData.map((d, i) => ({ index: i, day: d.day, date: d.date, count: d.classes.length })),
    [scheduleData],
  );
  const todayIndex = useMemo(() => {
    const i = scheduleData.findIndex((d) => d.isToday);
    return i >= 0 ? i : null;
  }, [scheduleData]);

  useEffect(() => {
    if (scheduleData.length === 0) return;
    const todayIdx = scheduleData.findIndex((d) => d.isToday);
    if (todayIdx >= 0) {
      setSelectedDay(todayIdx);
      return;
    }
    const firstWithClasses = scheduleData.findIndex((d) => d.classes.length > 0);
    setSelectedDay(firstWithClasses >= 0 ? firstWithClasses : "all");
  }, [scheduleData]);

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
            <Image
              src={cdnUrl("/warriorrythm.jpg")}
              alt="A class in session at The Studio by Copper and Cloves"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
              quality={90}
            />
          </div>
        </div>
      </section>

      {/* Tabs Section */}
      <section className="py-8 bg-cream">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mx-auto flex h-auto w-fit rounded-lg border border-sage/20 bg-white-warm p-1.5 shadow-xs">
              <TabsTrigger
                value="classes"
                className="rounded-md px-8 py-2.5 font-body text-sm font-normal text-charcoal transition-colors duration-300 hover:text-sage data-[state=active]:bg-sage data-[state=active]:text-cream data-[state=active]:shadow-sm"
              >
                Classes
              </TabsTrigger>
              <TabsTrigger
                value="schedule"
                className="rounded-md px-8 py-2.5 font-body text-sm font-normal text-charcoal transition-colors duration-300 hover:text-sage data-[state=active]:bg-sage data-[state=active]:text-cream data-[state=active]:shadow-sm"
              >
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
              <div className="bg-white-warm rounded-2xl shadow-[0_4px_24px_rgba(51,51,51,0.08)] border border-border overflow-hidden">
                {/* Schedule Header */}
                <div className="bg-cream p-6 border-b border-border">
                  <h2 className="font-display text-3xl text-charcoal text-center mb-2">
                    Weekly Schedule
                  </h2>
                  <p className="font-body text-charcoal/60 text-center text-sm">
                    Browse classes by day, or switch to the full week.
                  </p>
                </div>

                {/* Week/Month Navigation */}
                <div className="bg-cream/30 border-b border-border p-4">
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <Button
                      variant="sage-outline"
                      size="sm"
                      onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
                      disabled={selectedWeek === 1}
                      className="disabled:opacity-30"
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
                      variant="sage-outline"
                      size="sm"
                      onClick={() => setSelectedWeek(Math.min(5, selectedWeek + 1))}
                      disabled={selectedWeek === 5}
                      className="disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Schedule Grid */}
                {scheduleLoading ? (
                  <ScheduleGridSkeleton count={4} />
                ) : scheduleData.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="font-body text-charcoal/60">No classes scheduled for this week</p>
                  </div>
                ) : (
                  <>
                    {/* Day filter chips */}
                    <div className="p-4 border-b border-border">
                      <ScheduleDayFilter
                        days={dayOptions}
                        value={selectedDay}
                        todayIndex={todayIndex}
                        onChange={setSelectedDay}
                      />
                    </div>

                    {/* All-week grid or single-day panel */}
                    {selectedDay === "all" ? (
                      <div className="grid divide-y divide-border md:grid-cols-2 md:divide-y-0 md:[&>*:nth-child(odd)]:border-r md:[&>*]:border-border">
                        {scheduleData.map((daySchedule, index) => (
                          <div key={index} className="p-4 sm:p-6">
                            <div className="mb-4 flex items-end justify-between gap-3 border-b border-border pb-3">
                              <div>
                                <h3 className="font-display text-xl capitalize text-charcoal">{daySchedule.day}</h3>
                                <p className="font-body text-sm text-charcoal/50">{daySchedule.date}</p>
                              </div>
                              {daySchedule.classes.length > 0 && (
                                <span className="font-body text-xs text-charcoal/45">
                                  {daySchedule.classes.length} {daySchedule.classes.length === 1 ? "class" : "classes"}
                                </span>
                              )}
                            </div>
                            {daySchedule.classes.length === 0 ? (
                              <p className="font-body text-sm italic text-charcoal/40">No classes scheduled</p>
                            ) : (
                              <div className="space-y-2.5">
                                {daySchedule.classes.map((classItem, classIndex) => (
                                  <ScheduleClassRow
                                    key={classIndex}
                                    time={classItem.time}
                                    name={classItem.name}
                                    instructor={classItem.instructor}
                                    instructorImageUrl={classItem.instructorImageUrl}
                                    morning={isMorningClass(classItem.time)}
                                    onBook={authStatus === "authenticated" ? handleBookClass : handleSignupToBook}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      (() => {
                        const day = scheduleData[selectedDay];
                        if (!day) return null;
                        return (
                          <div className="p-4 sm:p-6">
                            <div className="mb-5 flex items-end justify-between gap-3 border-b border-border pb-4">
                              <div>
                                <h3 className="font-display text-3xl capitalize text-charcoal">{day.day}</h3>
                                <p className="font-body text-sm text-charcoal/50">{day.date}</p>
                              </div>
                              <span className="font-body text-xs text-charcoal/50">
                                {day.classes.length} {day.classes.length === 1 ? "class" : "classes"}
                              </span>
                            </div>
                            {day.classes.length === 0 ? (
                              <div className="flex flex-col items-center gap-2 py-12 text-center">
                                <Calendar className="size-8 text-charcoal/25" aria-hidden="true" />
                                <p className="font-body text-sm text-charcoal/45">No classes scheduled this day.</p>
                              </div>
                            ) : (
                              <div className="mx-auto grid max-w-2xl gap-2.5">
                                {day.classes.map((classItem, classIndex) => (
                                  <ScheduleClassRow
                                    key={classIndex}
                                    time={classItem.time}
                                    name={classItem.name}
                                    instructor={classItem.instructor}
                                    instructorImageUrl={classItem.instructorImageUrl}
                                    morning={isMorningClass(classItem.time)}
                                    onBook={authStatus === "authenticated" ? handleBookClass : handleSignupToBook}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <ClassDetailDialog
        classItem={selectedClass}
        authed={authStatus === "authenticated"}
        onClose={() => setSelectedClass(null)}
        onBook={authStatus === "authenticated" ? handleBookClass : handleSignupToBook}
      />

      <Footer
        cta={{
          heading: "Ready to begin?",
          body: "Choose your package, book your first class, and step into your wellness journey today.",
          primary: { label: "View Packages", onClick: handleViewPackages },
          secondary: { label: "Book Your First Class", onClick: handleBookClass },
        }}
      />
    </>
  );
}