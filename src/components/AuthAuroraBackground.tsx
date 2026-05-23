import type { CSSProperties } from "react";
import { DEFAULT_PALETTE, type MeshPalette } from "@/lib/weatherPalette";

/**
 * Silk-wave backdrop for the auth pages: layered SVG wave bands that flow
 * horizontally over a SOLID tinted base (no gradient look). Palette-driven, so
 * weather/time-of-day still tints the waves. Same `{ palette }` contract as the
 * other auth backgrounds — drop-in swap. Motion via SMIL translate (seamless
 * one-tile loop), softened with a light CSS blur.
 */

// Build a tiling sine wave (period 720) across 3 tiles so a -720 translate loops seamlessly.
function wavePath(baseline: number, amp: number): string {
  const seg = (x: number) =>
    ` C ${x + 120},${baseline - amp} ${x + 240},${baseline + amp} ${x + 360},${baseline}` +
    ` C ${x + 480},${baseline - amp} ${x + 600},${baseline + amp} ${x + 720},${baseline}`;
  let d = `M0,${baseline}`;
  for (let x = 0; x < 2160; x += 720) d += seg(x);
  return d + ` L2160,900 L0,900 Z`;
}

interface Wave {
  varName: string;
  baseline: number;
  amp: number;
  opacity: number;
  dur: number;
  reverse?: boolean;
}

const WAVES: Wave[] = [
  { varName: "--a-c1", baseline: 230, amp: 55, opacity: 0.55, dur: 24 },
  { varName: "--a-c2", baseline: 360, amp: 70, opacity: 0.5, dur: 30, reverse: true },
  { varName: "--a-c3", baseline: 500, amp: 60, opacity: 0.45, dur: 27 },
  { varName: "--a-c4", baseline: 640, amp: 80, opacity: 0.6, dur: 34, reverse: true },
];

export function AuthAuroraBackground({
  className = "",
  palette = DEFAULT_PALETTE,
}: {
  className?: string;
  palette?: MeshPalette;
}) {
  const vars = {
    "--a-c1": palette.c1,
    "--a-c2": palette.c2,
    "--a-c3": palette.c3,
    "--a-c4": palette.c4,
    backgroundColor: palette.baseTo,
  } as CSSProperties;

  return (
    <div
      aria-hidden
      style={vars}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        style={{ filter: "blur(6px)" }}
      >
        {WAVES.map((w, i) => (
          <g key={i} style={{ mixBlendMode: "multiply" }}>
            <path d={wavePath(w.baseline, w.amp)} style={{ fill: `var(${w.varName})` }} opacity={w.opacity} />
            <animateTransform
              attributeName="transform"
              type="translate"
              from={w.reverse ? "-720 0" : "0 0"}
              to={w.reverse ? "0 0" : "-720 0"}
              dur={`${w.dur}s`}
              repeatCount="indefinite"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
