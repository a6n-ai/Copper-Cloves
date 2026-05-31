/**
 * Single source of truth for status-badge colors across portals + admin.
 *
 * Every status pill (active / pending / expired / failed ...) routes through
 * one of four brand intents. No raw Tailwind blue/amber/yellow/green/purple/gray
 * status colors anywhere — those are off-palette for The Studio by Copper + Cloves.
 *
 *   success → sage           (active, confirmed, sent, live, open)
 *   pending → terracotta     (awaiting, scheduled, processing, upcoming)
 *   neutral → muted charcoal (expired, inactive, closed, shipped, abandoned)
 *   error   → deep terracotta(failed, cancelled, rejected, deducted)
 */
export type StatusIntent = "success" | "pending" | "neutral" | "error";

const TONE: Record<StatusIntent, string> = {
  success: "bg-sage/10 text-sage border border-sage/20",
  pending: "bg-terracotta/10 text-terracotta border border-terracotta/20",
  neutral: "bg-charcoal/10 text-charcoal/60 border border-charcoal/15",
  error: "bg-[#a05e38]/10 text-[#a05e38] border border-[#a05e38]/25",
};

/** Returns the brand classes for a status pill. */
export function statusTone(intent: StatusIntent): string {
  return TONE[intent];
}

/**
 * Maps a free-text status string to a brand intent. Unknown values fall back
 * to neutral. Keep the keyword lists here so new states stay on-palette by default.
 */
export function statusIntent(state: string | null | undefined): StatusIntent {
  const s = (state ?? "").toLowerCase().trim();
  if (
    /(active|confirmed|sent|live|open|success|paid|completed|approved|present|checked|delivered)/.test(
      s,
    )
  ) {
    return "success";
  }
  if (
    /(pending|awaiting|scheduled|processing|upcoming|in[\s_-]?review|hold|queued|draft)/.test(
      s,
    )
  ) {
    return "pending";
  }
  if (
    /(fail|error|cancel|reject|declin|deduct|no[\s_-]?show|abandon|closed|overdue|refund)/.test(
      s,
    )
  ) {
    return "error";
  }
  // expired / inactive / shipped / unknown → neutral
  return "neutral";
}

/** Convenience: state string straight to classes. */
export function statusToneFor(state: string | null | undefined): string {
  return statusTone(statusIntent(state));
}
