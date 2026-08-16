import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useSession } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { useCheckinScan, formatClassTime } from "@/lib/useCheckinScan";

export default function CheckinDeepLink() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { state, submit, confirmWalkIn, cancel } = useCheckinScan();

  const token = typeof router.query.t === "string" ? router.query.t : "";
  const signedOut = !isPending && !session?.user;

  // Fire once per token — `session` gets a new identity on every poll, and a
  // re-submit after the member cancelled would re-open the walk-in prompt.
  const sentRef = useRef<string | null>(null);
  useEffect(() => {
    if (isPending || !token || !session?.user || sentRef.current === token) return;
    sentRef.current = token;
    void submit(token);
  }, [isPending, session, token, submit]);

  useEffect(() => {
    if (!signedOut) return;
    // /login has no redirect-back; sign in then use the in-app Scan button.
    const id = setTimeout(() => void router.replace("/login"), 1800);
    return () => clearTimeout(id);
  }, [signedOut, router]);

  let body: React.ReactNode = "Checking you in…";
  if (!isPending && !token) body = "Missing check-in code.";
  else if (signedOut) body = "Please sign in, then tap “Scan check-in” in your dashboard.";
  else if (state.kind === "done") body = `${state.text} You can close this.`;
  else if (state.kind === "error") body = state.text;
  else if (state.kind === "confirm") {
    const { className, startTime, costsCredit, intended } = state.prompt;
    body = (
      <span className="block space-y-5">
        <span className="block text-2xl">
          You’re not booked for {className} · {formatClassTime(startTime)}
        </span>
        {intended ? (
          <span className="block font-body text-base text-muted-text">
            Your booking today is {intended.className} at {formatClassTime(intended.startTime)}. If
            that’s the class you attended, ask the desk to mark you in.
          </span>
        ) : null}
        <span className="block font-body text-base text-muted-text">
          {costsCredit
            ? `Join ${className} as a walk-in? This uses 1 class credit.`
            : `Join ${className} as a walk-in on your unlimited pass?`}
        </span>
        <span className="flex justify-center gap-3">
          <Button type="button" onClick={confirmWalkIn}>
            Yes, join this class
          </Button>
          <Button type="button" variant="secondary" onClick={cancel}>
            No, cancel
          </Button>
        </span>
      </span>
    );
  } else if (state.kind === "idle" && token && session?.user) body = "Cancelled — nothing was booked.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-6">
      <p role="status" aria-live="polite" className="max-w-md text-center font-display text-2xl text-charcoal">
        {body}
      </p>
    </div>
  );
}
