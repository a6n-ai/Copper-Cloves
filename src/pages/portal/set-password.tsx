// src/pages/portal/set-password.tsx
import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { SEO as Seo } from "@/components/SEO";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuthWeather } from "@/hooks/useAuthWeather";
import { useToast } from "@/hooks/use-toast";

function LeafDivider() {
  return (
    <div className="my-5 flex items-center justify-center gap-3" aria-hidden>
      <span className="h-px w-10 bg-linear-to-r from-transparent to-terracotta/40" />
      <Leaf className="h-3.5 w-3.5 text-terracotta/70" />
      <span className="h-px w-10 bg-linear-to-l from-transparent to-terracotta/40" />
    </div>
  );
}

export default function SetPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { palette, weather } = useAuthWeather();
  const token = typeof router.query.token === "string" ? router.query.token : "";

  const [email, setEmail] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/auth/set-password?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error === "already_activated") {
          router.replace("/login");
        } else if (data.error) {
          setTokenError(data.error);
        } else {
          setEmail(data.email);
        }
      });
  }, [token, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "Failed to set password", variant: "destructive" });
        return;
      }
      // Auto sign-in after setting password
      const result = await signIn("credentials", {
        email: data.email,
        password,
        role: "user",
        redirect: false,
      });
      if (result?.ok) {
        router.replace("/portal/dashboard");
      } else {
        toast({ title: "Password set. Please sign in.", variant: "default" });
        router.replace("/login");
      }
    } finally {
      setSubmitting(false);
    }
  }

  let content: ReactNode;

  if (!token || tokenError) {
    content = (
      <div className="text-center">
        <h1 className="font-display text-3xl sm:text-4xl text-charcoal leading-[1.1]">
          Link <span className="italic text-sage">invalid</span> or expired
        </h1>
        <LeafDivider />
        <p className="font-body text-sm text-charcoal/60 mb-8">
          {tokenError ?? "No token provided."}
        </p>
        <Button
          variant="sage"
          className="w-full h-12 rounded-full text-sm uppercase tracking-[0.15em]"
          onClick={() => router.push("/login")}
        >
          Go to sign in
        </Button>
      </div>
    );
  } else if (!email) {
    content = (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Spinner className="size-6 text-sage" />
        <p className="font-body text-sm text-charcoal/60">Validating your link…</p>
      </div>
    );
  } else {
    content = (
      <>
        <h1 className="font-display text-4xl sm:text-5xl text-charcoal leading-[1.05] text-center">
          Set your <span className="italic text-sage">password</span>
        </h1>

        <LeafDivider />

        <p className="font-body text-sm text-charcoal/60 mb-8 text-center">
          Choose a password for{" "}
          <span className="font-medium text-charcoal">{email}</span>. Must be at least 6 characters.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email-display" className="font-body text-charcoal/70 text-[11px] uppercase tracking-[0.15em]">
              Email
            </Label>
            <Input
              id="email-display"
              value={email}
              readOnly
              className="h-12 rounded-xl border-sage/25 bg-cream/60 cursor-default tabular-nums"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="font-body text-charcoal/70 text-[11px] uppercase tracking-[0.15em]">
              New password
            </Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              autoFocus
              autoComplete="new-password"
              placeholder="••••••••"
              className="h-12 rounded-xl border-sage/25 bg-cream placeholder:text-charcoal/40"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="font-body text-charcoal/70 text-[11px] uppercase tracking-[0.15em]">
              Confirm password
            </Label>
            <PasswordInput
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              className="h-12 rounded-xl border-sage/25 bg-cream placeholder:text-charcoal/40"
            />
          </div>

          <Button
            type="submit"
            variant="sage"
            disabled={submitting}
            className="w-full h-12 rounded-full text-sm uppercase tracking-[0.15em]"
          >
            {submitting ? (
              <>
                <Spinner className="mr-2 size-4" />
                Setting password…
              </>
            ) : (
              "Set password"
            )}
          </Button>
        </form>

        <p className="mt-8 font-body text-sm text-charcoal/60 text-center">
          Already have a password?{" "}
          <Link href="/login" className="text-sage hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <Seo title="Set Password — The Studio" description="Set your account password" />
      <AuthShell weather={weather} palette={palette}>
        {content}
      </AuthShell>
    </>
  );
}
