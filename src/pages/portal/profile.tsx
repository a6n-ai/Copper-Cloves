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
import { User, Save, CheckCircle2, Mail, Phone, ArrowLeft } from "lucide-react";

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
          {/* Page Header */}
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
          
          {/* Success Alert */}
          {showSuccess && (
            <Alert className="mb-6 border-sage/30 bg-sage/5 animate-in slide-in-from-top duration-600">
              <CheckCircle2 className="h-5 w-5 text-sage" />
              <AlertDescription className="text-charcoal ml-2 font-body">
                Your profile has been updated successfully!
              </AlertDescription>
            </Alert>
          )}

          {/* Profile Card */}
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
                {/* Full Name */}
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
                
                {/* Email Address */}
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

                {/* Phone Number */}
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
                
                {/* Submit Button */}
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

          {/* Account Settings Card */}
          <Card className="border-sage/20 bg-white/90 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-600 mt-6">
            <CardHeader className="p-6 md:p-8 border-b border-sage/10">
              <CardTitle className="font-display text-xl md:text-2xl text-charcoal">
                Account Settings
              </CardTitle>
              <CardDescription className="font-body text-charcoal/70">
                Manage your account preferences and privacy
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 md:p-8">
              <div className="space-y-4">
                <Button 
                  variant="outline"
                  className="w-full justify-start border-sage/20 hover:border-sage hover:bg-sage/5 transition-all duration-600 font-body h-12"
                >
                  Change Password
                </Button>
                <Button 
                  variant="outline"
                  className="w-full justify-start border-sage/20 hover:border-sage hover:bg-sage/5 transition-all duration-600 font-body h-12"
                >
                  Notification Preferences
                </Button>
                <Button 
                  variant="outline"
                  className="w-full justify-start border-terracotta/30 text-terracotta hover:border-terracotta hover:bg-terracotta/5 transition-all duration-600 font-body h-12"
                >
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}