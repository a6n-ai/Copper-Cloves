import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DayScheduleList } from "@/components/admin/DayScheduleList";
import { MetricCard } from "@/components/admin/MetricCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Calendar as CalendarIcon,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Users,
  Clock,
  Repeat,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Settings2,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedIcon } from "@/components/dashboard/AnimatedIcon";
import { useSession } from "next-auth/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/responsive/ResponsiveDialog";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const classSchema = z.object({
  classId: z.string().min(1, "Select a class"),
  instructorId: z.string().min(1, "Select an instructor"),
  day: z.string().min(1, "Select a day"),
  hour: z.string().min(1, "Required").refine(v => /^\d{1,2}$/.test(v) && +v >= 1 && +v <= 12, "Enter 1–12"),
  minute: z.string().min(1, "Required").refine(v => /^\d{1,2}$/.test(v) && +v >= 0 && +v <= 59, "Enter 0–59"),
  period: z.enum(["AM", "PM"]),
  endHour: z.string().optional(),
  endMinute: z.string().optional(),
  endPeriod: z.enum(["AM", "PM"]),
  recurring: z.boolean(),
  weekOfMonth: z.string().optional(),
  classNotes: z.string().optional(),
  actualInstructorId: z.string().optional(),
  instructorCheckInOutcome: z.enum(["on_time", "late", "absent"]).optional(),
}).refine(
  d => d.recurring || !!d.weekOfMonth,
  { message: "Select a week or enable recurring", path: ["weekOfMonth"] }
);

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKS_OF_MONTH = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"];

function parseTimeStr(t: string): { h: string; m: string; p: "AM" | "PM" } | null {
  const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;
  return { h: match[1].padStart(2, "0"), m: match[2].padStart(2, "0"), p: match[3].toUpperCase() as "AM" | "PM" };
}

async function extractApiError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return typeof (body as { error?: string }).error === "string"
    ? (body as { error: string }).error
    : fallback;
}

const CLASSES = [
  { id: 1, name: "Muay Thai Circuit Training", capacity: 12, duration: 60 },
  { id: 2, name: "Aerial Yoga", capacity: 8, duration: 60 },
  { id: 3, name: "Barre by Physique 57", capacity: 12, duration: 57 },
  { id: 4, name: "Animal Flow", capacity: 15, duration: 60 },
  { id: 5, name: "Hatha Yoga", capacity: 15, duration: 60 },
  { id: 6, name: "WARRIOR Strength", capacity: 15, duration: 60 },
  { id: 7, name: "Mat Pilates", capacity: 12, duration: 60 },
  { id: 8, name: "WARRIOR Rhythm", capacity: 15, duration: 60 },
  { id: 9, name: "Fit by Physique 57", capacity: 12, duration: 57 },
  { id: 10, name: "Mat Pilates by Physique 57", capacity: 12, duration: 57 }
];

const INSTRUCTORS = [
  { id: 1, name: "Vivek" },
  { id: 2, name: "Usha" },
  { id: 3, name: "Akshata" },
  { id: 4, name: "Prachi" },
  { id: 5, name: "Siddarth" },
  { id: 6, name: "Chaitanya" },
  { id: 7, name: "Gayathri" },
  { id: 8, name: "Kajol" },
  { id: 9, name: "Shruti" },
  { id: 10, name: "Pushyank" },
];

interface ScheduledClass {
  id: string;
  day: string;
  dateIso: string;
  startTimeIso: string;
  time: string;
  classId: string;
  instructorId: string;
  actualInstructorId?: string | null;
  recurring: boolean;
  booked: number;
  capacity: number | null;
  instructorCheckInTime?: string | null;
  instructorCheckInOutcome?: string | null;
  classNotes?: string | null;
}

type ClassSelectOption = {
  id: string;
  name: string;
  max_capacity: number;
  duration: number;
  _isPlaceholder?: boolean;
};

type InstructorSelectOption = {
  id: string;
  name: string;
  _isPlaceholder?: boolean;
};

