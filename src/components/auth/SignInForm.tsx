import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { primaryRole } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/ui/password-input";
import { FormAlert } from "@/components/ui/form-alert";
import { LayoutDashboard, Calendar, Users, ShieldCheck, ChefHat, type LucideIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/roles";

const PORTALS: Record<Role, { label: string; blurb: string; href: string; icon: LucideIcon }> = {
  admin: { label: "Admin", blurb: "Manage the studio", href: "/admin/dashboard", icon: ShieldCheck },
  partner: { label: "Partner", blurb: "Your classes & roster", href: "/partner/dashboard", icon: Calendar },
  instructor: { label: "Instructor", blurb: "Today's classes & check-in", href: "/instructor/dashboard", icon: Users },
  user: { label: "Member", blurb: "Book classes & packages", href: "/portal/dashboard", icon: LayoutDashboard },
  chef: { label: "Kitchen", blurb: "Café & live orders", href: "/admin/kitchen", icon: ChefHat },
};

export function SignInForm({ onSwitchToSignup }: { onSwitchToSignup: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  async function doSignIn() {
    setError(null);
    setLoading(true);
    try {
      const { data, error: signInError } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (signInError || !data?.user) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }
      const role = primaryRole((data.user as { role?: string }).role) ?? "user";
      // Hard navigation so the new session starts with a clean in-memory SWR
      // cache — a soft router.replace would reuse the previous user's cached
      // data (profile/packages/stats) and land you in "someone else's account".
      window.location.assign(PORTALS[role].href);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSignIn();
  }

  async function handleForgotPassword() {
    const target = email.trim();
    if (!target) {
      setError("Enter your email above, then tap “Forgot password?” again.");
      return;
    }
    setError(null);
    setResetMsg(null);
    setResetLoading(true);
    try {
      // API always returns 200 (never reveals whether the email exists).
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      setResetMsg(`If an account exists for ${target}, a password reset link is on its way. Check your inbox (and spam).`);
    } catch {
      setResetMsg("Could not send the reset email just now. Please try again in a moment.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <>
      <h1 className="font-display text-3xl sm:text-5xl text-charcoal leading-[1.05] text-left">
        Welcome <span className="italic text-sage">back</span>
      </h1>

      <p className="font-body text-sm text-charcoal/80 mb-6 mt-3 text-left sm:mb-8">
        Enter your email and password to sign in
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="font-body text-charcoal/70 text-[11px] uppercase tracking-[0.15em]">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className={cn(
              "bg-white-warm/45 backdrop-blur-md placeholder:text-charcoal/45 h-12 rounded-xl",
              "border-white/45 focus:ring-sage",
            )}
            required
            autoFocus
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "signin-error" : undefined}
          />
          <a
            href="mailto:thestudio@copperandcloves.com?subject=Lost%20access%20to%20my%20account%20email"
            className="inline-block rounded font-body text-xs text-sage hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          >
            Lost access to your email?
          </a>
        </div>

        <div className="space-y-5 pt-0.5">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="font-body text-charcoal/70 text-[11px] uppercase tracking-[0.15em]">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="border-white/60 bg-white-warm/45 backdrop-blur-md focus:ring-sage placeholder:text-charcoal/45 h-12 rounded-xl"
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "signin-error" : undefined}
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 font-body text-sm text-charcoal/70 cursor-pointer">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} className="border-sage/30 data-[state=checked]:bg-sage data-[state=checked]:border-sage" />
              Remember this device
            </label>
            <Button
              type="button"
              variant="link"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              className="text-sage h-auto p-0"
            >
              {resetLoading ? "Sending…" : "Forgot password?"}
            </Button>
          </div>
          {resetMsg && (
            <p className="font-body text-sm text-sage/90 bg-sage/5 border border-sage/15 rounded-lg px-3 py-2">
              {resetMsg}
            </p>
          )}
        </div>

        {error && (
          <div id="signin-error" aria-live="polite">
            <FormAlert message={error} variant="error" />
          </div>
        )}

        <Button type="submit" variant="sage" size="lg" disabled={loading || !email.trim() || !password} className="w-full rounded-md text-sm uppercase tracking-[0.15em]">
          {loading
            ? <><Spinner className="mr-2 size-4" />Signing in…</>
            : "Sign In"}
        </Button>
      </form>

      <div className="mt-7 space-y-3 sm:mt-8">
        <div className="flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-charcoal/15" />
          <span className="font-body text-xs text-charcoal/60">New to The Studio?</span>
          <span className="h-px flex-1 bg-charcoal/15" />
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onSwitchToSignup}
          className="w-full rounded-md border-sage/50 bg-white-warm/30 backdrop-blur-md text-sm uppercase tracking-[0.15em] text-charcoal hover:border-sage hover:bg-sage/10 hover:text-charcoal"
        >
          Create account
        </Button>
      </div>
    </>
  );
}
