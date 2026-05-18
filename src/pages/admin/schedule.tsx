import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DayScheduleList } from "@/components/admin/DayScheduleList";
import { MetricCard } from "@/components/admin/MetricCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ChevronRight
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { useSession } from "next-auth/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  { id: 1, name: "Vivek", specialties: ["Muay Thai", "WARRIOR Strength"] },
  { id: 2, name: "Usha", specialties: ["Aerial Yoga", "Hatha Yoga"] },
  { id: 3, name: "Akshata", specialties: ["Mat Pilates", "Barre"] },
  { id: 4, name: "Prachi", specialties: ["Physique 57", "Barre"] },
  { id: 5, name: "Siddarth", specialties: ["WARRIOR Strength", "WARRIOR Rhythm"] },
  { id: 6, name: "Chaitanya", specialties: ["Animal Flow", "WARRIOR Rhythm"] },
  { id: 7, name: "Gayathri", specialties: ["Hatha Yoga", "Aerial Yoga"] },
  { id: 8, name: "Kajol", specialties: ["Mat Pilates", "Physique 57"] },
  { id: 9, name: "Shruti", specialties: ["Barre", "Physique 57"] },
  { id: 10, name: "Pushyank", specialties: ["WARRIOR Strength", "Muay Thai"] }
];

