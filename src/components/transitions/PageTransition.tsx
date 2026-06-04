import { useRouter } from "next/router";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { useRef } from "react";

/**
 * Fade + lift transition for the public site body. The shared <Navigation>
 * lives OUTSIDE this wrapper (mounted once in _app), so the transform here can
 * never re-anchor the sticky/fixed header.
 *
 * `mode="wait"` runs exit-then-enter; `initial={false}` skips the animation on
 * first paint (SSG hydration) so the landing page doesn't fade in on load.
 *
 * On settle we hard-clear the transform: Framer leaves `transform: translateY(0px)`
 * at rest, and any lingering transform would still create a containing block for
 * descendant `position: fixed`/`sticky` elements (e.g. a page-local sticky CTA).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const nodeRef = useRef<HTMLDivElement>(null);

  // Key on the path WITHOUT the hash fragment: a same-page anchor jump
  // (e.g. `/rental#enquire`) must not look like a new route, or the whole
  // page replays the exit/enter transition on every in-page scroll link.
  const transitionKey = router.asPath.split("#")[0];

  if (reduce) {
    return (
      <LazyMotion features={domAnimation}>
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={transitionKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {children}
          </m.div>
        </AnimatePresence>
      </LazyMotion>
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={transitionKey}
          ref={nodeRef}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={(definition) => {
            // Strip the resting transform once the *enter* settles (y back to 0),
            // handing `position: fixed/sticky` containment back to the viewport.
            if ((definition as unknown as { y?: number })?.y === 0 && nodeRef.current) {
              nodeRef.current.style.transform = "none";
              nodeRef.current.style.willChange = "auto";
            }
          }}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
}
