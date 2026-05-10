import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import {
  enqueueActivityEvent,
  flushActivityQueue,
  getActivityVisitorId,
  installActivityFlushOnLeave,
} from "@/lib/activity-client";
import { installGlobalSelectionTracking } from "@/lib/selection-tracking";

/**
 * Captures route changes as `page_view` events and flushes the queue periodically.
 * Call once from `_app.tsx` inside the Next.js tree (with SessionProvider).
 */
export function useActivityTracking() {
  const router = useRouter();
  const { status } = useSession();
  const installed = useRef(false);

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
        metadata: { auth_status: status },
      });
    };

    router.events.on("routeChangeComplete", onComplete);
    onComplete(router.asPath);

    return () => {
      router.events.off("routeChangeComplete", onComplete);
    };
  }, [router, status]);

  useEffect(() => {
    const id = window.setInterval(() => void flushActivityQueue(), 15_000);
    return () => clearInterval(id);
  }, []);
}
