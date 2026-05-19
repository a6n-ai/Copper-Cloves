import { useState } from "react";
import { useRouter } from "next/router";
import { signIn, getSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import Link from "next/link";
import { Shield, CheckCircle2, LogIn } from "lucide-react";
import { SEO } from "@/components/SEO";
import { normalizeLoginEmail } from "@/lib/loginEmail";
import { FormAlert } from "@/components/ui/form-alert";

const adminLoginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type AdminLoginForm = z.infer<typeof adminLoginSchema>;

export default function AdminLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const form = useForm<AdminLoginForm>({
    resolver: zodResolver(adminLoginSchema),
    mode: "onTouched",
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: AdminLoginForm) => {
    try {
      setLoading(true);
      setError("");
      const result = await signIn("credentials", {
        email: normalizeLoginEmail(data.username),
        password: data.password,
        redirect: false,
      });
      if (!result?.ok) {
        setError("Invalid admin credentials");
        return;
      }
      await getSession();
      setSuccess(true);
      router.replace("/admin/dashboard");
    } catch (err) {
      console.error("Admin login error:", err);
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEO 
        title="Admin Login - The Studio"
        description="Administrative access for The Studio by Copper + Cloves"
      />
      
      <main className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10 flex items-center justify-center p-6">
        {/* Success Overlay */}
        {success && (
          <div className="fixed inset-0 bg-cream/90 backdrop-blur-xs z-50 flex items-center justify-center">
            <div className="text-center animate-in zoom-in duration-600">
              <CheckCircle2 className="h-24 w-24 text-sage mx-auto mb-6" />
              <h2 className="font-display text-4xl text-charcoal mb-4">
                Access Granted
              </h2>
              <p className="text-charcoal/60 font-body text-lg">
                Redirecting to admin dashboard...
              </p>
            </div>
          </div>
        )}

        <Card className="w-full max-w-md border-sage/20 bg-white/95 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center space-y-4 bg-linear-to-b from-sage/10 to-transparent pb-8">
            <div className="mx-auto h-20 w-20 rounded-full bg-sage/10 flex items-center justify-center ring-4 ring-sage/20">
              <Shield className="h-10 w-10 text-sage" />
            </div>
            <div>
              <CardTitle className="font-display text-4xl text-charcoal">
                Admin Access
              </CardTitle>
              <CardDescription className="font-body text-base mt-3 text-charcoal/60">
                The Studio by Copper + Cloves
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-8">
            <FormAlert message={error} variant="error" className="mb-6" />

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-body text-charcoal/80">
                        Username
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          autoComplete="username"
                          placeholder="Enter username"
                          className="h-12 border-charcoal/20 focus:border-sage font-body placeholder:text-charcoal/40 transition-all duration-600"
                        />
                      </FormControl>
                      <FormMessage className="font-body text-sm" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-body text-charcoal/80">
                        Password
                      </FormLabel>
                      <FormControl>
                        <PasswordInput
                          {...field}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          className="h-12 border-charcoal/20 focus:border-sage font-body placeholder:text-charcoal/40 transition-all duration-600"
                        />
                      </FormControl>
                      <FormMessage className="font-body text-sm" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 bg-sage hover:bg-sage/90 text-white font-body text-lg transition-all duration-600 hover:scale-105 active:scale-95 shadow-lg"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Authenticating...</span>
                    </div>
                  ) : (
                    "Access Dashboard"
                  )}
                </Button>
              </form>
            </Form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-charcoal/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white/95 font-body text-charcoal/50">or</span>
              </div>
            </div>

            <Button
              asChild
              variant="outline"
              className="w-full h-12 border-charcoal/20 text-charcoal hover:bg-sage/10 hover:border-sage/40 font-body transition-all duration-600"
            >
              <Link href="/portal/login">
                <LogIn size={18} className="mr-2" />
                Regular Login
              </Link>
            </Button>

            <div className="mt-8 pt-6 border-t border-charcoal/10 space-y-2">
              <p className="text-center text-sm font-body text-charcoal/70 leading-relaxed">
                This page is for studio administrators and staff only.
              </p>
              <p className="text-center text-xs font-body text-charcoal/50 leading-relaxed">
                Members should use{" "}
                <Link href="/portal/login" className="text-sage hover:underline">
                  Regular Login
                </Link>
                . If you need admin access, contact your studio manager.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}