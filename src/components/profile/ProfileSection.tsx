import { useEffect, useRef, useState } from "react";
import { mutate } from "swr";
import { useStudioSWR } from "@/lib/swr";
import Image from "next/image";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User, Save, CheckCircle2, Mail, Phone, Camera, Lock,
  MessageCircle, Calendar as CalendarIcon, Heart, ChevronDown,
} from "lucide-react";

export type ProfileRole = "user" | "admin" | "partner" | "instructor";

const FITNESS_GOALS = [
  "Weight Loss", "Build Strength", "Improve Flexibility",
  "Cardiovascular Fitness", "Stress Relief", "Athletic Performance",
  "Body Toning", "General Wellness",
];
const HEALTH_ISSUES_GENERAL = [
  "None", "Chronic Pain", "Hypertension", "Diabetes",
  "Asthma / Breathing Issues", "Heart Condition", "Joint Problems",
];
const HEALTH_ISSUES_FEMALE_SHORT = [
  "None", "Currently Pregnant (Prenatal)", "Postnatal (within 6 months of delivery)",
  "Recovering from Pregnancy (6+ months)", "Chronic Pain", "Hypertension",
  "Diabetes", "Asthma / Breathing Issues", "Hormonal Conditions (PCOS, thyroid, etc.)",
];
const HEALTH_ISSUES_FEMALE_LONG = [
  "None", "Osteoporosis / Bone Density", "Cardiovascular Disease",
  "Autoimmune Condition", "Hormonal Imbalance", "Mental Health Condition",
  "Chronic Fatigue", "Other",
];

