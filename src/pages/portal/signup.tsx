import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
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
import { Card, CardContent } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-alert";
import { Loader2, CheckCircle2, ChevronDown } from "lucide-react";
import { SEO } from "@/components/SEO";
import { motion } from "framer-motion";
import { AuthMeshBackground } from "@/components/AuthMeshBackground";
import { WeatherWidget } from "@/components/WeatherWidget";
import { useAuthWeather } from "@/hooks/useAuthWeather";
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
    acceptAll: z
      .boolean()
      .refine((v) => v, "Please accept our Terms, Privacy Policy, and Liability Waiver to continue"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { palette, weather, greeting } = useAuthWeather();
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [waiverExpanded, setWaiverExpanded] = useState(false);

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
      acceptAll: false,
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
        router.push("/login?signup=success");
      }, 2000);
    } catch (err: unknown) {
      setApiError(
        err instanceof Error ? err.message : "Failed to create account. Please try again."
      );
    }
  }

  if (success) {
    return (
      <div className="relative min-h-screen bg-cream flex items-center justify-center p-4 overflow-hidden">
        <AuthMeshBackground />
        <SEO
          title="Account Created - The Studio"
          description="Your account has been created successfully"
        />
        <Card className="relative w-full max-w-md border-white/40 bg-white/80 backdrop-blur-xl shadow-2xl">
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

      <div className="min-h-screen grid lg:grid-cols-2 bg-cream">
        {/* Form panel (left) */}
        <div className="flex items-center justify-center p-6 sm:p-10 py-12 order-2 lg:order-1">
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div className="mb-8 flex items-start justify-between">
              <Link href="/" className="flex flex-col leading-none">
                <span className="font-display text-xl text-charcoal italic tracking-tight">
                  the<span className="font-normal not-italic uppercase tracking-wider">STUDIO</span>
                </span>
                <span className="font-body text-[10px] tracking-[0.3em] uppercase text-charcoal/50 mt-0.5">
                  by Copper + Cloves
                </span>
              </Link>
              <Link href="/" className="font-body text-sm text-charcoal/60 hover:text-sage transition-colors">
                ← Home
              </Link>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl text-charcoal mb-2 leading-[1.05]">
              Join our <span className="italic text-sage">community</span>
            </h1>
            <p className="font-body text-sm text-charcoal/60 mb-8">
              Create your account and start your wellness journey
            </p>

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

                {/* Combined consent */}
                <div className="pt-2 border-t border-sage/10 space-y-3">
                  {/* Waiver inline summary (expandable) */}
                  <div className="rounded-xl border border-sage/20 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setWaiverExpanded(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-sage/5 hover:bg-sage/10 transition-colors text-left"
                    >
                      <span className="font-body text-sm font-medium text-charcoal/80">
                        Liability Waiver — key points
                      </span>
                      <ChevronDown
                        size={16}
                        className={`text-sage transition-transform duration-200 ${waiverExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                    {waiverExpanded && (
                      <div className="px-4 py-3 bg-white text-xs font-body text-charcoal/70 space-y-1.5 leading-relaxed">
                        <p>• Physical activity carries inherent risk of injury. You participate voluntarily.</p>
                        <p>• You confirm you are medically fit to participate in studio classes.</p>
                        <p>• The Studio by Copper + Cloves is not liable for injury, illness, or loss of personal property.</p>
                        <p>• In an emergency you consent to first-aid treatment and medical care.</p>
                        <p>• You may be photographed or filmed for studio use; opt out at reception.</p>
                      </div>
                    )}
                  </div>

                  {/* Single checkbox */}
                  <div className="space-y-1">
                    <div className="flex items-start gap-3">
                      <Controller
                        name="acceptAll"
                        control={control}
                        render={({ field }) => (
                          <Checkbox
                            id="acceptAll"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-0.5 data-[state=checked]:bg-sage data-[state=checked]:border-sage"
                          />
                        )}
                      />
                      <label htmlFor="acceptAll" className="text-sm font-body text-charcoal/80 cursor-pointer leading-snug">
                        I agree to the{" "}
                        <a href="https://thestudiobycopperandcloves.in/terms" target="_blank" rel="noopener noreferrer" className="text-sage underline underline-offset-2 hover:text-sage/80">
                          Terms of Service
                        </a>
                        {", "}
                        <a href="https://thestudiobycopperandcloves.in/policy" target="_blank" rel="noopener noreferrer" className="text-sage underline underline-offset-2 hover:text-sage/80">
                          Privacy Policy
                        </a>
                        {", and "}
                        <button
                          type="button"
                          onClick={() => setWaiverExpanded(true)}
                          className="text-sage underline underline-offset-2 hover:text-sage/80"
                        >
                          Liability Waiver
                        </button>
                      </label>
                    </div>
                    {errors.acceptAll && (
                      <p className="text-xs text-red-600 font-body ml-7">{errors.acceptAll.message}</p>
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

            <div className="mt-8">
              <p className="font-body text-sm text-charcoal/60">
                Already have an account?{" "}
                <Link href="/login" className="text-sage hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </motion.div>
        </div>

        {/* Visual panel (right) — weather-aware animated mesh gradient */}
        <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-charcoal order-1 lg:order-2">
          <AuthMeshBackground palette={palette} />
          <div className="relative flex items-center justify-between gap-4">
            <WeatherWidget weather={weather} />
            <span className="font-body text-[11px] tracking-[0.3em] uppercase text-charcoal/60">The Studio</span>
          </div>
          <motion.div
            className="relative"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          >
            <h2 className="font-display text-5xl xl:text-6xl leading-[1.02] text-charcoal drop-shadow-sm">
              Begin your<br />
              <span className="italic text-sage">wellness</span> journey.
            </h2>
            <p className="font-body text-base text-charcoal/75 mt-5 max-w-sm leading-relaxed">
              {greeting ?? "Movement, nourishment, and community under one roof. Create an account to book classes, buy packages, and more."}
            </p>
            {weather?.quote && (
              <motion.figure
                key={weather.quote.text}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="mt-8 max-w-sm border-l-2 border-sage/40 pl-4"
              >
                <blockquote className="font-display text-lg italic text-charcoal/80 leading-snug">
                  “{weather.quote.text}”
                </blockquote>
                <figcaption className="font-body text-xs uppercase tracking-widest text-charcoal/50 mt-2">
                  — {weather.quote.author}
                </figcaption>
              </motion.figure>
            )}
          </motion.div>
          <p className="relative font-body text-[11px] tracking-widest uppercase text-charcoal/50">
            © 2026 The Studio by Copper + Cloves
          </p>
        </div>
      </div>
    </>
  );
}
