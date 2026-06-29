"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { format } from "date-fns";

import { Pill } from "@/components/ui/pill";
import { memberStatusPill } from "@/lib/pillMaps";

const MAX_TILT = 8; // degrees — gentler than the medal; a card is held flatter.

// ---------------------------------------------------------------------------
// Tier resolution
// ---------------------------------------------------------------------------
// One layout, per-tier finish. Class passes read cooler/lighter (sage on cream);
// studio / unlimited read richer/metallic (terracotta copper). Within each family
// the surface ramps by value (1-day → 12-month) exactly like the medal tiers.

type Family = "class" | "studio";
type Level = 0 | 1 | 2 | 3;

interface PassVariant {
  family: Family;
  level: Level;
  /** Tier wordmark shown above the package name. */
  tierLabel: string;
  /** Composed CSS background for the card face. */
  background: string;
  /** Ink colour for all card copy. */
  ink: string;
  /** Soft ink for secondary copy. */
  inkMuted: string;
  /** Accent used for the chip + hairlines. */
  accent: string;
  /** Border colour for the card edge. */
  border: string;
  /** Metallic faces get the moving sheen sweep. */
  metallic: boolean;
}

// Brand palette only (.llm/design.md). No off-palette, no pure white/black.
const CREAM = "#f5f2ea";
const CHARCOAL = "#333333";
const SAGE = "#8f9779";
const TERRACOTTA = "#c17856";

function levelFrom(durationMonths?: number | null, price?: number | null): Level {
  const m = durationMonths ?? 0;
  if (m >= 12) return 3;
  if (m >= 6) return 2;
  if (m >= 3) return 1;
  if (m >= 1) return 0;
  // No duration signal — fall back to price (paise- or rupee-agnostic ramp).
  const p = price ?? 0;
  if (p >= 20000) return 3;
  if (p >= 10000) return 2;
  if (p >= 4000) return 1;
  return 0;
}

// Cooler / lighter sage face for class passes — lightened toward cream for the
// lower tiers, deepening as value climbs. Stays light enough for charcoal ink.
function classBackground(level: Level): string {
  const lighten = [60, 46, 34, 24][level]; // % cream blended in
  const light = `color-mix(in oklab, ${SAGE}, ${CREAM} ${lighten}%)`;
  const deep = `color-mix(in oklab, ${SAGE}, ${CHARCOAL} 12%)`;
  return [
    "radial-gradient(120% 130% at 16% 12%, rgba(255,255,255,0.55), rgba(255,255,255,0) 46%)",
    `linear-gradient(135deg, ${light} 0%, ${SAGE} 58%, ${deep} 100%)`,
  ].join(", ");
}

// Richer / metallic terracotta-copper face for studio / unlimited passes. Conic
// brushed-metal sweep (mirrors Medal.buildFaceBg), deepening with tier.
function studioBackground(level: Level): string {
  const darken = [14, 20, 26, 32][level];
  const base = `color-mix(in oklab, ${TERRACOTTA}, ${CHARCOAL} ${darken}%)`;
  return [
    "radial-gradient(circle at 26% 16%, rgba(255,255,255,0.42), rgba(255,255,255,0) 44%)",
    `conic-gradient(from 210deg, color-mix(in oklab, ${base}, #ffffff 30%), color-mix(in oklab, ${base}, #000000 24%) 22%, ${base} 50%, color-mix(in oklab, ${base}, #000000 24%) 74%, color-mix(in oklab, ${base}, #ffffff 30%))`,
  ].join(", ");
}

interface DeriveArgs {
  is_unlimited?: boolean | null;
  price?: number | null;
  duration_months?: number | null;
  name?: string | null;
}

