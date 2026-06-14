import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { DayScheduleList, type ScheduleRow } from "@/components/admin/DayScheduleList";
import { MetricCard } from "@/components/admin/MetricCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/filters";
import { Textarea } from "@/components/ui/textarea";
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
  Users,
  Clock,
  Repeat,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Power,
  PowerOff,
  ChevronsUpDown,
  Check,
  X,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/ui/pill";
import { AnimatedIcon } from "@/components/dashboard/AnimatedIcon";
import { ManageButton, DeleteButton } from "@/components/ui/quick-actions";
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

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const classSchema = z.object({
  classId: z.string().min(1, "Select a class"),
  instructorId: z.string().min(1, "Select an instructor"),
  startTime: z.string().regex(TIME_RE, "Use HH:MM (24h)"),
  durationMin: z.number().int().min(15, "≥ 15 min").max(240, "≤ 240 min"),
  mode: z.enum(["single", "weekly", "multi"]),
  singleDate: z.string().optional(),
  weeklyFrom: z.string().optional(),
  weeklyTo: z.string().optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  multiDates: z.array(z.string()).optional(),
  classNotes: z.string().optional(),
  actualInstructorId: z.string().optional(),
  instructorCheckInOutcome: z.enum(["on_time", "late", "absent"]).optional(),
}).superRefine((d, ctx) => {
  if (d.mode === "single") {
    if (!d.singleDate || !ISO_DATE_RE.test(d.singleDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["singleDate"], message: "Pick a date" });
    }
  } else if (d.mode === "weekly") {
    if (!d.weeklyFrom || !ISO_DATE_RE.test(d.weeklyFrom)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["weeklyFrom"], message: "Pick a start date" });
    }
    if (!d.weeklyTo || !ISO_DATE_RE.test(d.weeklyTo)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["weeklyTo"], message: "Pick an end date" });
    }
    if (d.weeklyFrom && d.weeklyTo && d.weeklyFrom > d.weeklyTo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["weeklyTo"], message: "End must be after start" });
    }
    if (!d.weekdays || d.weekdays.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["weekdays"], message: "Pick at least one weekday" });
    }
  } else if (d.mode === "multi") {
    if (!d.multiDates || d.multiDates.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["multiDates"], message: "Pick at least one date" });
    }
  }
});

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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
  endTimeIso?: string | null;
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
  status?: string;
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

/** Class row shape from the classes API (loose — only fields the page reads). */
interface DbClass {
  id: string | number;
  name: string;
  max_capacity?: number;
  duration?: number;
}

/** Instructor row shape from the instructors API (loose). */
interface DbInstructor {
  id: string | number;
  name: string;
  is_active?: boolean;
  image_url?: string | null;
}

