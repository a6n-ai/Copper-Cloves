import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Users, 
  Calendar, 
  Plus, 
  Edit, 
  Ban, 
  Mail, 
  Phone, 
  Clock, 
  Save,
  Upload,
  CheckCircle2,
  DollarSign,
  Download,
  CreditCard,
  Check,
  BarChart3,
  TrendingUp,
  TrendingDown,
  PieChart,
  Coffee,
  Trash2
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { InstructorAvatar } from "@/components/InstructorAvatar";
import { useSession } from "next-auth/react";
import type React from "react";
import { ControlAnalyticsPanel } from "@/components/admin/ControlAnalyticsPanel";
import { Pagination, usePagination } from "@/components/Pagination";

import { cdnUrl } from "@/lib/cdnUrl";
export default function ControlPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("users");

  // Dialog states
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [showAddClassDialog, setShowAddClassDialog] = useState(false);
  const [showClassDetailsDialog, setShowClassDetailsDialog] = useState(false);
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);
  const [showAddInstructorDialog, setShowAddInstructorDialog] = useState(false);
  const [showEditInstructorDialog, setShowEditInstructorDialog] = useState(false);

  // Selected items
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [selectedInstructorData, setSelectedInstructorData] = useState<any>(null);
  const [selectedPayoutData, setSelectedPayoutData] = useState<any>(null);

  // Classes state
  const [classes, setClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  // Users state
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Instructors state
  const [instructors, setInstructors] = useState<any[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(true);


  const [uploadingImage, setUploadingImage] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    pass_type: "class_pass" as "studio_pass" | "class_pass",
    class_or_days_count: "4",
    start_date: new Date().toISOString().slice(0, 10),
  });
  const [editPassType, setEditPassType] = useState<"class_pass" | "studio_pass">("class_pass");
  const [editClassCredits, setEditClassCredits] = useState<string>("");
  const [editDays, setEditDays] = useState<string>("");
  const [editStartDate, setEditStartDate] = useState<string>("");
  const [editEndDate, setEditEndDate] = useState<string>("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [classImagePreview, setClassImagePreview] = useState<string>("");

  const [instructorPayouts, setInstructorPayouts] = useState<
    {
      id: number;
      instructorId: string;
      name: string;
      specialties: string;
      checkIns: number;
      rate: number;
      total: number;
      percentage: number;
      status: "pending" | "paid";
    }[]
  >([]);
  const [payoutSummary, setPayoutSummary] = useState({
    totalPayouts: 0,
    pendingPayments: 0,
    completedPayments: 0,
    totalCheckIns: 0,
    pendingCount: 0,
    instructorsCount: 0,
  });

  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/admin/login"); return; }
    const role = (session?.user as { role?: string })?.role;
    if (status === "authenticated" && role !== "admin") { router.push("/admin/login"); return; }
    if (status === "authenticated") {
      fetchClasses();
      fetchUsers();
      fetchInstructors();
      void fetchPayoutData();
      setLoading(false);
    }
  }, [status, session, router]);

