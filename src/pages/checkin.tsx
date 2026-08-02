import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "@/lib/auth/client";

export default function CheckinDeepLink() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [msg, setMsg] = useState("Checking you in…");

  useEffect(() => {
    if (isPending) return;
    const t = typeof router.query.t === "string" ? router.query.t : "";
    if (!t) {
      setMsg("Missing check-in code.");
      return;
    }
    if (!session?.user) {
      // /login has no redirect-back; sign in then use the in-app Scan button.
      setMsg("Please sign in, then tap “Scan check-in” in your dashboard.");
      const id = setTimeout(() => void router.replace("/login"), 1800);
      return () => clearTimeout(id);
    }
    let cancelled = false;
    (async () => {
      const r = await fetch("/api/checkin/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      const d = await r.json().catch(() => ({}));
      if (!cancelled) setMsg(r.ok ? "Checked in ✓ You can close this." : d.error ?? "Check-in failed.");
    })();
    return () => {
      cancelled = true;
    };
  }, [isPending, session, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-6">
      <p role="status" aria-live="polite" className="text-center font-display text-2xl text-charcoal">{msg}</p>
    </div>
  );
}
