import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import { signUp } from "@/services/authService";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirm-password") as string;
    const fullName = formData.get("full-name") as string;
    const phone = formData.get("phone") as string;

    // Validation
    if (!email || !password || !fullName) {
      setError("Please fill in all required fields");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      console.log("Signing up with:", { email, fullName, phone });
      
      const result = await signUp(email, password, fullName, phone);

      if (result.error) {
        setError(result.error.message);
        setLoading(false);
        return;
      }

      // Show success message
      setSuccess(true);
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/portal/login?signup=success");
      }, 2000);
      
    } catch (err: any) {
      console.error("Signup error:", err);
      setError(err.message || "Failed to create account. Please try again.");
      setLoading(false);
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
              Please check your email to verify your account. You'll be redirected to login shortly.
            </p>
            <div className="h-2 bg-sage/10 rounded-full overflow-hidden">
              <div className="h-full bg-sage rounded-full animate-[progress_2s_ease-in-out]" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-sage/10 flex items-center justify-center p-4">
      <SEO 
        title="Sign Up - The Studio by Copper + Cloves"
        description="Create your account and start your wellness journey"
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

      <div className="w-full max-w-md">
        <Card className="border-sage/20 bg-white/95 backdrop-blur-xl shadow-2xl">
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
                Join Our Community
              </CardTitle>
              <CardDescription className="font-body text-charcoal/60">
                Create your account and start your wellness journey
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="font-body text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="full-name" className="font-body text-charcoal">
                  Full Name *
                </Label>
                <Input
                  id="full-name"
                  name="full-name"
                  type="text"
                  placeholder="John Doe"
                  required
                  className="border-sage/20 focus:ring-sage font-body placeholder:text-charcoal/40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="font-body text-charcoal">
                  Email Address *
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  className="border-sage/20 focus:ring-sage font-body placeholder:text-charcoal/40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="font-body text-charcoal">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  className="border-sage/20 focus:ring-sage font-body placeholder:text-charcoal/40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="font-body text-charcoal">
                  Password *
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="border-sage/20 focus:ring-sage font-body placeholder:text-charcoal/40"
                />
                <p className="text-xs text-charcoal/50 font-body">
                  Must be at least 6 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="font-body text-charcoal">
                  Confirm Password *
                </Label>
                <Input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="border-sage/20 focus:ring-sage font-body placeholder:text-charcoal/40"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-sage hover:bg-sage/90 text-white font-body"
              >
                {loading ? (
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

      <style jsx>{`
        @keyframes progress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}