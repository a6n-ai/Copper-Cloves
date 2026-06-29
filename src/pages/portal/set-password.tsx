// src/pages/portal/set-password.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function SetPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
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

  if (!token || tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-4">
        <div className="max-w-sm w-full text-center">
          <h1 className="font-body font-semibold text-2xl text-charcoal mb-3">Link invalid or expired</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {tokenError ?? "No token provided."}
          </p>
          <Button variant="outline" onClick={() => router.push("/login")}>Go to sign in</Button>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-sm text-muted-foreground">Validating…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="max-w-sm w-full">
        <h1 className="font-body font-semibold text-2xl text-charcoal mb-1">Set your password</h1>
        <p className="text-sm text-muted-foreground mb-6">For {email}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email-display" className="text-xs text-muted-foreground">Email</Label>
            <Input id="email-display" value={email} readOnly className="bg-sand/40 cursor-default" />
          </div>
          <div>
            <Label htmlFor="password" className="text-xs text-muted-foreground">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="confirm" className="text-xs text-muted-foreground">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <Button type="submit" variant="sage" className="w-full" disabled={submitting}>
            {submitting ? "Setting password…" : "Set password"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Already have a password?{" "}
          <Link href="/login" className="text-sage underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
