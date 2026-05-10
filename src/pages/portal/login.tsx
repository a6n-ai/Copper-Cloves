import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authService } from "@/services/authService";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (router.query.signup === "success") {
      setShowSuccess(true);
      router.replace("/portal/login", undefined, { shallow: true });
    }
  }, [router.query]);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    setEmailNotConfirmed(null);
    setShowSuccess(false);
    
    try {
      const { error: signInError } = await authService.signIn(data.email, data.password);

      if (signInError) {
        throw new Error(signInError.message);
      }

      const redirect = router.query.redirect as string;
      await router.replace(redirect || "/portal/dashboard");
    } catch (error: unknown) {
      setIsLoading(false);
      toast({
        title: "Authentication Error",
        description: error instanceof Error ? error.message : "Failed to sign in. Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <>
      <SEO 
        title="Sign In - The Studio by Copper + Cloves"
        description="Sign in to your account and continue your wellness journey"
      />

      {/* Navigation */}
      <nav className="bg-white/40 backdrop-blur-xl shadow-sm sticky top-0 z-50 border-b border-sage/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <Link href="/" className="flex flex-col leading-none group">
              <span className="font-display text-2xl text-charcoal italic tracking-tight">
                the<span className="font-normal not-italic uppercase tracking-wider">STUDIO</span>
              </span>
              <span className="font-body text-[10px] text-charcoal/60 tracking-widest uppercase mt-0.5">
                by COPPER+CLOVES
              </span>
            </Link>

            {/* Back to Home Link */}
            <Link href="/" className="font-body text-sm text-charcoal/60 hover:text-sage transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>
      </nav>

      {/* Login Form Container */}
      <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-sage/5 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md border-sage/20 bg-white/95 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-6 pb-8">
            {/* Logo Only - No Text */}
            <div className="flex justify-center">
              <img 
                src="/logo2.png" 
                alt="The Studio Logo" 
                className="h-20 w-auto"
                style={{ filter: 'brightness(0)' }}
              />
            </div>
            
            <div className="text-center">
              <CardTitle className="font-display text-3xl text-charcoal mb-2">
                Welcome Back
              </CardTitle>
              <CardDescription className="font-body text-charcoal/60">
                Sign in to continue your wellness journey
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            {showSuccess && (
              <Alert className="mb-6 border-sage/30 bg-sage/5 animate-in slide-in-from-top duration-300">
                <CheckCircle2 className="h-5 w-5 text-sage" />
                <AlertDescription className="text-sm text-charcoal ml-2 font-body">
                  <strong>Account created!</strong> You can now sign in to your dashboard.
                </AlertDescription>
              </Alert>
            )}

            {emailNotConfirmed && (
              <Alert className="mb-6 border-terracotta/30 bg-terracotta/5 animate-in slide-in-from-top duration-300">
                <AlertCircle className="h-5 w-5 text-terracotta" />
                <AlertDescription className="text-sm text-charcoal ml-2 font-body">
                  <strong>Invalid email or password.</strong> Please check your credentials.
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-body text-charcoal">
                  Email Address
                </Label>
                <Input
                  {...register("email")}
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="border-sage/20 focus:ring-sage font-body placeholder:text-charcoal/40"
                />
                {errors.email && (
                  <p className="text-sm text-terracotta">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="font-body text-charcoal">
                  Password
                </Label>
                <Input
                  {...register("password")}
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="border-sage/20 focus:ring-sage font-body placeholder:text-charcoal/40"
                />
                {errors.password && (
                  <p className="text-sm text-terracotta">{errors.password.message}</p>
                )}
              </div>

              <div className="text-right">
                <button
                  type="button"
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
                  <>
                    <Loader2 className="animate-spin mr-2" size={20} />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2" size={20} />
                  </>
                )}
              </Button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-charcoal/10"></div>
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