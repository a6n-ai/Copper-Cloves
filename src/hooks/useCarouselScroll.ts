import { useCallback, useRef, useState } from "react";

/**
 * Horizontal-carousel scroll controller. Tracks scroll position so the UI can
 * disable the prev/next controls at the ends and render a progress affordance.
 *
 * Uses a CALLBACK ref (not useRef + useEffect): the track is often rendered
 * conditionally after async data loads, so an effect keyed on mount would
 * attach its scroll listener to a node that doesn't exist yet. The callback
 * ref fires exactly when the real node mounts/unmounts.
 *
 * Scrolling uses native `scrollTo({ behavior: "smooth" })` so it cooperates
 * with CSS scroll-snap. A hand-rolled rAF loop that writes `scrollLeft` fights
 * the snap engine and produces visible jitter.
 */
export function useCarouselScroll() {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState({ atStart: true, atEnd: false, progress: 0 });

  const measure = useCallback(() => {
    const el = nodeRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft;
    setState({
      atStart: left <= 1,
      atEnd: max <= 1 || left >= max - 1,
      progress: max > 0 ? Math.min(1, Math.max(0, left / max)) : 0,
    });
  }, []);

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      nodeRef.current = node;
      if (!node) return;
      measure();
      node.addEventListener("scroll", measure, { passive: true });
      const ro = new ResizeObserver(measure);
      ro.observe(node);
      cleanupRef.current = () => {
        node.removeEventListener("scroll", measure);
        ro.disconnect();
      };
    },
    [measure],
  );

  const scrollBy = useCallback((direction: "left" | "right", amount: number) => {
    const el = nodeRef.current;
    if (!el) return;
    el.scrollTo({
      left: el.scrollLeft + (direction === "right" ? amount : -amount),
      behavior: "smooth",
    });
  }, []);

  return { ref, scrollBy, measure, ...state };
}
