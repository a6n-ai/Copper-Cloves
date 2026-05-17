import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Loader2, Dumbbell } from "lucide-react";

export default function InstructorLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/instructor/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid credentials");
        setLoading(false);
        return;
      }
      await router.replace("/instructor/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Nav */}
      <nav className="bg-white/60 backdrop-blur-xl border-b border-sage/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex flex-col leading-none">
            <span className="font-display text-xl text-charcoal italic tracking-tight">
              the<span className="font-normal not-italic uppercase tracking-wider">STUDIO</span>
            </span>
            <span className="font-body text-[9px] text-charcoal/60 tracking-widest uppercase">
              by COPPER+CLOVES
            </span>
          </Link>
          <span className="font-body text-sm text-charcoal/60">Instructor Portal</span>
        </div>
      </nav>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="h-14 w-14 rounded-full bg-sage/10 flex items-center justify-center">
              <Dumbbell className="h-7 w-7 text-sage" />
            </div>
          </div>

          <h1 className="font-display text-3xl text-charcoal text-center mb-1">Welcome back</h1>
          <p className="font-body text-sm text-charcoal/60 text-center mb-8">
            Sign in to your instructor dashboard
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-body text-charcoal text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40 h-11"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="font-body text-charcoal text-sm">Password</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40 h-11"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 font-body">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-sage hover:bg-sage/90 text-white font-body h-11 rounded-full text-base"
            >
              {loading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Signing in…</> : "Sign In"}
            </Button>
          </form>

          <p className="mt-6 text-center font-body text-xs text-charcoal/40">
            Not an instructor?{" "}
            <Link href="/portal/login" className="text-sage hover:underline">Member login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
