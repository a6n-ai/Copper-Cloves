"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const MAX_TILT = 16; // degrees
// Pointy-top hexagon clip for the faces (box-relative).
const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

export interface MedalProps {
  icon?: string | null;
  color: string;
  /** 0–100 ring fill. Earned medals pass 100. */
  pct?: number;
  /** Earned → metallic in the badge colour. Not earned → coin outline, accent only on the progress edge. */
  earned?: boolean;
  diameter: number;
  stroke: number;
  fontSize: number;
  /** Pointer-tilt parallax (disabled when flippable). */
  interactive?: boolean;
  /** Slow idle shine sweep (hero medals). */
  shimmer?: boolean;
  /** When set on an earned medal, the medal flips on tap to show this on the back. */
  flipLabel?: string | null;
}

/**
 * Pseudo-3D metallic hexagonal medal (Apple-Fitness feel, no WebGL). The face is a
 * clip-path hexagon with a brushed-metal gradient; a matching hexagonal SVG stroke
 * carries the progress / coin outline. Earned medals tilt + flip to the name;
 * locked medals show a hex outline with a ghosted emoji. Honours reduced-motion.
 */
export function Medal({
  icon,
  color,
  pct = 100,
  earned = true,
  diameter,
  stroke,
  fontSize,
  interactive = true,
  shimmer = false,
  flipLabel,
}: MedalProps) {
  const reduce = useReducedMotion();
  const [p, setP] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const flippable = !!flipLabel && earned;
  const tiltOn = interactive && !reduce && !flippable;

  // Hexagon geometry for the SVG stroke (inset by half the stroke so it isn't clipped).
  const pad = stroke / 2 + 1;
  const cx = diameter / 2;
  const q = diameter * 0.25;
  const pts: [number, number][] = [
    [cx, pad],
    [diameter - pad, q],
    [diameter - pad, diameter - q],
    [cx, diameter - pad],
    [pad, diameter - q],
    [pad, q],
  ];
  const pointsStr = pts.map((pt) => pt.join(",")).join(" ");
  const perim = pts.reduce((sum, pt, i) => {
    const n = pts[(i + 1) % pts.length];
    return sum + Math.hypot(n[0] - pt[0], n[1] - pt[1]);
  }, 0);
  const clamped = Math.min(100, Math.max(0, pct));
  const dashOffset = perim * (1 - clamped / 100);

  const faceBg = `radial-gradient(circle at 30% 22%, rgba(255,255,255,0.8), rgba(255,255,255,0) 44%), conic-gradient(from 215deg, color-mix(in oklab, ${color} 44%, white), color-mix(in oklab, ${color} 88%, black) 22%, ${color} 48%, color-mix(in oklab, ${color} 88%, black) 72%, color-mix(in oklab, ${color} 44%, white))`;

  // Front face layers (metallic / outline hexagon + progress stroke + emoji + highlight).
  const face = (
    <>
      {earned ? (
        <div className="absolute inset-0" style={{ background: faceBg, clipPath: HEX_CLIP }} />
      ) : null}
      <svg className="absolute inset-0" width={diameter} height={diameter} aria-hidden="true">
        <polygon points={pointsStr} fill="none" stroke="rgba(51,51,51,0.16)" strokeWidth={stroke} strokeLinejoin="round" />
        {reduce ? (
          <polygon
            points={pointsStr}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={perim}
            strokeDashoffset={dashOffset}
          />
        ) : (
          <motion.polygon
            points={pointsStr}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={perim}
            initial={{ strokeDashoffset: perim }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center" style={{ transform: "translateZ(1px)" }}>
        <span
          className="leading-none"
          style={{
            fontSize,
            textShadow: earned ? "0 1px 1px rgba(255,255,255,0.6), 0 -1px 2px rgba(51,51,51,0.25)" : "none",
            opacity: earned ? 1 : 0.35,
            filter: earned ? undefined : "grayscale(1)",
          }}
        >
          {icon ?? "🏆"}
        </span>
      </div>
      {earned ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            clipPath: HEX_CLIP,
            background: "linear-gradient(125deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 38%)",
            transform: `translate(${p.x * 26}%, ${p.y * 26}%)`,
            mixBlendMode: "screen",
            transition: hovering ? "none" : "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        />
      ) : null}
      {shimmer && earned && !reduce ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ clipPath: HEX_CLIP }}>
          <motion.div
            className="absolute -inset-y-2 w-1/3"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)", rotate: "18deg" }}
            initial={{ x: "-180%" }}
            animate={{ x: "320%" }}
            transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 3.5 }}
          />
        </div>
      ) : null}
    </>
  );

  // Flip-card: front hexagon ↔ back hexagon with the badge name.
  if (flippable) {
    return (
      // drop-shadow lives on this wrapper, NOT the preserve-3d element — a filter on
      // the 3D element would flatten the context and kill the backface flip.
      <div className="shrink-0" style={{ perspective: diameter * 4, filter: "drop-shadow(0 8px 12px rgba(51,51,51,0.22))" }}>
        <button
          type="button"
          aria-label={flipped ? `${flipLabel} — show badge` : `${flipLabel} — show name`}
          onClick={() => setFlipped((v) => !v)}
          className="relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          style={{
            width: diameter,
            height: diameter,
            transformStyle: "preserve-3d",
            transition: "transform 0.55s cubic-bezier(0.2, 0.8, 0.2, 1)",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
            {face}
          </div>
          <div
            className="absolute inset-0 flex items-center justify-center p-2 text-center"
            style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden", background: faceBg, clipPath: HEX_CLIP }}
          >
            <span
              className="font-display leading-tight text-charcoal"
              style={{ fontSize: Math.max(10, Math.round(diameter * 0.15)), textShadow: "0 1px 1px rgba(255,255,255,0.5)" }}
            >
              {flipLabel}
            </span>
          </div>
        </button>
      </div>
    );
  }

  const rotX = -p.y * MAX_TILT;
  const rotY = p.x * MAX_TILT;

  return (
    <div className="shrink-0" style={{ perspective: diameter * 4 }}>
      <div
        onPointerMove={
          tiltOn
            ? (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setP({ x: (e.clientX - rect.left) / rect.width - 0.5, y: (e.clientY - rect.top) / rect.height - 0.5 });
                setHovering(true);
              }
            : undefined
        }
        onPointerLeave={tiltOn ? () => { setHovering(false); setP({ x: 0, y: 0 }); } : undefined}
        className="relative"
        style={{
          width: diameter,
          height: diameter,
          transformStyle: "preserve-3d",
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transition: hovering ? "none" : "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
          filter: earned ? "drop-shadow(0 8px 12px rgba(51,51,51,0.22))" : "none",
        }}
      >
        {face}
      </div>
    </div>
  );
}