function CheckboxGroup({ options, selected, onChange }: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map((opt) => {
        const checked = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(checked ? selected.filter((x) => x !== opt) : [...selected, opt])}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm font-body transition-all ${
              checked ? "border-sage bg-sage/10 text-charcoal" : "border-sage/20 bg-white-warm text-charcoal/70 hover:border-sage/40"
            }`}
          >
            <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
              checked ? "bg-sage border-sage" : "border-charcoal/30"
            }`}>
              {checked && <CheckCircle2 size={10} className="text-cream" />}
            </div>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function ProfileSkeleton({ memberExtras }: { memberExtras: boolean }) {
  return (
    <div className="space-y-6">
      <Card className="border-sage/20 bg-[#fafaf8]/90 shadow-lg">
        <CardHeader className="p-6 border-b border-sage/10 bg-linear-to-r from-cream/50 to-[#fafaf8]">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="h-7 w-44" />
          </div>
          <Skeleton className="h-4 w-56 mt-2" />
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-5">
            <div className="flex gap-5 items-center pb-5 border-b border-sage/10">
              <Skeleton className="w-24 h-24 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-32 rounded-md" />
              </div>
            </div>
            {Array.from({ length: memberExtras ? 5 : 3 }).map((_, i) => (
              <div className="space-y-1.5" key={i}>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-11 w-full rounded-md" />
              </div>
            ))}
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ProfileSectionProps {
  role: ProfileRole;
  /** Override the heading. Defaults to "Your Profile". */
  title?: string;
  subtitle?: string;
}

interface ProfileData {
  full_name?: string;
  email?: string;
  phone?: string;
  whatsapp_phone?: string;
  gender?: string;
  dob?: string | null;
  avatar_url?: string | null;
  questionnaire?: Record<string, unknown> | null;
}

/**
 * Unified profile editor shared across all four portals.
 * - All roles get: avatar + name + email + phone + whatsapp + change password.
 * - Member role additionally gets: DOB, gender, health questionnaire.
 *   (Pause-subscription requests live on their own /portal/pause page.)
 */
export function ProfileSection({ role, title, subtitle }: ProfileSectionProps) {
  const isMember = role === "user";
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [savingPersonal, setSavingPersonal] = useState(false);

  const [fitnessGoals, setFitnessGoals] = useState<string[]>([]);
  const [healthShort, setHealthShort] = useState<string[]>([]);
  const [healthLong, setHealthLong] = useState<string[]>([]);
  const [injuries, setInjuries] = useState("");
  const [savingHealth, setSavingHealth] = useState(false);
  const [showLongHealth, setShowLongHealth] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const isFemale = gender === "female";

  // Shares the in-flight request + cache with the `/api/user/profile` key
  // `_app.tsx` already holds (and that this component mutates on avatar upload),
  // so visiting the profile page no longer fires a duplicate concurrent GET.
  const { data: profileData, error: profileError, isLoading: profileLoading } =
    useStudioSWR<ProfileData>("/api/user/profile");
  const loading = profileLoading && !profileData;

  useEffect(() => {
    if (profileError) toast({ title: "Could not load profile", variant: "destructive" });
  }, [profileError, toast]);

  // Seed the editable form fields once from the first SWR payload. Guarding on
  // a ref keeps focus-revalidation (or the post-avatar mutate) from clobbering
  // edits the member hasn't saved yet.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!profileData || seededRef.current) return;
    seededRef.current = true;
    const p = profileData;
    setFullName(p.full_name || "");
    setEmail(p.email || "");
    setPhone(p.phone || "");
    setWhatsappPhone(p.whatsapp_phone || "");
    setGender(p.gender || "");
    setDob(p.dob ? new Date(p.dob).toISOString().substring(0, 10) : "");
    setAvatarUrl(p.avatar_url || null);
    if (p.questionnaire && typeof p.questionnaire === "object") {
      const q = p.questionnaire as Record<string, unknown>;
      setFitnessGoals(Array.isArray(q.fitnessGoals) ? q.fitnessGoals as string[] : []);
      setHealthShort(Array.isArray(q.healthIssuesShort) ? q.healthIssuesShort as string[] : []);
      setHealthLong(Array.isArray(q.healthIssuesLong) ? q.healthIssuesLong as string[] : []);
      setInjuries(typeof q.injuries === "string" ? q.injuries : "");
    }
  }, [profileData]);

  useEffect(() => {
    if (loading || typeof window === "undefined") return;
    if (window.location.hash !== "#reset-password") return;
    document.getElementById("reset-password")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading]);

  async function savePersonal(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      toast({ title: "Name too short", description: "Enter at least 2 characters.", variant: "destructive" });
      return;
    }
    setSavingPersonal(true);
    try {
      const body: Record<string, unknown> = {
        full_name: fullName,
        phone,
        whatsapp_phone: whatsappPhone,
      };
      if (isMember) {
        body.dob = dob || null;
        body.gender = gender || null;
      }
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Personal details saved" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSavingPersonal(false);
    }
  }

  async function saveHealth(e: React.FormEvent) {
    e.preventDefault();
    if (fitnessGoals.length === 0) {
      toast({ title: "Select at least one fitness goal", variant: "destructive" });
      return;
    }
    if (healthShort.length === 0) {
      toast({ title: "Select at least one health option", variant: "destructive" });
      return;
    }
    setSavingHealth(true);
    try {
      const questionnaire: Record<string, unknown> = { fitnessGoals, healthIssuesShort: healthShort };
      if (healthLong.length > 0) questionnaire.healthIssuesLong = healthLong;
      if (injuries.trim()) questionnaire.injuries = injuries.trim();
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionnaire }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Health & fitness profile saved" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSavingHealth(false);
    }
  }

  async function onAvatarSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "Invalid file", description: "JPEG, PNG, or WebP only.", variant: "destructive" });
      return;
    }
    setAvatarUploading(true);
    try {
      const presignRes = await fetch("/api/user/avatar-presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      const presignJson = await presignRes.json().catch(() => ({}));
      if (!presignRes.ok) {
        toast({ title: "Upload not available", description: presignJson.error ?? "Try again later.", variant: "destructive" });
        return;
      }
      const { uploadUrl, publicUrl, key } = presignJson as { uploadUrl?: string; publicUrl?: string; key?: string };
      if (!uploadUrl || !publicUrl || !key) { toast({ title: "Upload error", variant: "destructive" }); return; }
      const putRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) {
        toast({ title: "Upload failed", description: "S3 upload rejected — try again.", variant: "destructive" });
        return;
      }
      const confirmRes = await fetch("/api/user/avatar-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, contentType: file.type, sizeBytes: file.size }),
      });
      const confirmJson = await confirmRes.json().catch(() => ({}));
      const finalUrl = confirmRes.ok && typeof confirmJson.url === "string" ? confirmJson.url : publicUrl;
      setAvatarUrl(finalUrl);
      // Bust the SWR cache so the topbar/sidebar avatar (DashboardChrome)
      // picks up the new photo without a hard reload.
      void mutate("/api/user/profile");
      toast({ title: "Photo updated" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) { toast({ title: "Current password required", variant: "destructive" }); return; }
    if (newPassword.length < 8) { toast({ title: "Password must be at least 8 characters", variant: "destructive" }); return; }
    if (currentPassword === newPassword) { toast({ title: "New password must differ from current", variant: "destructive" }); return; }
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast({ title: "Could not change password", description: data.error ?? "Try again.", variant: "destructive" }); return; }
      setCurrentPassword(""); setNewPassword("");
      toast({ title: "Password updated" });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream">
        <main className="pt-8 pb-16 min-h-screen">
          <div className="max-w-6xl mx-auto mb-6 px-4 sm:px-6 lg:px-8">
            <PageHeader title={title ?? "Your Profile"} subtitle={subtitle ?? "Manage your information and preferences"} />
          </div>
          <div className="max-w-2xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8">
            <ProfileSkeleton memberExtras={isMember} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <main className="pt-8 pb-16 min-h-screen">
        <div className="max-w-6xl mx-auto mb-6 px-4 sm:px-6 lg:px-8">
          <PageHeader title={title ?? "Your Profile"} subtitle={subtitle ?? "Manage your information and preferences"} />
        </div>
        <div className="max-w-2xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8">

          {/* ── Personal Details ──────────────────────────────────── */}
          <Card className="border-sage/20 bg-[#fafaf8]/90 shadow-lg">
            <CardHeader className="p-6 border-b border-sage/10 bg-linear-to-r from-cream/50 to-[#fafaf8]">
              <CardTitle className="font-display text-2xl text-charcoal flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sage/10 flex items-center justify-center">
                  <User className="text-sage" size={20} />
                </div>
                Personal Details
              </CardTitle>
              <CardDescription className="font-body text-charcoal/60 mt-1">
                Keep your contact info up to date
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={savePersonal} className="space-y-5" noValidate>

                <div className="flex gap-5 items-center pb-5 border-b border-sage/10">
                  <div className="relative w-24 h-24 rounded-full overflow-hidden bg-sage/10 border border-sage/20 shrink-0">
                    {avatarUrl
                      ? <Image src={avatarUrl} alt="" width={96} height={96} className="w-full h-full object-cover" unoptimized />
                      : <div className="w-full h-full flex items-center justify-center text-sage"><User size={36} /></div>
                    }
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-charcoal font-body flex items-center gap-2 text-sm">
                      <Camera size={14} className="text-sage" /> Profile Photo
                    </Label>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                      disabled={avatarUploading} onChange={(ev) => void onAvatarSelected(ev)} className="hidden" />
                    <Button type="button" variant="outline" size="sm"
                      disabled={avatarUploading} onClick={() => fileInputRef.current?.click()}
                      className="border-sage/30 text-sage hover:bg-sage hover:text-cream font-body text-xs h-8">
                      {avatarUploading ? "Uploading…" : "Change photo"}
                    </Button>
                    <p className="text-xs text-charcoal/40 font-body">JPEG, PNG or WebP</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal flex items-center gap-2">
                    <User size={14} className="text-sage" /> Full Name
                  </Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)}
                    className="border-sage/20 focus:border-sage h-11 font-body" required />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal flex items-center gap-2">
                    <Mail size={14} className="text-sage" /> Email Address
                  </Label>
                  <Input value={email} disabled className="bg-cream/50 border-sage/20 text-charcoal/60 cursor-not-allowed h-11 font-body" />
                  <p className="text-xs text-charcoal/40 font-body">Email cannot be changed</p>
                </div>

                {isMember && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="font-body text-sm text-charcoal flex items-center gap-2">
                        <CalendarIcon size={14} className="text-sage" /> Date of Birth
                      </Label>
                      <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)}
                        className="border-sage/20 focus:border-sage h-11 font-body" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-body text-sm text-charcoal">Gender</Label>
                      <div className="relative">
                        <select value={gender} onChange={(e) => setGender(e.target.value)}
                          className="w-full h-11 pl-3 pr-8 rounded-md border border-sage/20 bg-white-warm font-body text-sm text-charcoal focus:outline-hidden focus:ring-1 focus:ring-sage appearance-none">
                          <option value="">Select</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other / Prefer not to say</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/40 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal flex items-center gap-2">
                    <Phone size={14} className="text-sage" /> Phone Number
                  </Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="border-sage/20 focus:border-sage h-11 font-body" />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal flex items-center gap-2">
                    <MessageCircle size={14} className="text-sage" /> WhatsApp Number
                    <span className="text-xs text-charcoal/40 font-normal">(if different)</span>
                  </Label>
                  <Input value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="border-sage/20 focus:border-sage h-11 font-body" />
                  <p className="text-xs text-charcoal/40 font-body">Used for class reminders and booking notifications</p>
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={savingPersonal}
                    variant="sage" className="w-full h-12">
                    {savingPersonal ? <><Spinner className="mr-2 size-4" />Saving…</> : <><Save size={16} className="mr-2" />Save Personal Details</>}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* ── Health & Fitness (member only) ────────────────────── */}
          {isMember && (
            <Card className="border-sage/20 bg-[#fafaf8]/90 shadow-lg">
              <CardHeader className="p-6 border-b border-sage/10 bg-linear-to-r from-cream/50 to-[#fafaf8]">
                <CardTitle className="font-display text-2xl text-charcoal flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sage/10 flex items-center justify-center">
                    <Heart className="text-sage" size={20} />
                  </div>
                  Health & Fitness
                </CardTitle>
                <CardDescription className="font-body text-charcoal/60 mt-1">
                  Helps instructors personalise your experience
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={saveHealth} className="space-y-6" noValidate>
                  <div className="space-y-3">
                    <Label className="font-body text-sm font-medium text-charcoal">Fitness Goals <span className="text-terracotta">*</span></Label>
                    <CheckboxGroup options={FITNESS_GOALS} selected={fitnessGoals} onChange={setFitnessGoals} />
                    {fitnessGoals.length === 0 && <p className="text-xs text-charcoal/40 font-body">Select at least one goal</p>}
                  </div>
                  <div className="space-y-3">
                    <Label className="font-body text-sm font-medium text-charcoal">
                      Current Health Conditions <span className="text-terracotta">*</span>
                    </Label>
                    <CheckboxGroup
                      options={isFemale ? HEALTH_ISSUES_FEMALE_SHORT : HEALTH_ISSUES_GENERAL}
                      selected={healthShort} onChange={setHealthShort}
                    />
                  </div>
                  {isFemale && (
                    <div className="space-y-3">
                      <Button type="button" variant="sage-outline" size="sm" onClick={() => setShowLongHealth(!showLongHealth)}
                        className="h-auto p-0">
                        <ChevronDown size={14} className={`transition-transform ${showLongHealth ? "rotate-180" : ""}`} />
                        {showLongHealth ? "Hide" : "Show"} additional health conditions
                      </Button>
                      {showLongHealth && (
                        <CheckboxGroup options={HEALTH_ISSUES_FEMALE_LONG} selected={healthLong} onChange={setHealthLong} />
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="font-body text-sm text-charcoal">Injuries or limitations</Label>
                    <Textarea value={injuries} onChange={(e) => setInjuries(e.target.value)}
                      placeholder="Any injuries, recent surgeries, or physical limitations our instructors should know about…"
                      className="border-sage/20 focus:border-sage font-body text-sm resize-none" rows={3} />
                  </div>
                  <Button type="submit" disabled={savingHealth}
                    variant="sage" className="w-full h-12">
                    {savingHealth ? <><Spinner className="mr-2 size-4" />Saving…</> : <><Save size={16} className="mr-2" />Save Health Profile</>}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ── Change Password (everyone) ────────────────────────── */}
          <Card id="reset-password" className="border-sage/20 bg-[#fafaf8]/90 shadow-lg scroll-mt-28">
            <CardHeader className="p-6 border-b border-sage/10">
              <CardTitle className="font-display text-xl text-charcoal flex items-center gap-3">
                <Lock className="text-sage" size={20} /> Reset Password
              </CardTitle>
              <CardDescription className="font-body text-charcoal/60 mt-1">
                Minimum 8 characters, different from current
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={onChangePassword} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal">Current password</Label>
                  <Input type="password" autoComplete="current-password" value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)} className="border-sage/20 h-11" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal">New password</Label>
                  <Input type="password" autoComplete="new-password" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)} className="border-sage/20 h-11" required minLength={8} />
                </div>
                <Button type="submit" disabled={passwordSaving}
                  variant="sage" className="w-full h-12">
                  {passwordSaving ? "Updating…" : "Reset Password"}
                </Button>
              </form>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}
