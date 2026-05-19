import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmailInput } from "@/components/ui/email-input";
import { PasswordInput } from "@/components/ui/password-input";
import { authService } from "@/services/authService";
import { FormAlert } from "@/components/ui/form-alert";
import { Loader2, ArrowRight, CheckCircle2, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SEO } from "@/components/SEO";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const forgotSchema = z.object({
  forgotEmail: z.string().email("Please enter a valid email address"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type ForgotFormValues = z.infer<typeof forgotSchema>;

export default function Login() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  useEffect(() => {
    if (router.query.signup === "success") {
      setShowSuccess(true);
      router.replace("/portal/login", undefined, { shallow: true });
    }
  }, [router]);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
  });

  const {
    register: registerForgot,
    handleSubmit: handleForgotSubmit,
    formState: { errors: forgotErrors, isSubmitting: forgotSubmitting },
    reset: resetForgot,
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    mode: "onTouched",
  });

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    setLoginError(null);
    setShowSuccess(false);
    try {
      const { error: signInError } = await authService.signIn(data.email, data.password);
      if (signInError) throw new Error(signInError.message);
      const redirect = router.query.redirect as string;
      await router.replace(redirect || "/portal/dashboard");
    } catch (error: unknown) {
      setIsLoading(false);
      setLoginError(error instanceof Error ? error.message : "Failed to sign in. Please try again.");
    }
  }

  async function onForgotSubmit(data: ForgotFormValues) {
    setForgotError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.forgotEmail }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setForgotError(body.error ?? "Something went wrong. Please try again.");
        return;
      }
      setForgotSent(true);
    } catch {
      setForgotError("Something went wrong. Please try again.");
    }
  }

  function closeForgot() {
    setShowForgot(false);
    setForgotSent(false);
    setForgotError(null);
    resetForgot();
  }

  return (
    <>
      <SEO
        title="Sign In - The Studio by Copper + Cloves"
        description="Sign in to your account and continue your wellness journey"
      />

      {/* Forgot password modal */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40 backdrop-blur-xs animate-in fade-in duration-200">
          <Card className="w-full max-w-sm border-sage/20 bg-white shadow-2xl">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="font-display text-xl text-charcoal">
                    {forgotSent ? "Check your email" : "Forgot password?"}
                  </CardTitle>
                  <CardDescription className="font-body text-charcoal/60 mt-1 text-sm">
                    {forgotSent
                      ? "If an account exists for that email, a reset link has been sent. Check your inbox."
                      : "Enter your email and we'll send you a reset link."}
                  </CardDescription>
                </div>
                <button
                  onClick={closeForgot}
                  className="text-charcoal/40 hover:text-charcoal transition-colors mt-0.5 ml-4 shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>

            {!forgotSent && (
              <CardContent>
                <FormAlert message={forgotError} variant="error" className="mb-4" />
                <form onSubmit={handleForgotSubmit(onForgotSubmit)} noValidate className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="forgotEmail" className="font-body text-charcoal text-sm">
                      Email Address
                    </Label>
                    <EmailInput
                      {...registerForgot("forgotEmail")}
                      id="forgotEmail"
                      placeholder="you@example.com"
                      className="border-sage/20 placeholder:text-charcoal/40"
                    />
                    {forgotErrors.forgotEmail && (
                      <p className="text-xs text-red-600 font-body mt-1">{forgotErrors.forgotEmail.message}</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={forgotSubmitting}
                    className="w-full bg-sage hover:bg-sage/90 text-white font-body h-11 rounded-full"
                  >
                    {forgotSubmitting ? (
                      <><Loader2 className="animate-spin mr-2 h-4 w-4" />Sending…</>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </form>
              </CardContent>
            )}

            {forgotSent && (
              <CardContent>
                <div className="flex justify-center py-2">
                  <CheckCircle2 className="h-12 w-12 text-sage" />
                </div>
                <Button
                  variant="outline"
                  onClick={closeForgot}
                  className="w-full mt-4 border-sage/20 font-body"
                >
                  Back to Sign In
                </Button>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* Navigation */}
      <nav className="bg-white/40 backdrop-blur-xl shadow-xs sticky top-0 z-40 border-b border-sage/10">
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

      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/5 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md border-sage/20 bg-white/95 backdrop-blur-xl shadow-2xl">
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
              <CardTitle className="font-display text-3xl text-charcoal mb-2">Welcome Back</CardTitle>
              <CardDescription className="font-body text-charcoal/60">
                Sign in to continue your wellness journey
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            {showSuccess && (
              <Alert variant="success" className="mb-6 animate-in slide-in-from-top duration-300">
                <CheckCircle2 className="h-5 w-5" />
                <AlertDescription className="text-sm ml-2 font-body">
                  <strong>Account created!</strong> You can now sign in to your dashboard.
                </AlertDescription>
              </Alert>
            )}

            <FormAlert message={loginError} variant="error" className="mb-6" />

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-body text-charcoal">Email Address</Label>
                <EmailInput
                  {...register("email")}
                  id="email"
                  placeholder="you@example.com"
                  className="border-sage/20 placeholder:text-charcoal/40"
                />
                {errors.email && (
                  <p className="text-sm text-red-600 font-body">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="font-body text-charcoal">Password</Label>
                <PasswordInput
                  {...register("password")}
                  id="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="border-sage/20 focus:ring-sage font-body placeholder:text-charcoal/40"
                />
                {errors.password && (
                  <p className="text-sm text-red-600 font-body">{errors.password.message}</p>
                )}
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="font-body text-sm text-charcoal/60 hover:text-sage transition-colors hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-sage hover:bg-sage/90 text-white font-body text-base h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <><Loader2 className="animate-spin mr-2" size={20} />Signing in...</>
                ) : (
                  <>Sign In<ArrowRight className="ml-2" size={20} /></>
                )}
              </Button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-charcoal/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white/80 font-body text-charcoal/50">or</span>
              </div>
            </div>

            <div className="text-center">
              <Link
                href="/portal/signup"
                className="font-body text-sm text-charcoal/70 hover:text-sage transition-colors inline-flex items-center gap-2 group"
              >
                New to The Studio? Create account
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
