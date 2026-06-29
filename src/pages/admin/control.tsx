import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { requireSessionSSP } from "@/lib/requireSessionSSP";
import { useTabQuery } from "@/hooks/useTabQuery";

// Server-side auth gate — eliminates flash-of-unauth before the in-page
// useSession redirect can fire. Existing client-side checks remain as a
// belt-and-suspenders fallback for mid-session expiry.
export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/admin/MetricCard";
import { ListAvatar } from "@/components/admin/ListAvatar";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EditButton, DeleteButton } from "@/components/ui/quick-actions";
import { Pill } from "@/components/ui/pill";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FilterBar, FilterSearch } from "@/components/filters";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";
import { Label } from "@/components/ui/label";
import { 
  Users, 
  Calendar, 
  Plus, 
  Edit,
  Clock,
  Save,
  CheckCircle2,
  BarChart3,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Layers,
  Power,
  PowerOff,
  Package,
  Ticket,
  Settings2,
  CalendarX2,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "next-auth/react";
import { useInstructors } from "@/hooks/useInstructors";
import type React from "react";
// ~700 lines, only rendered when Analytics tab opens — defer.
const ControlAnalyticsPanel = dynamic(
  () => import("@/components/admin/ControlAnalyticsPanel").then((m) => m.ControlAnalyticsPanel),
  { ssr: false, loading: () => null },
);
import { Pagination, usePagination } from "@/components/Pagination";

import { cdnUrl } from "@/lib/cdnUrl";
import { toast } from "sonner";
import PackageCatalogTab from "@/components/admin/control-tabs/PackageCatalogTab";
import StudioSettingsTab from "@/components/admin/control-tabs/StudioSettingsTab";
import CancellationsTab from "@/components/admin/control-tabs/CancellationsTab";
import CouponsTab from "@/components/admin/control-tabs/CouponsTab";

/** Control Panel section nav — grouped vertical rail (desktop) / grouped select (mobile). */
const CONTROL_NAV: { label: string; items: { value: string; label: string; icon: typeof Users }[] }[] = [
  {
    label: "Members",
    items: [
      { value: "pauses", label: "Pause Requests", icon: Clock },
      { value: "cancellations", label: "Cancellations", icon: CalendarX2 },
    ],
  },
  {
    label: "Classes",
    items: [{ value: "classes", label: "Classes", icon: Calendar }],
  },
  {
    label: "Catalog",
    items: [
      { value: "packages", label: "Packages", icon: Package },
      { value: "coupons", label: "Coupons", icon: Ticket },
    ],
  },
  {
    label: "Studio",
    items: [{ value: "studio", label: "Studio Settings", icon: Settings2 }],
  },
  {
    label: "Insights",
    items: [{ value: "analytics", label: "Analytics", icon: BarChart3 }],
  },
];

/** Member list cards — mirrors the avatar + name/contact + pass badge + dates + actions row. */
function UserListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i} className="border-sage/20 bg-white-warm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <Skeleton className="h-14 w-14 rounded-full bg-sage/10 shrink-0" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40 bg-sage/10" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-3.5 w-44 bg-sage/10" />
                    <Skeleton className="h-3.5 w-28 bg-sage/10" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <Skeleton className="h-5 w-24 rounded-full bg-sage/10" />
                  <Skeleton className="h-4 w-20 bg-sage/10" />
                </div>
                <div className="hidden md:flex flex-col items-center gap-1.5">
                  <Skeleton className="h-3.5 w-16 bg-sage/10" />
                  <Skeleton className="h-4 w-24 bg-sage/10" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-16 rounded-md bg-sage/10" />
                  <Skeleton className="h-9 w-20 rounded-md bg-sage/10" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Class catalog cards — mirrors the image thumb + title/category + description + benefits + meta row. */
function ClassGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-sage/20 bg-white-warm">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <Skeleton className="h-24 w-24 rounded-lg bg-sage/10 shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-36 bg-sage/10" />
                    <Skeleton className="h-5 w-20 rounded-full bg-sage/10" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-16 rounded-md bg-sage/10" />
                    <Skeleton className="h-8 w-9 rounded-md bg-sage/10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-full bg-sage/10" />
                  <Skeleton className="h-3.5 w-2/3 bg-sage/10" />
                </div>
                <div className="flex flex-wrap gap-1">
                  <Skeleton className="h-5 w-16 rounded-full bg-sage/10" />
                  <Skeleton className="h-5 w-20 rounded-full bg-sage/10" />
                  <Skeleton className="h-5 w-14 rounded-full bg-sage/10" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-3.5 w-16 bg-sage/10" />
                  <Skeleton className="h-3.5 w-16 bg-sage/10" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Full page shell while session/data initially loads — header + tab bar + user list. */
function ControlPanelShellSkeleton() {
  return (
    <div className="space-y-8">
      {/* AdminPageHeader */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 bg-sage/10" />
        <Skeleton className="h-4 w-80 max-w-full bg-sage/10" />
      </div>
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-sage/20 bg-card/80 p-1 w-fit max-w-full overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-32 rounded-md bg-sage/10" />
        ))}
      </div>
      {/* Section header + add button */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 bg-sage/10" />
          <Skeleton className="h-4 w-72 bg-sage/10" />
        </div>
        <Skeleton className="h-10 w-28 rounded-md bg-sage/10" />
      </div>
      {/* Search/filter bar */}
      <Card className="border-sage/20 bg-white-warm">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <Skeleton className="h-10 flex-1 rounded-md bg-sage/10" />
            <Skeleton className="h-10 w-48 rounded-md bg-sage/10" />
          </div>
        </CardContent>
      </Card>
      <UserListSkeleton />
    </div>
  );
}

type SortDir = "asc" | "desc";

/** A class catalog row from `/api/admin/classes`. */
interface ClassRow {
  id: string;
  name?: string | null;
  category?: string | null;
  description?: string | null;
  benefits?: string[] | null;
  duration?: number | null;
  max_capacity?: number | null;
  image_url?: string | null;
  is_active?: boolean | null;
  [key: string]: unknown;
}

/** An instructor row from the shared `useInstructors` cache. */
interface InstructorRow {
  id: string;
  name?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  image_url?: string | null;
  specialties?: string[] | null;
  certifications?: string[] | null;
  philosophy?: string | null;
  about?: string | null;
  years_of_experience?: string | null;
  studio_payout_cut_percent?: number | null;
  social_facebook?: string | null;
  social_twitter?: string | null;
  social_linkedin?: string | null;
  social_whatsapp?: string | null;
  is_active?: boolean;
  [key: string]: unknown;
}

/** A member pause-subscription ticket from `/api/admin/member-tickets`. */
interface PauseTicket {
  id: string;
  type?: string;
  status?: string;
  admin_note?: string | null;
  reason?: string | null;
  attachment_url?: string | null;
  pause_from?: string | null;
  pause_to?: string | null;
  created_at?: string | null;
  profile?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  user_package?: {
    pass_type?: string | null;
    credits_remaining?: number | null;
    is_active?: boolean;
    package_type?: { name?: string | null } | null;
  } | null;
}

