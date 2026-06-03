import { useEffect, useRef } from "react";

const POLL_MS = 5 * 60 * 1000; // 5 minutes
const RELOAD_GRACE_MS = 2_000; // small delay so a click-in-progress can flush

/**
 * Polls `/api/version` against the build id baked into the client bundle.
 * On mismatch (i.e. a fresh deploy went out while this tab was open), soft-
 * reloads the page so the user picks up the new JS and the new session JWT.
 *
 * Combined with NextAuth `SessionProvider refetchInterval` this means a tab
 * that's been idle through a deploy will never end up in the "UI thinks I'm
 * logged in but every admin API returns 401" zombie state — we either re-
 * authenticate via the fresh JWT or land back on /login.
 */
export function BuildVersionWatcher() {
  const reloadingRef = useRef(false);

  useEffect(() => {
    // Production only. In `next dev` the page bundle and the /api/version route
    // are compiled at different times, so each bakes a different Date.now()
    // fallback build id — the mismatch would trigger an endless reload loop.
    if (process.env.NODE_ENV !== "production") return;
    const baked = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
    if (!baked || baked === "dev") return; // only watch in real builds

    let timer: ReturnType<typeof setTimeout> | null = null;

    const check = async () => {
      if (reloadingRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return;
        const { buildId } = (await r.json()) as { buildId?: string };
        if (!buildId || buildId === baked) return;
        reloadingRef.current = true;
        // Defer the reload a tick so any in-flight click handler can complete
        // its UI feedback before we navigate.
        setTimeout(() => {
          window.location.reload();
        }, RELOAD_GRACE_MS);
      } catch {
        /* ignore — transient network errors aren't worth reloading over */
      }
    };

    // Initial check after a small delay so first paint isn't blocked.
    timer = setTimeout(check, 10_000);
    const interval = setInterval(check, POLL_MS);
    // Also check the moment the tab regains focus — catches "I left this open
    // overnight, you deployed, I came back".
    const onVis = () => { if (!document.hidden) void check(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