async function fetchPayoutData() {
    try {
      const res = await fetch("/api/admin/instructor-payouts");
      if (!res.ok) {
        setInstructorPayouts([]);
        return;
      }
      const data = await res.json();
      setPayoutSummary(data.summary ?? {});
      setInstructorPayouts(Array.isArray(data.instructors) ? data.instructors : []);
    } catch {
      setInstructorPayouts([]);
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

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/admin/members", { credentials: "same-origin" });
      if (!res.ok) {
        console.error("Fetch users failed:", res.status);
        setUsers([]);
        return;
      }
      const raw: unknown = await res.json();
      const profiles = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { members?: unknown })?.members)
        ? (raw as { members: unknown[] }).members
        : [];
      const now = new Date();

      const processedUsers = profiles.map(
        (profile: {
          id: string;
          full_name?: string | null;
          email?: string;
          phone?: string | null;
          pass_type?: string | null;
          user_packages?: Array<{
            id: string;
            is_active: boolean;
            is_paused?: boolean;
            pass_type?: string | null;
            credits_remaining?: number | null;
            expiration_date: string;
            purchase_date?: string;
            created_at?: string;
            package_type?: { is_unlimited?: boolean; name?: string; type?: string };
          }>;
        }) => {
          const pkgs = profile.user_packages ?? [];
          const byRecency = (
            a: (typeof pkgs)[0],
            b: (typeof pkgs)[0]
          ) =>
            new Date(b.purchase_date ?? b.created_at ?? 0).getTime() -
            new Date(a.purchase_date ?? a.created_at ?? 0).getTime();

          const activePkgs = pkgs.filter(
            (p) =>
              p.is_active &&
              new Date(p.expiration_date).getTime() > now.getTime()
          );
          activePkgs.sort(byRecency);
          const sortedAll = [...pkgs].sort(byRecency);
          const mostRecentPackage = activePkgs[0] ?? sortedAll[0];

          const passRaw = (
            mostRecentPackage?.pass_type ||
            profile.pass_type ||
            ""
          ).toLowerCase();
          const pt = mostRecentPackage?.package_type;
          const ptType = (pt?.type ?? "").toLowerCase();
          const isUnlimited = Boolean(pt?.is_unlimited);

          let passType: "none" | "class_pass" | "studio_pass" = "none";
          if (mostRecentPackage) {
            if (
              passRaw === "studio_pass" ||
              isUnlimited ||
              ptType.includes("studio")
            ) {
              passType = "studio_pass";
            } else {
              passType = "class_pass";
            }
          }

          const exp = mostRecentPackage?.expiration_date
            ? new Date(mostRecentPackage.expiration_date)
            : null;
          const daysRemaining =
            exp && !Number.isNaN(exp.getTime())
              ? Math.max(
                  0,
                  Math.ceil((exp.getTime() - now.getTime()) / 86400000)
                )
              : 0;

          const creditsVal = mostRecentPackage?.credits_remaining ?? 0;
          const classesRemaining =
            passType === "studio_pass" || isUnlimited ? "Unlimited" : creditsVal;

          return {
            ...profile,
            name: profile.full_name || profile.email || "Member",
            pass_type:
              profile.pass_type ||
              mostRecentPackage?.package_type?.name ||
              null,
            passType,
            classesRemaining,
            daysRemaining,
            expiry:
              exp && !Number.isNaN(exp.getTime())
                ? exp.toISOString()
                : "N/A",
            isPaused: Boolean(mostRecentPackage?.is_paused),
            phone: profile.phone ?? "—",
          };
        }
      );
      setUsers(processedUsers);
    } catch (error) {
      console.error("Fetch users error:", error);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }

  const fetchInstructors = async () => {
    setLoadingInstructors(true);
    try {
      const res = await fetch("/api/admin/instructors");
      setInstructors(res.ok ? await res.json() : []);
    } catch (error) {
      console.error("Fetch instructors error:", error);
    } finally {
      setLoadingInstructors(false);
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploadingImage(true);
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data.error === "string" ? data.error : `Upload failed (HTTP ${res.status}).`;
        alert(msg);
        return null;
      }
      if (typeof data.url !== "string" || !data.url) {
        alert("Upload response was invalid.");
        return null;
      }
      return data.url;
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Failed to upload image. Please try again.");
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageUpload = uploadImage;
  const handleClassImageUpload = uploadImage;

  async function handleAdminCreateUser() {
    if (!newUserForm.email.trim() || !newUserForm.password) {
      alert("Email and password are required.");
      return;
    }
    setCreatingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          full_name: newUserForm.full_name.trim(),
          email: newUserForm.email.trim(),
          phone: newUserForm.phone.trim() || null,
          password: newUserForm.password,
          pass_type: newUserForm.pass_type,
          class_or_days_count: newUserForm.class_or_days_count
            ? Number(newUserForm.class_or_days_count)
            : undefined,
          start_date: newUserForm.start_date || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === "string" ? data.error : "Could not create user");
        return;
      }
      alert("User created successfully.");
      setShowAddUserDialog(false);
      setNewUserForm({
        full_name: "",
        email: "",
        phone: "",
        password: "",
        pass_type: "class_pass",
        class_or_days_count: "4",
        start_date: new Date().toISOString().slice(0, 10),
      });
      fetchUsers();
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleEditUserSave() {
    if (!selectedUser) return;
    try {
      const patchBase = { profile_id: selectedUser.id };

      if (editPassType === "class_pass" && editClassCredits) {
        const current = typeof selectedUser.classesRemaining === "number" ? selectedUser.classesRemaining : 0;
        await fetch("/api/admin/members", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            ...patchBase,
            credits_delta: Number(editClassCredits) - current,
            pass_type: "class_pass",
            ...(editEndDate ? { expiration_date: editEndDate } : {}),
          }),
        });
      } else if (editPassType === "studio_pass" && (editDays || editEndDate)) {
        let expiryStr = editEndDate;
        if (!expiryStr && editDays) {
          const expiry = new Date();
          expiry.setDate(expiry.getDate() + Number(editDays));
          expiryStr = expiry.toISOString().slice(0, 10);
        }
        await fetch("/api/admin/members", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ ...patchBase, expiration_date: expiryStr, pass_type: "studio_pass" }),
        });
      }

      if (editStartDate) {
        await fetch("/api/admin/members", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ ...patchBase, start_date: editStartDate }),
        });
      }

      setShowEditUserDialog(false);
      fetchUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save changes");
    }
  }

  async function handleDeleteUser(userId: string, userName: string) {
    if (!confirm(`Delete "${userName}" permanently? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(userId)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      fetchUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not delete user");
    }
  }

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const benefitsString = formData.get("benefits") as string;
    const benefits = benefitsString ? benefitsString.split(",").map(b => b.trim()) : [];
    
    // Handle image upload
    const imageFile = formData.get("class-image") as File;
    let imageUrl = cdnUrl("/placeholder.jpg");
    
    if (imageFile && imageFile.size > 0) {
      const uploadedUrl = await handleClassImageUpload(imageFile);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
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
        }),
      });
      if (!res.ok) throw new Error("Failed to create class");

      alert("Class created successfully!");
      setShowAddClassDialog(false);
      setClassImagePreview("");
      fetchClasses();
      form.reset();
    } catch (err) {
      console.error("Error:", err);
      alert("Failed to create class. Please try again.");
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
    
    if (imageFile && imageFile.size > 0) {
      const uploadedUrl = await handleClassImageUpload(imageFile);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
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
        }),
      });
      if (!res.ok) throw new Error("Update failed");

      alert("Class updated successfully!");
      setShowClassDetailsDialog(false);
      setClassImagePreview("");
      fetchClasses();
    } catch (err) {
      console.error("Error:", err);
      alert("Failed to update class. Please try again.");
    }
  }

  async function handleDeleteClass(classId: string, className: string) {
    const confirmed = confirm(`Are you sure you want to delete "${className}"? This action cannot be undone.`);
    
    if (!confirmed) return;
    
    console.log("Attempting to delete class:", classId, className);
    
    try {
      const res = await fetch(`/api/admin/classes?id=${classId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");

      alert("Class deleted successfully!");
      setShowClassDetailsDialog(false);
      fetchClasses();
    } catch (err) {
      console.error("Error:", err);
      alert("Failed to delete class. Please try again.");
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
    
    if (imageFile && imageFile.size > 0) {
      const uploadedUrl = await handleImageUpload(imageFile);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
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
        }),
      });
      if (!res.ok) throw new Error("Create instructor failed");

      alert("Instructor created successfully!");
      setShowAddInstructorDialog(false);
      setImagePreview("");
      fetchInstructors();
      form.reset();
    } catch (err) {
      console.error("Error:", err);
      alert("Failed to create instructor. Please try again.");
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
    
    if (imageFile && imageFile.size > 0) {
      const uploadedUrl = await handleImageUpload(imageFile);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
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
        }),
      });
      if (!res.ok) throw new Error("Update failed");

      alert("Instructor updated successfully!");
      setShowEditInstructorDialog(false);
      setImagePreview("");
      fetchInstructors();
    } catch (err) {
      console.error("Error:", err);
      alert("Failed to update instructor. Please try again.");
    }
  }

  async function handleToggleInstructorActive(instructorId: string, currentActive: boolean) {
    try {
      const res = await fetch(`/api/admin/instructors?id=${instructorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ is_active: !currentActive }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      fetchInstructors();
    } catch (err) {
      console.error("Error:", err);
      alert("Failed to update instructor status.");
    }
  }

  async function handleDeleteInstructor(instructorId: string, instructorName: string) {
    const confirmed = confirm(`Are you sure you want to delete "${instructorName}"? This action cannot be undone.`);
    
    if (!confirmed) return;
    
    try {
      const res = await fetch(`/api/admin/instructors?id=${instructorId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");

      alert("Instructor deleted successfully!");
      setShowEditInstructorDialog(false);
      fetchInstructors();
    } catch (err) {
      console.error("Error:", err);
      alert("Failed to delete instructor. Please try again.");
    }
  }

  const usersPg = usePagination(users);
  const classesPg = usePagination(classes);
  const payoutsPg = usePagination(instructorPayouts);
  const instructorsPg = usePagination(instructors);

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10 flex items-center justify-center">
        <div className="h-12 w-12 border-4 border-sage/20 border-t-sage rounded-full animate-spin" />
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
        {/* Decorative Elements */}
        <div className="fixed top-20 right-20 w-72 h-72 bg-sage/10 rounded-full blur-3xl pointer-events-none" />
        <div className="fixed bottom-20 left-20 w-96 h-96 bg-cream/50 rounded-full blur-3xl pointer-events-none" />
        
        
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <AdminPageHeader
              title="Control Panel"
              subtitle="Manage users, classes, payouts, and instructors."
            />

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="bg-white/80 backdrop-blur-xl border border-sage/20 p-1">
                <TabsTrigger value="users" className="data-[state=active]:bg-sage data-[state=active]:text-white font-body">
                  <Users className="h-4 w-4 mr-2" />
                  User Management
                </TabsTrigger>
                <TabsTrigger value="classes" className="data-[state=active]:bg-sage data-[state=active]:text-white font-body">
                  <Calendar className="h-4 w-4 mr-2" />
                  Class Management
                </TabsTrigger>
                <TabsTrigger value="payouts" className="data-[state=active]:bg-sage data-[state=active]:text-white font-body">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payouts
                </TabsTrigger>
                <TabsTrigger value="instructors" className="data-[state=active]:bg-sage data-[state=active]:text-white font-body">
                  <Users className="h-4 w-4 mr-2" />
                  Instructor Mgmt
                </TabsTrigger>
                <TabsTrigger value="analytics" className="data-[state=active]:bg-sage data-[state=active]:text-white font-body">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics
                </TabsTrigger>
              </TabsList>

              {/* USER MANAGEMENT TAB */}
              <TabsContent value="users" className="space-y-6">
                {/* Header with Add User Button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-3xl text-charcoal mb-2">User Management</h2>
                    <p className="font-body text-charcoal/60">Add, edit, or remove members from the system</p>
                  </div>
                  <Button 
                    className="bg-sage hover:bg-sage/90 text-white font-body"
                    onClick={() => setShowAddUserDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>

                {/* Search and Filters */}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Input 
                          placeholder="Search by name, email, or phone..." 
                          className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40"
                        />
                      </div>
                      <Select defaultValue="all">
                        <SelectTrigger className="w-48 border-sage/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          <SelectItem value="studio_pass">Studio Pass</SelectItem>
                          <SelectItem value="class_pass">Class Pass</SelectItem>
                          <SelectItem value="active">Active Only</SelectItem>
                          <SelectItem value="inactive">Inactive Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* User List */}
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-12 w-12 border-4 border-sage/20 border-t-sage rounded-full animate-spin" />
                  </div>
                ) : users.length === 0 ? (
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardContent className="p-12 text-center">
                      <p className="font-body text-charcoal/60">No users found. Add a user to get started.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {usersPg.pageItems.map((user) => (
                      <Card key={user.id} className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-xl transition-all duration-600">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              <div className="h-14 w-14 rounded-full bg-sage/10 flex items-center justify-center">
                                <span className="font-display text-xl text-sage">
                                  {(user.name || user.full_name || user.email || "M").split(" ").map((n: string) => n[0]).join("")}
                                </span>
                              </div>
                              <div>
                                <div className="font-body font-medium text-charcoal text-lg mb-1">
                                  {user.name || user.full_name || user.email}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-charcoal/60">
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-3.5 w-3.5" />
                                    {user.email}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3.5 w-3.5" />
                                    {user.phone}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-center">
                                {user.passType === "none" ? (
                                  <>
                                    <Badge className="bg-charcoal/20 text-charcoal mb-2">
                                      No Subscription
                                    </Badge>
                                    <div className="font-body text-sm text-charcoal/60">
                                      Not enrolled
                                    </div>
                                  </>
                                ) : user.passType === "class_pass" ? (
                                  <>
                                    <Badge className="bg-sage text-white mb-2">
                                      Class Pass
                                    </Badge>
                                    <div className="font-body text-sm text-charcoal/60">
                                      {user.classesRemaining} classes left
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <Badge className={`${user.isPaused ? 'bg-amber-500' : 'bg-sage'} text-white mb-2`}>
                                      Studio Pass {user.isPaused && '(Paused)'}
                                    </Badge>
                                    <div className="font-body text-sm text-charcoal/60">
                                      {user.daysRemaining} days left
                                    </div>
                                  </>
                                )}
                              </div>
                              {user.passType !== "none" && (
                                <div className="text-center">
                                  <div className="font-body text-sm text-charcoal/60 mb-1">
                                    Start Date
                                  </div>
                                  <div className="font-body font-medium text-charcoal">
                                    {user.start_date ? new Date(user.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}
                                  </div>
                                </div>
                              )}
                              {user.passType !== "none" && (
                                <div className="text-center">
                                  <div className="font-body text-sm text-charcoal/60 mb-1">
                                    End Date
                                  </div>
                                  <div className="font-body font-medium text-charcoal">
                                    {user.expiry !== "N/A" ? new Date(user.expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "N/A"}
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="border-sage/20 text-sage hover:bg-sage/5 font-body"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    const pt = user.passType === "studio_pass" ? "studio_pass" : "class_pass";
                                    setEditPassType(pt);
                                    setEditClassCredits(pt === "class_pass" && typeof user.classesRemaining === "number" ? String(user.classesRemaining) : "");
                                    setEditDays("");
                                    setEditStartDate(user.start_date ? new Date(user.start_date).toISOString().slice(0, 10) : "");
                                    setEditEndDate(user.expiry && user.expiry !== "N/A" ? new Date(user.expiry).toISOString().slice(0, 10) : "");
                                    setShowEditUserDialog(true);
                                  }}
                                >
                                  <Edit className="h-3.5 w-3.5 mr-1" />
                                  Edit
                                </Button>
                                {user.passType === "studio_pass" && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className={`border-amber-500/20 ${user.isPaused ? 'text-sage' : 'text-amber-600'} hover:bg-amber-50 font-body`}
                                  >
                                    {user.isPaused ? 'Resume' : 'Pause'}
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-red-500/20 text-red-600 hover:bg-red-50 font-body"
                                  onClick={() => handleDeleteUser(user.id, user.name || user.full_name || user.email)}
                                >
                                  <Ban className="h-3.5 w-3.5 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <Pagination page={usersPg.page} total={usersPg.total} onChange={usersPg.setPage} />
                  </div>
                )}
              </TabsContent>

              {/* CLASS MANAGEMENT TAB */}
              <TabsContent value="classes" className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-3xl text-charcoal mb-2">Class Management</h2>
                    <p className="font-body text-charcoal/60">Manage class types, descriptions, and settings</p>
                  </div>
                  <Button 
                    className="bg-sage hover:bg-sage/90 text-white font-body"
                    onClick={() => setShowAddClassDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Class
                  </Button>
                </div>

                {/* Classes Grid */}
                {loadingClasses ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-12 w-12 border-4 border-sage/20 border-t-sage rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {classesPg.pageItems.map((cls) => (
                      <Card key={cls.id} className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-xl transition-all duration-600">
                        <CardContent className="p-6">
                          <div className="flex gap-4">
                            <div className="h-24 w-24 rounded-lg overflow-hidden bg-sage/10 shrink-0">
                              {cls.image_url ? (
                                <img 
                                  src={cls.image_url} 
                                  alt={cls.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Calendar className="h-12 w-12 text-sage" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="font-display text-xl text-charcoal mb-1">
                                    {cls.name}
                                  </div>
                                  <Badge className="bg-sage/10 text-sage border-sage/20">
                                    {cls.category}
                                  </Badge>
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="border-sage/20 text-sage hover:bg-sage/5"
                                    onClick={() => {
                                      setSelectedClass(cls);
                                      setShowClassDetailsDialog(true);
                                    }}
                                  >
                                    <Edit className="h-3.5 w-3.5 mr-1" />
                                    Edit
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="border-red-200 text-red-600 hover:bg-red-50"
                                    onClick={() => handleDeleteClass(cls.id, cls.name)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="mb-3">
                                <div className="font-body text-sm text-charcoal/80 line-clamp-2">
                                  {cls.description}
                                </div>
                              </div>

                              {cls.benefits && cls.benefits.length > 0 && (
                                <div className="mb-3">
                                  <div className="font-body text-xs text-charcoal/50 mb-1">Key Benefits:</div>
                                  <div className="flex flex-wrap gap-1">
                                    {cls.benefits.slice(0, 3).map((benefit: string, idx: number) => (
                                      <Badge key={idx} variant="outline" className="border-sage/20 text-sage bg-sage/5 text-xs">
                                        {benefit}
                                      </Badge>
                                    ))}
                                    {cls.benefits.length > 3 && (
                                      <Badge variant="outline" className="border-sage/20 text-charcoal/60 bg-cream/30 text-xs">
                                        +{cls.benefits.length - 3} more
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-4 text-xs text-charcoal/60">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {cls.duration} min
                                </div>
                                <div className="flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5" />
                                  Max {cls.max_capacity}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                <Pagination page={classesPg.page} total={classesPg.total} onChange={classesPg.setPage} />
              </TabsContent>

              {/* PAYOUT MANAGEMENT TAB */}
              <TabsContent value="payouts" className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-3xl text-charcoal mb-2">Instructor Payouts</h2>
                    <p className="font-body text-charcoal/60">Calculate and manage instructor payments based on check-ins</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Select defaultValue="month">
                      <SelectTrigger className="w-48 border-sage/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">This Week</SelectItem>
                        <SelectItem value="month">This Month</SelectItem>
                        <SelectItem value="quarter">This Quarter</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Payout Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                        Total Payouts
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-4xl text-charcoal mb-2">
                        ₹{payoutSummary.totalPayouts.toLocaleString("en-IN")}
                      </div>
                      <Badge variant="outline" className="border-sage/20 text-sage bg-sage/5">
                        {payoutSummary.instructorsCount ?? instructorPayouts.length} instructors
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                        Pending Payments
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-4xl text-amber-600 mb-2">
                        ₹{payoutSummary.pendingPayments.toLocaleString("en-IN")}
                      </div>
                      <Badge variant="outline" className="border-amber-500/20 text-amber-600 bg-amber-50">
                        {payoutSummary.pendingCount} pending
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                        Completed Payments
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-4xl text-sage mb-2">
                        ₹{payoutSummary.completedPayments.toLocaleString("en-IN")}
                      </div>
                      <Badge variant="outline" className="border-sage/20 text-sage bg-sage/5">
                        0 completed
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                        Total Check-ins
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-4xl text-charcoal mb-2">
                        {payoutSummary.totalCheckIns}
                      </div>
                      <Badge variant="outline" className="border-charcoal/10 text-charcoal/60">
                        @ ₹150 each
                      </Badge>
                    </CardContent>
                  </Card>
                </div>

                {/* Instructor Payout Cards */}
                <div className="space-y-3">
                  {payoutsPg.pageItems.map((instructor) => (
                    <Card key={instructor.instructorId} className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-xl transition-all duration-600">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="h-16 w-16 rounded-full bg-sage/10 flex items-center justify-center">
                              <span className="font-display text-2xl text-sage">
                                {(instructor.name || "I").split(" ").map(n => n[0]).join("")}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="font-display text-xl text-charcoal mb-1">
                                {instructor.name}
                              </div>
                              <div className="font-body text-sm text-charcoal/60 mb-2">
                                {instructor.specialties}
                              </div>
                              <div className="flex items-center gap-4">
                                <Badge variant="outline" className="border-sage/20 text-sage bg-sage/5">
                                  {instructor.checkIns} check-ins
                                </Badge>
                                <span className="font-body text-xs text-charcoal/50">
                                  @ ₹{instructor.rate} per check-in
                                </span>
                                <span className="font-body text-xs text-charcoal/50">
                                  {instructor.percentage}% share
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="font-display text-4xl text-sage mb-1">
                                ₹{instructor.total.toLocaleString()}
                              </div>
                              <div className="font-body text-xs text-charcoal/50">
                                Total Payout
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              {instructor.status === "pending" ? (
                                <>
                                  <Button 
                                    className="bg-sage hover:bg-sage/90 text-white font-body"
                                    onClick={() => {
                                      setSelectedPayoutData(instructor);
                            setShowPayoutDialog(true);
                                    }}
                                  >
                                    <DollarSign className="h-4 w-4 mr-1" />
                                    Process Payment
                                  </Button>
                                  <Badge variant="outline" className="border-amber-500/20 text-amber-600 bg-amber-50">
                                    Pending
                                  </Badge>
                                </>
                              ) : (
                                <Badge className="bg-sage text-white">
                                  <Check className="h-3 w-3 mr-1" />
                                  Paid
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <Pagination page={payoutsPg.page} total={payoutsPg.total} onChange={payoutsPg.setPage} />
                </div>

                {/* Bulk Actions */}
                <Card className="border-sage/20 bg-linear-to-br from-sage/5 to-white backdrop-blur-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-body font-medium text-charcoal mb-1">
                          Bulk Payment Actions
                        </div>
                        <div className="font-body text-sm text-charcoal/60">
                          Process multiple payments at once
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button variant="outline" className="border-sage/20 text-sage hover:bg-sage/5 font-body">
                          <Download className="h-4 w-4 mr-2" />
                          Export Payouts
                        </Button>
                        <Button className="bg-sage hover:bg-sage/90 text-white font-body">
                          <CreditCard className="h-4 w-4 mr-2" />
                          Pay All Pending
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* INSTRUCTOR MANAGEMENT TAB */}
              <TabsContent value="instructors" className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-3xl text-charcoal mb-2">Instructor Management</h2>
                    <p className="font-body text-charcoal/60">Add, edit, and manage instructor profiles and payment settings</p>
                  </div>
                  <Button 
                    className="bg-sage hover:bg-sage/90 text-white font-body"
                    onClick={() => setShowAddInstructorDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Instructor
                  </Button>
                </div>

                {/* Instructor Cards */}
                {loadingInstructors ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-12 w-12 border-4 border-sage/20 border-t-sage rounded-full animate-spin" />
                  </div>
                ) : instructors.length === 0 ? (
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardContent className="p-12 text-center">
                      <p className="font-body text-charcoal/60">No instructors found. Add an instructor to get started.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {instructorsPg.pageItems.map((instructor) => (
                      <Card key={instructor.id} className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-xl transition-all duration-600">
                        <CardContent className="p-6">
                          <div className="flex gap-4">
                            <div className="h-24 w-24 rounded-lg overflow-hidden bg-sage/10 shrink-0">
                              <InstructorAvatar
                                src={instructor.image_url}
                                name={instructor.name}
                                className="h-full w-full"
                              />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="font-display text-xl text-charcoal mb-1">
                                    {instructor.name}
                                  </div>
                                  {instructor.title && (
                                    <div className="font-body text-sm text-sage uppercase tracking-wide mb-1">
                                      {instructor.title}
                                    </div>
                                  )}
                                  {instructor.years_of_experience && (
                                    <div className="font-body text-xs text-charcoal/60 italic mb-2">
                                      {instructor.years_of_experience} years experience
                                    </div>
                                  )}
                                  <Badge className={instructor.is_active !== false ? "bg-sage text-white" : "bg-charcoal/20 text-charcoal/60"}>
                                    {instructor.is_active !== false ? "active" : "inactive"}
                                  </Badge>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={instructor.is_active !== false ? "border-charcoal/20 text-charcoal/60 hover:bg-charcoal/5" : "border-sage/20 text-sage hover:bg-sage/5"}
                                    onClick={() => handleToggleInstructorActive(instructor.id, instructor.is_active !== false)}
                                  >
                                    {instructor.is_active !== false ? "Set Inactive" : "Set Active"}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-sage/20 text-sage hover:bg-sage/5"
                                    onClick={() => {
                                      setSelectedInstructorData(instructor);
                                      setShowEditInstructorDialog(true);
                                    }}
                                  >
                                    <Edit className="h-3.5 w-3.5 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-red-200 text-red-600 hover:bg-red-50"
                                    onClick={() => handleDeleteInstructor(instructor.id, instructor.name)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="space-y-2 mb-3">
                                <div className="flex items-center gap-2 text-sm text-charcoal/60">
                                  <Mail className="h-3.5 w-3.5" />
                                  {instructor.email}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-charcoal/60">
                                  <Phone className="h-3.5 w-3.5" />
                                  {instructor.phone}
                                </div>
                              </div>

                              {instructor.specialties && instructor.specialties.length > 0 && (
                                <div className="mb-3">
                                  <div className="font-body text-xs text-charcoal/50 mb-1">Specialties:</div>
                                  <div className="flex flex-wrap gap-1">
                                    {instructor.specialties.map((specialty: string, idx: number) => (
                                      <Badge key={idx} variant="outline" className="border-sage/20 text-sage bg-sage/5 text-xs">
                                        {specialty}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {instructor.certifications && instructor.certifications.length > 0 && (
                                <div className="mb-3">
                                  <div className="font-body text-xs text-charcoal/50 mb-1">Certifications:</div>
                                  <ul className="list-disc list-inside space-y-0.5">
                                    {instructor.certifications.map((cert: string, idx: number) => (
                                      <li key={idx} className="font-body text-xs text-charcoal/70">
                                        {cert}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {instructor.philosophy && (
                                <div className="p-3 rounded-lg bg-cream/30 mb-3">
                                  <div className="font-body text-xs text-charcoal/80 italic">
                                    "{instructor.philosophy}"
                                  </div>
                                </div>
                              )}

                              {instructor.about && (
                                <div className="mb-3">
                                  <div className="font-body text-xs text-charcoal/50 mb-1">About:</div>
                                  <div className="font-body text-xs text-charcoal/70">
                                    {instructor.about}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                <Pagination page={instructorsPg.page} total={instructorsPg.total} onChange={instructorsPg.setPage} />
              </TabsContent>

              {/* ANALYTICS TAB */}
              <TabsContent value="analytics" className="space-y-6">
                <ControlAnalyticsPanel />
              </TabsContent>
            </Tabs>

          </div>
        </main>
      </div>

      {/* Dialogs - same as in dashboard */}
      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-xl border-sage/20">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">Add New User</DialogTitle>
            <DialogDescription className="font-body text-charcoal/60">
              Create a new member account with password and package (class count or studio days).
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label className="font-body text-charcoal">Full Name</Label>
              <Input
                value={newUserForm.full_name}
                onChange={(e) => setNewUserForm((s) => ({ ...s, full_name: e.target.value }))}
                placeholder="John Doe"
                className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-charcoal">Email</Label>
              <Input
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm((s) => ({ ...s, email: e.target.value }))}
                placeholder="john@email.com"
                className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-charcoal">Password</Label>
              <Input
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm((s) => ({ ...s, password: e.target.value }))}
                placeholder="Min. 8 characters"
                className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-charcoal">Phone Number</Label>
              <Input
                value={newUserForm.phone}
                onChange={(e) => setNewUserForm((s) => ({ ...s, phone: e.target.value }))}
                placeholder="+00 00000 00000"
                className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-charcoal">Pass Type</Label>
              <Select
                value={newUserForm.pass_type}
                onValueChange={(v) => {
                  const pt = v as "studio_pass" | "class_pass";
                  setNewUserForm((s) => ({ ...s, pass_type: pt, class_or_days_count: pt === "class_pass" ? "4" : "30" }));
                }}
              >
                <SelectTrigger className="border-sage/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="class_pass">Class Pass</SelectItem>
                  <SelectItem value="studio_pass">Studio Pass</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-body text-charcoal">
                {newUserForm.pass_type === "class_pass" ? "Classes Remaining" : "Days Remaining"}
              </Label>
              <Select
                value={newUserForm.class_or_days_count}
                onValueChange={(v) => setNewUserForm((s) => ({ ...s, class_or_days_count: v }))}
              >
                <SelectTrigger className="border-sage/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {newUserForm.pass_type === "class_pass"
                    ? [1, 4, 8, 12].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} {n === 1 ? "Class" : "Classes"}
                        </SelectItem>
                      ))
                    : [30, 90, 180, 365].map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d} Days
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-body text-charcoal">Start Date</Label>
              <Input
                type="date"
                value={newUserForm.start_date}
                onChange={(e) => setNewUserForm((s) => ({ ...s, start_date: e.target.value }))}
                className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40"
              />
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)} className="border-sage/20 font-body">
              Cancel
            </Button>
            <Button
              className="bg-sage hover:bg-sage/90 text-white font-body"
              disabled={creatingUser}
              onClick={() => void handleAdminCreateUser()}
            >
              <Save className="h-4 w-4 mr-2" />
              {creatingUser ? "Creating…" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
        <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-xl border-sage/20">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">Edit User</DialogTitle>
            <DialogDescription className="font-body text-charcoal/60">
              Update member information, package, or credits
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label className="font-body text-charcoal">Full Name</Label>
                <Input defaultValue={selectedUser.name} disabled className="border-sage/20 bg-sage/5 text-charcoal/60" />
              </div>
              <div className="space-y-2">
                <Label className="font-body text-charcoal">Email</Label>
                <Input defaultValue={selectedUser.email} disabled className="border-sage/20 bg-sage/5 text-charcoal/60" />
              </div>
              <div className="space-y-2">
                <Label className="font-body text-charcoal">Pass Type</Label>
                <Select
                  value={editPassType}
                  onValueChange={(v) => {
                    const pt = v as "class_pass" | "studio_pass";
                    setEditPassType(pt);
                    setEditClassCredits("");
                    setEditDays("");
                  }}
                >
                  <SelectTrigger className="border-sage/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class_pass">Class Pass</SelectItem>
                    <SelectItem value="studio_pass">Studio Pass</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editPassType === "class_pass" ? (
                <div className="space-y-2">
                  <Label className="font-body text-charcoal">Classes Remaining</Label>
                  <Select value={editClassCredits} onValueChange={setEditClassCredits}>
                    <SelectTrigger className="border-sage/20">
                      <SelectValue placeholder="Select classes" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 4, 8, 12].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} {n === 1 ? "Class" : "Classes"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="font-body text-charcoal">Days Remaining (from today)</Label>
                  <Select value={editDays} onValueChange={setEditDays}>
                    <SelectTrigger className="border-sage/20">
                      <SelectValue placeholder="Select days" />
                    </SelectTrigger>
                    <SelectContent>
                      {[30, 90, 180, 365].map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d} Days
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="font-body text-charcoal">Start Date</Label>
                <Input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="border-sage/20 focus:ring-sage"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-body text-charcoal">End Date</Label>
                <Input
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="border-sage/20 focus:ring-sage"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditUserDialog(false)} className="border-sage/20 font-body">
              Cancel
            </Button>
            <Button className="bg-sage hover:bg-sage/90 text-white font-body" onClick={() => void handleEditUserSave()}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Class Dialog */}
      <Dialog open={showAddClassDialog} onOpenChange={setShowAddClassDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-xl border-sage/20">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">Create New Class</DialogTitle>
            <DialogDescription className="font-body text-charcoal/60">
              Define a new class type (scheduling happens in Schedule tab)
            </DialogDescription>
          </DialogHeader>
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
                    <img src={classImagePreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg border border-sage/20" />
                  </div>
                )}
                {uploadingImage && (
                  <p className="text-sm text-sage">Uploading image...</p>
                )}
              </div>
            </div>
            <DialogFooter className="sticky bottom-0 bg-white/95 backdrop-blur-xl pt-4 border-t border-sage/10">
              <Button type="button" variant="outline" onClick={() => setShowAddClassDialog(false)} className="border-sage/20 font-body">
                Cancel
              </Button>
              <Button type="submit" className="bg-sage hover:bg-sage/90 text-white font-body">
                <Save className="h-4 w-4 mr-2" />
                Create Class
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Class Details Dialog */}
      <Dialog open={showClassDetailsDialog} onOpenChange={setShowClassDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-xl border-sage/20">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">
              {selectedClass?.name}
            </DialogTitle>
            <DialogDescription className="font-body text-charcoal/60">
              Edit class details and settings
            </DialogDescription>
          </DialogHeader>
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
                      <img 
                        src={classImagePreview || selectedClass.image_url} 
                        alt="Current" 
                        className="w-32 h-32 object-cover rounded-lg border border-sage/20" 
                      />
                    </div>
                    {uploadingImage && (
                      <p className="text-sm text-sage">Uploading image...</p>
                    )}
                    <p className="text-xs text-charcoal/50">Leave empty to keep current image</p>
                  </div>
                </div>
              </div>
              <DialogFooter className="sticky bottom-0 bg-white/95 backdrop-blur-xl pt-4 border-t border-sage/10 flex-col sm:flex-row gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => handleDeleteClass(selectedClass.id, selectedClass.name)}
                  className="border-red-200 text-red-600 hover:bg-red-50 font-body sm:mr-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Class
                </Button>
                <div className="flex gap-2 sm:ml-auto">
                  <Button type="button" variant="outline" onClick={() => setShowClassDetailsDialog(false)} className="border-sage/20 font-body">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-sage hover:bg-sage/90 text-white font-body">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Payout Dialog */}
      <Dialog open={showPayoutDialog} onOpenChange={setShowPayoutDialog}>
        <DialogContent className="max-w-lg bg-white/95 backdrop-blur-xl border-sage/20">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">Process Payment</DialogTitle>
            <DialogDescription className="font-body text-charcoal/60">
              Confirm instructor payout details
            </DialogDescription>
          </DialogHeader>
          {selectedPayoutData && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-sage/5 border border-sage/20">
                <div className="font-body font-medium text-charcoal mb-2">
                  {selectedPayoutData.name}
                </div>
                <div className="font-body text-sm text-charcoal/60 mb-4">
                  {selectedPayoutData.specialties}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="font-body text-xs text-charcoal/50 mb-1">Check-ins</div>
                    <div className="font-display text-2xl text-charcoal">
                      {selectedPayoutData.checkIns}
                    </div>
                  </div>
                  <div>
                    <div className="font-body text-xs text-charcoal/50 mb-1">Rate per Check-in</div>
                    <div className="font-display text-2xl text-charcoal">
                      ₹{selectedPayoutData.rate}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-sage/20">
                  <div className="flex items-center justify-between">
                    <div className="font-body font-medium text-charcoal">
                      Total Payout:
                    </div>
                    <div className="font-display text-4xl text-sage">
                      ₹{selectedPayoutData.total.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-method" className="font-body text-charcoal">Payment Method</Label>
                <Select defaultValue="transfer">
                  <SelectTrigger className="border-sage/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Bank Transfer</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-notes" className="font-body text-charcoal">Notes (Optional)</Label>
                <Textarea 
                  id="payment-notes" 
                  placeholder="Add any payment notes..."
                  className="border-sage/20 focus:ring-sage"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayoutDialog(false)} className="border-sage/20 font-body">
              Cancel
            </Button>
            <Button className="bg-sage hover:bg-sage/90 text-white font-body">
              <DollarSign className="h-4 w-4 mr-2" />
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Instructor Dialog */}
      <Dialog open={showAddInstructorDialog} onOpenChange={setShowAddInstructorDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">Add New Instructor</DialogTitle>
            <DialogDescription className="font-body text-charcoal/60">
              Create complete instructor profile with all details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateInstructor}>
            <div className="grid grid-cols-2 gap-4 py-4">
              {/* Basic Information */}
              <div className="col-span-2">
                <h3 className="font-display text-lg text-charcoal mb-3">Basic Information</h3>
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
                    <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg border border-sage/20" />
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
                <h3 className="font-display text-lg text-charcoal mb-3">Expertise & Credentials</h3>
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
                <h3 className="font-display text-lg text-charcoal mb-3">Biography</h3>
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
                <h3 className="font-display text-lg text-charcoal mb-3">Social Media (Optional)</h3>
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
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowAddInstructorDialog(false)} className="border-sage/20 font-body">
                Cancel
              </Button>
              <Button type="submit" className="bg-sage hover:bg-sage/90 text-white font-body">
                <Save className="h-4 w-4 mr-2" />
                Create Instructor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Instructor Dialog */}
      <Dialog open={showEditInstructorDialog} onOpenChange={setShowEditInstructorDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">Edit Instructor</DialogTitle>
            <DialogDescription className="font-body text-charcoal/60">
              Update instructor profile and details
            </DialogDescription>
          </DialogHeader>
          {selectedInstructorData && (
            <form onSubmit={handleUpdateInstructor}>
              <div className="grid grid-cols-2 gap-4 py-4">
                {/* Basic Information */}
                <div className="col-span-2">
                  <h3 className="font-display text-lg text-charcoal mb-3">Basic Information</h3>
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
                    <img 
                      src={imagePreview || selectedInstructorData.image_url} 
                      alt="Current" 
                      className="w-32 h-32 object-cover rounded-lg border border-sage/20" 
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
                  <h3 className="font-display text-lg text-charcoal mb-3">Expertise & Credentials</h3>
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
                  <h3 className="font-display text-lg text-charcoal mb-3">Biography</h3>
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
                  <h3 className="font-display text-lg text-charcoal mb-3">Social Media (Optional)</h3>
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
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setShowEditInstructorDialog(false)} className="border-sage/20 font-body">
                  Cancel
                </Button>
                <Button type="submit" className="bg-sage hover:bg-sage/90 text-white font-body">
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