/** DayScheduleList row plus the raw schedule it was derived from. */
type DayRow = ScheduleRow & { _raw: ScheduledClass };

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
          <Card key={i} className="border-sage/15 bg-white-warm h-full">
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
        <Card className="border-sage/20 bg-[#fafaf8]/95 flex flex-col">
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

        <Card className="border-sage/20 bg-[#fafaf8]/95">
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
            <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
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
      classId: "",
      instructorId: "",
      startTime: "07:00",
      durationMin: 60,
      mode: "single",
      singleDate: "",
      weeklyFrom: "",
      weeklyTo: "",
      weekdays: [],
      multiDates: [],
      classNotes: "",
    },
  });
  const watchMode = classForm.watch("mode");
  const watchClassId = classForm.watch("classId");
  const watchWeekdays = classForm.watch("weekdays") ?? [];
  const watchMultiDates = classForm.watch("multiDates") ?? [];

  // Combobox open state per field.
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [instructorPickerOpen, setInstructorPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [multiDateInput, setMultiDateInput] = useState("");
  
  // Month/year are pure derivations of the selected calendar date — compute
  // them during render instead of mirroring into state via an effect (which
  // forced an extra render + refetch on every month change).
  const selectedMonth = selectedDate.getMonth();
  const scheduleViewYear = selectedDate.getFullYear();
  const [dbClasses, setDbClasses] = useState<DbClass[]>([]);
  const [dbInstructors, setDbInstructors] = useState<DbInstructor[]>([]);
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
  const [rosterLoading] = useState(false);
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
  }, [schedule, dbClasses]);

  const { data: session, status } = useSession();
  // Scalar role — avoids session-object identity churn refiring the loader.
  const userRole = (session?.user as { role?: string })?.role;

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/admin/login");
      return;
    }
    if (status === "authenticated" && userRole !== "admin") {
      router.push("/admin/login");
      return;
    }
    if (status !== "authenticated") return;

    let cancelled = false;
    (async () => {
      try {
        setLoadError(null);
        // Run independent fetches concurrently (was sequential).
        const [catErr, schedErr] = await Promise.all([loadDbData(), loadSchedule()]);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole, selectedMonth, scheduleViewYear]);

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
        end_time?: string | null;
        class_id: string;
        instructor_id?: string;
        actual_instructor_id?: string | null;
        current_bookings?: number;
        capacity?: number | null;
        instructor_check_in_time?: string | null;
        instructor_check_in_outcome?: string | null;
        class_notes?: string | null;
        status?: string | null;
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
          endTimeIso: item.end_time ?? null,
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
          status: item.status ?? "available",
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
      classId: "",
      instructorId: "",
      startTime: "07:00",
      durationMin: 60,
      mode: "single",
      singleDate: selectedDateIso,
      weeklyFrom: selectedDateIso,
      weeklyTo: "",
      weekdays: [],
      multiDates: [],
      classNotes: "",
    });
    setDialogOpen(true);
  };

  const handleEditClass = (scheduledClass: ScheduledClass) => {
    setEditingClass(scheduledClass);
    const start = new Date(scheduledClass.startTimeIso);
    const hh = String(start.getHours()).padStart(2, "0");
    const mm = String(start.getMinutes()).padStart(2, "0");
    classForm.reset({
      classId: scheduledClass.classId.toString(),
      instructorId: scheduledClass.instructorId.toString(),
      startTime: `${hh}:${mm}`,
      durationMin: 60,
      mode: "single",
      singleDate: scheduledClass.dateIso,
      weeklyFrom: scheduledClass.dateIso,
      weeklyTo: "",
      weekdays: [],
      multiDates: [],
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
    const locked =
      sc.status === "completed" ||
      sc.status === "abandoned" ||
      (!!sc.endTimeIso && new Date(sc.endTimeIso).getTime() < Date.now());
    if (locked) {
      toast.error("This class is over and can no longer be edited.");
    } else {
      handleEditClass(sc);
    }
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

    const [hStr, mStr] = data.startTime.split(":");
    const startHour = parseInt(hStr, 10);
    const startMin = parseInt(mStr, 10);
    const durationMin = Number(data.durationMin) || selectedClassData?.duration || 60;
    const capacity = selectedClassData?.max_capacity ?? null;

    const buildPair = (dateIso: string): { start: Date; end: Date } => {
      const [y, mo, d] = dateIso.split("-").map(Number);
      const start = new Date(y, mo - 1, d, startHour, startMin, 0, 0);
      const end = new Date(start.getTime() + durationMin * 60_000);
      return { start, end };
    };

    try {
      if (editingClass) {
        // Edit always single — preserve original date, swap time/duration.
        const dateIso = editingClass.dateIso;
        const { start, end } = buildPair(dateIso);
        const updateRes = await fetch("/api/class-schedules", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: editingClass.id,
            class_id: data.classId,
            instructor_id: data.instructorId,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            available_spots: capacity ?? undefined,
            capacity: capacity ?? undefined,
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
        // Build items[] per mode.
        const dates: string[] = [];
        if (data.mode === "single" && data.singleDate) {
          dates.push(data.singleDate);
        } else if (data.mode === "weekly" && data.weeklyFrom && data.weeklyTo && data.weekdays?.length) {
          const wd = new Set(data.weekdays);
          const [fy, fm, fd] = data.weeklyFrom.split("-").map(Number);
          const [ty, tm, td] = data.weeklyTo.split("-").map(Number);
          const cur = new Date(fy, fm - 1, fd);
          const stop = new Date(ty, tm - 1, td);
          while (cur <= stop) {
            // Convert getDay() (Sun=0..Sat=6) → Mon=0..Sun=6.
            const idx = (cur.getDay() + 6) % 7;
            if (wd.has(idx)) {
              const yy = cur.getFullYear();
              const mm = String(cur.getMonth() + 1).padStart(2, "0");
              const dd = String(cur.getDate()).padStart(2, "0");
              dates.push(`${yy}-${mm}-${dd}`);
            }
            cur.setDate(cur.getDate() + 1);
          }
        } else if (data.mode === "multi" && data.multiDates?.length) {
          dates.push(...data.multiDates);
        }

        if (dates.length === 0) {
          toast.error("No dates resolved from the selected schedule. Adjust dates/weekdays and retry.");
          return;
        }
        if (dates.length > 200) {
          toast.error(`Too many occurrences (${dates.length}). Limit is 200.`);
          return;
        }

        const items = dates.map((dateIso) => {
          const { start, end } = buildPair(dateIso);
          return {
            class_id: data.classId,
            instructor_id: data.instructorId,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            available_spots: capacity ?? 0,
            capacity,
            status: "available",
            current_bookings: 0,
          };
        });

        const res = await fetch("/api/class-schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ items }),
        });
        if (!res.ok) throw new Error(await extractApiError(res, `Insert failed (HTTP ${res.status})`));
        const result = (await res.json()) as { created: number; skipped: number };
        setSuccessMessage(
          result.skipped > 0
            ? `Scheduled ${result.created} class${result.created === 1 ? "" : "es"} (${result.skipped} already existed).`
            : `Scheduled ${result.created} class${result.created === 1 ? "" : "es"}.`
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

  const [statusToggleTarget, setStatusToggleTarget] = useState<ScheduledClass | null>(null);
  const [statusToggleBusy, setStatusToggleBusy] = useState(false);

  const confirmToggleStatus = async () => {
    if (!statusToggleTarget) return;
    const sc = statusToggleTarget;
    const next = sc.status === "available" ? "inactive" : "available";
    // For "cancelled" → next is "available" (reactivation). Same for "inactive".
    setStatusToggleBusy(true);
    try {
      const res = await fetch(`/api/class-schedules`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sc.id, status: next }),
      });
      if (!res.ok) throw new Error(await extractApiError(res, `Status change failed (HTTP ${res.status})`));
      toast.success(next === "inactive" ? "Class set to inactive" : "Class reactivated");
      setStatusToggleTarget(null);
      const schedErr = await loadSchedule();
      if (schedErr) setLoadError(schedErr);
    } catch (err) {
      console.error("Error toggling status:", err);
      toast.error(`Could not change status: ${(err as Error)?.message ?? "Unknown error"}`);
    } finally {
      setStatusToggleBusy(false);
    }
  };

  const handleToggleStatus = (sc: ScheduledClass) => {
    setStatusToggleTarget(sc);
  };

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

  // Build id → row Maps once per fetch so per-row lookups are O(1) instead of
  // scanning the full arrays for every cell in every schedule row.
  const dbClassById = useMemo(() => {
    const m = new Map<string, typeof dbClasses[number]>();
    for (const c of dbClasses) m.set(String(c.id), c);
    return m;
  }, [dbClasses]);
  const dbInstructorById = useMemo(() => {
    const m = new Map<string, typeof dbInstructors[number]>();
    for (const i of dbInstructors) m.set(String(i.id), i);
    return m;
  }, [dbInstructors]);

  const getClassName = (classId: number | string) => {
    return dbClassById.get(String(classId))?.name || "";
  };

  const getClassCapacity = (classId: number | string) => {
    return dbClassById.get(String(classId))?.max_capacity || 0;
  };

  const getInstructorName = (instructorId: number | string) => {
    return dbInstructorById.get(String(instructorId))?.name || "";
  };

  const getInstructorAvatar = (instructorId: number | string): string | null => {
    const instructor = dbInstructorById.get(String(instructorId));
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
      <div className="min-h-screen overflow-x-hidden bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen overflow-x-hidden">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 min-w-0">
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
      
      <div className="min-h-screen overflow-x-hidden bg-linear-to-br from-cream via-cream to-sage/10">

        <main className="min-h-screen overflow-x-hidden">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8 min-w-0">
            <AdminPageHeader
              title="Class Schedule"
              subtitle="Pick a date to see the day's classes, instructors, and check-ins."
            />

            {loadError && (
              <Alert variant="default" className="border-terracotta/30 bg-terracotta/10 text-[#a05e38]">
                <AlertCircle className="h-4 w-4 text-terracotta" />
                <AlertDescription className="font-body text-[#a05e38]">{loadError}</AlertDescription>
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
              <MetricCard label="Busiest day" value={stats.busiestLabel} icon={Repeat} tone="clay" hint={`${stats.busiestCount} classes`} />
            </div>

            {/* 2-column: calendar + day list. Inline calendar only at xl+ where the
                table has room; below xl it collapses into the date-picker popover in
                the day header so the schedule table gets the full width. */}
            <div className="grid xl:grid-cols-[280px_1fr] gap-6 items-stretch">
              <Card className="border-sage/20 bg-[#fafaf8]/95 hidden xl:flex flex-col">
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
                    classNames={{ root: "w-full", months: "w-full", month: "w-full" }}
                    className="w-full p-0 [--cell-size:--spacing(9)]"
                  />
                </CardContent>
              </Card>

              <Card className="border-sage/20 bg-[#fafaf8]/95">
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
                          if (selectedDateIso === todayIso) return "Today";
                          const yesterday = new Date(t);
                          yesterday.setDate(t.getDate() - 1);
                          const yIso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
                          const tomorrow = new Date(t);
                          tomorrow.setDate(t.getDate() + 1);
                          const tomIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
                          if (selectedDateIso === yIso) return "Yesterday";
                          if (selectedDateIso === tomIso) return "Tomorrow";
                          return selectedDate.toLocaleDateString("en-US", { year: "numeric" });
                        })()}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="xl:hidden border-sage/40 text-sage hover:bg-sage hover:text-cream hover:border-sage h-9 w-9 p-0 transition-colors"
                            aria-label="Pick date"
                          >
                            <CalendarIcon className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(d) => {
                              if (d) {
                                setSelectedDate(d);
                                setDatePickerOpen(false);
                              }
                            }}
                            showOutsideDays
                            modifiers={{ hasClass: datesWithClasses }}
                            modifiersClassNames={{
                              hasClass:
                                "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-sage",
                            }}
                            className="p-0 [--cell-size:--spacing(8)]"
                          />
                        </PopoverContent>
                      </Popover>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-sage/40 text-sage hover:bg-sage hover:text-cream hover:border-sage h-9 w-9 p-0 transition-colors"
                        onClick={() => {
                          const d = new Date(selectedDate);
                          d.setDate(d.getDate() - 1);
                          setSelectedDate(d);
                        }}
                        aria-label="Previous day"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {(() => {
                        const t = new Date();
                        const todayIso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
                        const isToday = selectedDateIso === todayIso;
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            className={
                              isToday
                                ? "bg-sage text-cream border-sage hover:bg-sage/90 h-9 font-body transition-colors"
                                : "border-sage/40 text-sage hover:bg-sage hover:text-cream hover:border-sage h-9 font-body transition-colors"
                            }
                            onClick={() => setSelectedDate(new Date())}
                            disabled={isToday}
                          >
                            Today
                          </Button>
                        );
                      })()}
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-sage/40 text-sage hover:bg-sage hover:text-cream hover:border-sage h-9 w-9 p-0 transition-colors"
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
                        variant="sage"
                        className="h-9"
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
                    onSelect={(row: ScheduleRow) => router.push(`/admin/schedule/${row.id}`)}
                    items={schedule
                      .filter((c) => c.dateIso === selectedDateIso)
                      .sort((a, b) => a.startTimeIso.localeCompare(b.startTimeIso))
                      .map((sc) => ({
                        id: sc.id,
                        name: getClassName(sc.classId),
                        time: sc.time,
                        instructor: getInstructorName(sc.instructorId),
                        instructorId: sc.instructorId,
                        instructorAvatarUrl: getInstructorAvatar(sc.instructorId),
                        enrolled: sc.booked,
                        capacity: sc.capacity ?? getClassCapacity(sc.classId),
                        recurring: sc.recurring,
                        instructorCheckedInAt: sc.instructorCheckInTime
                          ? new Date(sc.instructorCheckInTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                          : null,
                        status: sc.status ?? "available",
                        _raw: sc,
                      } as DayRow))}
                    actions={(row: ScheduleRow) => {
                      const sc: ScheduledClass = (row as DayRow)._raw;
                      const isActive = (sc.status ?? "available") === "available";
                      const isInactive = sc.status === "inactive";
                      const isCancelled = sc.status === "cancelled";
                      const isLockedRow =
                        sc.status === "completed" ||
                        sc.status === "abandoned" ||
                        (!!sc.endTimeIso && new Date(sc.endTimeIso).getTime() < Date.now());
                      const toggleable = !isLockedRow && (isActive || isInactive || isCancelled);
                      return (
                        <>
                          {toggleable && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleToggleStatus(sc); }}
                              className={`font-body h-8 w-8 p-0 transition-all hover:scale-110 active:scale-95 ${
                                isActive
                                  ? "border-terracotta/40 text-terracotta bg-white-warm hover:bg-terracotta! hover:text-cream! hover:border-terracotta!"
                                  : "border-sage/60 text-sage bg-white-warm hover:bg-sage! hover:text-cream! hover:border-sage!"
                              }`}
                              title={
                                isActive
                                  ? "Set inactive (hide from members)"
                                  : isCancelled
                                  ? "Reactivate cancelled class"
                                  : "Reactivate"
                              }
                            >
                              <AnimatedIcon icon={isActive ? PowerOff : Power} size={14} animateOnMount={false} hover="wiggle" />
                            </Button>
                          )}
                          <ManageButton
                            onClick={(e) => { e.stopPropagation(); router.push(`/admin/schedule/${sc.id}`); }}
                          />
                          <DeleteButton
                            onClick={(e) => { e.stopPropagation(); handleDeleteClass(sc.id); }}
                            disabled={isLockedRow}
                            label={isLockedRow ? `Class is ${sc.status}; cannot delete.` : "Delete"}
                          />
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
        <ResponsiveDialogContent className="max-w-2xl bg-white-warm">
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
                <div className="rounded-lg border border-terracotta/20 bg-terracotta/10 px-4 py-3 font-body text-sm text-[#a05e38] mb-4">
                  <strong className="font-medium">Sample list:</strong> no class types or instructors in the database yet. Add them in Admin → Settings, then schedule live sessions.
                </div>
              )}

              <Tabs defaultValue="basics" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-cream/50">
                  <TabsTrigger value="basics" className="font-body data-[state=active]:bg-sage data-[state=active]:text-cream">
                    Class
                  </TabsTrigger>
                  <TabsTrigger value="schedule" className="font-body data-[state=active]:bg-sage data-[state=active]:text-cream">
                    When
                  </TabsTrigger>
                </TabsList>

                {/* ── Class Tab ── */}
                <TabsContent value="basics" className="space-y-5 mt-5">
                  <FormField
                    control={classForm.control}
                    name="classId"
                    render={({ field }) => {
                      const selected = classOptions.find(c => c.id === field.value);
                      return (
                        <FormItem className="flex flex-col">
                          <FormLabel className="font-body text-charcoal/80">Class Type</FormLabel>
                          <Popover open={classPickerOpen} onOpenChange={setClassPickerOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "h-12 justify-between font-body border-charcoal/20 hover:bg-white-warm hover:text-charcoal!",
                                    !field.value && "text-charcoal/40",
                                  )}
                                >
                                  {selected
                                    ? `${selected.name} · ${selected.duration} min · max ${selected.max_capacity}`
                                    : "Search and select class…"}
                                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                              <Command>
                                <CommandInput placeholder="Search classes…" className="font-body" />
                                <CommandList>
                                  <CommandEmpty>No classes found.</CommandEmpty>
                                  <CommandGroup>
                                    {classOptions.map(cls => (
                                      <CommandItem
                                        key={cls.id}
                                        value={`${cls.name} ${cls.id}`}
                                        onSelect={() => {
                                          field.onChange(cls.id);
                                          // Auto-fill duration from class default.
                                          classForm.setValue("durationMin", cls.duration);
                                          setClassPickerOpen(false);
                                        }}
                                        className="font-body"
                                      >
                                        <Check className={cn("mr-2 h-4 w-4", field.value === cls.id ? "opacity-100" : "opacity-0")} />
                                        <span className="flex-1">{cls.name}</span>
                                        <span className="text-xs text-charcoal/40 ml-2">
                                          {cls.duration}m · {cls.max_capacity}p{cls._isPlaceholder ? " · sample" : ""}
                                        </span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  <FormField
                    control={classForm.control}
                    name="instructorId"
                    render={({ field }) => {
                      const selected = instructorOptions.find(i => i.id === field.value);
                      return (
                        <FormItem className="flex flex-col">
                          <FormLabel className="font-body text-charcoal/80">Instructor</FormLabel>
                          <Popover open={instructorPickerOpen} onOpenChange={setInstructorPickerOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "h-12 justify-between font-body border-charcoal/20 hover:bg-white-warm hover:text-charcoal!",
                                    !field.value && "text-charcoal/40",
                                  )}
                                >
                                  {selected ? selected.name : "Search and select instructor…"}
                                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                              <Command>
                                <CommandInput placeholder="Search instructors…" className="font-body" />
                                <CommandList>
                                  <CommandEmpty>No instructors found.</CommandEmpty>
                                  <CommandGroup>
                                    {instructorOptions.map(instr => (
                                      <CommandItem
                                        key={instr.id}
                                        value={`${instr.name} ${instr.id}`}
                                        onSelect={() => {
                                          field.onChange(instr.id);
                                          setInstructorPickerOpen(false);
                                        }}
                                        className="font-body"
                                      >
                                        <Check className={cn("mr-2 h-4 w-4", field.value === instr.id ? "opacity-100" : "opacity-0")} />
                                        <span className="flex-1">{instr.name}{instr._isPlaceholder ? " · sample" : ""}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
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
                                        ? active ? "bg-[#a05e38] border-[#a05e38] text-cream" : "border-charcoal/20 text-charcoal/60 hover:bg-[#a05e38]/10"
                                        : v === "late"
                                          ? active ? "bg-terracotta border-terracotta text-cream" : "border-charcoal/20 text-charcoal/60 hover:bg-terracotta/10"
                                          : active ? "bg-sage border-sage text-cream" : "border-charcoal/20 text-charcoal/60 hover:bg-sage/10"
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

                {/* ── When Tab ── */}
                <TabsContent value="schedule" className="space-y-5 mt-5">
                  {/* Time + duration */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={classForm.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-body text-charcoal/80">Start Time</FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                              className="h-12 font-body text-lg border-charcoal/20 focus:border-sage"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={classForm.control}
                      name="durationMin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-body text-charcoal/80">
                            Duration <span className="text-charcoal/40 font-normal">(min)</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={15}
                              max={240}
                              step={1}
                              value={field.value ?? ""}
                              onChange={e => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                              className="h-12 font-body text-lg border-charcoal/20 focus:border-sage"
                            />
                          </FormControl>
                          <FormDescription className="font-body text-xs text-charcoal/50">
                            Auto-fills from class default ({watchClassId ? classOptions.find(c => c.id === watchClassId)?.duration ?? "—" : "—"} min)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Mode picker — hidden when editing (single only) */}
                  {!editingClass && (
                    <FormField
                      control={classForm.control}
                      name="mode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-body text-charcoal/80">How often?</FormLabel>
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              { v: "single", label: "Single date" },
                              { v: "weekly", label: "Weekly" },
                              { v: "multi", label: "Custom dates" },
                            ] as const).map(opt => {
                              const active = field.value === opt.v;
                              return (
                                <button
                                  key={opt.v}
                                  type="button"
                                  onClick={() => field.onChange(opt.v)}
                                  className={cn(
                                    "h-11 rounded-lg border font-body text-sm font-medium transition-colors",
                                    active
                                      ? "bg-sage border-sage text-cream"
                                      : "border-charcoal/20 text-charcoal/70 hover:bg-sage/10",
                                  )}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Single date */}
                  {(editingClass || watchMode === "single") && (
                    <FormField
                      control={classForm.control}
                      name="singleDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-body text-charcoal/80">Date</FormLabel>
                          <FormControl>
                            <DatePicker
                              value={field.value}
                              onChange={field.onChange}
                              disabled={!!editingClass}
                              className="h-12 text-lg"
                            />
                          </FormControl>
                          {editingClass && (
                            <FormDescription className="font-body text-xs text-charcoal/50">
                              Date locked when editing. Delete and re-create to move to another day.
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Weekly recurring */}
                  {!editingClass && watchMode === "weekly" && (
                    <div className="space-y-4 rounded-xl border border-charcoal/10 bg-cream/30 p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={classForm.control}
                          name="weeklyFrom"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-body text-charcoal/80">From</FormLabel>
                              <FormControl>
                                <DatePicker value={field.value} onChange={field.onChange} className="h-12" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={classForm.control}
                          name="weeklyTo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-body text-charcoal/80">To</FormLabel>
                              <FormControl>
                                <DatePicker value={field.value} onChange={field.onChange} className="h-12" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={classForm.control}
                        name="weekdays"
                        render={({ field }) => {
                          const set = new Set(field.value ?? []);
                          const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                          return (
                            <FormItem>
                              <FormLabel className="font-body text-charcoal/80">Repeat on</FormLabel>
                              <div className="grid grid-cols-7 gap-1.5">
                                {labels.map((lbl, i) => {
                                  const active = set.has(i);
                                  return (
                                    <button
                                      key={lbl}
                                      type="button"
                                      onClick={() => {
                                        const next = new Set(set);
                                        if (next.has(i)) next.delete(i);
                                        else next.add(i);
                                        field.onChange(Array.from(next).sort());
                                      }}
                                      className={cn(
                                        "h-10 rounded-md border font-body text-xs font-medium transition-colors",
                                        active
                                          ? "bg-sage border-sage text-cream"
                                          : "border-charcoal/20 text-charcoal/60 hover:bg-sage/10",
                                      )}
                                    >
                                      {lbl}
                                    </button>
                                  );
                                })}
                              </div>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      {(() => {
                        const f = classForm.getValues("weeklyFrom");
                        const t = classForm.getValues("weeklyTo");
                        const wd = watchWeekdays;
                        if (!f || !t || !ISO_DATE_RE.test(f) || !ISO_DATE_RE.test(t) || wd.length === 0) return null;
                        const wdSet = new Set(wd);
                        const [fy, fm, fdd] = f.split("-").map(Number);
                        const [ty, tm, tdd] = t.split("-").map(Number);
                        const cur = new Date(fy, fm - 1, fdd);
                        const stop = new Date(ty, tm - 1, tdd);
                        let n = 0;
                        while (cur <= stop) {
                          const idx = (cur.getDay() + 6) % 7;
                          if (wdSet.has(idx)) n++;
                          cur.setDate(cur.getDate() + 1);
                        }
                        return (
                          <p className="font-body text-xs text-sage">
                            Will create <strong>{n}</strong> class{n === 1 ? "" : "es"} in this date range.
                          </p>
                        );
                      })()}
                    </div>
                  )}

                  {/* Multi date chips */}
                  {!editingClass && watchMode === "multi" && (
                    <FormField
                      control={classForm.control}
                      name="multiDates"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-body text-charcoal/80">Pick dates</FormLabel>
                          <div className="flex gap-2">
                            <DatePicker
                              value={multiDateInput}
                              onChange={setMultiDateInput}
                              className="h-11"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              className="h-11 border-sage/40 text-sage hover:bg-sage hover:text-cream"
                              onClick={() => {
                                if (!ISO_DATE_RE.test(multiDateInput)) return;
                                const next = Array.from(new Set([...(field.value ?? []), multiDateInput])).sort();
                                field.onChange(next);
                                setMultiDateInput("");
                              }}
                              disabled={!ISO_DATE_RE.test(multiDateInput)}
                            >
                              <Plus className="h-4 w-4 mr-1" /> Add
                            </Button>
                          </div>
                          {watchMultiDates.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {watchMultiDates.map(d => (
                                <span
                                  key={d}
                                  className="inline-flex items-center gap-1 rounded-full bg-sage/10 border border-sage/30 px-2.5 py-1 font-body text-xs text-sage"
                                >
                                  {new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                  <button
                                    type="button"
                                    onClick={() => field.onChange(watchMultiDates.filter(x => x !== d))}
                                    className="hover:bg-sage/20 rounded-full p-0.5"
                                    aria-label={`Remove ${d}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <FormDescription className="font-body text-xs text-charcoal/50">
                            Use for irregular schedules (e.g. special workshops). Up to 200 dates.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
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
              variant="sage"
            >
              {editingClass ? "Update Class" : "Schedule Class"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Roster Dialog */}
      <ResponsiveDialog open={!!rosterScheduleId} onOpenChange={(open) => { if (!open) { setRosterScheduleId(null); setRosterData(null); setMemberQuery(""); setMemberResults([]); } }}>
        <ResponsiveDialogContent className="max-w-lg w-full bg-white-warm flex flex-col p-0 max-h-[85vh] overflow-hidden">
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
                        <Pill tone="warning" size="sm" className="ml-1">sub</Pill>
                      </>
                    ) : (
                      <span>{rosterData.instructor}</span>
                    )}
                  </span>
                  {rosterData.instructorCheckInOutcome && (
                    <Pill
                      tone={
                        rosterData.instructorCheckInOutcome === "absent"
                          ? "danger"
                          : rosterData.instructorCheckInOutcome === "late"
                            ? "warning"
                            : "success"
                      }
                      size="sm"
                      className="font-medium"
                    >
                      {rosterData.instructorCheckInOutcome.replace("_", " ")}
                    </Pill>
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
                        <Image src={b.avatarUrl} alt={b.name} width={36} height={36} className="h-9 w-9 rounded-full object-cover border border-sage/20 shrink-0" unoptimized />
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
                            {b.checkInOutcome === "late" && <span className="ml-1 text-terracotta">(late)</span>}
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
                          variant="sage"
                          className="rounded-full px-3 h-8 text-xs shrink-0"
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
                          ? active ? "bg-[#a05e38] border-[#a05e38] text-cream" : "border-charcoal/20 text-charcoal/60 hover:bg-[#a05e38]/10"
                          : v === "late"
                            ? active ? "bg-terracotta border-terracotta text-cream" : "border-charcoal/20 text-charcoal/60 hover:bg-terracotta/10"
                            : active ? "bg-sage border-sage text-cream" : "border-charcoal/20 text-charcoal/60 hover:bg-sage/10"
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
              <ul className="mt-1 rounded-lg border border-sage/20 bg-white-warm shadow-sm divide-y divide-sage/10 max-h-44 overflow-y-auto">
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
                          variant="sage"
                          className="h-7 px-3 text-xs shrink-0"
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

      {/* Status toggle confirmation */}
      <ResponsiveDialog
        open={!!statusToggleTarget}
        onOpenChange={(o) => { if (!o) setStatusToggleTarget(null); }}
      >
        <ResponsiveDialogContent className="sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {statusToggleTarget?.status === "available"
                ? "Set class inactive?"
                : statusToggleTarget?.status === "cancelled"
                ? "Reactivate cancelled class?"
                : "Reactivate class?"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {statusToggleTarget?.status === "available"
                ? "Class will be hidden from members on the booking page and block new bookings. Existing bookings keep their seat. You can reactivate any time."
                : statusToggleTarget?.status === "cancelled"
                ? "Class will move from cancelled back to available. Members will be able to book again. Note: members previously notified of cancellation will not be auto-notified."
                : "Class will become bookable again and appear on the member portal."}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setStatusToggleTarget(null)} disabled={statusToggleBusy} className="font-body">
              Cancel
            </Button>
            <Button
              onClick={confirmToggleStatus}
              disabled={statusToggleBusy}
              variant={statusToggleTarget?.status === "available" ? "terracotta" : "sage"}
            >
              {statusToggleBusy
                ? "Saving…"
                : statusToggleTarget?.status === "available"
                ? "Set inactive"
                : "Reactivate"}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
