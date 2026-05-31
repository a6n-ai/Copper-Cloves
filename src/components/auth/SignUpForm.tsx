import { useState } from "react";
import { useRouter } from "next/router";
import { useForm, Controller } from "react-hook-form";
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
import { FormAlert } from "@/components/ui/form-alert";
import { CheckCircle2, ChevronDown, Leaf, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { motion, AnimatePresence } from "framer-motion";
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

const labelCls = "font-body text-charcoal/70 text-[11px] uppercase tracking-[0.15em]";
const inputCls = "border-sage/25 bg-cream focus:ring-sage font-body placeholder:text-charcoal/40 h-11 rounded-xl";

// Brand-themed, readable passphrase generator (botanical words + number + symbol).
const PW_WORDS = ["Lotus", "Cedar", "Sage", "Willow", "Aloe", "Maple", "Jasmine", "Bloom", "Ginger", "Mint", "Olive", "Fern", "Saffron", "Meadow", "River", "Honey", "Pebble", "Clove"];

function randInt(max: number): number {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const a = new Uint32Array(1);
    window.crypto.getRandomValues(a);
    return a[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function generatePassword(): string {
  const sym = "!@#$%&*";
  const w1 = PW_WORDS[randInt(PW_WORDS.length)];
  let w2 = PW_WORDS[randInt(PW_WORDS.length)];
  while (w2 === w1) w2 = PW_WORDS[randInt(PW_WORDS.length)];
  const num = 10 + randInt(90);
  return `${w1}-${w2}-${num}${sym[randInt(sym.length)]}`;
}

export function SignUpForm({ onSwitchToSignin }: { onSwitchToSignin: () => void }) {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [waiverExpanded, setWaiverExpanded] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [generated, setGenerated] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    trigger,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: "onTouched",
    defaultValues: { acceptAll: false },
  });

  // No `useWatch` on password — every keystroke would rerender the whole form
  // when the value is only needed inside a single onChange handler. Read via
  // `getValues` instead.

  async function goToStep2() {
    setApiError(null);
    const ok = await trigger(["fullName", "email", "phone"]);
    if (ok) {
      // Capture the partial lead (name + email) so we can nudge later. Best-effort.
      const { fullName, email, phone } = getValues();
      fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), fullName: fullName.trim(), phone: phone?.trim() }),
      }).catch(() => {});
      setStep(2);
    }
  }

  function handleGeneratePassword() {
    const pw = generatePassword();
    setValue("password", pw, { shouldValidate: true });
    setValue("confirmPassword", pw, { shouldValidate: true });
    setGenerated(pw);
  }

  function handleFormSubmit(e: React.FormEvent) {
    if (step === 1) {
      e.preventDefault();
      goToStep2();
    } else {
      handleSubmit(onSubmit)(e);
    }
  }

  async function onSubmit(data: SignupFormValues) {
    setApiError(null);
    try {
      const result = await signUp(data.email.trim(), data.password, data.fullName.trim(), data.phone?.trim());
      if (result.error) {
        setApiError(result.error.message);
        return;
      }
      // Mark the captured lead as converted. Best-effort.
      fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email.trim() }),
      }).catch(() => {});

      setSuccess(true);
      setTimeout(() => {
        router.push("/login?signup=success");
      }, 2000);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Failed to create account. Please try again.");
    }
  }

  if (success) {
    return (
      <div className="py-6 text-center">
        <div className="mb-6 flex justify-center">
          <div className="h-16 w-16 rounded-full bg-sage/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-sage" />
          </div>
        </div>
        <h2 className="font-display text-2xl text-charcoal mb-3">Account Created Successfully!</h2>
        <p className="font-body text-charcoal/60 mb-6">{"You'll be redirected to sign in shortly."}</p>
        <div className="h-2 bg-sage/10 rounded-full overflow-hidden">
          <div className="h-full bg-sage rounded-full animate-[progress_2s_ease-in-out]" />
        </div>
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
      <h1 className="font-display text-4xl sm:text-5xl text-charcoal leading-[1.05] text-center">
        Join our <span className="italic text-sage">community</span>
      </h1>

      {/* delicate leaf divider */}
      <div className="my-5 flex items-center justify-center gap-3" aria-hidden>
        <span className="h-px w-10 bg-linear-to-r from-transparent to-terracotta/40" />
        <Leaf className="h-3.5 w-3.5 text-terracotta/70" />
        <span className="h-px w-10 bg-linear-to-l from-transparent to-terracotta/40" />
      </div>

      <p className="font-body text-sm text-charcoal/60 mb-6 text-center">
        Create your account and start your wellness journey
      </p>

      <FormAlert message={apiError} variant="error" className="mb-4" />

      <form onSubmit={handleFormSubmit} noValidate>
        <AnimatePresence mode="wait" initial={false}>
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="space-y-3"
            >
              {/* Full Name */}
              <div className="space-y-1">
                <Label htmlFor="fullName" className={labelCls}>
                  Full Name <span className="text-terracotta">*</span>
                </Label>
                <Input
                  {...register("fullName")}
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="Jane Doe"
                  className={inputCls}
                />
                {errors.fullName && (
                  <p className="text-xs text-[#a05e38] font-body mt-1">{errors.fullName.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <Label htmlFor="email" className={labelCls}>
                  Email Address <span className="text-terracotta">*</span>
                </Label>
                <EmailInput
                  {...register("email")}
                  id="email"
                  placeholder="you@example.com"
                  className="border-sage/25 bg-cream placeholder:text-charcoal/40 h-11 rounded-xl"
                />
                {errors.email && (
                  <p className="text-xs text-[#a05e38] font-body mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <Label htmlFor="phone" className={labelCls}>
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
                      className="[&_input]:border-sage/25 [&_input]:bg-cream [&_input]:font-body [&_input]:h-11 [&_input]:rounded-xl [&_button]:border-sage/25 [&_button]:bg-cream [&_button]:rounded-xl"
                    />
                  )}
                />
                {errors.phone && (
                  <p className="text-xs text-[#a05e38] font-body mt-1">{errors.phone.message}</p>
                )}
              </div>

              <Button
                type="submit"
                variant="sage"
                size="lg"
                className="w-full rounded-full text-sm uppercase tracking-[0.15em] mt-2"
              >
                Continue
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="space-y-3"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setStep(1); setApiError(null); }}
              >
                ← Back to details
              </Button>

              {/* Password */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className={labelCls}>
                    Password <span className="text-terracotta">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="font-body text-[11px] text-sage hover:underline inline-flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" /> Suggest strong
                  </button>
                </div>
                <PasswordInput
                  {...register("password", {
                    onChange: () => {
                      if (generated) setGenerated(null);
                      if (getValues("password") !== undefined) trigger("confirmPassword");
                    },
                  })}
                  id="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={inputCls}
                />
                {errors.password ? (
                  <p className="text-xs text-[#a05e38] font-body mt-1">{errors.password.message}</p>
                ) : generated ? (
                  <p className="text-xs text-charcoal/70 font-body mt-1">
                    Suggested: <span className="font-medium text-charcoal">{generated}</span> — save it somewhere safe.
                  </p>
                ) : (
                  <p className="text-xs text-charcoal/50 font-body mt-1">Must be at least 6 characters</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <Label htmlFor="confirmPassword" className={labelCls}>
                  Confirm Password <span className="text-terracotta">*</span>
                </Label>
                <PasswordInput
                  {...register("confirmPassword")}
                  id="confirmPassword"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={inputCls}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-[#a05e38] font-body mt-1">{errors.confirmPassword.message}</p>
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
                    <div className="px-4 py-3 bg-cream text-xs font-body text-charcoal/70 space-y-1.5 leading-relaxed">
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
                    <p className="text-xs text-[#a05e38] font-body ml-7">{errors.acceptAll.message}</p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                variant="sage"
                size="lg"
                disabled={isSubmitting}
                className="w-full rounded-full text-sm uppercase tracking-[0.15em] mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Spinner className="mr-2 size-4" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      <p className="mt-5 font-body text-sm text-charcoal/60 text-center">
        Already have an account?{" "}
        <Button type="button" variant="link" onClick={onSwitchToSignin} className="text-sage h-auto p-0 font-medium">
          Sign in
        </Button>
      </p>
    </>
  );
}
