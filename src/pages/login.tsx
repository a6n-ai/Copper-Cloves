import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/ui/password-input";
import { Loader2, LayoutDashboard, Calendar, Users, ShieldCheck, type LucideIcon } from "lucide-react";
import { AuthMeshBackground } from "@/components/AuthMeshBackground";
import { WeatherWidget } from "@/components/WeatherWidget";
import { useAuthWeather } from "@/hooks/useAuthWeather";

type Role = "admin" | "partner" | "instructor" | "user";

const PORTALS: Record<Role, { label: string; blurb: string; href: string; icon: LucideIcon }> = {
  admin: { label: "Admin", blurb: "Manage the studio", href: "/admin/dashboard", icon: ShieldCheck },
  partner: { label: "Partner", blurb: "Your classes & roster", href: "/partner/dashboard", icon: Calendar },
  instructor: { label: "Instructor", blurb: "Today's classes & check-in", href: "/instructor/dashboard", icon: Users },
  user: { label: "Member", blurb: "Book classes & packages", href: "/portal/dashboard", icon: LayoutDashboard },
};

export default function UnifiedLogin() {
  const router = useRouter();
  const { palette, weather, greeting } = useAuthWeather();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [emailChecked, setEmailChecked] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Editing the email after a check resets everything revealed below it.
  function onEmailChange(value: string) {
    setEmail(value);
    if (emailChecked || role || roles.length) {
      setEmailChecked(false);
      setRoles([]);
      setRole(null);
      setPassword("");
      setError(null);
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
      await router.replace(PORTALS[r].href);
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

  const needPick = emailChecked && roles.length > 1 && !role;

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-cream">
      {/* Form panel (left) */}
      <div className="flex items-center justify-center p-6 sm:p-10 order-2 lg:order-1">
        <div className="w-full max-w-sm">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div className="mb-8">
              <span className="font-display text-xl text-charcoal italic tracking-tight">
                the<span className="font-normal not-italic uppercase tracking-wider">STUDIO</span>
              </span>
              <p className="font-body text-[10px] tracking-[0.3em] uppercase text-charcoal/50 mt-0.5">by Copper + Cloves</p>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl text-charcoal mb-2 leading-[1.05]">
              Welcome <span className="italic text-sage">back</span>
            </h1>
          </motion.div>
          <p className="font-body text-sm text-charcoal/60 mb-8">
            {!emailChecked
              ? "Enter your email to continue"
              : needPick
                ? "Choose a portal to continue"
                : "Enter your password to sign in"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email — always present, editable */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-body text-charcoal text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="you@email.com"
                className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40 h-11"
                required
                autoFocus
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
                          className="w-full flex items-center gap-3 rounded-xl border border-sage/20 bg-white px-4 py-3 text-left transition-colors hover:border-sage hover:bg-sage/5 disabled:opacity-60"
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
                  className="overflow-hidden -mx-1 px-1"
                >
                  <div className="space-y-5 pt-0.5">
                    {roles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => { setRole(null); setPassword(""); setError(null); }}
                        className="font-body text-xs text-sage hover:underline"
                      >
                        ← Choose a different portal ({PORTALS[role].label})
                      </button>
                    )}
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
                        autoFocus
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 font-body text-sm text-charcoal/70 cursor-pointer">
                        <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} className="border-sage/30 data-[state=checked]:bg-sage data-[state=checked]:border-sage" />
                        Remember this device
                      </label>
                      <a href="mailto:thestudio@copperandcloves.com?subject=Password%20reset" className="font-body text-sm text-sage hover:underline">Forgot password?</a>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && <ErrorBox msg={error} />}

            {/* Hide the primary button while the picker is the active choice */}
            {!needPick && (
              <Button type="submit" disabled={loading} className="w-full bg-sage hover:bg-sage/90 text-white font-body h-11 rounded-full text-base">
                {loading
                  ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />{role ? "Signing in…" : "Checking…"}</>
                  : role ? "Sign In" : "Continue"}
              </Button>
            )}
          </form>

          <p className="mt-8 font-body text-sm text-charcoal/60">
            New to The Studio?{" "}
            <Link href="/portal/signup" className="text-sage hover:underline">Create account</Link>
          </p>
        </div>
      </div>

      {/* Visual panel (right) — weather-aware animated mesh gradient */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-charcoal order-1 lg:order-2">
        <AuthMeshBackground palette={palette} />
        <div className="relative flex items-center justify-between gap-4">
          <WeatherWidget weather={weather} />
          <span className="font-body text-[11px] tracking-[0.3em] uppercase text-charcoal/60">The Studio</span>
        </div>
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
        >
          <h2 className="font-display text-5xl xl:text-6xl leading-[1.02] text-charcoal drop-shadow-sm">
            One door,<br />
            <span className="italic text-sage">every space</span> you run.
          </h2>
          <p className="font-body text-base text-charcoal/75 mt-5 max-w-sm leading-relaxed">
            {greeting ?? "Movement, nourishment, and community under one roof. Sign in and pick up where you left off."}
          </p>
          {weather?.quote && (
            <motion.figure
              key={weather.quote.text}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="mt-8 max-w-sm border-l-2 border-sage/40 pl-4"
            >
              <blockquote className="font-display text-lg italic text-charcoal/80 leading-snug">
                “{weather.quote.text}”
              </blockquote>
              <figcaption className="font-body text-xs uppercase tracking-widest text-charcoal/50 mt-2">
                — {weather.quote.author}
              </figcaption>
            </motion.figure>
          )}
        </motion.div>
        <p className="relative font-body text-[11px] tracking-widest uppercase text-charcoal/50">
          © 2026 The Studio by Copper + Cloves
        </p>
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 font-body">{msg}</div>
  );
}