/** Shape-matched loading state mirroring the page header, KPI strip, and calendar + day-list layout. */
function ScheduleLoadingSkeleton() {
  return (
    <div className="space-y-8">
      {/* AdminPageHeader */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 bg-sage/10" />
        <Skeleton className="h-4 w-96 max-w-full bg-sage/10" />
      </div>

      {/* KPI strip — 4 MetricCards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-sage/15 bg-white h-full">
            <CardContent className="p-5 flex flex-col h-full">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-9 w-24 bg-sage/10" />
                <Skeleton className="h-9 w-9 rounded-xl bg-sage/10 shrink-0" />
              </div>
              <Skeleton className="mt-3 h-8 w-20 bg-sage/10" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 2-column: calendar + day list */}
      <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-stretch">
        <Card className="border-sage/20 bg-white/95 flex flex-col">
          <CardHeader className="pb-2 space-y-2">
            <Skeleton className="h-5 w-24 bg-sage/10" />
            <Skeleton className="h-3 w-40 bg-sage/10" />
          </CardHeader>
          <CardContent className="p-3 flex-1">
            {/* Weekday header row */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full bg-sage/10" />
              ))}
            </div>
            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md bg-sage/10" />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-sage/20 bg-white/95">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-7 w-64 bg-sage/10" />
                <Skeleton className="h-4 w-20 bg-sage/10" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-9 rounded-md bg-sage/10" />
                <Skeleton className="h-9 w-16 rounded-md bg-sage/10" />
                <Skeleton className="h-9 w-9 rounded-md bg-sage/10" />
                <Skeleton className="h-9 w-36 rounded-md bg-sage/10" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {/* DayScheduleList table */}
            <div className="rounded-xl border border-sage/15 bg-white overflow-hidden">
              {/* Table header */}
              <div className="flex items-center gap-4 bg-sage/5 px-5 py-3">
                <Skeleton className="h-3 w-[90px] bg-sage/10" />
                <Skeleton className="h-3 flex-1 bg-sage/10" />
                <Skeleton className="h-3 w-32 bg-sage/10" />
                <Skeleton className="h-3 w-[200px] bg-sage/10" />
                <Skeleton className="h-3 w-12 bg-sage/10" />
                <Skeleton className="h-3 w-[120px] bg-sage/10" />
              </div>
              {/* Table rows */}
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 border-t border-sage/10 px-5 py-4">
                  <Skeleton className="h-5 w-[90px] bg-sage/10" />
                  <Skeleton className="h-4 flex-1 bg-sage/10" />
                  <div className="flex w-32 items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full bg-sage/10 shrink-0" />
                    <Skeleton className="h-4 flex-1 bg-sage/10" />
                  </div>
                  <div className="flex w-[200px] items-center gap-3">
                    <Skeleton className="h-1.5 flex-1 max-w-[160px] rounded-full bg-sage/10" />
                    <Skeleton className="h-4 w-10 bg-sage/10" />
                  </div>
                  <Skeleton className="h-5 w-12 rounded-full bg-sage/10" />
                  <div className="flex w-[120px] items-center justify-end gap-1.5">
                    <Skeleton className="h-8 w-8 rounded-md bg-sage/10" />
                    <Skeleton className="h-8 w-8 rounded-md bg-sage/10" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminSchedule() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<ScheduledClass[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ScheduledClass | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [successMessage, setSuccessMessage] = useState("");

  const classForm = useForm<z.infer<typeof classSchema>>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      classId: "", instructorId: "", day: "",
      hour: "07", minute: "00", period: "AM",
      endHour: "", endMinute: "", endPeriod: "AM",
      recurring: false, weekOfMonth: "",
    },
  });
  const watchRecurring = classForm.watch("recurring");
  const watchClassId = classForm.watch("classId");
  
  // New state for month/week selection
  const [scheduleViewYear, setScheduleViewYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [dbClasses, setDbClasses] = useState<any[]>([]);
  const [dbInstructors, setDbInstructors] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Roster sheet state
  const [rosterScheduleId, setRosterScheduleId] = useState<string | null>(null);
  const [rosterData, setRosterData] = useState<{
    scheduleId: string; className: string;
    instructor: string; instructorId: string | null;
    actualInstructor: string | null; actualInstructorId: string | null;
    instructorCheckInOutcome: string | null;
    classNotes: string | null;
    startTime: string; capacity: number | null;
    bookings: { id: string; userId: string; name: string; email: string;
      avatarUrl: string | null; checkedIn: boolean; checkInTime: string | null;
      checkInOutcome: string | null; extraGuests: number; }[];
  } | null>(null);
  const [savingInstructorOutcome, setSavingInstructorOutcome] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [checkingInMap, setCheckingInMap] = useState<Record<string, boolean>>({});

  // Add-member search state
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [memberSearching, setMemberSearching] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);

  const classOptions: ClassSelectOption[] = useMemo(() => {
    if (dbClasses.length > 0) {
      return dbClasses.map((c: { id: string; name: string; max_capacity?: number; duration?: number }) => ({
        id: String(c.id),
        name: c.name,
        max_capacity: c.max_capacity ?? 15,
        duration: c.duration ?? 60,
      }));
    }
    return CLASSES.map(c => ({
      id: `demo-class-${c.id}`,
      name: c.name,
      max_capacity: c.capacity,
      duration: c.duration,
      _isPlaceholder: true,
    }));
  }, [dbClasses]);

  const instructorOptions: InstructorSelectOption[] = useMemo(() => {
    if (dbInstructors.length > 0) {
      return dbInstructors
        .filter((i: { id: string; name: string; is_active?: boolean }) => i.is_active !== false)
        .map((i: { id: string; name: string }) => ({
          id: String(i.id),
          name: i.name,
        }));
    }
    return INSTRUCTORS.map(i => ({
      id: `demo-instructor-${i.id}`,
      name: i.name,
      _isPlaceholder: true,
    }));
  }, [dbInstructors]);

  const usingPlaceholderCatalog =
    classOptions.some(c => c._isPlaceholder) || instructorOptions.some(i => i._isPlaceholder);

  /** yyyy-mm-dd for the currently selected calendar date. */
  const selectedDateIso = useMemo(() => {
    const d = selectedDate;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [selectedDate]);

  /** Distinct ISO dates that have at least one class in the loaded month — for calendar markers. */
  const datesWithClasses = useMemo(
    () =>
      Array.from(new Set(schedule.map((c) => c.dateIso))).map((iso) => {
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(y, m - 1, d);
      }),
    [schedule],
  );

  /** KPI stats derived from currently-loaded month schedule. */
  const stats = useMemo(() => {
    const total = schedule.length;
    let bookedSum = 0;
    let capSum = 0;
    const byDay: Record<string, number> = {};
    const capMap = new Map<string, number>(
      dbClasses.map((c: { id: string | number; max_capacity?: number }) => [String(c.id), c.max_capacity ?? 0]),
    );
    for (const c of schedule) {
      bookedSum += c.booked;
      capSum += capMap.get(String(c.classId)) ?? 0;
      byDay[c.dateIso] = (byDay[c.dateIso] ?? 0) + 1;
    }
    const avgOccupancy = capSum > 0 ? Math.round((bookedSum / capSum) * 100) : 0;
    const busiestEntry = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
    const busiestLabel = busiestEntry
      ? new Date(busiestEntry[0] + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
      : "—";
    const busiestCount = busiestEntry?.[1] ?? 0;
    const todayIso = (() => {
      const t = new Date();
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    })();
    const todayCount = schedule.filter((c) => c.dateIso === todayIso).length;
    return { total, avgOccupancy, busiestLabel, busiestCount, todayCount };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, dbClasses]);

  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/admin/login");
      return;
    }
    const role = (session?.user as { role?: string })?.role;
    if (status === "authenticated" && role !== "admin") {
      router.push("/admin/login");
      return;
    }
    if (status !== "authenticated") return;

    let cancelled = false;
    (async () => {
      try {
        setLoadError(null);
        const catErr = await loadDbData();
        const schedErr = await loadSchedule();
        const combined = [catErr, schedErr].filter(Boolean).join(" ");
        if (!cancelled) {
          setLoadError(combined || null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) router.push("/admin/login");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session, router, selectedMonth, scheduleViewYear]);

  // Sync month/year fetch range when calendar moves to a different month.
  useEffect(() => {
    const m = selectedDate.getMonth();
    const y = selectedDate.getFullYear();
    if (m !== selectedMonth || y !== scheduleViewYear) {
      setSelectedMonth(m);
      setScheduleViewYear(y);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const getWeekDateRange = (weekNumber: number, month: number) => {
    const year = scheduleViewYear;
    const startOfMonth = new Date(year, month, 1);
    
    // Find first Monday of the month
    const firstMonday = new Date(startOfMonth);
    while (firstMonday.getDay() !== 1) {
      firstMonday.setDate(firstMonday.getDate() + 1);
    }
    
    // Calculate week start
    const weekStart = new Date(firstMonday);
    weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);
    
    // Calculate week end (Sunday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const formatDate = (date: Date) => {
      const monthName = MONTHS[date.getMonth()].slice(0, 3);
      return `${monthName} ${date.getDate()}`;
    };
    
    return `${formatDate(weekStart)}-${formatDate(weekEnd)}`;
  };

  const loadDbData = async (): Promise<string | null> => {
    try {
      const [classesRes, instructorsRes] = await Promise.all([
        fetch("/api/classes", { credentials: "omit" }),
        fetch("/api/admin/instructors", { credentials: "omit" }),
      ]);
      if (!classesRes.ok) {
        setDbClasses([]);
        setDbInstructors([]);
        return extractApiError(classesRes, `Class catalog request failed (HTTP ${classesRes.status}).`);
      }
      if (!instructorsRes.ok) {
        setDbClasses(await classesRes.json());
        setDbInstructors([]);
        return extractApiError(instructorsRes, `Instructors request failed (HTTP ${instructorsRes.status}).`);
      }
      setDbClasses(await classesRes.json());
      setDbInstructors(await instructorsRes.json());
      return null;
    } catch (err) {
      console.error("Error loading database data:", err);
      setDbClasses([]);
      setDbInstructors([]);
      return "Could not load class catalog or instructors (network error).";
    }
  };

  const loadSchedule = async (): Promise<string | null> => {
    try {
      const year = scheduleViewYear;
      const rangeStart = new Date(year, selectedMonth, 1, 0, 0, 0, 0);
      const rangeEnd = new Date(year, selectedMonth + 1, 0, 23, 59, 59, 999);
      const params = new URLSearchParams({
        fromMs: String(rangeStart.getTime()),
        toMs: String(rangeEnd.getTime()),
        expand: "0",
      });
      // Public GET — do not send cookies. Large __Secure-next-auth.session-token headers can exceed
      // CloudFront/API limits and produce 413 Content Too Large on Amplify.
      const res = await fetch(`/api/class-schedules?${params}`, {
        credentials: "omit",
        cache: "no-store",
      });
      if (!res.ok) {
        const statusFallback =
          res.status === 413
            ? "Schedule could not be loaded (HTTP 413 — request too large for CloudFront). Clear site cookies or use Incognito and retry."
            : res.status === 503
              ? "Schedule could not be loaded (HTTP 503 — server or DB unreachable). Try redeploying after db push."
              : `Schedule could not be loaded (HTTP ${res.status}).`;
        setSchedule([]);
        return extractApiError(res, statusFallback);
      }
      const data = (await res.json()) as Array<{
        id: string;
        start_time: string;
        class_id: string;
        instructor_id?: string;
        actual_instructor_id?: string | null;
        current_bookings?: number;
        capacity?: number | null;
        instructor_check_in_time?: string | null;
        instructor_check_in_outcome?: string | null;
        class_notes?: string | null;
      }>;

      const formattedSchedule: ScheduledClass[] = data.map((item) => {
        const startTime = new Date(item.start_time);
        const dayName = WEEKDAYS[startTime.getDay() === 0 ? 6 : startTime.getDay() - 1];
        const y = startTime.getFullYear();
        const mo = String(startTime.getMonth() + 1).padStart(2, "0");
        const d = String(startTime.getDate()).padStart(2, "0");
        return {
          id: item.id.toString(),
          day: dayName,
          dateIso: `${y}-${mo}-${d}`,
          startTimeIso: item.start_time,
          time: startTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          classId: item.class_id.toString(),
          instructorId: item.instructor_id?.toString() || "",
          actualInstructorId: item.actual_instructor_id ?? null,
          recurring: false,
          booked: item.current_bookings || 0,
          capacity: item.capacity ?? null,
          instructorCheckInTime: item.instructor_check_in_time ?? null,
          instructorCheckInOutcome: item.instructor_check_in_outcome ?? null,
          classNotes: item.class_notes ?? null,
        };
      });
      setSchedule(formattedSchedule);
      return null;
    } catch (err) {
      console.error("Error loading schedule:", err);
      setSchedule([]);
      return "Could not load schedule (network error).";
    }
  };

  const handleAddClass = () => {
    setEditingClass(null);
    classForm.reset({
      classId: "", instructorId: "", day: "",
      hour: "07", minute: "00", period: "AM",
      endHour: "", endMinute: "", endPeriod: "AM",
      recurring: false, weekOfMonth: "",
    });
    setDialogOpen(true);
  };

  const handleEditClass = (scheduledClass: ScheduledClass) => {
    setEditingClass(scheduledClass);
    const parsed = parseTimeStr(scheduledClass.time);
    classForm.reset({
      classId: scheduledClass.classId.toString(),
      instructorId: scheduledClass.instructorId.toString(),
      day: scheduledClass.day,
      hour: parsed?.h ?? "07",
      minute: parsed?.m ?? "00",
      period: parsed?.p ?? "AM",
      endHour: "", endMinute: "", endPeriod: "AM",
      recurring: scheduledClass.recurring,
      weekOfMonth: "",
      classNotes: scheduledClass.classNotes ?? "",
      actualInstructorId: scheduledClass.actualInstructorId ?? "",
      instructorCheckInOutcome: (scheduledClass.instructorCheckInOutcome as "on_time" | "late" | "absent" | undefined) ?? undefined,
    });
    setDialogOpen(true);
  };

  // Deep-link from the class page ("Edit in scheduler") opens the edit dialog.
  useEffect(() => {
    const editId = router.query.edit;
    if (typeof editId !== "string" || schedule.length === 0) return;
    const sc = schedule.find((c) => c.id === editId);
    if (!sc) return;
    handleEditClass(sc);
    const rest = { ...router.query };
    delete rest.edit;
    void router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.edit, schedule]);

  const handleSaveClass = async (data: z.infer<typeof classSchema>) => {
    const selectedClassData = classOptions.find(c => String(c.id) === String(data.classId));

    if (selectedClassData?._isPlaceholder) {
      toast.error("No class types are set up in the database yet. Add classes in Admin → Settings (System config), then schedule here.");
      return;
    }

    const selectedInstructorRecord = instructorOptions.find(i => String(i.id) === String(data.instructorId));
    if (selectedInstructorRecord?._isPlaceholder) {
      toast.error("No instructors are set up in the database yet. Add instructors in Admin → Settings, then schedule here.");
      return;
    }

    try {
      const year = scheduleViewYear;

      // Parse start time
      let hour = parseInt(data.hour);
      const minute = parseInt(data.minute);
      if (data.period === "PM" && hour !== 12) hour += 12;
      if (data.period === "AM" && hour === 12) hour = 0;

      // Parse end time — fall back to class duration
      let endHour = hour;
      let endMinute = minute;
      if (data.endHour && data.endMinute) {
        endHour = parseInt(data.endHour);
        endMinute = parseInt(data.endMinute);
        if (data.endPeriod === "PM" && endHour !== 12) endHour += 12;
        if (data.endPeriod === "AM" && endHour === 12) endHour = 0;
      } else if (selectedClassData) {
        const totalMinutes = minute + selectedClassData.duration;
        endHour = hour + Math.floor(totalMinutes / 60);
        endMinute = totalMinutes % 60;
      }

      const dayIndex = WEEKDAYS.indexOf(data.day);

      if (editingClass) {
        // Preserve the original calendar date — only update the time.
        // Re-deriving the date from weekday + month would pick the wrong week (always week 1).
        const originalDate = new Date(editingClass.startTimeIso);
        const startDate = new Date(
          originalDate.getFullYear(),
          originalDate.getMonth(),
          originalDate.getDate(),
          hour,
          minute,
          0,
          0
        );

        const endDate = new Date(startDate);
        endDate.setHours(endHour, endMinute, 0, 0);

        const updateRes = await fetch("/api/class-schedules", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: editingClass.id,
            class_id: data.classId,
            instructor_id: data.instructorId,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            available_spots: selectedClassData?.max_capacity,
            capacity: selectedClassData?.max_capacity,
            actual_instructor_id: data.actualInstructorId || null,
            instructor_check_in_outcome: data.instructorCheckInOutcome || null,
            class_notes: data.classNotes || null,
          }),
        });
        if (!updateRes.ok) {
          throw new Error(await extractApiError(updateRes, `Update failed (HTTP ${updateRes.status})`));
        }
        setSuccessMessage("Class updated successfully!");
      } else {
        const schedulesToCreate = [];

        if (data.recurring) {
          const startOfMonth = new Date(year, selectedMonth, 1);
          const endOfMonth = new Date(year, selectedMonth + 1, 0);
          const currentDate = new Date(startOfMonth);
          while (currentDate.getDay() !== (dayIndex + 1) % 7) {
            currentDate.setDate(currentDate.getDate() + 1);
          }
          while (currentDate <= endOfMonth) {
            const startTime = new Date(currentDate);
            startTime.setHours(hour, minute, 0, 0);
            const endTime = new Date(startTime);
            endTime.setHours(endHour, endMinute, 0, 0);
            schedulesToCreate.push({
              class_id: data.classId,
              instructor_id: data.instructorId,
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              available_spots: selectedClassData?.max_capacity,
              capacity: selectedClassData?.max_capacity,
              status: "available",
              current_bookings: 0,
            });
            currentDate.setDate(currentDate.getDate() + 7);
          }
        } else {
          const weekMatch = data.weekOfMonth?.match(/week\s+(\d+)/i);
          const weekNumber = weekMatch ? parseInt(weekMatch[1], 10) : NaN;
          if (!Number.isFinite(weekNumber) || weekNumber < 1 || weekNumber > 5) {
            toast.error("Please select a valid week (Week 1–Week 5).");
            return;
          }
          const startOfMonth = new Date(year, selectedMonth, 1);
          const currentDate = new Date(startOfMonth);
          while (currentDate.getDay() !== (dayIndex + 1) % 7) {
            currentDate.setDate(currentDate.getDate() + 1);
          }
          currentDate.setDate(currentDate.getDate() + (weekNumber - 1) * 7);
          if (currentDate.getMonth() !== selectedMonth) {
            toast.error(
              `${data.weekOfMonth} for ${data.day} does not exist in ${MONTHS[selectedMonth]} ${year}. Choose Week 1–4, use Recurring, or pick another month.`
            );
            return;
          }
          const startTime = new Date(currentDate);
          startTime.setHours(hour, minute, 0, 0);
          const endTime = new Date(startTime);
          endTime.setHours(endHour, endMinute, 0, 0);
          schedulesToCreate.push({
            class_id: data.classId,
            instructor_id: data.instructorId,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            available_spots: selectedClassData?.max_capacity,
            capacity: selectedClassData?.max_capacity,
            status: "available",
            current_bookings: 0,
          });
        }

        for (const schedule of schedulesToCreate) {
          const res = await fetch("/api/class-schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(schedule),
          });
          if (!res.ok) throw new Error(await extractApiError(res, `Insert failed (HTTP ${res.status})`));
        }
        setSuccessMessage(data.recurring
          ? `${schedulesToCreate.length} recurring classes scheduled for ${MONTHS[selectedMonth]}!`
          : "Class scheduled successfully!"
        );
      }
      
      setDialogOpen(false);
      const schedErr = await loadSchedule();
      if (schedErr) setLoadError(schedErr);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: unknown) {
      console.error("Error saving class:", err);
      toast.error(`Failed to save: ${(err as Error)?.message ?? "Unknown error"}`);
    }
  };

  const handleDeleteClass = async (id: string) => {
    try {
      const res = await fetch(`/api/class-schedules?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await extractApiError(res, `Delete failed (HTTP ${res.status})`));
      setSuccessMessage("Class removed from schedule");
      const schedErr = await loadSchedule();
      if (schedErr) setLoadError(schedErr);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error deleting class:", err);
      toast.error("Failed to delete class. Please try again.");
    }
  };

  const handleDuplicateClass = (scheduledClass: ScheduledClass) => {
    const newClass: ScheduledClass = {
      ...scheduledClass,
      id: `temp-${Date.now()}`,
      booked: 0
    };
    setSchedule([...schedule, newClass]);
    setSuccessMessage("Class duplicated successfully!");
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  async function loadRoster(scheduleId: string) {
    setRosterScheduleId(scheduleId);
    setRosterLoading(true);
    setRosterData(null);
    try {
      const res = await fetch(`/api/admin/class-roster?scheduleId=${scheduleId}`);
      if (res.ok) setRosterData(await res.json());
    } finally {
      setRosterLoading(false);
    }
  }

  async function handleAdminCheckIn(bookingId: string) {
    setCheckingInMap(prev => ({ ...prev, [bookingId]: true }));
    try {
      const res = await fetch("/api/admin/manual-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      if (res.ok) {
        setRosterData(prev => prev ? {
          ...prev,
          bookings: prev.bookings.map(b =>
            b.id === bookingId ? { ...b, checkedIn: true, checkInTime: new Date().toISOString(), checkInOutcome: "on_time" } : b
          ),
        } : prev);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error((err as { error?: string }).error ?? "Check-in failed");
      }
    } finally {
      setCheckingInMap(prev => ({ ...prev, [bookingId]: false }));
    }
  }

  const getClassName = (classId: number | string) => {
    const cls = dbClasses.find(c => String(c.id) === String(classId));
    return cls?.name || "";
  };

  const getClassCapacity = (classId: number | string) => {
    const cls = dbClasses.find(c => String(c.id) === String(classId));
    return cls?.max_capacity || 0;
  };

  const getInstructorName = (instructorId: number | string) => {
    const instructor = dbInstructors.find(i => String(i.id) === String(instructorId));
    return instructor?.name || "";
  };

  const getInstructorAvatar = (instructorId: number | string): string | null => {
    const instructor = dbInstructors.find(i => String(i.id) === String(instructorId));
    return instructor?.image_url ?? null;
  };

  const searchMembers = async (q: string) => {
    setMemberQuery(q);
    if (!q.trim()) { setMemberResults([]); return; }
    setMemberSearching(true);
    try {
      const res = await fetch(`/api/admin/members-search?q=${encodeURIComponent(q)}`, { credentials: "include" });
      if (res.ok) setMemberResults(await res.json());
    } finally {
      setMemberSearching(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!rosterScheduleId) return;
    setAddingMemberId(userId);
    try {
      const res = await fetch("/api/admin/add-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scheduleId: rosterScheduleId, userId }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed to add member"); return; }
      setRosterData(prev => prev ? { ...prev, bookings: [...prev.bookings, json.booking] } : prev);
      setMemberQuery("");
      setMemberResults([]);
    } finally {
      setAddingMemberId(null);
    }
  };

  async function handleSaveInstructorOutcome(outcome: "on_time" | "late" | "absent") {
    if (!rosterScheduleId) return;
    setSavingInstructorOutcome(true);
    try {
      const res = await fetch("/api/class-schedules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: rosterScheduleId, instructor_check_in_outcome: outcome }),
      });
      if (res.ok) {
        setRosterData(prev => prev ? { ...prev, instructorCheckInOutcome: outcome } : prev);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error((err as { error?: string }).error ?? "Failed to save");
      }
    } finally {
      setSavingInstructorOutcome(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8">
            <ScheduleLoadingSkeleton />
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Schedule Management - Admin"
        description="Manage class schedules and instructors"
      />
      
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <AdminPageHeader
              title="Class Schedule"
              subtitle="Pick a date to see the day's classes, instructors, and check-ins."
            />

            {loadError && (
              <Alert variant="default" className="border-amber-300 bg-amber-50 text-amber-950">
                <AlertCircle className="h-4 w-4 text-amber-700" />
                <AlertDescription className="font-body text-amber-900">{loadError}</AlertDescription>
              </Alert>
            )}
            {successMessage && (
              <Alert className="border-sage/30 bg-sage/10 text-sage">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="font-body text-sage">{successMessage}</AlertDescription>
              </Alert>
            )}

            {/* KPI strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Classes this month" value={stats.total} icon={CalendarIcon} tone="sage" />
              <MetricCard label="Avg occupancy" value={stats.avgOccupancy} suffix="%" icon={Users} tone="sage" />
              <MetricCard label="Today" value={stats.todayCount} icon={Clock} tone="terracotta" hint="classes scheduled" />
              <MetricCard label="Busiest day" value={stats.busiestLabel} icon={Repeat} tone="amber" hint={`${stats.busiestCount} classes`} />
            </div>

            {/* 2-column: calendar + day list */}
            <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-stretch">
              <Card className="border-sage/20 bg-white/95 flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-lg text-charcoal">Calendar</CardTitle>
                  <CardDescription className="font-body text-xs text-charcoal/60">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-sage mr-1.5 align-middle" />
                    Dots mark days with scheduled classes
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 flex-1 flex justify-center items-start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(d)}
                    showOutsideDays
                    modifiers={{ hasClass: datesWithClasses }}
                    modifiersClassNames={{
                      hasClass: "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-sage",
                    }}
                    classNames={{
                      months: "w-full",
                      month: "w-full space-y-4",
                      table: "w-full border-collapse",
                      head_row: "flex w-full",
                      head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] text-center",
                      row: "flex w-full mt-2",
                      cell: "relative p-0 text-center text-sm flex-1 focus-within:relative focus-within:z-20 has-aria-[selected]:bg-accent has-aria-[selected]:rounded-md",
                      day: "h-9 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-sage/10 rounded-md transition-colors",
                      day_selected: "bg-sage text-white hover:bg-sage hover:text-white focus:bg-sage focus:text-white",
                      day_today: "bg-sage/10 text-sage font-medium",
                    }}
                    className="w-full p-0"
                  />
                </CardContent>
              </Card>

              <Card className="border-sage/20 bg-white/95">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="font-display text-2xl text-charcoal">
                        {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                      </CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        {(() => {
                          const t = new Date();
                          const todayIso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
                          return selectedDateIso === todayIso ? "Today" : selectedDate.toLocaleDateString("en-US", { year: "numeric" });
                        })()}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-sage/20 text-sage hover:bg-sage/5 h-9 w-9 p-0"
                        onClick={() => {
                          const d = new Date(selectedDate);
                          d.setDate(d.getDate() - 1);
                          setSelectedDate(d);
                        }}
                        aria-label="Previous day"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-sage/20 text-sage hover:bg-sage/5 h-9 font-body"
                        onClick={() => setSelectedDate(new Date())}
                      >
                        Today
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-sage/20 text-sage hover:bg-sage/5 h-9 w-9 p-0"
                        onClick={() => {
                          const d = new Date(selectedDate);
                          d.setDate(d.getDate() + 1);
                          setSelectedDate(d);
                        }}
                        aria-label="Next day"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={handleAddClass}
                        size="sm"
                        className="bg-sage hover:bg-sage/90 text-white font-body h-9"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Schedule Class
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <DayScheduleList
                    variant="expanded"
                    emptyText="No classes on this day. Click Schedule Class to add one."
                    onSelect={(row: any) => router.push(`/admin/schedule/${row.id}`)}
                    items={schedule
                      .filter((c) => c.dateIso === selectedDateIso)
                      .sort((a, b) => a.startTimeIso.localeCompare(b.startTimeIso))
                      .map((sc) => ({
                        id: sc.id,
                        name: getClassName(sc.classId),
                        time: sc.time,
                        instructor: getInstructorName(sc.instructorId),
                        instructorAvatarUrl: getInstructorAvatar(sc.instructorId),
                        enrolled: sc.booked,
                        capacity: sc.capacity ?? getClassCapacity(sc.classId),
                        recurring: sc.recurring,
                        instructorCheckedInAt: sc.instructorCheckInTime
                          ? new Date(sc.instructorCheckInTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                          : null,
                        _raw: sc,
                      } as any))}
                    actions={(row: any) => {
                      const sc = row._raw;
                      return (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); router.push(`/admin/schedule/${sc.id}`); }}
                            className="border-sage/20 text-sage hover:bg-sage/10 font-body h-8 w-8 p-0 transition-transform hover:scale-110 active:scale-95"
                            title="Manage"
                          >
                            <AnimatedIcon icon={Settings2} size={14} animateOnMount={false} hover="spin" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleDeleteClass(sc.id); }}
                            className="font-body h-8 w-8 p-0 transition-transform hover:scale-110 active:scale-95"
                            title="Delete"
                          >
                            <AnimatedIcon icon={Trash2} size={14} animateOnMount={false} hover="wiggle" />
                          </Button>
                        </>
                      );
                    }}
                  />
                </CardContent>
              </Card>
            </div>

          </div>
        </main>
      </div>

      {/* Add/Edit Class Dialog */}
      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent className="max-w-2xl bg-white">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-3xl text-charcoal">
              {editingClass ? "Edit Class" : "Schedule Class"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Configure class details, time, and recurring schedule
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <Form {...classForm}>
            <form
              id="class-form"
              onSubmit={classForm.handleSubmit(handleSaveClass)}
              className="py-4 space-y-0"
            >
              {usingPlaceholderCatalog && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 font-body text-sm text-amber-950 mb-4">
                  <strong className="font-medium">Sample list:</strong> no class types or instructors in the database yet. Add them in Admin → Settings, then schedule live sessions.
                </div>
              )}

              <Tabs defaultValue="basics" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-cream/50">
                  <TabsTrigger value="basics" className="font-body data-[state=active]:bg-sage data-[state=active]:text-white">
                    Basics
                  </TabsTrigger>
                  <TabsTrigger value="schedule" className="font-body data-[state=active]:bg-sage data-[state=active]:text-white">
                    When &amp; Repeat
                  </TabsTrigger>
                </TabsList>

                {/* ── Basics Tab ── */}
                <TabsContent value="basics" className="space-y-5 mt-5">
                  <FormField
                    control={classForm.control}
                    name="classId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-body text-charcoal/80">Class Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 border-charcoal/20 focus:border-sage font-body">
                              <SelectValue placeholder="Select class" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent position="popper" className="max-h-[300px] overflow-y-auto">
                            {classOptions.map(cls => (
                              <SelectItem key={cls.id} value={cls.id}>
                                {cls.name} (Max: {cls.max_capacity}){cls._isPlaceholder ? " — sample" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={classForm.control}
                    name="instructorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-body text-charcoal/80">Instructor</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 border-charcoal/20 focus:border-sage font-body">
                              <SelectValue placeholder="Select instructor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent position="popper" className="max-h-[300px] overflow-y-auto">
                            {instructorOptions.map(instructor => (
                              <SelectItem key={instructor.id} value={instructor.id}>
                                {instructor.name}{instructor._isPlaceholder ? " — sample" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={classForm.control}
                    name="classNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-body text-charcoal/80">
                          Class Notes <span className="text-charcoal/40 font-normal">(Optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={2}
                            placeholder="Substitute reason, announcements, incidents…"
                            className="border-charcoal/20 focus:border-sage font-body resize-none"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {editingClass && (
                    <div className="rounded-xl border border-charcoal/10 bg-cream/30 p-4 space-y-4">
                      <p className="font-body text-xs font-medium text-charcoal/50 uppercase tracking-wide">Post-Class</p>

                      <FormField
                        control={classForm.control}
                        name="actualInstructorId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-body text-charcoal/80">Substitute Instructor</FormLabel>
                            <Select
                              onValueChange={(v) => field.onChange(v === "__same__" ? "" : v)}
                              value={field.value ? field.value : "__same__"}
                            >
                              <FormControl>
                                <SelectTrigger className="h-12 border-charcoal/20 focus:border-sage font-body">
                                  <SelectValue placeholder="Same as scheduled" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent position="popper" className="max-h-[300px] overflow-y-auto">
                                <SelectItem value="__same__">Same as scheduled</SelectItem>
                                {instructorOptions.filter(i => !i._isPlaceholder).map(instructor => (
                                  <SelectItem key={instructor.id} value={instructor.id}>
                                    {instructor.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription className="font-body text-xs text-charcoal/50">
                              Set only if a substitute covered this class
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={classForm.control}
                        name="instructorCheckInOutcome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-body text-charcoal/80">Instructor Attendance</FormLabel>
                            <div className="flex gap-2">
                              {(["on_time", "late", "absent"] as const).map(v => {
                                const labels = { on_time: "On Time", late: "Late", absent: "Absent" };
                                const active = field.value === v;
                                return (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() => field.onChange(active ? undefined : v)}
                                    className={`flex-1 h-10 rounded-lg border font-body text-sm font-medium transition-colors ${
                                      v === "absent"
                                        ? active ? "bg-red-500 border-red-500 text-white" : "border-charcoal/20 text-charcoal/60 hover:bg-red-50"
                                        : v === "late"
                                          ? active ? "bg-amber-500 border-amber-500 text-white" : "border-charcoal/20 text-charcoal/60 hover:bg-amber-50"
                                          : active ? "bg-sage border-sage text-white" : "border-charcoal/20 text-charcoal/60 hover:bg-sage/10"
                                    }`}
                                  >
                                    {labels[v]}
                                  </button>
                                );
                              })}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </TabsContent>

                {/* ── When & Repeat Tab ── */}
                <TabsContent value="schedule" className="space-y-5 mt-5">
                  <FormField
                    control={classForm.control}
                    name="day"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-body text-charcoal/80">Day of Week</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 border-charcoal/20 focus:border-sage font-body">
                              <SelectValue placeholder="Select day" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent position="popper">
                            {WEEKDAYS.map(day => (
                              <SelectItem key={day} value={day}>{day}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Start Time */}
                  <FormItem>
                    <FormLabel className="font-body text-charcoal/80">Start Time</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormField
                        control={classForm.control}
                        name="hour"
                        render={({ field }) => (
                          <FormControl>
                            <Input
                              {...field}
                              className="w-16 h-12 text-center font-body text-lg border-charcoal/20 focus:border-sage"
                              placeholder="07"
                              maxLength={2}
                              onChange={e => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 2))}
                            />
                          </FormControl>
                        )}
                      />
                      <span className="text-xl font-semibold text-charcoal/50">:</span>
                      <FormField
                        control={classForm.control}
                        name="minute"
                        render={({ field }) => (
                          <FormControl>
                            <Input
                              {...field}
                              className="w-16 h-12 text-center font-body text-lg border-charcoal/20 focus:border-sage"
                              placeholder="00"
                              maxLength={2}
                              onChange={e => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 2))}
                            />
                          </FormControl>
                        )}
                      />
                      <FormField
                        control={classForm.control}
                        name="period"
                        render={({ field }) => (
                          <div className="flex rounded-lg overflow-hidden border border-charcoal/20">
                            {(["AM", "PM"] as const).map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => field.onChange(p)}
                                className={`px-4 h-12 font-body text-sm font-medium transition-colors ${p === "PM" ? "border-l border-charcoal/20" : ""} ${
                                  field.value === p ? "bg-sage text-white" : "bg-white text-charcoal/70 hover:bg-sage/10"
                                }`}
                              >{p}</button>
                            ))}
                          </div>
                        )}
                      />
                    </div>
                    <div className="flex gap-1">
                      <FormField control={classForm.control} name="hour" render={() => <FormMessage />} />
                      <FormField control={classForm.control} name="minute" render={() => <FormMessage />} />
                    </div>
                  </FormItem>

                  {/* End Time (optional) */}
                  <FormItem>
                    <FormLabel className="font-body text-charcoal/80">
                      End Time <span className="text-charcoal/40 font-normal">(Optional)</span>
                    </FormLabel>
                    <div className="flex items-center gap-2">
                      <FormField
                        control={classForm.control}
                        name="endHour"
                        render={({ field }) => (
                          <FormControl>
                            <Input
                              {...field}
                              className="w-16 h-12 text-center font-body text-lg border-charcoal/20 focus:border-sage"
                              placeholder="08"
                              maxLength={2}
                              onChange={e => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 2))}
                            />
                          </FormControl>
                        )}
                      />
                      <span className="text-xl font-semibold text-charcoal/50">:</span>
                      <FormField
                        control={classForm.control}
                        name="endMinute"
                        render={({ field }) => (
                          <FormControl>
                            <Input
                              {...field}
                              className="w-16 h-12 text-center font-body text-lg border-charcoal/20 focus:border-sage"
                              placeholder="00"
                              maxLength={2}
                              onChange={e => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 2))}
                            />
                          </FormControl>
                        )}
                      />
                      <FormField
                        control={classForm.control}
                        name="endPeriod"
                        render={({ field }) => (
                          <div className="flex rounded-lg overflow-hidden border border-charcoal/20">
                            {(["AM", "PM"] as const).map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => field.onChange(p)}
                                className={`px-4 h-12 font-body text-sm font-medium transition-colors ${p === "PM" ? "border-l border-charcoal/20" : ""} ${
                                  field.value === p ? "bg-sage text-white" : "bg-white text-charcoal/70 hover:bg-sage/10"
                                }`}
                              >{p}</button>
                            ))}
                          </div>
                        )}
                      />
                    </div>
                    <FormDescription className="font-body text-xs text-charcoal/50">
                      Leave empty to auto-calculate from class duration (
                      {watchClassId ? classOptions.find(c => String(c.id) === String(watchClassId))?.duration ?? "—" : "—"} min)
                    </FormDescription>
                  </FormItem>

                  {/* Week of Month — only when not recurring */}
                  {!watchRecurring && (
                    <FormField
                      control={classForm.control}
                      name="weekOfMonth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-body text-charcoal/80">Week of Month</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ""}>
                            <FormControl>
                              <SelectTrigger className="h-12 border-charcoal/20 focus:border-sage font-body">
                                <SelectValue placeholder="Select week" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent position="popper">
                              {WEEKS_OF_MONTH.map((week, index) => (
                                <SelectItem key={week} value={week}>
                                  {week} ({getWeekDateRange(index + 1, selectedMonth)})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="font-body text-xs text-charcoal/50">
                            Select which week of {MONTHS[selectedMonth]} to schedule this class
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Recurring toggle */}
                  <FormField
                    control={classForm.control}
                    name="recurring"
                    render={({ field }) => (
                      <FormItem className="flex items-start gap-3 p-4 rounded-xl border border-charcoal/10 bg-cream/30">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-0.5 border-charcoal/30 data-[state=checked]:bg-sage data-[state=checked]:border-sage"
                          />
                        </FormControl>
                        <div className="space-y-0.5">
                          <FormLabel className="font-body font-medium text-charcoal cursor-pointer">
                            Recurring Weekly (All {MONTHS[selectedMonth]})
                          </FormLabel>
                          <FormDescription className="font-body text-sm text-charcoal/60">
                            Repeat this class every week throughout {MONTHS[selectedMonth]}
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>
            </form>
          </Form>

          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-charcoal/20 text-charcoal hover:bg-charcoal/5 font-body"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="class-form"
              className="bg-sage hover:bg-sage/90 text-white font-body"
            >
              {editingClass ? "Update Class" : "Schedule Class"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Roster Dialog */}
      <ResponsiveDialog open={!!rosterScheduleId} onOpenChange={(open) => { if (!open) { setRosterScheduleId(null); setRosterData(null); setMemberQuery(""); setMemberResults([]); } }}>
        <ResponsiveDialogContent className="max-w-lg w-full bg-white flex flex-col p-0 max-h-[85vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-sage/10 shrink-0">
            <ResponsiveDialogTitle className="font-display text-2xl text-charcoal">
              {rosterData ? rosterData.className : "Class Roster"}
            </ResponsiveDialogTitle>
            {rosterData && (
              <div className="font-body text-sm text-charcoal/60 space-y-1 mt-1">
                <p>{new Date(rosterData.startTime).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span>
                    {rosterData.actualInstructor ? (
                      <>
                        <span className="line-through text-charcoal/40">{rosterData.instructor}</span>
                        {" "}
                        <span className="text-terracotta font-medium">{rosterData.actualInstructor}</span>
                        <span className="ml-1 text-xs bg-terracotta/10 text-terracotta px-1.5 py-0.5 rounded-full">sub</span>
                      </>
                    ) : (
                      <span>{rosterData.instructor}</span>
                    )}
                  </span>
                  {rosterData.instructorCheckInOutcome && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      rosterData.instructorCheckInOutcome === "absent"
                        ? "bg-red-100 text-red-600"
                        : rosterData.instructorCheckInOutcome === "late"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-sage/10 text-sage"
                    }`}>
                      {rosterData.instructorCheckInOutcome.replace("_", " ")}
                    </span>
                  )}
                </div>
                {rosterData.classNotes && (
                  <p className="text-xs text-charcoal/50 italic">{rosterData.classNotes}</p>
                )}
                <p className="text-sage font-medium">
                  {rosterData.bookings.filter(b => b.checkedIn).length}/{rosterData.bookings.length} checked in
                  {rosterData.capacity ? ` · ${rosterData.capacity} capacity` : ""}
                </p>
              </div>
            )}
          </div>

          {/* Scrollable member list */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {rosterLoading && (
              <div className="flex items-center justify-center py-16">
                <Spinner className="size-8 text-sage" />
              </div>
            )}

            {!rosterLoading && rosterData && rosterData.bookings.length === 0 && (
              <div className="py-16 text-center">
                <Users className="h-10 w-10 text-sage/20 mx-auto mb-3" />
                <p className="font-body text-sm text-charcoal/50">No confirmed bookings yet</p>
              </div>
            )}

            {!rosterLoading && rosterData && rosterData.bookings.length > 0 && (
              <ul className="divide-y divide-sage/10">
                {rosterData.bookings.map(b => {
                  const initials = b.name.split(" ").slice(0, 2).map((p: string) => p[0]).join("").toUpperCase();
                  return (
                    <li key={b.id} className="py-3 flex items-center gap-3">
                      {b.avatarUrl ? (
                        <img src={b.avatarUrl} alt={b.name} className="h-9 w-9 rounded-full object-cover border border-sage/20 shrink-0" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center shrink-0">
                          <span className="font-body text-xs font-medium text-sage">{initials}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm font-medium text-charcoal truncate">
                          {b.name}
                          {b.extraGuests > 0 && <span className="ml-1.5 text-xs text-terracotta">+{b.extraGuests} guest{b.extraGuests > 1 ? "s" : ""}</span>}
                        </p>
                        <p className="font-body text-xs text-charcoal/40 truncate">{b.email}</p>
                        {b.checkedIn && b.checkInTime && (
                          <p className="font-body text-xs text-sage mt-0.5">
                            Checked in {new Date(b.checkInTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                            {b.checkInOutcome === "late" && <span className="ml-1 text-amber-600">(late)</span>}
                          </p>
                        )}
                      </div>
                      {b.checkedIn ? (
                        <CheckCircle2 className="h-5 w-5 text-sage shrink-0" />
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => void handleAdminCheckIn(b.id)}
                          disabled={checkingInMap[b.id]}
                          className="bg-sage hover:bg-sage/90 text-white font-body rounded-full px-3 h-8 text-xs shrink-0"
                        >
                          {checkingInMap[b.id] ? (
                            <Spinner className="size-3.5" />
                          ) : (
                            <><UserCheck className="h-3.5 w-3.5 mr-1" />Check In</>
                          )}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Instructor outcome quick-pick */}
          {rosterData && (
            <div className="shrink-0 px-6 py-3 border-t border-sage/10">
              <p className="font-body text-xs font-medium text-charcoal/50 uppercase tracking-wide mb-2">Instructor Attendance</p>
              <div className="flex gap-2">
                {(["on_time", "late", "absent"] as const).map(v => {
                  const labels = { on_time: "On Time", late: "Late", absent: "Absent" };
                  const active = rosterData.instructorCheckInOutcome === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => void handleSaveInstructorOutcome(v)}
                      disabled={savingInstructorOutcome}
                      className={`flex-1 h-9 rounded-lg border font-body text-xs font-medium transition-colors disabled:opacity-50 ${
                        v === "absent"
                          ? active ? "bg-red-500 border-red-500 text-white" : "border-charcoal/20 text-charcoal/60 hover:bg-red-50"
                          : v === "late"
                            ? active ? "bg-amber-500 border-amber-500 text-white" : "border-charcoal/20 text-charcoal/60 hover:bg-amber-50"
                            : active ? "bg-sage border-sage text-white" : "border-charcoal/20 text-charcoal/60 hover:bg-sage/10"
                      }`}
                    >
                      {labels[v]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add Member panel */}
          <div className="shrink-0 px-6 py-4 border-t border-sage/10 bg-sage/3">
            <p className="font-body text-xs font-medium text-charcoal/50 uppercase tracking-wide mb-2">Add Member</p>
            <div className="relative">
              <Input
                className="h-9 font-body text-sm border-charcoal/20 pr-8"
                placeholder="Search by name or email…"
                value={memberQuery}
                onChange={e => searchMembers(e.target.value)}
              />
              {memberSearching && (
                <Spinner className="absolute right-2 top-2 size-4 text-sage" />
              )}
            </div>
            {memberResults.length > 0 && (
              <ul className="mt-1 rounded-lg border border-sage/20 bg-white shadow-sm divide-y divide-sage/10 max-h-44 overflow-y-auto">
                {memberResults.map(m => {
                  const alreadyBooked = rosterData?.bookings.some(b => b.userId === m.id);
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-body text-sm font-medium text-charcoal truncate">{m.full_name || "—"}</p>
                        <p className="font-body text-xs text-charcoal/40 truncate">{m.email}</p>
                      </div>
                      {alreadyBooked ? (
                        <span className="font-body text-xs text-sage shrink-0">Booked</span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleAddMember(m.id)}
                          disabled={addingMemberId === m.id}
                          className="bg-sage hover:bg-sage/90 text-white font-body h-7 px-3 text-xs shrink-0"
                        >
                          {addingMemberId === m.id ? (
                            <Spinner className="size-3" />
                          ) : "Add"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
