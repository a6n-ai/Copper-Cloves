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
}: NumberTickerProps) {
  const [value, setValue] = useState(start);
  const startTimeRef = useRef<number | null>(null);
  const fromRef = useRef(start);

  useEffect(() => {
    let frame: number;
    fromRef.current = value;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) startTimeRef.current = timestamp;
      const progress = timestamp - startTimeRef.current;
      const percent = Math.min(progress / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - percent, 3);
      setValue(fromRef.current + (end - fromRef.current) * eased);
      if (percent < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