interface ScheduledClass {
  id: string;
  day: string;
  /** ISO date string e.g. "2026-05-17" for the actual calendar date */
  dateIso: string;
  /** Full ISO datetime from DB — used to preserve date when editing */
  startTimeIso: string;
  time: string;
  classId: string;
  instructorId: string;
  recurring: boolean;
  booked: number;
  instructorCheckInTime?: string | null;
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

export default function AdminSchedule() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<ScheduledClass[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ScheduledClass | null>(null);
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedHour, setSelectedHour] = useState("07");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">("AM");
  const [selectedEndHour, setSelectedEndHour] = useState("");
  const [selectedEndMinute, setSelectedEndMinute] = useState("");
  const [selectedEndPeriod, setSelectedEndPeriod] = useState<"AM" | "PM">("AM");
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedInstructor, setSelectedInstructor] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  
  // New state for month/week selection
  const [scheduleViewYear, setScheduleViewYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [dbClasses, setDbClasses] = useState<any[]>([]);
  const [dbInstructors, setDbInstructors] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        const body = await classesRes.json().catch(() => ({}));
        const msg =
          typeof (body as { error?: string }).error === "string"
            ? (body as { error: string }).error
            : `Class catalog request failed (HTTP ${classesRes.status}).`;
        setDbClasses([]);
        setDbInstructors([]);
        return msg;
      }
      if (!instructorsRes.ok) {
        const body = await instructorsRes.json().catch(() => ({}));
        const msg =
          typeof (body as { error?: string }).error === "string"
            ? (body as { error: string }).error
            : `Instructors request failed (HTTP ${instructorsRes.status}).`;
        setDbClasses(await classesRes.json());
        setDbInstructors([]);
        return msg;
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
        const body = await res.json().catch(() => ({}));
        const fromApi =
          typeof (body as { error?: string }).error === "string"
            ? (body as { error: string }).error
            : null;
        const fallback =
          res.status === 413
            ? `Schedule could not be loaded (HTTP 413). Usually the request is too large for CloudFront (often a huge Cookie header). In DevTools → Network, open the failing "class-schedules" request and check Request Headers: if Cookie is present, clear site data for this domain or use Incognito. If Cookie is empty, redeploy so the API supports expand=0 (smaller JSON).`
            : res.status === 503
              ? `Schedule could not be loaded (HTTP 503). The server may be unable to reach the database or the schema may be out of sync (run Prisma db push on production, or redeploy so Amplify preBuild can sync).`
              : `Schedule could not be loaded (HTTP ${res.status}).`;
        const msg = fromApi ?? fallback;
        setSchedule([]);
        return msg;
      }
      const data = (await res.json()) as Array<{
        id: string;
        start_time: string;
        class_id: string;
        instructor_id?: string;
        current_bookings?: number;
        instructor_check_in_time?: string | null;
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
          recurring: false,
          booked: item.current_bookings || 0,
          instructorCheckInTime: item.instructor_check_in_time ?? null,
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
    setSelectedDay("");
    setSelectedHour("07");
    setSelectedMinute("00");
    setSelectedPeriod("AM");
    setSelectedEndHour("");
    setSelectedEndMinute("");
    setSelectedEndPeriod("AM");
    setSelectedClass("");
    setSelectedInstructor("");
    setIsRecurring(false);
    setSelectedWeek("");
    setDialogOpen(true);
  };

  const handleEditClass = (scheduledClass: ScheduledClass) => {
    setEditingClass(scheduledClass);
    setSelectedDay(scheduledClass.day);
    const parsed = parseTimeStr(scheduledClass.time);
    setSelectedHour(parsed?.h ?? "07");
    setSelectedMinute(parsed?.m ?? "00");
    setSelectedPeriod(parsed?.p ?? "AM");
    setSelectedEndHour("");
    setSelectedEndMinute("");
    setSelectedEndPeriod("AM");
    setSelectedClass(scheduledClass.classId.toString());
    setSelectedInstructor(scheduledClass.instructorId.toString());
    setIsRecurring(scheduledClass.recurring);
    setDialogOpen(true);
  };

  const handleSaveClass = async () => {
    const selectedTime = selectedHour && selectedMinute
      ? `${selectedHour.padStart(2, "0")}:${selectedMinute.padStart(2, "0")} ${selectedPeriod}`
      : "";
    const selectedEndTime = selectedEndHour && selectedEndMinute
      ? `${selectedEndHour.padStart(2, "0")}:${selectedEndMinute.padStart(2, "0")} ${selectedEndPeriod}`
      : "";

    console.log('🔵 handleSaveClass called');
    console.log('🔵 Form values:', {
      selectedDay,
      selectedTime,
      selectedClass,
      selectedInstructor,
      selectedWeek,
      isRecurring,
      selectedMonth
    });

    try {
      const year = scheduleViewYear;
      const selectedClassData = classOptions.find(c => String(c.id) === String(selectedClass));

      console.log('🔵 Selected class data:', selectedClassData);

      if (!selectedClassData) {
        alert("Please select a valid class");
        return;
      }

      if (selectedClassData._isPlaceholder) {
        alert(
          "No class types are set up in the database yet. Add classes in Admin → Settings (System config), then schedule here. The dropdown shows sample names only."
        );
        return;
      }

      const selectedInstructorRecord = instructorOptions.find(
        i => String(i.id) === String(selectedInstructor)
      );
      if (!selectedInstructor) {
        alert("Please select an instructor");
        return;
      }
      if (!selectedInstructorRecord) {
        alert("Please select a valid instructor");
        return;
      }
      if (selectedInstructorRecord._isPlaceholder) {
        alert(
          "No instructors are set up in the database yet. Add instructors in Admin → Settings, then schedule here. The dropdown shows sample names only."
        );
        return;
      }

      if (!selectedDay) {
        alert("Please select a day");
        return;
      }

      if (!selectedTime) {
        alert("Please enter a start time");
        return;
      }

      if (!isRecurring && !selectedWeek) {
        alert("Please select a week of the month");
        return;
      }

      // Parse time (e.g., "07:00 AM" -> hour: 7, minute: 0)
      const timeParts = selectedTime.match(/(\d+):(\d+)\s*(AM|PM)/);
      if (!timeParts) {
        alert("Invalid time format");
        return;
      }
      
      let hour = parseInt(timeParts[1]);
      const minute = parseInt(timeParts[2]);
      const period = timeParts[3];
      
      if (period === "PM" && hour !== 12) hour += 12;
      if (period === "AM" && hour === 12) hour = 0;

      // Parse end time if provided, otherwise use class duration
      let endHour = hour;
      let endMinute = minute;
      
      if (selectedEndTime) {
        const endTimeParts = selectedEndTime.match(/(\d+):(\d+)\s*(AM|PM)/);
        if (endTimeParts) {
          endHour = parseInt(endTimeParts[1]);
          endMinute = parseInt(endTimeParts[2]);
          const endPeriod = endTimeParts[3];
          
          if (endPeriod === "PM" && endHour !== 12) endHour += 12;
          if (endPeriod === "AM" && endHour === 12) endHour = 0;
        }
      } else {
        // Use class duration
        const totalMinutes = minute + selectedClassData.duration;
        endHour = hour + Math.floor(totalMinutes / 60);
        endMinute = totalMinutes % 60;
      }

      const dayIndex = WEEKDAYS.indexOf(selectedDay);
      if (dayIndex === -1) {
        alert("Invalid day selected");
        return;
      }

      console.log('🔵 Parsed time:', { hour, minute, period });
      console.log('🔵 Day index:', dayIndex);

      if (editingClass) {
        console.log('🔵 Editing existing class:', editingClass.id);
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

        console.log('🔵 Updating with:', {
          class_id: selectedClass,
          instructor_id: selectedInstructor,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          available_spots: selectedClassData.max_capacity,
          capacity: selectedClassData.max_capacity
        });

        const updateRes = await fetch("/api/class-schedules", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: editingClass.id,
            class_id: selectedClass,
            instructor_id: selectedInstructor,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            available_spots: selectedClassData.max_capacity,
            capacity: selectedClassData.max_capacity,
          }),
        });
        if (!updateRes.ok) {
          const body = await updateRes.json().catch(() => ({}));
          const msg =
            typeof (body as { error?: string }).error === "string"
              ? (body as { error: string }).error
              : `Update failed (HTTP ${updateRes.status})`;
          throw new Error(msg);
        }
        setSuccessMessage("Class updated successfully!");
      } else {
        console.log('🔵 Creating new class schedule(s)');
        // Create new class schedule(s)
        const schedulesToCreate = [];
        
        if (isRecurring) {
          console.log('🔵 Creating recurring classes for', MONTHS[selectedMonth]);
          // Create for all occurrences of this day in the selected month
          const startOfMonth = new Date(year, selectedMonth, 1);
          const endOfMonth = new Date(year, selectedMonth + 1, 0);
          
          const currentDate = new Date(startOfMonth);
          // Find first occurrence of selected day
          while (currentDate.getDay() !== (dayIndex + 1) % 7) {
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          // Add all occurrences in this month
          while (currentDate <= endOfMonth) {
            const startTime = new Date(currentDate);
            startTime.setHours(hour, minute, 0, 0);
            const endTime = new Date(startTime);
            endTime.setHours(endHour, endMinute, 0, 0);
            
            schedulesToCreate.push({
              class_id: selectedClass,
              instructor_id: selectedInstructor,
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              available_spots: selectedClassData.max_capacity,
              capacity: selectedClassData.max_capacity,
              status: "available",
              current_bookings: 0
            });
            
            currentDate.setDate(currentDate.getDate() + 7); // Next week
          }
          console.log('🔵 Total recurring classes to create:', schedulesToCreate.length);
        } else {
          console.log('🔵 Creating single class for week:', selectedWeek);
          // Single occurrence
          const weekMatch = selectedWeek.match(/week\s+(\d+)/i);
          const weekNumber = weekMatch ? parseInt(weekMatch[1], 10) : NaN;
          if (!Number.isFinite(weekNumber) || weekNumber < 1 || weekNumber > 5) {
            alert("Please select a valid week (Week 1–Week 5).");
            return;
          }
          const startOfMonth = new Date(year, selectedMonth, 1);
          
          // Find the nth occurrence of this day in the month
          const currentDate = new Date(startOfMonth);
          while (currentDate.getDay() !== (dayIndex + 1) % 7) {
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          // Move to the selected week
          currentDate.setDate(currentDate.getDate() + (weekNumber - 1) * 7);
          
          if (currentDate.getMonth() !== selectedMonth) {
            alert(
              `${selectedWeek} for ${selectedDay} does not exist in ${MONTHS[selectedMonth]} ${year} (that date falls in the next month). Choose Week 1–4, use Recurring, or pick another month.`
            );
            return;
          }

          const startTime = new Date(currentDate);
          startTime.setHours(hour, minute, 0, 0);
          const endTime = new Date(startTime);
          endTime.setHours(endHour, endMinute, 0, 0);
          
          schedulesToCreate.push({
            class_id: selectedClass,
            instructor_id: selectedInstructor,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            available_spots: selectedClassData.max_capacity,
            capacity: selectedClassData.max_capacity,
            status: "available",
            current_bookings: 0
          });
        }

        console.log('🔵 Schedules to create:', schedulesToCreate);

        for (const schedule of schedulesToCreate) {
          const res = await fetch("/api/class-schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(schedule),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const msg =
              typeof (body as { error?: string }).error === "string"
                ? (body as { error: string }).error
                : `Insert failed (HTTP ${res.status})`;
            throw new Error(msg);
          }
        }
        setSuccessMessage(isRecurring 
          ? `${schedulesToCreate.length} recurring classes scheduled for ${MONTHS[selectedMonth]}!`
          : "Class scheduled successfully!"
        );
      }
      
      setDialogOpen(false);
      const schedErr = await loadSchedule();
      if (schedErr) setLoadError(schedErr);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      console.error("❌ Error saving class:", err);
      alert(`Failed to save class: ${err?.message || 'Unknown error'}. Please check the console for details.`);
    }
  };

  const handleDeleteClass = async (id: string) => {
    try {
      const res = await fetch(`/api/class-schedules?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          typeof (body as { error?: string }).error === "string"
            ? (body as { error: string }).error
            : `Delete failed (HTTP ${res.status})`;
        throw new Error(msg);
      }
      setSuccessMessage("Class removed from schedule");
      const schedErr = await loadSchedule();
      if (schedErr) setLoadError(schedErr);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error deleting class:", err);
      alert("Failed to delete class. Please try again.");
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-sage/10 flex items-center justify-center">
        <div className="h-12 w-12 border-4 border-sage/20 border-t-sage rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Schedule Management - Admin"
        description="Manage class schedules and instructors"
      />
      
      <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-sage/10">
        
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
                      cell: "relative p-0 text-center text-sm flex-1 focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected])]:rounded-md",
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
                    onSelect={(row: any) => handleEditClass(row._raw)}
                    items={schedule
                      .filter((c) => c.dateIso === selectedDateIso)
                      .map((sc) => ({
                        id: sc.id,
                        name: getClassName(sc.classId),
                        time: sc.time,
                        instructor: getInstructorName(sc.instructorId),
                        instructorAvatarUrl: getInstructorAvatar(sc.instructorId),
                        enrolled: sc.booked,
                        capacity: getClassCapacity(sc.classId),
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
                            onClick={() => handleEditClass(sc)}
                            className="border-sage/20 text-sage hover:bg-sage/10 font-body h-8 w-8 p-0"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDuplicateClass(sc)}
                            className="border-charcoal/20 text-charcoal hover:bg-charcoal/5 font-body h-8 w-8 p-0"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClass(sc.id)}
                            className="border-red-500/20 text-red-600 hover:bg-red-50 font-body h-8 w-8 p-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl text-charcoal">
              {editingClass ? "Edit Class" : "Schedule Class"}
            </DialogTitle>
            <DialogDescription className="font-body text-charcoal/60">
              Configure class details, time, and recurring schedule
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {usingPlaceholderCatalog ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 font-body text-sm text-amber-950 mb-4">
                <strong className="font-medium">Sample list:</strong> there are no class types or instructors in the database yet, so the menus below show built-in examples. Add real classes and instructors in Admin → Settings, then you can schedule live sessions.
              </div>
            ) : null}

            <Tabs defaultValue="basics" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-cream/50">
                <TabsTrigger value="basics" className="font-body data-[state=active]:bg-sage data-[state=active]:text-white">
                  Basics
                </TabsTrigger>
                <TabsTrigger value="schedule" className="font-body data-[state=active]:bg-sage data-[state=active]:text-white">
                  When &amp; Repeat
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basics" className="space-y-4 mt-4">
            <div>
              <Label className="font-body text-charcoal/80 mb-2">Class Type</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="h-12 border-charcoal/20 focus:border-sage font-body">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {classOptions.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} (Max: {cls.max_capacity})
                      {cls._isPlaceholder ? " — sample" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="font-body text-charcoal/80 mb-2">Instructor</Label>
              <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                <SelectTrigger className="h-12 border-charcoal/20 focus:border-sage font-body">
                  <SelectValue placeholder="Select instructor" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {instructorOptions.map(instructor => (
                    <SelectItem key={instructor.id} value={instructor.id}>
                      {instructor.name}
                      {instructor._isPlaceholder ? " — sample" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4 mt-4">
            <div>
              <Label className="font-body text-charcoal/80 mb-2">Day of Week</Label>
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger className="h-12 border-charcoal/20 focus:border-sage font-body">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map(day => (
                    <SelectItem key={day} value={day}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="font-body text-charcoal/80 mb-2">Start Time</Label>
              <div className="flex items-center gap-2">
                <Input
                  className="w-16 h-12 text-center font-body text-lg border-charcoal/20 focus:border-sage"
                  placeholder="07"
                  maxLength={2}
                  value={selectedHour}
                  onChange={e => setSelectedHour(e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
                <span className="text-xl font-semibold text-charcoal/50">:</span>
                <Input
                  className="w-16 h-12 text-center font-body text-lg border-charcoal/20 focus:border-sage"
                  placeholder="00"
                  maxLength={2}
                  value={selectedMinute}
                  onChange={e => setSelectedMinute(e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
                <div className="flex rounded-lg overflow-hidden border border-charcoal/20">
                  <button
                    type="button"
                    onClick={() => setSelectedPeriod("AM")}
                    className={`px-4 h-12 font-body text-sm font-medium transition-colors ${
                      selectedPeriod === "AM" ? "bg-sage text-white" : "bg-white text-charcoal/70 hover:bg-sage/10"
                    }`}
                  >AM</button>
                  <button
                    type="button"
                    onClick={() => setSelectedPeriod("PM")}
                    className={`px-4 h-12 font-body text-sm font-medium transition-colors border-l border-charcoal/20 ${
                      selectedPeriod === "PM" ? "bg-sage text-white" : "bg-white text-charcoal/70 hover:bg-sage/10"
                    }`}
                  >PM</button>
                </div>
              </div>
            </div>

            <div>
              <Label className="font-body text-charcoal/80 mb-2">End Time <span className="text-charcoal/40 font-normal">(Optional)</span></Label>
              <div className="flex items-center gap-2">
                <Input
                  className="w-16 h-12 text-center font-body text-lg border-charcoal/20 focus:border-sage"
                  placeholder="08"
                  maxLength={2}
                  value={selectedEndHour}
                  onChange={e => setSelectedEndHour(e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
                <span className="text-xl font-semibold text-charcoal/50">:</span>
                <Input
                  className="w-16 h-12 text-center font-body text-lg border-charcoal/20 focus:border-sage"
                  placeholder="00"
                  maxLength={2}
                  value={selectedEndMinute}
                  onChange={e => setSelectedEndMinute(e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
                <div className="flex rounded-lg overflow-hidden border border-charcoal/20">
                  <button
                    type="button"
                    onClick={() => setSelectedEndPeriod("AM")}
                    className={`px-4 h-12 font-body text-sm font-medium transition-colors ${
                      selectedEndPeriod === "AM" ? "bg-sage text-white" : "bg-white text-charcoal/70 hover:bg-sage/10"
                    }`}
                  >AM</button>
                  <button
                    type="button"
                    onClick={() => setSelectedEndPeriod("PM")}
                    className={`px-4 h-12 font-body text-sm font-medium transition-colors border-l border-charcoal/20 ${
                      selectedEndPeriod === "PM" ? "bg-sage text-white" : "bg-white text-charcoal/70 hover:bg-sage/10"
                    }`}
                  >PM</button>
                </div>
              </div>
              <p className="font-body text-xs text-charcoal/50 mt-1">
                Leave empty to auto-calculate from class duration (
                {selectedClass
                  ? classOptions.find(c => String(c.id) === String(selectedClass))?.duration ?? "—"
                  : "—"}{" "}
                min)
              </p>
            </div>

            {!isRecurring && (
              <div>
                <Label className="font-body text-charcoal/80 mb-2">Week of Month</Label>
                <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                  <SelectTrigger className="h-12 border-charcoal/20 focus:border-sage font-body">
                    <SelectValue placeholder="Select week" />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKS_OF_MONTH.map((week, index) => (
                      <SelectItem key={week} value={week}>
                        {week} ({getWeekDateRange(index + 1, selectedMonth)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="font-body text-xs text-charcoal/50 mt-1">
                  Select which week of {MONTHS[selectedMonth]} to schedule this class
                </p>
              </div>
            )}

            <div className="flex items-center gap-3 p-4 rounded-xl border border-charcoal/10 bg-cream/30">
              <input
                type="checkbox"
                id="recurring"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="h-5 w-5 rounded border-charcoal/20 text-sage focus:ring-sage"
              />
              <div>
                <Label htmlFor="recurring" className="font-body font-medium text-charcoal cursor-pointer">
                  Recurring Weekly (All {MONTHS[selectedMonth]})
                </Label>
                <p className="font-body text-sm text-charcoal/60">
                  Repeat this class every week throughout {MONTHS[selectedMonth]}
                </p>
              </div>
            </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-charcoal/20 text-charcoal hover:bg-charcoal/5 font-body"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveClass}
              disabled={!selectedDay || !selectedHour || !selectedMinute || !selectedClass || !selectedInstructor}
              className="bg-sage hover:bg-sage/90 text-white font-body"
            >
              {editingClass ? "Update Class" : "Schedule Class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}