import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useSession } from "@/lib/auth/client";
import {
  enqueueActivityEvent,
  flushActivityQueue,
  getActivityVisitorId,
  installActivityFlushOnLeave,
} from "@/lib/activity-client";
import { installGlobalSelectionTracking } from "@/lib/selection-tracking";

/** Fire-and-forget queue flush; swallows rejection so timers/handlers stay quiet. */
const safeFlush = () => {
  flushActivityQueue().catch(() => {});
};

/**
 * Captures route changes as `page_view` events and flushes the queue periodically.
 * Call once from `_app.tsx` inside the Next.js tree (with SessionProvider).
 */
export function useActivityTracking() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const status = session?.user ? "authenticated" : isPending ? "loading" : "unauthenticated";
  const installed = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    if (!installed.current) {
      installed.current = true;
      installActivityFlushOnLeave();
      installGlobalSelectionTracking();
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    getActivityVisitorId();

    const onComplete = (url: string) => {
      enqueueActivityEvent({
        event_name: "page_view",
        event_category: "navigation",
        path: url,
        metadata: { auth_status: statusRef.current },
      });
    };

    router.events.on("routeChangeComplete", onComplete);
    onComplete(router.asPath);

    return () => {
      router.events.off("routeChangeComplete", onComplete);
    };
    // router.events is a stable ref; intentionally exclude `router` + `status`
    // to avoid re-binding the listener (and re-firing initial page_view) on
    // every router/session tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let id: number | null = null;
    const start = () => {
      if (id !== null) return;
      id = window.setInterval(safeFlush, 15_000);
    };
    const stop = () => {
      if (id === null) return;
      clearInterval(id);
      id = null;
    };
    const onVis = () => {
      if (document.hidden) stop();
      else {
        safeFlush();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, []);
}
