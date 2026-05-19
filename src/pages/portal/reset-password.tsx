import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-alert";
import { CheckCircle2, Loader2 } from "lucide-react";
import { SEO } from "@/components/SEO";

import { cdnUrl } from "@/lib/cdnUrl";
const schema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const token = router.query.token as string | undefined;

  const [apiError, setApiError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
  });

  async function onSubmit(data: FormValues) {
    setApiError(null);
    if (!token) {
      setApiError("Invalid reset link. Please request a new one.");
      return;
    }
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setApiError(body.error ?? "Could not reset password. Please try again.");
        return;
      }
      setDone(true);
      setTimeout(() => router.replace("/portal/login"), 3000);
    } catch {
      setApiError("Something went wrong. Please try again.");
    }
  }

  return (
    <>
      <SEO title="Reset Password — The Studio" description="Choose a new password" />

      <nav className="bg-white/40 backdrop-blur-xl shadow-xs sticky top-0 z-40 border-b border-sage/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link href="/" className="flex flex-col leading-none">
              <span className="font-display text-2xl text-charcoal italic tracking-tight">
                the<span className="font-normal not-italic uppercase tracking-wider">STUDIO</span>
              </span>
              <span className="font-body text-[10px] text-charcoal/60 tracking-widest uppercase mt-0.5">
                by COPPER+CLOVES
              </span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="min-h-[calc(100vh-5rem)] bg-linear-to-br from-cream via-cream to-sage/5 flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md border-sage/20 bg-white/95 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-6 pb-6">
            <div className="flex justify-center">
              <Image
                src={cdnUrl("/logo2.png")}
                alt="The Studio"
                width={180}
                height={64}
                className="h-16 w-auto"
                style={{ filter: "brightness(0)" }}
              />
            </div>
            <div className="text-center">
              <CardTitle className="font-display text-2xl text-charcoal mb-1">
                {done ? "Password updated" : "Choose a new password"}
              </CardTitle>
              <CardDescription className="font-body text-charcoal/60">
                {done
                  ? "Redirecting you to sign in…"
                  : "Must be at least 6 characters."}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            {done ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <CheckCircle2 className="h-14 w-14 text-sage" />
                <Link href="/portal/login" className="font-body text-sm text-sage hover:underline">
                  Sign in now →
                </Link>
              </div>
            ) : (
              <>
                <FormAlert message={apiError} variant="error" className="mb-5" />
                {!token && (
                  <FormAlert
                    message="This reset link is missing a token. Please use the link from your email."
                    variant="warning"
                    className="mb-5"
                  />
                )}
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
                  <div className="space-y-1">
                    <Label htmlFor="password" className="font-body text-charcoal">
                      New Password <span className="text-red-500">*</span>
                    </Label>
                    <PasswordInput
                      {...register("password")}
                      id="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="border-sage/20 font-body placeholder:text-charcoal/40"
                    />
                    {errors.password && (
                      <p className="text-xs text-red-600 font-body mt-1">{errors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="confirmPassword" className="font-body text-charcoal">
                      Confirm Password <span className="text-red-500">*</span>
                    </Label>
                    <PasswordInput
                      {...register("confirmPassword")}
                      id="confirmPassword"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="border-sage/20 font-body placeholder:text-charcoal/40"
                    />
                    {errors.confirmPassword && (
                      <p className="text-xs text-red-600 font-body mt-1">{errors.confirmPassword.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting || !token}
                    className="w-full bg-sage hover:bg-sage/90 text-white font-body h-12 rounded-full"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="animate-spin mr-2 h-4 w-4" />Saving…</>
                    ) : (
                      "Update Password"
                    )}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
