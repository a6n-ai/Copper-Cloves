import { SEO } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, CheckCircle, Calendar, Users, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  mondayBasedWeekBoundsInMonth,
  isSameLocalCalendarDay,
  defaultPortalWeekSelection,
} from "@/lib/calendarWeek";

import { cdnUrl } from "@/lib/cdnUrl";
/** Dedupe in-flight fetches (e.g. React Strict Mode) without AbortController — avoids "(canceled)" in DevTools. */
let classesListPromise: Promise<unknown[]> | null = null;

function fetchClassesList(): Promise<unknown[]> {
  if (!classesListPromise) {
    classesListPromise = fetch("/api/classes")
      .then((res) => (res.ok ? res.json() : []))
      .finally(() => {
        classesListPromise = null;
      });
  }
  return classesListPromise;
}

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

interface ClassDetail {
  name: string;
  duration: string;
  image: string;
  description: string;
  benefits: string[];
  intensity: "High" | "Moderate" | "Gentle";
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

const classDetails: ClassDetail[] = [
  {
    name: "Muay Thai Circuit Training",
    duration: "55 min",
    image: cdnUrl("/muaythaicircuittraining.jpg"),
    description: "Experience the ultimate full-body workout that blends the art of eight limbs with modern circuit training. This high-energy class combines traditional Muay Thai techniques with weights, HIIT intervals, and intensive pad work to build power, speed, and conditioning.",
    benefits: [
      "Develops explosive power and speed",
      "Burns 600+ calories per session",
      "Builds functional strength and coordination",
      "Improves cardiovascular endurance",
      "Teaches authentic self-defense skills"
    ],
    intensity: "High"
  },
  {
    name: "Aerial Yoga",
    duration: "55 min",
    image: cdnUrl("/aerialyoga.jpg"),
    description: "Suspend your practice and explore a new dimension of movement. Using a fabric hammock to support your body weight, this playful yet therapeutic class decompresses the spine, builds core strength, and challenges your balance in ways traditional yoga cannot.",
    benefits: [
      "Decompresses and elongates the spine",
      "Improves flexibility and range of motion",
      "Builds deep core strength",
      "Reduces joint compression",
      "Enhances body awareness and balance"
    ],
    intensity: "Moderate"
  },
  {
    name: "WARRIOR Rhythm",
    duration: "55 min",
    image: cdnUrl("/warriorrythm.jpg"),
    description: "Move to the beat in this music-driven fusion experience. WARRIOR Rhythm seamlessly blends yoga flows, strength sequences, and high-intensity intervals into one cohesive, dance-inspired practice that leaves you energized and empowered.",
    benefits: [
      "Combines cardio with mindful movement",
      "Improves coordination and rhythm",
      "Builds mental focus and presence",
      "Full-body toning and conditioning",
      "Reduces stress through movement meditation"
    ],
    intensity: "High"
  },
  {
    name: "WARRIOR Strength",
    duration: "55 min",
    image: cdnUrl("/warriorstrength.jpg"),
    description: "Power up with this high-energy strength and cardio workout set to killer playlists. Using weights, resistance bands, and bodyweight exercises, this class builds lean muscle, increases metabolism, and develops functional fitness for everyday life.",
    benefits: [
      "Builds lean muscle mass",
      "Increases metabolic rate",
      "Develops functional strength patterns",
      "Improves bone density",
      "Boosts energy and confidence"
    ],
    intensity: "High"
  },
  {
    name: "Hatha Yoga",
    duration: "55 min",
    image: cdnUrl("/hathayoga.jpg"),
    description: "Return to the roots of yoga with this traditional, grounding practice. Hatha Yoga focuses on breath awareness, proper alignment, and holding postures to build strength, flexibility, and inner calm. Perfect for beginners and experienced practitioners seeking a mindful practice.",
    benefits: [
      "Improves flexibility and joint mobility",
      "Builds foundational strength",
      "Enhances breath control and lung capacity",
      "Reduces stress and anxiety",
      "Promotes better sleep and recovery"
    ],
    intensity: "Gentle"
  },
  {
    name: "Mat Pilates",
    duration: "55 min",
    image: cdnUrl("/matpilates.jpg"),
    description: "Discover the transformative power of low-impact, core-focused movement. This classical Mat Pilates practice emphasizes precision, control, and breath to sculpt long, lean muscles, improve posture, and develop a strong, stable core foundation.",
    benefits: [
      "Strengthens deep core muscles",
      "Improves posture and alignment",
      "Increases flexibility and mobility",
      "Reduces back pain",
      "Enhances body awareness and control"
    ],
    intensity: "Moderate"
  },
  {
    name: "Animal Flow",
    duration: "55 min",
    image: cdnUrl("/animalflow.jpg"),
    description: "Reconnect with primal movement patterns through this ground-based practice inspired by animal locomotion. Animal Flow combines elements of yoga, gymnastics, and breakdancing to improve mobility, build functional strength, and ignite creativity in your movement practice.",
    benefits: [
      "Enhances full-body mobility",
      "Develops functional strength patterns",
      "Improves coordination and body control",
      "Increases joint stability",
      "Builds mind-body connection"
    ],
    intensity: "Moderate"
  },
  {
    name: "Mat Pilates by Physique 57",
    duration: "57 min",
    image: cdnUrl("/matpilates57.jpg"),
    description: "Experience Physique 57's signature sculpting techniques in a mat-based format. This class brings the best of barre to the floor with targeted exercises that lengthen, tone, and define every muscle group through isometric holds and small, controlled movements.",
    benefits: [
      "Sculpts long, lean muscles",
      "Targets hard-to-tone areas",
      "Improves muscle definition",
      "Increases core stability",
      "Enhances flexibility and range of motion"
    ],
    intensity: "Moderate"
  },
  {
    name: "Barre by Physique 57",
    duration: "57 min",
    image: cdnUrl("/Barre57.jpg"),
    description: "The iconic Physique 57 experience. This 57-minute signature class combines ballet-inspired movements, interval training, and orthopedic stretches to create a full-body transformation. Expect isometric holds that burn, cardio bursts that challenge, and results that show.",
    benefits: [
      "Creates long, lean muscle definition",
      "Burns fat while building strength",
      "Improves posture and alignment",
      "Increases flexibility",
      "Boosts metabolism for hours post-workout"
    ],
    intensity: "High"
  },
  {
    name: "Fit by Physique 57",
    duration: "57 min",
    image: cdnUrl("/fit57.jpg"),
    description: "Take your strength to the next level with high-intensity functional training. Fit by Physique 57 incorporates heavy weights, plyometrics, and athletic conditioning drills to build power, endurance, and total-body strength that translates to real-life performance.",
    benefits: [
      "Builds functional strength and power",
      "Increases athletic performance",
      "Burns maximum calories",
      "Develops muscular endurance",
      "Improves coordination and agility"
    ],
    intensity: "High"
  }
];

export default function ClassesPage() {
  const router = useRouter();
  const initialCalendar = defaultPortalWeekSelection();
  const [activeTab, setActiveTab] = useState("classes");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
        return t >= weekStart && t <= weekEnd && item.status !== "cancelled";
      });

      const instructorMap = new Map(
        data
          .filter((item: { instructor?: { id: string; name: string } }) => item.instructor)
          .map((item: { instructor: { id: string; name: string } }) => [item.instructor.id, item.instructor.name])
      );

      // Group by day
      const daySchedules: DaySchedule[] = [];
      const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      
      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(weekStart);
        currentDay.setDate(currentDay.getDate() + i);
        
        const dayClasses = (data || [])
          .filter((item: any) => {
            const itemDate = new Date(item.start_time);
            return isSameLocalCalendarDay(itemDate, currentDay);
          })
          .map((item: { start_time: string; end_time: string; class_model?: { name?: string; instructor_id?: string }; instructor?: { id: string; name: string } }) => {
            const startTime = new Date(item.start_time);
            const endTime = new Date(item.end_time);
            return {
              time: `${startTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} - ${endTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`,
              name: item.class_model?.name || "Class",
              instructor: item.instructor?.name || instructorMap.get(item.class_model?.instructor_id ?? "") || "",
            };
          });

        daySchedules.push({
          day: daysOfWeek[i],
          date: currentDay.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
          classes: dayClasses
        });
      }

      if (isStale?.()) return;
      setScheduleData(daySchedules);
    } catch (err) {
      console.error("Error fetching schedule:", err);
      if (!isStale?.()) setScheduleData([]);
    } finally {
      if (!isStale?.()) setScheduleLoading(false);
    }
  }, [viewYear, selectedMonth, selectedWeek]);

  const fetchClasses = useCallback(async (isStale?: () => boolean) => {
    try {
      setLoading(true);

      const data = await fetchClassesList();
      if (isStale?.()) return;

      const transformedClasses = (Array.isArray(data) ? data : []).map((cls: {
        id: string;
        name: string;
        description?: string | null;
        duration: number;
        category: string;
        max_capacity?: number;
        image_url?: string | null;
        benefits?: string[];
        instructor?: { name?: string } | null;
      }) => ({
        id: cls.id,
        name: cls.name || "Class",
        description: cls.description || "",
        duration: cls.duration || 60,
        intensity: (cls.category || "general").toLowerCase(),
        category: cls.category || "General",
        image_url: cls.image_url || cdnUrl("/placeholder.jpg"),
        benefits: cls.benefits || [],
        instructor: cls.instructor?.name || "Instructor",
        max_capacity: cls.max_capacity ?? 15,
      }));

      if (isStale?.()) return;
      setClasses(transformedClasses);
    } catch (error) {
      console.error("Error fetching classes:", error);
      if (!isStale?.()) setClasses([]);
    } finally {
      if (!isStale?.()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let stale = false;
    const isStale = () => stale;
    void fetchClasses(isStale);
    return () => {
      stale = true;
    };
  }, [fetchClasses]);

  useEffect(() => {
    if (activeTab !== "schedule") return;
    let stale = false;
    const isStale = () => stale;
    void fetchScheduleData(isStale);
    return () => {
      stale = true;
    };
  }, [activeTab, fetchScheduleData]);

  const { data: authSession } = useSession();

  async function handleBookClass() {
    try {
      if (!authSession) {
        router.push("/portal/login?redirect=/portal/book");
        return;
      }
      router.push("/portal/book");
    } catch (err) {
      console.error("Auth check error:", err);
      router.push("/portal/login?redirect=/portal/book");
    }
  }

  const filteredClasses = selectedFilter === "all" 
    ? classes 
    : classes.filter(c => c.category === selectedFilter);

  // Helper function to determine if time is morning (before 12:00 PM)
  function isMorningClass(timeString: string): boolean {
    // Extract first time from format "07:00 - 08:00"
    const firstTime = timeString.split(" - ")[0];
    const hour = parseInt(firstTime.split(":")[0]);
    return hour < 12;
  }

  useEffect(() => {
    const { tab } = router.query;
    if (tab === "schedule") {
      setActiveTab("schedule");
    }
  }, [router.query]);

  return (
    <>
      <SEO 
        title="Our Classes | The Studio by Copper + Cloves"
        description="Explore our complete range of expert-led wellness classes. From Muay Thai to Aerial Yoga, find the perfect practice for your journey."
      />
      
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 bg-linear-to-br from-sage/10 via-cream to-terracotta/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <h1 className="font-display text-5xl md:text-6xl text-charcoal mb-6">
            Our Classes
          </h1>
          <p className="font-body text-lg text-charcoal/70 max-w-2xl mx-auto leading-relaxed">
            From high-intensity circuits to restorative flows, discover the class that speaks to your body and soul. 
            Each practice is designed to meet you where you are and elevate you to where you want to be.
          </p>
        </div>
      </section>

      {/* Tabs Section */}
      <section className="py-8 bg-cream">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-white/80 backdrop-blur-xs border border-sage/20 p-1 rounded-full">
              <TabsTrigger 
                value="classes" 
                className="rounded-full data-[state=active]:bg-sage data-[state=active]:text-white transition-all duration-300"
              >
                <Calendar className="mr-2" size={16} />
                Classes
              </TabsTrigger>
              <TabsTrigger 
                value="schedule" 
                className="rounded-full data-[state=active]:bg-sage data-[state=active]:text-white transition-all duration-300"
              >
                <Clock className="mr-2" size={16} />
                Schedule
              </TabsTrigger>
            </TabsList>

            {/* Classes Tab Content */}
            <TabsContent value="classes" className="mt-8">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-12 w-12 border-4 border-sage/20 border-t-sage rounded-full animate-spin" />
                </div>
              ) : filteredClasses.length === 0 ? (
                <div className="text-center py-12">
                  <p className="font-body text-charcoal/60">No classes found for this category.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredClasses.map((classItem) => (
                    <Card 
                      key={classItem.id}
                      className="border-0 bg-white/95 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-600 group overflow-hidden"
                    >
                      <div className="relative h-64 overflow-hidden bg-sage/5">
                        <img
                          src={classItem.image_url}
                          alt={classItem.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-600"
                        />
                        <Badge className="absolute top-4 right-4 bg-sage/90 text-white border-0 backdrop-blur-xs">
                          {classItem.category}
                        </Badge>
                      </div>
                      <CardContent className="p-6">
                        <h3 className="font-display text-2xl text-charcoal mb-3">
                          {classItem.name}
                        </h3>
                        <p className="font-body text-charcoal/70 text-sm mb-4 line-clamp-2">
                          {classItem.description}
                        </p>
                        
                        {/* Class Info */}
                        <div className="flex items-center gap-4 mb-4 text-sm text-charcoal/60">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            <span>{classItem.duration} min</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-4 w-4" />
                            <span>Max {classItem.max_capacity}</span>
                          </div>
                        </div>

                        {/* Key Benefits */}
                        {classItem.benefits && classItem.benefits.length > 0 && (
                          <div className="mb-4">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Sparkles className="h-4 w-4 text-sage" />
                              <span className="font-body text-xs font-medium text-charcoal/70">Key Benefits:</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {classItem.benefits.slice(0, 3).map((benefit: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="border-sage/30 bg-sage/5 text-sage text-xs">
                                  {benefit}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <Button 
                          onClick={handleBookClass}
                          className="w-full bg-sage hover:bg-sage/90 text-white font-body"
                        >
                          Book This Class
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Schedule Tab Content */}
            <TabsContent value="schedule" className="mt-8">
              <div className="bg-white rounded-2xl shadow-lg border border-sage/10 overflow-hidden">
                {/* Schedule Header */}
                <div className="bg-linear-to-r from-sage/10 via-cream to-terracotta/5 p-6 border-b border-sage/10">
                  <h2 className="font-display text-3xl text-charcoal text-center mb-2">
                    Weekly Schedule
                  </h2>
                  <p className="font-body text-charcoal/60 text-center text-sm">
                    Check our ticketed events on the page
                  </p>
                </div>

                {/* Week/Month Navigation */}
                <div className="bg-cream/30 border-b border-sage/10 p-4">
                  <div className="flex items-center justify-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
                      disabled={selectedWeek === 1}
                      className="border-sage/20 text-sage hover:bg-sage/5 disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <div className="flex items-center gap-2">
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
                        <SelectTrigger className="w-[180px] border-sage/20 bg-white font-body text-charcoal rounded-xl focus:ring-sage">
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
                        <SelectTrigger className="w-[280px] border-sage/20 bg-white font-body text-charcoal rounded-xl focus:ring-sage">
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
                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-sage/10">
                  {scheduleLoading ? (
                    <div className="col-span-2 flex items-center justify-center py-12">
                      <div className="h-12 w-12 border-4 border-sage/20 border-t-sage rounded-full animate-spin" />
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
                        <div className="mb-4 pb-3 border-b border-sage/10">
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
      <section className="py-24 bg-sage text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-white blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="font-display text-4xl md:text-5xl mb-6">
            Ready to Begin?
          </h2>
          <p className="font-body text-lg text-white/90 mb-8 leading-relaxed">
            Choose your package, book your first class, and step into your wellness journey today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleBookClass}
              size="lg"
              className="bg-white text-sage hover:bg-white/90 px-8 transition-all duration-600 ease-in-out"
            >
              View Packages
            </Button>
            <Button 
              onClick={handleBookClass}
              size="lg"
              variant="outline"
              className="border-white/40 text-white hover:bg-white/10 transition-all duration-600 ease-in-out"
            >
              Book Your First Class
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}