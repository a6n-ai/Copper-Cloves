import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PortalNavigation } from "@/components/PortalNavigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { User, Save, CheckCircle2, Mail, Phone, ArrowLeft, Camera, Lock } from "lucide-react";

const profileSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Profile() {
  const router = useRouter();
  const { status } = useSession();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
  });

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      const profile = await res.json();
      reset({
        fullName: profile.full_name || "",
        email: profile.email || "",
        phone: profile.phone || "",
      });
      setAvatarUrl(typeof profile.avatar_url === "string" && profile.avatar_url ? profile.avatar_url : null);
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/portal/login");
      return;
    }
    if (status === "authenticated") {
      loadProfile();
    }
  }, [loadProfile, router, status]);

  useEffect(() => {
    if (loading || router.asPath !== "/portal/profile#reset-password") return;
    const el = document.getElementById("reset-password");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading, router.asPath]);

  async function onSubmit(data: ProfileFormValues) {
    setSaving(true);
    setShowSuccess(false);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: data.fullName, phone: data.phone }),
      });
      if (!res.ok) throw new Error("Update failed");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
      toast({ title: "Profile updated", description: "Your changes have been saved successfully." });
    } catch {
      toast({ title: "Update failed", description: "There was an error updating your profile.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const contentType = file.type;
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      toast({
        title: "Invalid file",
        description: "Please choose a JPEG, PNG, or WebP image.",
        variant: "destructive",
      });
      return;
    }
    setAvatarUploading(true);
    try {
      const presignRes = await fetch("/api/user/avatar-presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType }),
      });
      const presignJson = await presignRes.json().catch(() => ({}));
      if (presignRes.status === 503) {
        toast({
          title: "Upload not available",
          description:
            typeof presignJson.error === "string"
              ? presignJson.error
              : "S3 is not configured for this environment.",
          variant: "destructive",
        });
        return;
      }
      if (!presignRes.ok) {
        toast({
          title: "Could not start upload",
          description: typeof presignJson.error === "string" ? presignJson.error : "Try again later.",
          variant: "destructive",
        });
        return;
      }
      const { uploadUrl, publicUrl } = presignJson as { uploadUrl?: string; publicUrl?: string };
      if (!uploadUrl || !publicUrl) {
        toast({ title: "Upload error", description: "Invalid response from server.", variant: "destructive" });
        return;
      }
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
      });
      if (!putRes.ok) {
        toast({ title: "Upload failed", description: "Could not upload file to storage.", variant: "destructive" });
        return;
      }
      const patchRes = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: publicUrl }),
      });
      if (!patchRes.ok) {
        toast({ title: "Could not save photo", description: "Upload succeeded but profile was not updated.", variant: "destructive" });
        return;
      }
      setAvatarUrl(publicUrl);
      toast({ title: "Photo updated", description: "Your profile picture has been saved." });
    } catch {
      toast({ title: "Upload failed", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) {
      toast({ title: "Current password required", description: "Enter your current password.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (currentPassword === newPassword) {
      toast({
        title: "Choose a different password",
        description: "Your new password must be different from your current password.",
        variant: "destructive",
      });
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Could not change password",
          description: typeof data.error === "string" ? data.error : "Try again.",
          variant: "destructive",
        });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      toast({ title: "Password updated", description: "You can sign in with your new password next time." });
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-sage/30 border-t-sage rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sage font-display text-xl">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <PortalNavigation />

      <main className="pt-24 px-4 sm:px-6 lg:px-8 pb-12 min-h-screen">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl md:text-5xl text-charcoal mb-3">Your Profile</h1>
              <p className="font-body text-sage text-base md:text-lg">Manage your personal information and preferences</p>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push("/portal/dashboard")}
              className="border-sage text-sage hover:bg-sage hover:text-white transition-all duration-600 w-full sm:w-auto font-body hover:scale-105 active:scale-95"
            >
              <ArrowLeft className="mr-2" size={18} />
              Back to Dashboard
            </Button>
          </div>

          {showSuccess && (
            <Alert className="mb-6 border-sage/30 bg-sage/5 animate-in slide-in-from-top duration-600">
              <CheckCircle2 className="h-5 w-5 text-sage" />
              <AlertDescription className="text-charcoal ml-2 font-body">
                Your profile has been updated successfully!
              </AlertDescription>
            </Alert>
          )}

          <Card className="border-sage/20 bg-white/90 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-600">
            <CardHeader className="p-6 md:p-8 border-b border-sage/10 bg-gradient-to-r from-cream/50 to-white">
              <CardTitle className="font-display text-2xl md:text-3xl text-charcoal flex items-center">
                <div className="w-12 h-12 rounded-full bg-sage/10 flex items-center justify-center mr-3">
                  <User className="text-sage" size={24} />
                </div>
                Personal Details
              </CardTitle>
              <CardDescription className="font-body text-charcoal/70 text-base ml-15">
                Keep your information up to date for the best experience
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 md:p-8">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <div className="flex flex-col sm:flex-row gap-6 items-center pb-6 border-b border-sage/10">
                  <div className="relative w-28 h-28 rounded-full overflow-hidden bg-sage/10 border border-sage/20 flex-shrink-0">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sage">
                        <User size={40} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    <Label className="text-charcoal font-body flex items-center gap-2">
                      <Camera size={16} className="text-sage" />
                      Profile photo
                    </Label>
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/jpg,image/webp"
                      disabled={avatarUploading}
                      onChange={(ev) => void onAvatarSelected(ev)}
                      className="border-sage/20 font-body cursor-pointer"
                    />
                    <p className="text-xs text-charcoal/50 font-body">
                      Uses your studio S3 bucket when configured (AWS env vars). JPEG, PNG, or WebP.
                    </p>
                    {avatarUploading && (
                      <p className="text-sm text-sage font-body">Uploading…</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="fullName" className="text-charcoal font-body text-base flex items-center gap-2">
                    <User size={16} className="text-sage" />
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    className="border-sage/20 focus:border-sage focus:ring-sage transition-all duration-600 bg-white h-12 font-body text-base"
                    {...register("fullName")}
                  />
                  {errors.fullName && (
                    <p className="text-sm text-terracotta font-body animate-in slide-in-from-left duration-300 flex items-center gap-2">
                      {errors.fullName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="email" className="text-charcoal font-body text-base flex items-center gap-2">
                    <Mail size={16} className="text-sage" />
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    {...register("email")}
                    disabled
                    className="bg-cream/50 border-sage/20 text-charcoal/70 cursor-not-allowed h-12 font-body text-base"
                  />
                  <p className="text-xs text-charcoal/50 font-body flex items-center gap-1">
                    <span className="text-sage">•</span>
                    Email address cannot be changed directly
                  </p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="phone" className="text-charcoal font-body text-base flex items-center gap-2">
                    <Phone size={16} className="text-sage" />
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    className="border-sage/20 focus:border-sage focus:ring-sage transition-all duration-600 bg-white h-12 font-body text-base"
                    placeholder="+91 98765 43210"
                    {...register("phone")}
                  />
                  {errors.phone && (
                    <p className="text-sm text-terracotta font-body animate-in slide-in-from-left duration-300">
                      {errors.phone.message}
                    </p>
                  )}
                </div>

                <div className="pt-6 border-t border-sage/10">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-sage hover:bg-sage/90 text-white w-full font-body h-14 text-base transition-all duration-600 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        Saving Changes...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2" size={20} />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card
            id="reset-password"
            className="border-sage/20 bg-white/90 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-600 mt-6 scroll-mt-28"
          >
            <CardHeader className="p-6 md:p-8 border-b border-sage/10">
              <CardTitle className="font-display text-xl md:text-2xl text-charcoal flex items-center gap-2">
                <Lock className="text-sage" size={22} />
                Reset password
              </CardTitle>
              <CardDescription className="font-body text-charcoal/70">
                Enter your current password, then choose a new one (at least 8 characters).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 md:p-8">
              <form onSubmit={onChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="font-body text-charcoal">Current password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="border-sage/20 h-12"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="font-body text-charcoal">New password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="border-sage/20 h-12"
                    required
                    minLength={8}
                  />
                </div>
                <Button type="submit" disabled={passwordSaving} className="bg-sage hover:bg-sage/90 text-white w-full h-12 font-body">
                  {passwordSaving ? "Updating…" : "Reset password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
