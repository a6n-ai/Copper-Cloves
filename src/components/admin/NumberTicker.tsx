"use client";

import { useEffect, useRef, useState } from "react";

type NumberTickerProps = {
  end: number;
  start?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
};

export function NumberTicker({
  end,
  start = 0,
  duration = 1.2,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: Readonly<NumberTickerProps>) {
  const [value, setValue] = useState(start);
  const startTimeRef = useRef<number | null>(null);
  const fromRef = useRef(start);
  // Tracks the latest animated value so the next animation can pick up from it
  // without reading the stale render-time `value` snapshot.
  const currentRef = useRef(start);

  useEffect(() => {
    let frame: number;
    fromRef.current = currentRef.current;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      startTimeRef.current ??= timestamp;
      const progress = timestamp - startTimeRef.current;
      const percent = Math.min(progress / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - percent, 3);
      const next = fromRef.current + (end - fromRef.current) * eased;
      currentRef.current = next;
      setValue(next);
      if (percent < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [end, duration]);

  const formatted = value.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export default NumberTicker;