function useSort<K extends string>() {
  const [key, setKey] = useState<K | null>(null);
  const [dir, setDir] = useState<SortDir>("asc");
  const toggle = (k: K, defaultDir: SortDir = "asc") => {
    if (key === k) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setKey(k);
      setDir(defaultDir);
    }
  };
  return { key, dir, toggle };
}

function sortArrow(active: boolean, dir: SortDir) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

const thBtn = "inline-flex items-center gap-1 hover:text-charcoal transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1";

export default function ControlPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useTabQuery(
    ["pauses", "classes", "instructors", "analytics", "packages", "coupons", "studio", "cancellations"],
    "classes",
  );

  // Sync activeTab with ?tab= query so sidebar links can deep-link into a tab.
  useEffect(() => {
    const t = typeof router.query.tab === "string" ? router.query.tab : null;
    if (t && t !== activeTab) setActiveTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.tab]);

  // Dialog states
  const [showAddClassDialog, setShowAddClassDialog] = useState(false);
  const [showClassDetailsDialog, setShowClassDetailsDialog] = useState(false);
  const [showAddInstructorDialog, setShowAddInstructorDialog] = useState(false);
  const [showEditInstructorDialog, setShowEditInstructorDialog] = useState(false);

  // Selected items
  const [selectedClass, setSelectedClass] = useState<ClassRow | null>(null);
  const [selectedInstructorData, _setSelectedInstructorData] = useState<InstructorRow | null>(null);

  // Classes state
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  // Instructors roster — shared SWR key (one cached copy across admin pages).
  const { data: instructorsData, mutate: mutateInstructors } = useInstructors<InstructorRow[]>();
  const instructors = useMemo<InstructorRow[]>(() => instructorsData ?? [], [instructorsData]);

  // Pause request tickets state
  const [pauseTickets, setPauseTickets] = useState<PauseTicket[]>([]);
  const [loadingPauseTickets, setLoadingPauseTickets] = useState(true);
  const [pauseStatusFilter, setPauseStatusFilter] = useState<"all" | "open" | "in_review" | "resolved" | "rejected">("all");
  const [pauseNoteDrafts, setPauseNoteDrafts] = useState<Record<string, string>>({});
  const [pauseSavingId, setPauseSavingId] = useState<string | null>(null);


  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [classImagePreview, setClassImagePreview] = useState<string>("");


  const { data: session, status } = useSession();
  const userRole = (session?.user as { role?: string })?.role;

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/admin/login"); return; }
    if (status === "authenticated" && userRole !== "admin") { router.push("/admin/login"); return; }
    if (status === "authenticated") {
      fetchClasses();
      void fetchPauseTickets();
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole]);

  async function fetchPauseTickets() {
    setLoadingPauseTickets(true);
    try {
      const res = await fetch("/api/admin/member-tickets", { credentials: "same-origin" });
      if (!res.ok) { setPauseTickets([]); return; }
      const data: unknown = await res.json();
      const onlyPause: PauseTicket[] = Array.isArray(data)
        ? (data as PauseTicket[]).filter((t) => t.type === "pause_subscription")
        : [];
      setPauseTickets(onlyPause);
      setPauseNoteDrafts(
        Object.fromEntries(onlyPause.map((t) => [t.id, t.admin_note ?? ""])),
      );
    } catch {
      setPauseTickets([]);
    } finally {
      setLoadingPauseTickets(false);
    }
  }

  async function updatePauseTicket(id: string, patch: { status?: string; admin_note?: string }) {
    setPauseSavingId(id);
    try {
      const res = await fetch("/api/admin/member-tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) return;
      await fetchPauseTickets();
    } finally {
      setPauseSavingId(null);
    }
  }


  async function fetchClasses() {
    try {
      setLoadingClasses(true);
      const res = await fetch("/api/admin/classes");
      setClasses(res.ok ? await res.json() : []);
    } catch (err) {
      console.error("Error loading classes:", err);
    } finally {
      setLoadingClasses(false);
    }
  }

  const uploadImage = async (
    file: File,
    purpose: "instructor_photo" | "class_image",
    ownerId?: string,
  ): Promise<{ url: string; fileId: string | null } | null> => {
    try {
      setUploadingImage(true);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", purpose);
      if (ownerId) fd.append("ownerId", ownerId);
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data.error === "string" ? data.error : `Upload failed (HTTP ${res.status}).`;
        toast.error(msg);
        return null;
      }
      if (typeof data.url !== "string" || !data.url) {
        toast.error("Upload response was invalid.");
        return null;
      }
      return { url: data.url, fileId: typeof data.fileId === "string" ? data.fileId : null };
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image. Please try again.");
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const benefitsString = formData.get("benefits") as string;
    const benefits = benefitsString ? benefitsString.split(",").map(b => b.trim()) : [];
    
    // Handle image upload
    const imageFile = formData.get("class-image") as File;
    let imageUrl = cdnUrl("/placeholder.jpg");
    let imageFileId: string | null = null;

    if (imageFile && imageFile.size > 0) {
      const uploaded = await uploadImage(imageFile, "class_image");
      if (uploaded) {
        imageUrl = uploaded.url;
        imageFileId = uploaded.fileId;
      } else {
        return;
      }
    }

    try {
      const res = await fetch("/api/admin/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("class-name") as string,
          category: formData.get("category") as string,
          description: formData.get("description") as string,
          benefits: benefits,
          duration: parseInt(formData.get("duration") as string),
          max_capacity: parseInt(formData.get("capacity") as string),
          instructor_id: formData.get("instructor") as string,
          display_order: parseInt(formData.get("display-order") as string) || 0,
          image_url: imageUrl,
          image_file_id: imageFileId,
        }),
      });
      if (!res.ok) throw new Error("Failed to create class");

      toast.success("Class created successfully!");
      setShowAddClassDialog(false);
      setClassImagePreview("");
      fetchClasses();
      form.reset();
    } catch (err) {
      console.error("Error:", err);
      toast.error("Failed to create class. Please try again.");
    }
  }

  async function handleUpdateClass(e: React.FormEvent) {
    e.preventDefault();
    
    if (!selectedClass) return;
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const benefitsString = formData.get("edit-benefits") as string;
    const benefits = benefitsString ? benefitsString.split(",").map(b => b.trim()) : [];
    
    // Handle image upload if new image selected
    const imageFile = formData.get("edit-class-image") as File;
    let imageUrl = selectedClass.image_url;
    let imageFileId: string | null | undefined = undefined;

    if (imageFile && imageFile.size > 0) {
      const uploaded = await uploadImage(imageFile, "class_image", selectedClass.id);
      if (uploaded) {
        imageUrl = uploaded.url;
        imageFileId = uploaded.fileId;
      }
    }

    try {
      const res = await fetch("/api/admin/classes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedClass.id,
          name: formData.get("edit-class-name") as string,
          category: formData.get("edit-category") as string,
          description: formData.get("edit-description") as string,
          benefits: benefits,
          duration: parseInt(formData.get("edit-duration") as string),
          max_capacity: parseInt(formData.get("edit-capacity") as string),
          image_url: imageUrl,
          ...(imageFileId !== undefined ? { image_file_id: imageFileId } : {}),
        }),
      });
      if (!res.ok) throw new Error("Update failed");

      toast.success("Class updated successfully!");
      setShowClassDetailsDialog(false);
      setClassImagePreview("");
      fetchClasses();
    } catch (err) {
      console.error("Error:", err);
      toast.error("Failed to update class. Please try again.");
    }
  }

  async function handleDeleteClass(classId: string, className: string) {
    const confirmed = confirm(`Are you sure you want to delete "${className}"? This action cannot be undone.`);
    
    if (!confirmed) return;
    
    try {
      const res = await fetch(`/api/admin/classes?id=${classId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");

      toast.success("Class deleted successfully!");
      setShowClassDetailsDialog(false);
      fetchClasses();
    } catch (err) {
      console.error("Error:", err);
      toast.error("Failed to delete class. Please try again.");
    }
  }

  async function handleToggleClassActive(cls: ClassRow) {
    const nextActive = cls.is_active === false; // currently inactive → reactivate; else set inactive
    try {
      const res = await fetch("/api/admin/classes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cls.id, is_active: nextActive }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      toast.success(nextActive ? "Class reactivated." : "Class set inactive (hidden from members).");
      fetchClasses();
    } catch (err) {
      console.error("Error:", err);
      toast.error("Failed to update class status. Please try again.");
    }
  }

  async function handleCreateInstructor(e: React.FormEvent) {
    e.preventDefault();
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const specialtiesString = formData.get("specialties") as string;
    const specialties = specialtiesString ? specialtiesString.split(",").map(s => s.trim()) : [];
    
    const certificationsString = formData.get("certifications") as string;
    const certifications = certificationsString ? certificationsString.split(",").map(s => s.trim()) : [];
    
    // Handle image upload
    const imageFile = formData.get("instructor-image") as File;
    let imageUrl = cdnUrl("/placeholder.jpg");
    let imageFileId: string | null = null;

    if (imageFile && imageFile.size > 0) {
      const uploaded = await uploadImage(imageFile, "instructor_photo");
      if (uploaded) {
        imageUrl = uploaded.url;
        imageFileId = uploaded.fileId;
      }
    }

    try {
      const res = await fetch("/api/admin/instructors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("instructor-name") as string,
          title: formData.get("instructor-title") as string,
          email: formData.get("instructor-email") as string,
          phone: formData.get("instructor-phone") as string,
          years_of_experience: String(parseInt(formData.get("years-experience") as string)),
          studio_payout_cut_percent:
            formData.get("studio-payout-cut") != null &&
            String(formData.get("studio-payout-cut")).trim() !== ""
              ? Number(formData.get("studio-payout-cut"))
              : null,
          specialties: specialties,
          philosophy: formData.get("philosophy") as string,
          about: formData.get("about") as string,
          certifications: certifications,
          social_facebook: formData.get("social-facebook") as string,
          social_twitter: formData.get("social-twitter") as string,
          social_linkedin: formData.get("social-linkedin") as string,
          social_whatsapp: formData.get("social-whatsapp") as string,
          image_url: imageUrl,
          image_file_id: imageFileId,
        }),
      });
      if (!res.ok) throw new Error("Create instructor failed");

      toast.success("Instructor created successfully!");
      setShowAddInstructorDialog(false);
      setImagePreview("");
      void mutateInstructors();
      form.reset();
    } catch (err) {
      console.error("Error:", err);
      toast.error("Failed to create instructor. Please try again.");
    }
  }

  async function handleUpdateInstructor(e: React.FormEvent) {
    e.preventDefault();
    
    if (!selectedInstructorData) return;
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const specialtiesString = formData.get("edit-specialties") as string;
    const specialties = specialtiesString ? specialtiesString.split(",").map(s => s.trim()) : [];
    
    const certificationsString = formData.get("edit-certifications") as string;
    const certifications = certificationsString ? certificationsString.split(",").map(s => s.trim()) : [];
    
    // Handle image upload if new image selected
    const imageFile = formData.get("edit-instructor-image") as File;
    let imageUrl = selectedInstructorData.image_url;
    let imageFileId: string | null | undefined = undefined;

    if (imageFile && imageFile.size > 0) {
      const uploaded = await uploadImage(imageFile, "instructor_photo", selectedInstructorData.id);
      if (uploaded) {
        imageUrl = uploaded.url;
        imageFileId = uploaded.fileId;
      }
    }

    try {
      const res = await fetch("/api/admin/instructors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedInstructorData.id,
          name: formData.get("edit-instructor-name") as string,
          title: formData.get("edit-instructor-title") as string,
          email: formData.get("edit-instructor-email") as string,
          phone: formData.get("edit-instructor-phone") as string,
          years_of_experience: String(parseInt(formData.get("edit-years-experience") as string)),
          studio_payout_cut_percent:
            formData.get("edit-studio-payout-cut") != null &&
            String(formData.get("edit-studio-payout-cut")).trim() !== ""
              ? Number(formData.get("edit-studio-payout-cut"))
              : null,
          specialties: specialties,
          philosophy: formData.get("edit-philosophy") as string,
          about: formData.get("edit-about") as string,
          certifications: certifications,
          social_facebook: formData.get("edit-social-facebook") as string,
          social_twitter: formData.get("edit-social-twitter") as string,
          social_linkedin: formData.get("edit-social-linkedin") as string,
          social_whatsapp: formData.get("edit-social-whatsapp") as string,
          image_url: imageUrl,
          ...(imageFileId !== undefined ? { image_file_id: imageFileId } : {}),
        }),
      });
      if (!res.ok) throw new Error("Update failed");

      toast.success("Instructor updated successfully!");
      setShowEditInstructorDialog(false);
      setImagePreview("");
      void mutateInstructors();
    } catch (err) {
      console.error("Error:", err);
      toast.error("Failed to update instructor. Please try again.");
    }
  }

  // ---- Tab search + sort ----
  const [classSearch, setClassSearch] = useState("");

  const classSort = useSort<"name" | "category" | "duration" | "capacity">();

  const filteredClasses = useMemo(() => {
    let list = classes;
    const q = classSearch.trim().toLowerCase();
    if (q)
      list = list.filter(
        (c) =>
          String(c.name ?? "").toLowerCase().includes(q) ||
          String(c.category ?? "").toLowerCase().includes(q),
      );
    if (classSort.key) {
      const dir = classSort.dir === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        switch (classSort.key) {
          case "name":
            return String(a.name ?? "").localeCompare(String(b.name ?? "")) * dir;
          case "category":
            return String(a.category ?? "").localeCompare(String(b.category ?? "")) * dir;
          case "duration":
            return ((a.duration ?? 0) - (b.duration ?? 0)) * dir;
          case "capacity":
            return ((a.max_capacity ?? 0) - (b.max_capacity ?? 0)) * dir;
          default:
            return 0;
        }
      });
    }
    return list;
  }, [classes, classSearch, classSort.key, classSort.dir]);

  // ---- Stat summaries ----
  const classStats = useMemo(() => {
    const cats = new Set(classes.map((c) => c.category).filter(Boolean));
    const durations = classes.map((c) => Number(c.duration) || 0).filter((d) => d > 0);
    const avgDur = durations.length
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : 0;
    const capacity = classes.reduce((s, c) => s + (Number(c.max_capacity) || 0), 0);
    return { total: classes.length, categories: cats.size, avgDur, capacity };
  }, [classes]);

  const classesPg = usePagination(filteredClasses, 10, `${classSearch}|${classSort.key}|${classSort.dir}`);

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          <ControlPanelShellSkeleton />
        </div>
      </div>
    );
  }



  return (
    <>
      <SEO 
        title="Control Panel - The Studio"
        description="Manage operations and settings"
      />
      
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <AdminPageHeader
              title="Control Panel"
              subtitle="Members, classes, catalog, coupons, and studio settings."
            />

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="lg:grid lg:grid-cols-[224px_minmax(0,1fr)] lg:gap-8">
                {/* Section nav */}
                <aside className="mb-6 lg:mb-0 lg:sticky lg:top-6 lg:self-start">
                  {/* Phone / tablet: grouped select */}
                  <div className="lg:hidden">
                    <Select value={activeTab} onValueChange={setActiveTab}>
                      <SelectTrigger className="w-full bg-white-warm border-sage/20 font-body" aria-label="Control Panel section">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTROL_NAV.map((group) => (
                          <SelectGroup key={group.label}>
                            <SelectLabel className="font-body text-xs uppercase tracking-wider text-charcoal/40">
                              {group.label}
                            </SelectLabel>
                            {group.items.map((it) => (
                              <SelectItem key={it.value} value={it.value} className="font-body">
                                {it.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Desktop: grouped vertical rail */}
                  <TabsList className="hidden lg:flex lg:flex-col h-auto w-full items-stretch gap-0.5 bg-transparent p-0">
                    {CONTROL_NAV.map((group) => (
                      <div key={group.label} className="mb-3 w-full">
                        <p className="px-3 pb-1 font-body text-[11px] font-semibold uppercase tracking-wider text-charcoal/40">
                          {group.label}
                        </p>
                        {group.items.map((it) => {
                          const Icon = it.icon;
                          const openPauses =
                            it.value === "pauses" ? pauseTickets.filter((t) => t.status === "open").length : 0;
                          return (
                            <TabsTrigger
                              key={it.value}
                              value={it.value}
                              className="w-full cursor-pointer justify-start gap-2.5 rounded-lg px-3 py-2 font-body text-charcoal/70 transition-colors duration-200 hover:bg-sage/10 data-[state=active]:bg-sage data-[state=active]:text-cream data-[state=active]:shadow-sm"
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="flex-1 text-left">{it.label}</span>
                              {openPauses > 0 && (
                                <Pill tone="warning" size="sm">
                                  {openPauses}
                                </Pill>
                              )}
                            </TabsTrigger>
                          );
                        })}
                      </div>
                    ))}
                  </TabsList>
                </aside>

                {/* Content column */}
                <div className="min-w-0 space-y-6">

              {/* PAUSE REQUESTS TAB */}
              <TabsContent value="pauses" className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard label="Total" value={pauseTickets.length} icon={Clock} tone="sage" />
                  <MetricCard label="Open" value={pauseTickets.filter((t) => t.status === "open").length} icon={Clock} tone="terracotta" />
                  <MetricCard label="In Review" value={pauseTickets.filter((t) => t.status === "in_review").length} icon={Edit} tone="charcoal" />
                  <MetricCard label="Resolved" value={pauseTickets.filter((t) => t.status === "resolved").length} icon={CheckCircle2} tone="sage" />
                </div>

                <Card className="border-sage/20 bg-white-warm">
                  <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="font-body font-semibold text-xl">Pause Subscription Requests</CardTitle>
                      <CardDescription>Approving freezes the pass shown on each request and extends its expiry by the pause duration.</CardDescription>
                    </div>
                    <Select value={pauseStatusFilter} onValueChange={(v) => setPauseStatusFilter(v as typeof pauseStatusFilter)}>
                      <SelectTrigger className="w-40 border-sage/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent>
                    {loadingPauseTickets ? (
                      <UserListSkeleton rows={3} />
                    ) : (() => {
                      const filtered = pauseStatusFilter === "all"
                        ? pauseTickets
                        : pauseTickets.filter((t) => t.status === pauseStatusFilter);
                      if (filtered.length === 0) {
                        return <p className="font-body text-sm text-charcoal/60 py-8 text-center">No pause requests {pauseStatusFilter !== "all" && `with status "${pauseStatusFilter}"`}.</p>;
                      }
                      return (
                        <div className="space-y-3">
                          {filtered.map((t) => {
                            const from = t.pause_from ? new Date(t.pause_from) : null;
                            const to = t.pause_to ? new Date(t.pause_to) : null;
                            const days = from && to
                              ? Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)))
                              : null;
                            const statusTone: Record<string, "success" | "warning" | "neutral"> = {
                              open: "warning",
                              in_review: "neutral",
                              resolved: "success",
                              rejected: "neutral",
                            };
                            const draft = pauseNoteDrafts[t.id] ?? t.admin_note ?? "";
                            return (
                              <Card key={t.id} className="border-sage/15 bg-white-warm">
                                <CardContent className="p-5 space-y-3">
                                  <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div className="space-y-0.5">
                                      <p className="font-body font-medium text-charcoal">{t.profile?.full_name || "Unknown"}</p>
                                      <p className="font-body text-xs text-charcoal/60">{t.profile?.email}{t.profile?.phone && ` · ${t.profile.phone}`}</p>
                                    </div>
                                    <Pill tone={statusTone[t.status] ?? "neutral"} size="sm" className="font-body uppercase">
                                      {t.status?.replace("_", " ")}
                                    </Pill>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm font-body">
                                    <div>
                                      <p className="text-xs text-charcoal/50 uppercase tracking-wide">Pass</p>
                                      {(() => {
                                        const up = t.user_package;
                                        if (!up) return <p className="text-charcoal/50 italic">Most recent active (legacy)</p>;
                                        const name = up.package_type?.name?.trim()
                                          || (up.pass_type === "studio_pass" ? "Studio Pass" : "Class Pass");
                                        const detail = up.pass_type === "studio_pass"
                                          ? "Unlimited"
                                          : up.credits_remaining != null ? `${up.credits_remaining} left` : null;
                                        return (
                                          <p className="text-charcoal">
                                            {name}{detail && <span className="text-charcoal/50"> · {detail}</span>}
                                            {up.is_active === false && <span className="text-terracotta"> · inactive</span>}
                                          </p>
                                        );
                                      })()}
                                    </div>
                                    <div>
                                      <p className="text-xs text-charcoal/50 uppercase tracking-wide">From</p>
                                      <p className="text-charcoal">{from ? from.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-charcoal/50 uppercase tracking-wide">To</p>
                                      <p className="text-charcoal">{to ? to.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-charcoal/50 uppercase tracking-wide">Duration</p>
                                      <p className="text-charcoal">{days ? `${days} day${days === 1 ? "" : "s"}` : "—"}</p>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-xs text-charcoal/50 uppercase tracking-wide font-body mb-1">Reason</p>
                                    <p className="font-body text-sm text-charcoal whitespace-pre-wrap">{t.reason}</p>
                                  </div>
                                  {t.attachment_url && (
                                    <a href={t.attachment_url} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 text-xs text-sage hover:text-sage/80 font-body underline">
                                      View attachment
                                    </a>
                                  )}
                                  <div className="space-y-1.5">
                                    <Label className="text-xs text-charcoal/60 font-body">Admin note</Label>
                                    <Textarea
                                      value={draft}
                                      onChange={(e) => setPauseNoteDrafts((p) => ({ ...p, [t.id]: e.target.value }))}
                                      placeholder="Internal note (optional)"
                                      rows={2}
                                      className="border-sage/20 text-sm font-body resize-none"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap pt-1">
                                    <Button size="sm" variant="outline"
                                      disabled={pauseSavingId === t.id || draft === (t.admin_note ?? "")}
                                      onClick={() => updatePauseTicket(t.id, { admin_note: draft })}
                                      className="border-sage/30 text-sage hover:bg-sage hover:text-cream font-body">
                                      Save note
                                    </Button>
                                    {t.status !== "in_review" && t.status !== "resolved" && (
                                      <Button size="sm" variant="outline"
                                        disabled={pauseSavingId === t.id}
                                        onClick={() => updatePauseTicket(t.id, { status: "in_review", admin_note: draft })}
                                        className="border-charcoal/30 text-charcoal hover:bg-charcoal hover:text-cream font-body">
                                        Mark In Review
                                      </Button>
                                    )}
                                    {t.status !== "resolved" && (
                                      <Button size="sm"
                                        disabled={pauseSavingId === t.id || !t.pause_from || !t.pause_to}
                                        onClick={() => updatePauseTicket(t.id, { status: "resolved", admin_note: draft })}
                                        variant="sage">
                                        Approve & Extend Expiry
                                      </Button>
                                    )}
                                    {t.status !== "rejected" && t.status !== "resolved" && (
                                      <Button size="sm" variant="outline"
                                        disabled={pauseSavingId === t.id}
                                        onClick={() => updatePauseTicket(t.id, { status: "rejected", admin_note: draft })}
                                        className="border-terracotta/40 text-terracotta hover:bg-terracotta hover:text-cream font-body">
                                        Reject
                                      </Button>
                                    )}
                                  </div>
                                  <p className="text-xs text-charcoal/40 font-body">Raised {new Date(t.created_at).toLocaleString("en-IN")}</p>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* CLASS MANAGEMENT TAB */}
              <TabsContent value="classes" className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard label="Classes" value={classStats.total} icon={Calendar} tone="sage" />
                  <MetricCard label="Categories" value={classStats.categories} icon={Layers} tone="terracotta" />
                  <MetricCard label="Avg Duration" value={classStats.avgDur} icon={Clock} tone="charcoal" suffix=" min" />
                  <MetricCard label="Total Capacity" value={classStats.capacity} icon={Users} tone="sage" />
                </div>

                <Card className="border-sage/20 bg-white-warm">
                  <CardHeader className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="font-body font-semibold text-2xl text-charcoal">
                          Class Management <span className="font-body text-base text-charcoal/40">({filteredClasses.length})</span>
                        </CardTitle>
                        <CardDescription className="font-body text-charcoal/60">
                          Manage class types, descriptions, and settings
                        </CardDescription>
                      </div>
                      <Button
                          onClick={() => setShowAddClassDialog(true)}
                          variant="sage"
                          className="h-9 shrink-0"
                        >
                          <Plus className="h-4 w-4 mr-1.5" />
                          Create Class
                        </Button>
                    </div>
                    <FilterBar reset={classSearch ? () => setClassSearch("") : undefined}>
                      <FilterSearch
                        value={classSearch}
                        onChange={setClassSearch}
                        placeholder="Search class or category…"
                        aria-label="Search classes"
                      />
                    </FilterBar>
                  </CardHeader>
                  <CardContent>
                    {loadingClasses ? (
                      <ClassGridSkeleton count={4} />
                    ) : filteredClasses.length === 0 ? (
                      <EmptyState
                        icon={Calendar}
                        title={classes.length === 0 ? "No classes yet" : "No classes match your search."}
                        description={classes.length === 0 ? "Create one to get started." : undefined}
                      />
                    ) : (
                      <>
                        <ResponsiveTable>
                          <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>
                                    <button type="button" onClick={() => classSort.toggle("name")} className={thBtn}>
                                      Class {sortArrow(classSort.key === "name", classSort.dir)}
                                    </button>
                                  </TableHead>
                                  <TableHead className="w-[150px]">
                                    <button type="button" onClick={() => classSort.toggle("category")} className={thBtn}>
                                      Category {sortArrow(classSort.key === "category", classSort.dir)}
                                    </button>
                                  </TableHead>
                                  <TableHead className="w-[120px]">
                                    <button type="button" onClick={() => classSort.toggle("duration", "desc")} className={thBtn}>
                                      Duration {sortArrow(classSort.key === "duration", classSort.dir)}
                                    </button>
                                  </TableHead>
                                  <TableHead className="w-[110px]">
                                    <button type="button" onClick={() => classSort.toggle("capacity", "desc")} className={thBtn}>
                                      Capacity {sortArrow(classSort.key === "capacity", classSort.dir)}
                                    </button>
                                  </TableHead>
                                  <TableHead className="w-[110px]">Status</TableHead>
                                  <TableHead className="w-[110px] text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {classesPg.pageItems.map((cls) => (
                                  <TableRow key={cls.id}>
                                    <TableCell>
                                      <div className="flex items-center gap-3 min-w-0">
                                        <ListAvatar
                                          name={cls.name}
                                          src={cls.image_url}
                                          size="md"
                                          className="shrink-0"
                                          overlay={
                                            !cls.image_url ? (
                                              <Calendar className="absolute inset-0 m-auto h-5 w-5 text-sage" />
                                            ) : null
                                          }
                                          fallbackClassName="bg-sage/10 text-transparent"
                                        />
                                        <div className="min-w-0">
                                          <div className="font-body font-medium text-charcoal truncate">{cls.name}</div>
                                          {cls.description && (
                                            <div className="font-body text-xs text-charcoal/50 truncate max-w-[280px]">{cls.description}</div>
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Pill tone="success" className="font-body">{cls.category}</Pill>
                                    </TableCell>
                                    <TableCell>
                                      <span className="font-body text-sm text-charcoal/70 tabular-nums">{cls.duration} min</span>
                                    </TableCell>
                                    <TableCell>
                                      <span className="font-body text-sm text-charcoal/70 tabular-nums">Max {cls.max_capacity}</span>
                                    </TableCell>
                                    <TableCell>
                                      {cls.is_active === false ? (
                                        <Pill tone="neutral" className="font-body">Inactive</Pill>
                                      ) : (
                                        <Pill tone="success" className="font-body">Active</Pill>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-2 justify-end">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleToggleClassActive(cls)}
                                          aria-label={cls.is_active === false ? "Reactivate class type" : "Set inactive (hide from members)"}
                                          title={cls.is_active === false ? "Reactivate class type" : "Set inactive (hide from members)"}
                                          className={cn(
                                            "h-8 w-8 p-0",
                                            cls.is_active === false
                                              ? "border-sage/60 text-sage hover:bg-sage hover:text-cream"
                                              : "border-terracotta/40 text-terracotta hover:bg-terracotta hover:text-cream",
                                          )}
                                        >
                                          {cls.is_active === false ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                                        </Button>
                                        <EditButton onClick={() => { setSelectedClass(cls); setShowClassDetailsDialog(true); }} label="Edit class" />
                                        <DeleteButton onClick={() => handleDeleteClass(cls.id, cls.name)} label="Delete class" />
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </ResponsiveTable>
                        <Pagination page={classesPg.page} total={classesPg.total} onChange={classesPg.setPage} />
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ANALYTICS TAB */}
              <TabsContent value="analytics" className="space-y-6">
                <ControlAnalyticsPanel />
              </TabsContent>

              {/* PACKAGES TAB (moved from Settings) */}
              <TabsContent value="packages" className="space-y-6">
                <PackageCatalogTab />
              </TabsContent>

              {/* COUPONS TAB (moved from Dashboard) */}
              <TabsContent value="coupons" className="space-y-6">
                <CouponsTab />
              </TabsContent>

              {/* STUDIO SETTINGS TAB (moved from Settings) */}
              <TabsContent value="studio" className="space-y-6">
                <StudioSettingsTab />
              </TabsContent>

              {/* CANCELLATIONS TAB (moved from Settings) */}
              <TabsContent value="cancellations" className="space-y-6">
                <CancellationsTab />
              </TabsContent>
                </div>
              </div>
            </Tabs>

          </div>
        </main>
      </div>

      {/* Dialogs - same as in dashboard */}

      {/* Add Class Dialog */}
      <ResponsiveDialog open={showAddClassDialog} onOpenChange={setShowAddClassDialog}>
        <ResponsiveDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white-warm border-sage/20">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-body font-semibold text-2xl text-charcoal">Create New Class</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Define a new class type (scheduling happens in Schedule tab)
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <form onSubmit={handleCreateClass}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="class-name" className="font-body text-charcoal">Class Name</Label>
                <Input id="class-name" name="class-name" placeholder="e.g., Muay Thai Circuit" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="font-body text-charcoal">Category</Label>
                <Select name="category" required>
                  <SelectTrigger className="border-sage/20">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strength">Strength</SelectItem>
                    <SelectItem value="flexibility">Flexibility</SelectItem>
                    <SelectItem value="cardio">Cardio</SelectItem>
                    <SelectItem value="mind-body">Mind-Body</SelectItem>
                    <SelectItem value="specialty">Specialty</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="description" className="font-body text-charcoal">Description</Label>
                <Textarea 
                  id="description"
                  name="description"
                  placeholder="Describe what this class is about..."
                  className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40"
                  rows={3}
                  required
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="benefits" className="font-body text-charcoal">Key Benefits (comma-separated)</Label>
                <Input 
                  id="benefits"
                  name="benefits"
                  placeholder="e.g., Builds Strength, Improves Flexibility, Boosts Confidence"
                  className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" 
                  required
                />
                <p className="text-xs text-charcoal/50">Enter benefits separated by commas</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration" className="font-body text-charcoal">Duration (minutes)</Label>
                <Input id="duration" name="duration" type="number" placeholder="60" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity" className="font-body text-charcoal">Max Capacity</Label>
                <Input id="capacity" name="capacity" type="number" placeholder="12" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructor" className="font-body text-charcoal">Instructor</Label>
                <Select name="instructor" required>
                  <SelectTrigger className="border-sage/20">
                    <SelectValue placeholder="Select instructor" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {instructors.map(instructor => (
                      <SelectItem key={instructor.id} value={instructor.id}>
                        {instructor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="display-order" className="font-body text-charcoal">Display Order</Label>
                <Input id="display-order" name="display-order" type="number" placeholder="0" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="class-image" className="font-body text-charcoal">Class image</Label>
                <p className="text-xs text-charcoal/50 font-body">JPEG, PNG, or WebP. Leave empty to use the default placeholder (large files use data URLs — up to ~12MB).</p>
                <Input 
                  id="class-image"
                  name="class-image"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  className="border-sage/20 focus:ring-sage"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setClassImagePreview(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  required
                />
                {classImagePreview && (
                  <div className="mt-2">
                    <Image src={classImagePreview} alt="Preview" width={128} height={128} className="w-32 h-32 object-cover rounded-lg border border-sage/20" unoptimized />
                  </div>
                )}
                {uploadingImage && (
                  <p className="text-sm text-sage">Uploading image...</p>
                )}
              </div>
            </div>
            <ResponsiveDialogFooter className="sticky bottom-0 bg-white-warm pt-4 border-t border-sage/10">
              <Button type="button" variant="outline" onClick={() => setShowAddClassDialog(false)} className="border-sage/20 font-body">
                Cancel
              </Button>
              <Button type="submit" variant="sage">
                <Save className="h-4 w-4 mr-2" />
                Create Class
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Class Details Dialog */}
      <ResponsiveDialog open={showClassDetailsDialog} onOpenChange={setShowClassDetailsDialog}>
        <ResponsiveDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white-warm border-sage/20">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-body font-semibold text-2xl text-charcoal">
              {selectedClass?.name}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Edit class details and settings
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {selectedClass && (
            <form onSubmit={handleUpdateClass}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-class-name" className="font-body text-charcoal">Class Name</Label>
                    <Input 
                      id="edit-class-name"
                      name="edit-class-name"
                      defaultValue={selectedClass.name}
                      className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-category" className="font-body text-charcoal">Category</Label>
                    <Select name="edit-category" defaultValue={selectedClass.category} required>
                      <SelectTrigger className="border-sage/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="strength">Strength</SelectItem>
                        <SelectItem value="flexibility">Flexibility</SelectItem>
                        <SelectItem value="cardio">Cardio</SelectItem>
                        <SelectItem value="mind-body">Mind-Body</SelectItem>
                        <SelectItem value="specialty">Specialty</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="edit-description" className="font-body text-charcoal">Description</Label>
                    <Textarea 
                      id="edit-description"
                      name="edit-description"
                      defaultValue={selectedClass.description}
                      className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40"
                      rows={3}
                      required
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="edit-benefits" className="font-body text-charcoal">Key Benefits (comma-separated)</Label>
                    <Input 
                      id="edit-benefits"
                      name="edit-benefits"
                      defaultValue={selectedClass.benefits?.join(", ")}
                      className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-duration" className="font-body text-charcoal">Duration (minutes)</Label>
                    <Input 
                      id="edit-duration"
                      name="edit-duration"
                      type="number" 
                      defaultValue={selectedClass.duration}
                      className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-capacity" className="font-body text-charcoal">Max Capacity</Label>
                    <Input 
                      id="edit-capacity"
                      name="edit-capacity"
                      type="number" 
                      defaultValue={selectedClass.max_capacity}
                      className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40"
                      required
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="edit-class-image" className="font-body text-charcoal">Class Image</Label>
                    <Input 
                      id="edit-class-image"
                      name="edit-class-image"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      className="border-sage/20 focus:ring-sage"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setClassImagePreview(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <div className="mt-2">
                      <Image
                        src={classImagePreview || selectedClass.image_url}
                        alt="Current"
                        width={128}
                        height={128}
                        className="w-32 h-32 object-cover rounded-lg border border-sage/20"
                        unoptimized
                      />
                    </div>
                    {uploadingImage && (
                      <p className="text-sm text-sage">Uploading image...</p>
                    )}
                    <p className="text-xs text-charcoal/50">Leave empty to keep current image</p>
                  </div>
                </div>
              </div>
              <ResponsiveDialogFooter className="sticky bottom-0 bg-white-warm pt-4 border-t border-sage/10 flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDeleteClass(selectedClass.id, selectedClass.name)}
                  className="font-body sm:mr-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Class
                </Button>
                <div className="flex gap-2 sm:ml-auto">
                  <Button type="button" variant="outline" onClick={() => setShowClassDetailsDialog(false)} className="border-sage/20 font-body">
                    Cancel
                  </Button>
                  <Button type="submit" variant="sage">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </ResponsiveDialogFooter>
            </form>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Add Instructor Dialog */}
      <ResponsiveDialog open={showAddInstructorDialog} onOpenChange={setShowAddInstructorDialog}>
        <ResponsiveDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white-warm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-body font-semibold text-2xl text-charcoal">Add New Instructor</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Create complete instructor profile with all details
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <form onSubmit={handleCreateInstructor}>
            <div className="grid grid-cols-2 gap-4 py-4">
              {/* Basic Information */}
              <div className="col-span-2">
                <h3 className="font-body font-semibold text-lg text-charcoal mb-3">Basic Information</h3>
              </div>
              
              <div className="col-span-2 space-y-2">
                <Label htmlFor="instructor-image" className="font-body text-charcoal">Profile Image *</Label>
                <Input 
                  id="instructor-image" 
                  name="instructor-image" 
                  type="file" 
                  accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  className="border-sage/20 focus:ring-sage"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setImagePreview(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  required
                />
                {imagePreview && (
                  <div className="mt-2">
                    <Image src={imagePreview} alt="Preview" width={128} height={128} className="w-32 h-32 object-cover rounded-lg border border-sage/20" unoptimized />
                  </div>
                )}
                {uploadingImage && (
                  <p className="text-sm text-sage">Uploading image...</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="instructor-name" className="font-body text-charcoal">Full Name *</Label>
                <Input id="instructor-name" name="instructor-name" placeholder="John Doe" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" required />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="instructor-title" className="font-body text-charcoal">Title/Role *</Label>
                <Input id="instructor-title" name="instructor-title" placeholder="MUAY THAI INSTRUCTOR" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" required />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="instructor-email" className="font-body text-charcoal">Email *</Label>
                <Input id="instructor-email" name="instructor-email" type="email" placeholder="instructor@email.com" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" required />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="instructor-phone" className="font-body text-charcoal">Phone Number *</Label>
                <Input id="instructor-phone" name="instructor-phone" placeholder="+91 98765 43210" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" required />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="years-experience" className="font-body text-charcoal">Years of Experience *</Label>
                <Input id="years-experience" name="years-experience" type="number" min="0" placeholder="10" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" required />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="studio-payout-cut" className="font-body text-charcoal">Studio revenue cut (%)</Label>
                <Input
                  id="studio-payout-cut"
                  name="studio-payout-cut"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  placeholder="40 — studio share; instructor gets the rest"
                  className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40"
                />
                <p className="text-xs text-charcoal/50">Not shown on the public site. Used for payout estimates.</p>
              </div>

              {/* Expertise */}
              <div className="col-span-2 mt-4">
                <h3 className="font-body font-semibold text-lg text-charcoal mb-3">Expertise & Credentials</h3>
              </div>
              
              <div className="col-span-2 space-y-2">
                <Label htmlFor="specialties" className="font-body text-charcoal">Specialties (comma-separated) *</Label>
                <Input id="specialties" name="specialties" placeholder="Muay Thai, Hatha Yoga, Combat Conditioning" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" required />
              </div>
              
              <div className="col-span-2 space-y-2">
                <Label htmlFor="certifications" className="font-body text-charcoal">Certifications (comma-separated) *</Label>
                <Input id="certifications" name="certifications" placeholder="Muay Thai Master Trainer (Thailand), Sivananda Yoga (200hr)" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" required />
              </div>

              {/* Bio */}
              <div className="col-span-2 mt-4">
                <h3 className="font-body font-semibold text-lg text-charcoal mb-3">Biography</h3>
              </div>
              
              <div className="col-span-2 space-y-2">
                <Label htmlFor="philosophy" className="font-body text-charcoal">Philosophy/Quote *</Label>
                <Textarea 
                  id="philosophy" 
                  name="philosophy"
                  placeholder="Movement is meditation. Every strike, every breath is a journey inward."
                  className="border-sage/20 focus:ring-sage"
                  rows={2}
                  required
                />
              </div>
              
              <div className="col-span-2 space-y-2">
                <Label htmlFor="about" className="font-body text-charcoal">About (Detailed Bio) *</Label>
                <Textarea 
                  id="about" 
                  name="about"
                  placeholder="Vivek Prabhu brings a decade of Muay Thai expertise, honed in Thailand, and three years of Hatha Yoga practice from Sivananda Yoga Ashram."
                  className="border-sage/20 focus:ring-sage"
                  rows={4}
                  required
                />
              </div>

              {/* Social Media */}
              <div className="col-span-2 mt-4">
                <h3 className="font-body font-semibold text-lg text-charcoal mb-3">Social Media (Optional)</h3>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="social-facebook" className="font-body text-charcoal">Facebook URL</Label>
                <Input id="social-facebook" name="social-facebook" placeholder="https://facebook.com/..." className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="social-twitter" className="font-body text-charcoal">Twitter URL</Label>
                <Input id="social-twitter" name="social-twitter" placeholder="https://twitter.com/..." className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="social-linkedin" className="font-body text-charcoal">LinkedIn URL</Label>
                <Input id="social-linkedin" name="social-linkedin" placeholder="https://linkedin.com/in/..." className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="social-whatsapp" className="font-body text-charcoal">WhatsApp Number</Label>
                <Input id="social-whatsapp" name="social-whatsapp" placeholder="+91 98765 43210" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" />
              </div>
            </div>
            <ResponsiveDialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowAddInstructorDialog(false)} className="border-sage/20 font-body">
                Cancel
              </Button>
              <Button type="submit" variant="sage">
                <Save className="h-4 w-4 mr-2" />
                Create Instructor
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Edit Instructor Dialog */}
      <ResponsiveDialog open={showEditInstructorDialog} onOpenChange={setShowEditInstructorDialog}>
        <ResponsiveDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white-warm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-body font-semibold text-2xl text-charcoal">Edit Instructor</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Update instructor profile and details
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {selectedInstructorData && (
            <form onSubmit={handleUpdateInstructor}>
              <div className="grid grid-cols-2 gap-4 py-4">
                {/* Basic Information */}
                <div className="col-span-2">
                  <h3 className="font-body font-semibold text-lg text-charcoal mb-3">Basic Information</h3>
                </div>
                
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="edit-instructor-image" className="font-body text-charcoal">Profile Image</Label>
                  <Input 
                    id="edit-instructor-image" 
                    name="edit-instructor-image" 
                    type="file" 
                    accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    className="border-sage/20 focus:ring-sage"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setImagePreview(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <div className="mt-2">
                    <Image
                      src={imagePreview || selectedInstructorData.image_url}
                      alt="Current"
                      width={128}
                      height={128}
                      className="w-32 h-32 object-cover rounded-lg border border-sage/20"
                      unoptimized
                    />
                  </div>
                  {uploadingImage && (
                    <p className="text-sm text-sage">Uploading image...</p>
                  )}
                  <p className="text-xs text-charcoal/50">Leave empty to keep current image</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-instructor-name" className="font-body text-charcoal">Full Name *</Label>
                  <Input id="edit-instructor-name" name="edit-instructor-name" defaultValue={selectedInstructorData.name} className="border-sage/20 focus:ring-sage" required />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-instructor-title" className="font-body text-charcoal">Title/Role *</Label>
                  <Input id="edit-instructor-title" name="edit-instructor-title" defaultValue={selectedInstructorData.title} className="border-sage/20 focus:ring-sage" required />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-instructor-email" className="font-body text-charcoal">Email *</Label>
                  <Input id="edit-instructor-email" name="edit-instructor-email" type="email" defaultValue={selectedInstructorData.email} className="border-sage/20 focus:ring-sage" required />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-instructor-phone" className="font-body text-charcoal">Phone Number *</Label>
                  <Input id="edit-instructor-phone" name="edit-instructor-phone" defaultValue={selectedInstructorData.phone} className="border-sage/20 focus:ring-sage" required />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-years-experience" className="font-body text-charcoal">Years of Experience *</Label>
                  <Input id="edit-years-experience" name="edit-years-experience" type="number" min="0" defaultValue={selectedInstructorData.years_of_experience} className="border-sage/20 focus:ring-sage" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-studio-payout-cut" className="font-body text-charcoal">Studio revenue cut (%)</Label>
                  <Input
                    id="edit-studio-payout-cut"
                    name="edit-studio-payout-cut"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    defaultValue={
                      selectedInstructorData.studio_payout_cut_percent != null
                        ? String(selectedInstructorData.studio_payout_cut_percent)
                        : ""
                    }
                    placeholder="e.g. 40"
                    className="border-sage/20 focus:ring-sage"
                  />
                  <p className="text-xs text-charcoal/50 font-body">Internal only — studio share before instructor payout.</p>
                </div>

                {/* Expertise */}
                <div className="col-span-2 mt-4">
                  <h3 className="font-body font-semibold text-lg text-charcoal mb-3">Expertise & Credentials</h3>
                </div>
                
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="edit-specialties" className="font-body text-charcoal">Specialties (comma-separated) *</Label>
                  <Input id="edit-specialties" name="edit-specialties" defaultValue={selectedInstructorData.specialties?.join(", ")} className="border-sage/20 focus:ring-sage" required />
                </div>
                
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="edit-certifications" className="font-body text-charcoal">Certifications (comma-separated) *</Label>
                  <Input id="edit-certifications" name="edit-certifications" defaultValue={selectedInstructorData.certifications?.join(", ")} className="border-sage/20 focus:ring-sage" required />
                </div>

                {/* Bio */}
                <div className="col-span-2 mt-4">
                  <h3 className="font-body font-semibold text-lg text-charcoal mb-3">Biography</h3>
                </div>
                
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="edit-philosophy" className="font-body text-charcoal">Philosophy/Quote *</Label>
                  <Textarea 
                    id="edit-philosophy" 
                    name="edit-philosophy"
                    defaultValue={selectedInstructorData.philosophy}
                    className="border-sage/20 focus:ring-sage"
                    rows={2}
                    required
                  />
                </div>
                
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="edit-about" className="font-body text-charcoal">About (Detailed Bio) *</Label>
                  <Textarea 
                    id="edit-about" 
                    name="edit-about"
                    defaultValue={selectedInstructorData.about}
                    className="border-sage/20 focus:ring-sage"
                    rows={4}
                    required
                  />
                </div>

                {/* Social Media */}
                <div className="col-span-2 mt-4">
                  <h3 className="font-body font-semibold text-lg text-charcoal mb-3">Social Media (Optional)</h3>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-social-facebook" className="font-body text-charcoal">Facebook URL</Label>
                  <Input id="edit-social-facebook" name="edit-social-facebook" defaultValue={selectedInstructorData.social_facebook} className="border-sage/20 focus:ring-sage" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-social-twitter" className="font-body text-charcoal">Twitter URL</Label>
                  <Input id="edit-social-twitter" name="edit-social-twitter" defaultValue={selectedInstructorData.social_twitter} className="border-sage/20 focus:ring-sage" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-social-linkedin" className="font-body text-charcoal">LinkedIn URL</Label>
                  <Input id="edit-social-linkedin" name="edit-social-linkedin" defaultValue={selectedInstructorData.social_linkedin} className="border-sage/20 focus:ring-sage" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-social-whatsapp" className="font-body text-charcoal">WhatsApp Number</Label>
                  <Input id="edit-social-whatsapp" name="edit-social-whatsapp" defaultValue={selectedInstructorData.social_whatsapp} className="border-sage/20 focus:ring-sage" />
                </div>
              </div>
              <ResponsiveDialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setShowEditInstructorDialog(false)} className="border-sage/20 font-body">
                  Cancel
                </Button>
                <Button type="submit" variant="sage">
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </ResponsiveDialogFooter>
            </form>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
