import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { isPublicSite } from "@/lib/isPublicSite";
import { resolveSkeleton } from "@/components/transitions/skeletons";

/** ms a navigation must stall before the full-page skeleton appears. */
const SKELETON_DELAY = 200;

function pathOf(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url;
  }
}

/**
 * Public-site navigation feedback, mounted once in _app:
 *  - a thin top progress bar on every public→public route change, and
 *  - a generic page skeleton that only appears if the new route stalls past
 *    SKELETON_DELAY (so instant SSG pages never flash a skeleton).
 *
 * Gated to public routes via isPublicSite — the dashboards have their own
 * per-page loading states and shell chrome.
 */
export function RouteProgress() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [active, setActive] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  // Destination path captured at routeChangeStart — router.pathname still points
  // at the OLD page until the navigation completes, so we can't read it live.
  const [targetPath, setTargetPath] = useState("/");

  // Preview hook: `?__skeleton=1` pins the current route's skeleton on screen so
  // skeletons are reviewable without throttling the network. `?__skeleton=/path`
  // previews a specific route's skeleton. Dev affordance — harmless in prod.
  const skParam = router.query.__skeleton;
  const forced = skParam != null;
  const previewPath =
    typeof skParam === "string" && skParam.startsWith("/") ? skParam : router.pathname;
  const skeletonVisible = showSkeleton || forced;
  const skeletonPath = forced ? previewPath : targetPath;

  useEffect(() => {
    let skeletonTimer: ReturnType<typeof setTimeout> | undefined;

    const start = (url: string) => {
      const path = pathOf(url);
      if (!isPublicSite(path)) return;
      setTargetPath(path);
      setActive(true);
      skeletonTimer = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY);
    };
    const finish = () => {
      if (skeletonTimer) clearTimeout(skeletonTimer);
      setActive(false);
      setShowSkeleton(false);
    };

    router.events.on("routeChangeStart", start);
    router.events.on("routeChangeComplete", finish);
    router.events.on("routeChangeError", finish);
    return () => {
      router.events.off("routeChangeStart", start);
      router.events.off("routeChangeComplete", finish);
      router.events.off("routeChangeError", finish);
      if (skeletonTimer) clearTimeout(skeletonTimer);
    };
  }, [router.events]);

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {active && (
          <m.div
            key="route-progress-bar"
            className="fixed top-0 left-0 z-[100] h-[3px] bg-primary"
            initial={{ width: "0%", opacity: 1 }}
            animate={{ width: "90%" }}
            exit={{ width: "100%", opacity: 0 }}
            transition={{
              width: { duration: 8, ease: "easeOut" },
              opacity: { duration: 0.25, delay: 0.1 },
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {skeletonVisible && (
          <m.div
            key="route-skeleton"
            // z-40 keeps the skeleton BELOW the persistent nav (z-50) so the
            // navbar stays visible while the next page loads.
            className="fixed inset-0 z-40 overflow-y-auto bg-cream"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            aria-hidden
          >
            {resolveSkeleton(skeletonPath)}
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
