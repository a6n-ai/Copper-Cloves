// Shared class-capacity fill signal so every schedule card reads the same:
// filling/full = green (sage), under-filled = red (destructive), middle = terracotta.
// Single source of truth for thresholds + brand tone classes (no amber — design.md).

export type FillTier = "high" | "mid" | "low" | "none";

export function classFillPct(enrolled: number, capacity: number): number {
  if (!capacity || capacity <= 0) return 0;
  return Math.min(100, Math.round((enrolled / capacity) * 100));
}

export function classFillTier(enrolled: number, capacity: number): FillTier {
  if (!capacity || capacity <= 0) return "none";
  const pct = (enrolled / capacity) * 100;
  if (pct >= 50) return "high"; // half-full or more = filling up → green
  if (pct <= 33) return "low"; // a third or less = needs attention → red
  return "mid"; // 34–49% → terracotta
}

// Tailwind classes per tier. Green = filling up; everything else stays neutral
// (no alarming red by default — a half-empty class is the normal resting state).
export const FILL_TEXT: Record<FillTier, string> = {
  high: "text-sage",
  mid: "text-charcoal/60",
  low: "text-charcoal/60",
  none: "text-charcoal/60",
};

export const FILL_BAR: Record<FillTier, string> = {
  high: "bg-sage",
  mid: "bg-charcoal/25",
  low: "bg-charcoal/25",
  none: "bg-charcoal/20",
};

// Subtle surface shade for cards that have NO competing status tone (instructor /
// schedule / portal cards). Do NOT layer on cards already tinted by status.
export const FILL_SHADE: Record<FillTier, string> = {
  high: "border-sage/30 bg-sage/5",
  mid: "border-terracotta/25 bg-terracotta/5",
  low: "border-destructive/30 bg-destructive/5",
  none: "border-border bg-white-warm",
};

// Whole-card fill — the card body carries the signal so no thin outline can clip.
// Only a filling-up class gets a green wash; the rest are the normal white-warm
// surface (no red by default). Full borders only — no side-stripe.
export const FILL_CARD: Record<FillTier, string> = {
  high: "border-sage/40 bg-sage/[0.12]",
  mid: "border-border bg-white-warm",
  low: "border-border bg-white-warm",
  none: "border-border bg-white-warm",
};