export function derivePassVariant({ is_unlimited, price, duration_months, name }: DeriveArgs): PassVariant {
  const n = (name ?? "").toLowerCase();
  const isStudio = Boolean(is_unlimited) || n.includes("studio") || n.includes("unlimited");
  const level = levelFrom(duration_months, price);

  if (isStudio) {
    return {
      family: "studio",
      level,
      tierLabel: is_unlimited || n.includes("unlimited") ? "Studio · Unlimited" : "Studio Pass",
      background: studioBackground(level),
      ink: CREAM,
      inkMuted: "color-mix(in oklab, #f5f2ea, transparent 28%)",
      accent: "color-mix(in oklab, #f5f2ea, #c17856 18%)",
      border: "color-mix(in oklab, #f5f2ea, transparent 78%)",
      metallic: true,
    };
  }

  return {
    family: "class",
    level,
    tierLabel: "Class Pass",
    background: classBackground(level),
    ink: CHARCOAL,
    inkMuted: "color-mix(in oklab, #333333, transparent 38%)",
    accent: "color-mix(in oklab, #8f9779, #333333 22%)",
    border: "color-mix(in oklab, #333333, transparent 88%)",
    metallic: false,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// Stylised EMV chip glyph (rounded contacts grid) — drawn, never an emoji.
function ChipGlyph({ accent }: Readonly<{ accent: string }>) {
  return (
    <svg width="40" height="30" viewBox="0 0 40 30" aria-hidden="true" className="shrink-0">
      <rect x="1" y="1" width="38" height="28" rx="5" fill={accent} opacity="0.9" />
      <rect x="1" y="1" width="38" height="28" rx="5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
      <g stroke="rgba(51,51,51,0.35)" strokeWidth="1.1">
        <line x1="14" y1="1" x2="14" y2="29" />
        <line x1="26" y1="1" x2="26" y2="29" />
        <line x1="1" y1="10" x2="39" y2="10" />
        <line x1="1" y1="20" x2="39" y2="20" />
      </g>
    </svg>
  );
}

// Earned-only moving highlight for metallic faces; honours reduced-motion.
function MetallicSheen({ reduce }: Readonly<{ reduce: boolean }>) {
  if (reduce) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      <motion.div
        className="absolute -inset-y-4 w-1/3"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.42), transparent)",
          rotate: "16deg",
        }}
        initial={{ x: "-160%" }}
        animate={{ x: "320%" }}
        transition={{ duration: 2.8, ease: "easeInOut", repeat: Infinity, repeatDelay: 4 }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PassCard
// ---------------------------------------------------------------------------

export interface PassCardProps {
  /** Package / pass name (e.g. "12 Month Studio Pass"). */
  name: string;
  /** Unlimited passes show ∞ and drive the metallic tier. */
  isUnlimited?: boolean | null;
  /** Classes left on a finite pass. Ignored when `isUnlimited`. */
  classesRemaining?: number | null;
  /** Pass price (for tier ramp + display); rupees or paise — only relative size matters for the ramp. */
  price?: number | null;
  /** Validity window in months (primary tier signal). */
  durationMonths?: number | null;
  /** Expiry date — string, Date, or null for non-expiring. */
  expiry?: string | Date | null;
  /** Account/pass status: active | expiring | expired | paused. Drives the status pill. */
  status: string;
  /** Pointer-tilt parallax. Disabled automatically under reduced-motion. */
  interactive?: boolean;
  className?: string;
}

/**
 * Credit-card-styled view of a member's pass. One layout; per-tier colour/finish
 * derived from { isUnlimited, price, durationMonths, name } (class passes read
 * cooler/lighter, studio/unlimited richer/metallic, ramping by value like the
 * medal tiers). Brand palette only; honours `prefers-reduced-motion`.
 *
 * Example:
 *   <PassCard
 *     name="12 Month Studio Pass"
 *     isUnlimited
 *     durationMonths={12}
 *     price={36000}
 *     expiry="2027-06-30"
 *     status="active"
 *   />
 *   <PassCard
 *     name="10 Class Pass"
 *     classesRemaining={4}
 *     durationMonths={2}
 *     price={6000}
 *     expiry="2026-08-15"
 *     status="expiring"
 *   />
 */
export function PassCard({
  name,
  isUnlimited = false,
  classesRemaining,
  price,
  durationMonths,
  expiry,
  status,
  interactive = true,
  className,
}: PassCardProps) {
  const reduce = useReducedMotion();
  const [p, setP] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);

  const v = derivePassVariant({
    is_unlimited: isUnlimited,
    price,
    duration_months: durationMonths,
    name,
  });

  const tiltOn = interactive && !reduce;
  const rotX = tiltOn ? -p.y * MAX_TILT : 0;
  const rotY = tiltOn ? p.x * MAX_TILT : 0;

  const expiryLabel = (() => {
    if (!expiry) return "No expiry";
    const d = expiry instanceof Date ? expiry : new Date(expiry);
    return Number.isNaN(d.getTime()) ? "No expiry" : format(d, "dd MMM yyyy");
  })();

  const classesValue = isUnlimited ? "∞" : String(classesRemaining ?? 0);
  const classesSuffix = isUnlimited ? "Unlimited Classes" : "classes left";

  const statusPill = memberStatusPill(status);
  const statusLabel = status
    ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")
    : "—";

  return (
    <div className={className} style={{ perspective: 1000 }}>
      <motion.div
        onPointerMove={
          tiltOn
            ? (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setP({
                  x: (e.clientX - rect.left) / rect.width - 0.5,
                  y: (e.clientY - rect.top) / rect.height - 0.5,
                });
                setHovering(true);
              }
            : undefined
        }
        onPointerLeave={
          tiltOn
            ? () => {
                setHovering(false);
                setP({ x: 0, y: 0 });
              }
            : undefined
        }
        className="relative aspect-[1.586/1] w-full max-w-sm overflow-hidden rounded-2xl p-5"
        style={{
          background: v.background,
          color: v.ink,
          border: `1px solid ${v.border}`,
          transformStyle: "preserve-3d",
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transition: hovering ? "none" : "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s ease-out",
          boxShadow: hovering
            ? "0 8px 48px rgba(51,51,51,0.18)"
            : "0 4px 24px rgba(51,51,51,0.08)",
        }}
      >
        {v.metallic ? <MetallicSheen reduce={!!reduce} /> : null}

        {/* Top row: chip + brand wordmark */}
        <div className="relative flex items-start justify-between">
          <ChipGlyph accent={v.accent} />
          <span
            className="font-body font-semibold text-sm leading-none tracking-wide"
            style={{ color: v.ink }}
          >
            The Studio
          </span>
        </div>

        {/* Tier + package name */}
        <div className="relative mt-4">
          <span
            className="font-body text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: v.inkMuted }}
          >
            {v.tierLabel}
          </span>
          <p className="font-body text-base font-semibold leading-tight" style={{ color: v.ink }}>
            {name}
          </p>
        </div>

        {/* Classes remaining */}
        <div className="relative mt-3 flex items-baseline gap-2">
          <span className="font-body font-semibold text-3xl leading-none tabular-nums" style={{ color: v.ink }}>
            {classesValue}
          </span>
          <span className="font-body text-xs" style={{ color: v.inkMuted }}>
            {classesSuffix}
          </span>
        </div>

        {/* Bottom row: expiry + status */}
        <div className="relative mt-4 flex items-end justify-between">
          <div className="flex flex-col">
            <span
              className="font-body text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: v.inkMuted }}
            >
              Valid until
            </span>
            <span className="font-body text-sm" style={{ color: v.ink }}>
              {expiryLabel}
            </span>
          </div>
          <Pill {...statusPill} size="sm">
            {statusLabel}
          </Pill>
        </div>
      </motion.div>
    </div>
  );
}

export default PassCard;
