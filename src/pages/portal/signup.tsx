import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { isValidPhoneNumber } from "react-phone-number-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/email-input";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput, type PhoneValue } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-alert";
import { Loader2, CheckCircle2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import { signUp } from "@/services/authService";

const signupSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
    phone: z
      .string()
      .optional()
      .refine((v) => !v || isValidPhoneNumber(v), "Please enter a valid phone number"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    acceptTerms: z.boolean().refine((v) => v, "You must accept the Terms of Service"),
    acceptPrivacy: z.boolean().refine((v) => v, "You must accept the Privacy Policy"),
    acceptWaiver: z.boolean().refine((v) => v, "You must accept the Liability Waiver"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: "onTouched",
    defaultValues: {
      acceptTerms: false,
      acceptPrivacy: false,
      acceptWaiver: false,
    },
  });

  const passwordValue = useWatch({ control, name: "password" });

  async function onSubmit(data: SignupFormValues) {
    setApiError(null);
    try {
      const result = await signUp(
        data.email.trim(),
        data.password,
        data.fullName.trim(),
        data.phone?.trim()
      );

      if (result.error) {
        setApiError(result.error.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/portal/login?signup=success");
      }, 2000);
    } catch (err: unknown) {
      setApiError(
        err instanceof Error ? err.message : "Failed to create account. Please try again."
      );
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-sage/10 flex items-center justify-center p-4">
        <SEO
          title="Account Created - The Studio"
          description="Your account has been created successfully"
        />
        <Card className="w-full max-w-md border-sage/20 bg-white/95 backdrop-blur-xl shadow-xl">
          <CardContent className="pt-12 pb-8 text-center">
            <div className="mb-6 flex justify-center">
              <div className="h-16 w-16 rounded-full bg-sage/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-sage" />
              </div>
            </div>
            <h2 className="font-display text-2xl text-charcoal mb-3">
              Account Created Successfully!
            </h2>
            <p className="font-body text-charcoal/60 mb-6">
              {"You'll be redirected to sign in shortly."}
            </p>
            <div className="h-2 bg-sage/10 rounded-full overflow-hidden">
              <div className="h-full bg-sage rounded-full animate-[progress_2s_ease-in-out]" />
            </div>
          </CardContent>
        </Card>
        <style jsx>{`
          @keyframes progress {
            from { width: 0%; }
            to { width: 100%; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Sign Up - The Studio by Copper + Cloves"
        description="Create your account and start your wellness journey"
      />

      <nav className="bg-white/40 backdrop-blur-xl shadow-sm sticky top-0 z-50 border-b border-sage/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link href="/" className="flex flex-col leading-none group">
              <span className="font-display text-2xl text-charcoal italic tracking-tight">
                the<span className="font-normal not-italic uppercase tracking-wider">STUDIO</span>
              </span>
              <span className="font-body text-[10px] text-charcoal/60 tracking-widest uppercase mt-0.5">
                by COPPER+CLOVES
              </span>
            </Link>
            <Link href="/" className="font-body text-sm text-charcoal/60 hover:text-sage transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>
      </nav>

      <div className="min-h-[calc(100vh-5rem)] bg-gradient-to-br from-cream via-cream to-sage/10 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <Card className="border-sage/20 bg-white/95 backdrop-blur-xl shadow-2xl">
            <CardHeader className="space-y-6 pb-8">
              <div className="flex justify-center">
                <Image
                  src="/logo2.png"
                  alt="The Studio Logo"
                  width={220}
                  height={80}
                  className="h-20 w-auto"
                  style={{ filter: "brightness(0)" }}
                />
              </div>
              <div className="text-center">
                <CardTitle className="font-display text-3xl text-charcoal mb-2">
                  Join Our Community
                </CardTitle>
                <CardDescription className="font-body text-charcoal/60">
                  Create your account and start your wellness journey
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              <FormAlert message={apiError} variant="error" className="mb-6" />

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                {/* Full Name */}
                <div className="space-y-1">
                  <Label htmlFor="fullName" className="font-body text-charcoal">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    {...register("fullName")}
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    placeholder="Jane Doe"
                    className="border-sage/20 focus:ring-sage font-body placeholder:text-charcoal/40"
                  />
                  {errors.fullName && (
                    <p className="text-xs text-red-600 font-body mt-1">{errors.fullName.message}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <Label htmlFor="email" className="font-body text-charcoal">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <EmailInput
                    {...register("email")}
                    id="email"
                    placeholder="you@example.com"
                    className="border-sage/20 placeholder:text-charcoal/40"
                  />
                  {errors.email && (
                    <p className="text-xs text-red-600 font-body mt-1">{errors.email.message}</p>
                  )}
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <Label htmlFor="phone" className="font-body text-charcoal">
                    Phone Number
                  </Label>
                  <Controller
                    name="phone"
                    control={control}
                    render={({ field }) => (
                      <PhoneInput
                        id="phone"
                        value={field.value as PhoneValue}
                        onChange={field.onChange}
                        className="[&_input]:border-sage/20 [&_input]:font-body [&_button]:border-sage/20"
                      />
                    )}
                  />
                  {errors.phone && (
                    <p className="text-xs text-red-600 font-body mt-1">{errors.phone.message}</p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <Label htmlFor="password" className="font-body text-charcoal">
                    Password <span className="text-red-500">*</span>
                  </Label>
                  <PasswordInput
                    {...register("password", {
                      onChange: () => {
                        if (passwordValue !== undefined) trigger("confirmPassword");
                      },
                    })}
                    id="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="border-sage/20 focus:ring-sage font-body placeholder:text-charcoal/40"
                  />
                  {errors.password ? (
                    <p className="text-xs text-red-600 font-body mt-1">{errors.password.message}</p>
                  ) : (
                    <p className="text-xs text-charcoal/50 font-body mt-1">Must be at least 6 characters</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1">
                  <Label htmlFor="confirmPassword" className="font-body text-charcoal">
                    Confirm Password <span className="text-red-500">*</span>
                  </Label>
                  <PasswordInput
                    {...register("confirmPassword")}
                    id="confirmPassword"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="border-sage/20 focus:ring-sage font-body placeholder:text-charcoal/40"
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-red-600 font-body mt-1">{errors.confirmPassword.message}</p>
                  )}
                </div>

                {/* Consent checkboxes */}
                <div className="space-y-3 pt-2 border-t border-sage/10">
                  <p className="text-xs text-charcoal/50 font-body">Please read and accept the following before creating your account</p>

                  <div className="space-y-1">
                    <div className="flex items-start gap-3">
                      <Controller
                        name="acceptTerms"
                        control={control}
                        render={({ field }) => (
                          <Checkbox
                            id="acceptTerms"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-0.5"
                          />
                        )}
                      />
                      <label htmlFor="acceptTerms" className="text-sm font-body text-charcoal/80 cursor-pointer leading-snug">
                        I have read and agree to the{" "}
                        <a href="https://thestudiobycopperandcloves.in/terms" target="_blank" rel="noopener noreferrer" className="text-sage underline underline-offset-2 hover:text-sage/80">
                          Terms of Service
                        </a>
                      </label>
                    </div>
                    {errors.acceptTerms && (
                      <p className="text-xs text-red-600 font-body ml-7">{errors.acceptTerms.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-start gap-3">
                      <Controller
                        name="acceptPrivacy"
                        control={control}
                        render={({ field }) => (
                          <Checkbox
                            id="acceptPrivacy"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-0.5"
                          />
                        )}
                      />
                      <label htmlFor="acceptPrivacy" className="text-sm font-body text-charcoal/80 cursor-pointer leading-snug">
                        I have read and agree to the{" "}
                        <a href="https://thestudiobycopperandcloves.in/policy" target="_blank" rel="noopener noreferrer" className="text-sage underline underline-offset-2 hover:text-sage/80">
                          Privacy Policy
                        </a>
                      </label>
                    </div>
                    {errors.acceptPrivacy && (
                      <p className="text-xs text-red-600 font-body ml-7">{errors.acceptPrivacy.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-start gap-3">
                      <Controller
                        name="acceptWaiver"
                        control={control}
                        render={({ field }) => (
                          <Checkbox
                            id="acceptWaiver"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-0.5"
                          />
                        )}
                      />
                      <label htmlFor="acceptWaiver" className="text-sm font-body text-charcoal/80 cursor-pointer leading-snug">
                        I have read and accept the{" "}
                        <span className="text-sage/60 italic text-xs">(PDF available soon)</span>{" "}
                        Liability Waiver
                      </label>
                    </div>
                    {errors.acceptWaiver && (
                      <p className="text-xs text-red-600 font-body ml-7">{errors.acceptWaiver.message}</p>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-sage hover:bg-sage/90 text-white font-body h-12 rounded-full mt-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="font-body text-sm text-charcoal/60">
                  Already have an account?{" "}
                  <Link href="/portal/login" className="text-sage hover:underline font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
