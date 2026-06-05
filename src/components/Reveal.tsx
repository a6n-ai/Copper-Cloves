import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger offset in ms when several Reveals share a row. */
  delay?: number;
}

/**
 * Scroll-reveal wrapper. Fades + lifts its children in the first time they
 * enter the viewport, then disconnects.
 *
 * Follows Emil Kowalski's animation principles:
 * - Animates only `opacity` + `transform` (GPU, no layout/CLS).
 * - CSS transition (off main thread) rather than a JS rAF loop — stays smooth
 *   even while the page is still hydrating.
 * - Strong custom ease-out curve; entrance-length 600ms.
 * - `once` via IntersectionObserver disconnect; reveals immediately if IO is
 *   unavailable so content is never stuck hidden.
 * - Movement is gated behind `motion-safe:` — reduced-motion users see the
 *   content with no transform and no fade-in.
 */
export function Reveal({ children, className = "", delay = 0 }: Readonly<RevealProps>) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -100px 0px", threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-revealed={revealed}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={
        "motion-safe:transition-[opacity,transform] motion-safe:duration-600 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)] " +
        "motion-safe:data-[revealed=false]:translate-y-4 motion-safe:data-[revealed=false]:opacity-0 " +
        "data-[revealed=true]:translate-y-0 data-[revealed=true]:opacity-100 " +
        className
      }
    >
      {children}
    </div>
  );
}
