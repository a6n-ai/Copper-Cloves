import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { normalizeLoginEmail } from "@/lib/loginEmail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { FormAlert } from "@/components/ui/form-alert";
import { Spinner } from "@/components/ui/spinner";

const RESEND_COOLDOWN_MS = 30_000;
const FIELD = "bg-white-warm/45 backdrop-blur-md placeholder:text-charcoal/45 h-12 rounded-xl border-white/45 focus:ring-sage";
const LABEL = "font-body text-charcoal/70 text-[11px] uppercase tracking-[0.15em]";

type Props = {
  mode: "sign-in" | "reset";
  initialEmail: string;
  onSignedIn: (role: string | undefined) => void;
  onResetDone: () => void;
  onBack: () => void;
  onSwitchToSignup: () => void;
};

function verifyErrorMessage(code: string | undefined) {
  if (code === "TOO_MANY_ATTEMPTS") return "Too many wrong attempts. Request a new code.";
  return "That code is incorrect or has expired.";
}

export function OtpAuthFlow({ mode, initialEmail, onSignedIn, onResetDone, onBack, onSwitchToSignup }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const isReset = mode === "reset";
  const cooldownLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendAt]);

  async function sendCode() {
    setError(null);
    setBusy(true);
    const target = normalizeLoginEmail(email);
    // Both endpoints answer success for unknown emails (no enumeration), so the
    // code step is always shown; a wrong address just never receives a code.
    const { error: sendError } = isReset
      ? await authClient.emailOtp.requestPasswordReset({ email: target })
      : await authClient.emailOtp.sendVerificationOtp({ email: target, type: "sign-in" });
    setBusy(false);
    if (sendError) {
      setError(sendError.status === 429 ? "Too many requests. Please wait a minute and try again." : "Could not send the code. Please try again.");
      return;
    }
    setSentTo(target);
    setOtp("");
    setNow(Date.now());
    setResendAt(Date.now() + RESEND_COOLDOWN_MS);
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setError(null);
    setBusy(true);
    if (isReset) {
      const { error: resetError } = await authClient.emailOtp.resetPassword({ email: sentTo, otp, password });
      setBusy(false);
      if (resetError) {
        setError(resetError.code === "PASSWORD_TOO_SHORT" ? "Password must be at least 8 characters." : verifyErrorMessage(resetError.code));
        return;
      }
      onResetDone();
      return;
    }
    const { data, error: signInError } = await authClient.signIn.emailOtp({ email: sentTo, otp });
    if (signInError || !data?.user) {
      setBusy(false);
      setError(verifyErrorMessage(signInError?.code));
      return;
    }
    onSignedIn((data.user as { role?: string }).role);
  }

  const codeReady = otp.length === 6 && (!isReset || password.length >= 8);

  return (
    <>
      <h1 className="font-display text-3xl sm:text-5xl text-charcoal leading-[1.05] text-left">
        {isReset ? <>Reset your <span className="italic text-sage">password</span></> : <>Sign in with a <span className="italic text-sage">code</span></>}
      </h1>
      <p className="font-body text-sm text-charcoal/80 mb-6 mt-3 text-left sm:mb-8">
        {sentTo ? `We emailed a 6-digit code to ${sentTo}. It's valid for 10 minutes.` : "We'll email you a 6-digit code."}
      </p>

      {!sentTo ? (
        <form onSubmit={(e) => { e.preventDefault(); void sendCode(); }} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="otp-email" className={LABEL}>Email</Label>
            <Input id="otp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className={FIELD} required autoFocus />
          </div>
          {error && <div aria-live="polite"><FormAlert message={error} variant="error" /></div>}
          <Button type="submit" variant="sage" size="lg" disabled={busy || !email.trim()} className="w-full rounded-md text-sm uppercase tracking-[0.15em]">
            {busy ? <><Spinner className="mr-2 size-4" />Sending…</> : "Email me a code"}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="otp-code" className={LABEL}>6-digit code</Label>
            <Input
              id="otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className={`${FIELD} tracking-[0.5em] text-center text-lg`}
              required
              autoFocus
            />
          </div>
          {isReset && (
            <div className="space-y-1.5">
              <Label htmlFor="otp-new-password" className={LABEL}>New password</Label>
              <PasswordInput id="otp-new-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={FIELD} required />
            </div>
          )}
          {error && <div aria-live="polite"><FormAlert message={error} variant="error" /></div>}
          <Button type="submit" variant="sage" size="lg" disabled={busy || !codeReady} className="w-full rounded-md text-sm uppercase tracking-[0.15em]">
            {busy ? <><Spinner className="mr-2 size-4" />{isReset ? "Saving…" : "Signing in…"}</> : isReset ? "Set new password" : "Sign in"}
          </Button>
          <div className="flex items-center justify-between font-body text-sm">
            <Button type="button" variant="link" className="text-sage h-auto p-0" disabled={busy || cooldownLeft > 0} onClick={() => void sendCode()}>
              {cooldownLeft > 0 ? `Resend code in ${cooldownLeft}s` : "Resend code"}
            </Button>
            <Button type="button" variant="link" className="text-charcoal/60 h-auto p-0" onClick={() => { setSentTo(null); setError(null); }}>
              Wrong email?
            </Button>
          </div>
        </form>
      )}

      <Button type="button" variant="link" onClick={onBack} className="mt-6 text-sage h-auto p-0">
        {isReset ? "← Back to sign in" : "Use my password instead"}
      </Button>

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
