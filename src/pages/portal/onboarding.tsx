import { useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-alert";
import { ChevronRight, ChevronLeft, CheckCircle2 } from "lucide-react";
import { Spinner, PageLoader } from "@/components/ui/spinner";
import { SEO as Seo } from "@/components/SEO";
import { DatePicker } from "@/components/filters";

import { cdnUrl } from "@/lib/cdnUrl";
// ── Fitness goals (shared) ────────────────────────────────────────────────────
const FITNESS_GOALS = [
  "Weight Loss",
  "Build Strength",
  "Improve Flexibility",
  "Cardiovascular Fitness",
  "Stress Relief",
  "Athletic Performance",
  "Body Toning",
  "General Wellness",
];

// ── Short-term health issues ──────────────────────────────────────────────────
const HEALTH_ISSUES_GENERAL = [
  "None",
  "Chronic Pain",
  "Hypertension",
  "Diabetes",
  "Asthma / Breathing Issues",
  "Heart Condition",
  "Joint Problems",
];

const HEALTH_ISSUES_FEMALE_SHORT = [
  "None",
  "Currently Pregnant (Prenatal)",
  "Postnatal (within 6 months of delivery)",
  "Recovering from Pregnancy (6+ months)",
  "Chronic Pain",
  "Hypertension",
  "Diabetes",
  "Asthma / Breathing Issues",
  "Hormonal Conditions (PCOS, thyroid, etc.)",
];

const HEALTH_ISSUES_FEMALE_LONG = [
  "None",
  "Osteoporosis / Bone Density",
  "Cardiovascular Disease",
  "Autoimmune Condition",
  "Hormonal Imbalance",
  "Mental Health Condition",
  "Chronic Fatigue",
  "Other",
];

// ── Zod schema ────────────────────────────────────────────────────────────────
const baseSchema = z.object({
  dob: z.string().min(1, "Date of birth is required").refine((v) => {
    const d = new Date(v);
    if (isNaN(d.getTime())) return false;
    const age = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return age >= 12 && age <= 100;
  }, "Please enter a valid date of birth (must be 12+)"),
  gender: z.enum(["male", "female", "other"], { message: "Please select a gender" }),
  fitnessGoals: z.array(z.string()).min(1, "Select at least one goal"),
  healthIssuesShort: z.array(z.string()).min(1, "Select at least one option"),
  healthIssuesLong: z.array(z.string()).optional(),
  injuries: z.string().optional(),
});

type OnboardingValues = z.infer<typeof baseSchema>;

// ── Multi-checkbox helper ─────────────────────────────────────────────────────
function MultiCheckbox({
  options,
  value,
  onChange,
}: Readonly<{
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}>) {
  function toggle(opt: string) {
    if (opt === "None") {
      onChange(value.includes("None") ? [] : ["None"]);
      return;
    }
    const without = value.filter((v) => v !== "None");
    if (without.includes(opt)) {
      onChange(without.filter((v) => v !== opt));
    } else {
      onChange([...without, opt]);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      {options.map((opt) => (
        <div key={opt} className="flex items-center gap-3">
          <Checkbox
            id={`opt-${opt}`}
            checked={value.includes(opt)}
            onCheckedChange={() => toggle(opt)}
          />
          <label htmlFor={`opt-${opt}`} className="text-sm font-body text-charcoal/80 cursor-pointer">
            {opt}
          </label>
        </div>
      ))}
    </div>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────────
const STEP_LABELS = ["About You", "Your Goals", "Health Info"];
const GENDER_LABELS: Record<"male" | "female" | "other", string> = {
  male: "Male",
  female: "Female",
  other: "Other",
};

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const [step, setStep] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingValues>({
    resolver: zodResolver(baseSchema),
    mode: "onTouched",
    defaultValues: {
      dob: "",
      gender: undefined,
      fitnessGoals: [],
      healthIssuesShort: [],
      healthIssuesLong: [],
      injuries: "",
    },
  });

  const gender = watch("gender");
  const isFemale = gender === "female";

  async function goNext() {
    let valid = false;
    if (step === 0) valid = await trigger(["dob", "gender"]);
    if (step === 1) valid = await trigger(["fitnessGoals"]);
    if (step === 2) valid = await trigger(["healthIssuesShort"]);
    if (valid) setStep((s) => s + 1);
  }

  async function onSubmit(data: OnboardingValues) {
    setApiError(null);
    const questionnaire: Record<string, unknown> = {
      fitnessGoals: data.fitnessGoals,
      healthIssuesShort: data.healthIssuesShort,
    };
    if (isFemale) {
      questionnaire.healthIssuesLong = data.healthIssuesLong;
    } else {
      questionnaire.injuries = data.injuries;
    }

    try {
      const res = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dob: data.dob, gender: data.gender, questionnaire }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setApiError(body.error ?? "Could not save. Please try again.");
        return;
      }
      await updateSession({ onboarding_completed: true });
      setDone(true);
      setTimeout(() => router.replace("/portal/dashboard"), 1500);
    } catch {
      setApiError("Something went wrong. Please try again.");
    }
  }

  if (!session) {
    return <PageLoader />;
  }

  if (done) {
    return (
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10 flex items-center justify-center p-4">
        <div className="text-center animate-in zoom-in duration-500">
          <CheckCircle2 className="h-20 w-20 text-sage mx-auto mb-6" />
          <h2 className="font-body font-semibold text-3xl text-charcoal mb-2">{"You're all set!"}</h2>
          <p className="font-body text-charcoal/60">Taking you to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Seo title="Welcome — The Studio" description="Tell us a little about yourself" />

      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image
              src={cdnUrl("/logo2.png")}
              alt="The Studio"
              width={160}
              height={60}
              className="h-14 w-auto"
            />
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {STEP_LABELS.map((label, i) => {
              let labelColor: string;
              if (i === step) labelColor = "text-charcoal font-medium";
              else if (i < step) labelColor = "text-sage";
              else labelColor = "text-charcoal/30";

              let bubbleColor: string;
              if (i < step) bubbleColor = "bg-sage border-sage text-cream";
              else if (i === step) bubbleColor = "bg-charcoal border-charcoal text-cream";
              else bubbleColor = "border-charcoal/20 text-charcoal/30";

              return (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-xs font-body transition-colors ${labelColor}`}>
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs border transition-colors ${bubbleColor}`}>
                    {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`h-px w-8 transition-colors ${i < step ? "bg-sage" : "bg-charcoal/15"}`} />
                )}
              </div>
              );
            })}
          </div>

          <Card className="border-sage/20 bg-white-warm shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
            <CardHeader className="pb-4">
              <CardTitle className="font-body font-semibold text-2xl text-charcoal">
                {step === 0 && "Tell us about yourself"}
                {step === 1 && "Your fitness goals"}
                {step === 2 && "Health & wellbeing"}
              </CardTitle>
              <CardDescription className="font-body text-charcoal/60">
                {step === 0 && "This helps us personalise your studio experience."}
                {step === 1 && "What are you working towards? Pick all that apply."}
                {step === 2 && "Helps your instructors keep you safe. All info is private."}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <FormAlert message={apiError} variant="error" className="mb-5" />

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

                {/* ── Step 0: DOB + Gender ─────────────────────────────── */}
                {step === 0 && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="dob" className="font-body text-charcoal">
                        Date of Birth <span className="text-terracotta">*</span>
                      </Label>
                      <Controller
                        name="dob"
                        control={control}
                        render={({ field }) => (
                          <DatePicker
                            id="dob"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            placeholder="Select date"
                            max={new Date().toISOString().split("T")[0]}
                          />
                        )}
                      />
                      {errors.dob && (
                        <p className="text-xs text-destructive font-body mt-1">{errors.dob.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="font-body text-charcoal">
                        Gender <span className="text-terracotta">*</span>
                      </Label>
                      <Controller
                        name="gender"
                        control={control}
                        render={({ field }) => (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {(["male", "female", "other"] as const).map((g) => (
                              <button
                                key={g}
                                type="button"
                                onClick={() => field.onChange(g)}
                                className={`py-3 px-4 rounded-md border text-sm font-body capitalize transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1 ${
                                  field.value === g
                                    ? "bg-charcoal text-cream border-charcoal"
                                    : "border-sage/20 text-charcoal/70 hover:border-sage/50"
                                }`}
                              >
                                {GENDER_LABELS[g]}
                              </button>
                            ))}
                          </div>
                        )}
                      />
                      {errors.gender && (
                        <p className="text-xs text-destructive font-body mt-1">{errors.gender.message}</p>
                      )}
                    </div>
                  </>
                )}

                {/* ── Step 1: Fitness Goals ────────────────────────────── */}
                {step === 1 && (
                  <div className="space-y-1">
                    <Controller
                      name="fitnessGoals"
                      control={control}
                      render={({ field }) => (
                        <MultiCheckbox
                          options={FITNESS_GOALS}
                          value={field.value}
                          onChange={field.onChange}
                        />
                      )}
                    />
                    {errors.fitnessGoals && (
                      <p className="text-xs text-destructive font-body mt-2">{errors.fitnessGoals.message}</p>
                    )}
                  </div>
                )}

                {/* ── Step 2: Health Info ──────────────────────────────── */}
                {step === 2 && (
                  <>
                    <div className="space-y-2">
                      <Label className="font-body text-charcoal font-medium">
                        {isFemale ? "Short-term health considerations" : "Current health conditions"}
                        <span className="text-terracotta ml-0.5">*</span>
                      </Label>
                      <p className="text-xs text-charcoal/50 font-body">Select all that apply</p>
                      <Controller
                        name="healthIssuesShort"
                        control={control}
                        render={({ field }) => (
                          <MultiCheckbox
                            options={isFemale ? HEALTH_ISSUES_FEMALE_SHORT : HEALTH_ISSUES_GENERAL}
                            value={field.value}
                            onChange={field.onChange}
                          />
                        )}
                      />
                      {errors.healthIssuesShort && (
                        <p className="text-xs text-destructive font-body mt-1">{errors.healthIssuesShort.message}</p>
                      )}
                    </div>

                    {isFemale ? (
                      <div className="space-y-2">
                        <Label className="font-body text-charcoal font-medium">Long-term health conditions</Label>
                        <p className="text-xs text-charcoal/50 font-body">Select all that apply</p>
                        <Controller
                          name="healthIssuesLong"
                          control={control}
                          render={({ field }) => (
                            <MultiCheckbox
                              options={HEALTH_ISSUES_FEMALE_LONG}
                              value={field.value ?? []}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Label htmlFor="injuries" className="font-body text-charcoal font-medium">
                          Current or recent injuries
                        </Label>
                        <p className="text-xs text-charcoal/50 font-body">Leave blank if none</p>
                        <Controller
                          name="injuries"
                          control={control}
                          render={({ field }) => (
                            <Textarea
                              {...field}
                              id="injuries"
                              placeholder="e.g. lower back strain (2 months ago), left knee ligament recovery…"
                              className="border-sage/20 font-body text-sm resize-none"
                              rows={3}
                            />
                          )}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* ── Navigation ───────────────────────────────────────── */}
                <div className="flex gap-3 pt-2">
                  {step > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep((s) => s - 1)}
                      className="flex-1 border-sage/20 text-charcoal hover:bg-sage/5 font-body hover:text-charcoal!"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                  )}

                  {step < 2 ? (
                    <Button
                      type="button"
                      onClick={goNext}
                      variant="sage"
                      className="flex-1 font-body h-11 rounded-full"
                    >
                      Continue
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      variant="sage"
                      className="flex-1 h-11 rounded-full"
                    >
                      {isSubmitting ? (
                        <>
                          <Spinner className="mr-2 size-4" />
                          Saving…
                        </>
                      ) : (
                        "Complete Profile"
                      )}
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-charcoal/40 font-body mt-6">
            All health information is kept strictly private and only shared with your instructors.
          </p>
        </div>
      </div>
    </>
  );
}
