import { useState } from "react";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/ui/password-input";
import { FormAlert } from "@/components/ui/form-alert";
import { LayoutDashboard, Calendar, Users, ShieldCheck, Leaf, ChefHat, type LucideIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

type Role = "admin" | "partner" | "instructor" | "user" | "chef";

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
  const [emailChecked, setEmailChecked] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  // Editing the email after a check resets everything revealed below it.
  function onEmailChange(value: string) {
    setEmail(value);
    if (emailChecked || role || roles.length) {
      setEmailChecked(false);
      setRoles([]);
      setRole(null);
      setPassword("");
      setError(null);
      setResetMsg(null);
    }
  }

  async function checkEmail() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      const found = (data.roles ?? []) as Role[];
      if (found.length === 0) {
        setError("Invalid email or password");
        return;
      }
      setRoles(found);
      setEmailChecked(true);
      if (found.length === 1) setRole(found[0]); // single role → reveal password
      // >1 role → leave role null → show portal picker below
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function doSignIn(r: Role) {
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", { email: email.trim(), password, role: r, redirect: false });
      if (!res || res.error) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }
      // Hard navigation so the new session starts with a clean in-memory SWR
      // cache — a soft router.replace would reuse a prior user's cached data
      // (profile/packages/stats) and land you in "someone else's account".
      window.location.assign(PORTALS[r].href);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailChecked) {
      checkEmail();
    } else if (role) {
      doSignIn(role);
    }
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
      // Pass the picked role so non-member portals (instructor/partner/admin) reset too.
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target, role: role ?? undefined }),
      });
      setResetMsg(`If an account exists for ${target}, a password reset link is on its way. Check your inbox (and spam).`);
    } catch {
      setResetMsg("Could not send the reset email just now. Please try again in a moment.");
    } finally {
      setResetLoading(false);
    }
  }

  const needPick = emailChecked && roles.length > 1 && !role;

  return (
    <>
      <h1 className="font-display text-4xl sm:text-5xl text-charcoal leading-[1.05] text-center">
        Welcome <span className="italic text-sage">back</span>
      </h1>

      {/* delicate leaf divider */}
      <div className="my-5 flex items-center justify-center gap-3" aria-hidden>
        <span className="h-px w-10 bg-linear-to-r from-transparent to-terracotta/40" />
        <Leaf className="h-3.5 w-3.5 text-terracotta/70" />
        <span className="h-px w-10 bg-linear-to-l from-transparent to-terracotta/40" />
      </div>

      <p className="font-body text-sm text-charcoal/80 mb-8 text-center">
        {!emailChecked
          ? "Enter your email to continue"
          : needPick
            ? "Choose a portal to continue"
            : "Enter your password to sign in"}
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email — always present, editable */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="font-body text-charcoal/70 text-[11px] uppercase tracking-[0.15em]">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="you@email.com"
            className="border-sage/25 bg-cream focus:ring-sage placeholder:text-charcoal/40 h-12 rounded-xl"
            required
            autoFocus
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "signin-error" : undefined}
          />
        </div>

        {/* Portal picker — only when this email maps to more than one portal */}
        <AnimatePresence initial={false}>
          {needPick && (
            <motion.div
              key="picker"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden -mx-1 px-1"
            >
              <div className="space-y-2.5 pt-0.5">
                {roles.map((r) => {
                  const p = PORTALS[r];
                  return (
                    <button
                      key={r}
                      type="button"
                      disabled={loading}
                      onClick={() => { setRole(r); setError(null); }}
                      className="w-full flex items-center gap-3 rounded-xl border border-sage/20 bg-white-warm px-4 py-3 text-left transition-colors hover:border-sage hover:bg-sage/5 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1"
                    >
                      <div className="h-9 w-9 rounded-full bg-sage/10 flex items-center justify-center text-sage shrink-0">
                        <p.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-body font-medium text-charcoal text-sm">{p.label}</p>
                        <p className="font-body text-xs text-charcoal/55 truncate">{p.blurb}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Password — revealed once a single role is known / a portal is picked */}
        <AnimatePresence initial={false}>
          {role && (
            <motion.div
              key="password"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onAnimationComplete={() => {
                // Focus after the height animation settles so the mobile keyboard
                // doesn't pop mid-animation (autoFocus fired during the transition).
                document.getElementById("password")?.focus();
              }}
              className="overflow-hidden -mx-1 px-1"
            >
              <div className="space-y-5 pt-0.5">
                {roles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => { setRole(null); setPassword(""); setError(null); }}
                    className="rounded font-body text-xs text-sage hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
                  >
                    ← Choose a different portal ({PORTALS[role].label})
                  </button>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="font-body text-charcoal/70 text-[11px] uppercase tracking-[0.15em]">Password</Label>
                  <PasswordInput
                    id="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="border-sage/25 bg-cream focus:ring-sage placeholder:text-charcoal/40 h-12 rounded-xl"
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
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div id="signin-error" aria-live="polite">
            <FormAlert message={error} variant="error" />
          </div>
        )}

        {/* Hide the primary button while the picker is the active choice */}
        {!needPick && (
          <Button type="submit" variant="sage" size="lg" disabled={loading} className="w-full rounded-full text-sm uppercase tracking-[0.15em]">
            {loading
              ? <><Spinner className="mr-2 size-4" />{role ? "Signing in…" : "Checking…"}</>
              : role ? "Sign In" : "Continue"}
          </Button>
        )}
      </form>

      <p className="mt-8 font-body text-sm text-charcoal/80 text-center">
        New to The Studio?{" "}
        <Button type="button" variant="link" onClick={onSwitchToSignup} className="text-sage h-auto p-0 font-medium">
          Create account
        </Button>
      </p>
    </>
  );
}
