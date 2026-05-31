import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, Leaf } from "lucide-react";

const schema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordForm({ token }: { token: string | undefined }) {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
  });

  async function onSubmit(data: FormValues) {
    setApiError(null);
    if (!token) {
      setApiError("Invalid reset link. Please request a new one.");
      return;
    }
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setApiError(body.error ?? "Could not reset password. Please try again.");
        return;
      }
      setDone(true);
      setTimeout(() => router.replace("/login"), 3000);
    } catch {
      setApiError("Something went wrong. Please try again.");
    }
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center"
      >
        <h1 className="font-display text-4xl sm:text-5xl text-charcoal leading-[1.05]">
          Password <span className="italic text-sage">updated</span>
        </h1>
        <div className="my-5 flex items-center justify-center gap-3" aria-hidden>
          <span className="h-px w-10 bg-linear-to-r from-transparent to-terracotta/40" />
          <Leaf className="h-3.5 w-3.5 text-terracotta/70" />
          <span className="h-px w-10 bg-linear-to-l from-transparent to-terracotta/40" />
        </div>
        <div className="flex flex-col items-center gap-4 py-2">
          <CheckCircle2 className="h-14 w-14 text-sage" />
          <p className="font-body text-sm text-charcoal/60">Redirecting you to sign in…</p>
          <Link href="/login" className="font-body text-sm text-sage hover:underline">
            Sign in now →
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <h1 className="font-display text-4xl sm:text-5xl text-charcoal leading-[1.05] text-center">
        Choose a <span className="italic text-sage">new password</span>
      </h1>

      <div className="my-5 flex items-center justify-center gap-3" aria-hidden>
        <span className="h-px w-10 bg-linear-to-r from-transparent to-terracotta/40" />
        <Leaf className="h-3.5 w-3.5 text-terracotta/70" />
        <span className="h-px w-10 bg-linear-to-l from-transparent to-terracotta/40" />
      </div>

      <p className="font-body text-sm text-charcoal/60 mb-8 text-center">
        Must be at least 6 characters. You&apos;ll be signed out of all other devices.
      </p>

      {!token && (
        <div className="mb-5 bg-terracotta/10 border border-terracotta/20 rounded-lg px-4 py-3 text-sm text-terracotta font-body">
          This reset link is missing a token. Please use the link from your email.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="password" className="font-body text-charcoal/70 text-[11px] uppercase tracking-[0.15em]">
            New Password
          </Label>
          <PasswordInput
            {...register("password")}
            id="password"
            autoComplete="new-password"
            placeholder="••••••••"
            className="border-sage/25 bg-cream focus:ring-sage placeholder:text-charcoal/40 h-12 rounded-xl"
            autoFocus
          />
          {errors.password && (
            <p className="text-xs text-[#a05e38] font-body mt-1">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="font-body text-charcoal/70 text-[11px] uppercase tracking-[0.15em]">
            Confirm Password
          </Label>
          <PasswordInput
            {...register("confirmPassword")}
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="••••••••"
            className="border-sage/25 bg-cream focus:ring-sage placeholder:text-charcoal/40 h-12 rounded-xl"
          />
          {errors.confirmPassword && (
            <p className="text-xs text-[#a05e38] font-body mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        {apiError && (
          <div className="bg-[#a05e38]/10 border border-[#a05e38]/25 rounded-lg px-4 py-3 text-sm text-[#a05e38] font-body">
            {apiError}
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting || !token}
          variant="sage"
          className="w-full h-12 rounded-full text-sm uppercase tracking-[0.15em]"
        >
          {isSubmitting ? (
            <><Spinner className="mr-2 size-4" />Saving…</>
          ) : (
            "Update Password"
          )}
        </Button>
      </form>

      <p className="mt-8 font-body text-sm text-charcoal/60 text-center">
        Remembered it?{" "}
        <Link href="/login" className="text-sage hover:underline font-medium">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
