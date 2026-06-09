import type { PillProps } from "@/components/ui/pill"

type PillSpec = Pick<PillProps, "tone" | "brand" | "appearance">

// Generic status string -> pill tone + pulse + display label.
// Replaces the legacy `statusPillProps` from the removed StatusPill component.
export function statusPill(status: string | null | undefined): {
  tone: NonNullable<PillProps["tone"]>
  pulse: boolean
  label: string
} {
  const s = (status ?? "").toLowerCase()
  switch (s) {
    case "available":
    case "active":
    case "open":
      return { tone: "success", pulse: true, label: capitalize(s) }
    case "started":
    case "live":
    case "in_progress":
      return { tone: "warning", pulse: true, label: "Live" }
    case "pending":
    case "paused":
      return { tone: "warning", pulse: false, label: capitalize(s) }
    case "inactive":
    case "deactivated":
    case "disabled":
    case "blocked":
      return { tone: "danger", pulse: false, label: capitalize(s) }
    case "completed":
    case "archived":
    case "ended":
      return { tone: "neutral", pulse: false, label: capitalize(s) }
    case "cancelled":
    case "canceled":
    case "abandoned":
    case "failed":
    case "rejected":
      return { tone: "danger", pulse: false, label: capitalize(s) }
    default:
      return { tone: "neutral", pulse: false, label: s ? capitalize(s) : "—" }
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ")
}

// Booking status -> pill
export function bookingStatusPill(status: string): PillSpec {
  switch (status) {
    case "confirmed":
    case "checked_in":
      return { tone: "success" }
    case "pending":
      return { tone: "warning" }
    case "no_show":
    case "cancelled":
      return { tone: "danger" }
    case "completed":
      return { tone: "info" }
    default:
      return { tone: "neutral" }
  }
}

// Class schedule status -> pill
export function classStatusPill(status: string): PillSpec {
  switch (status) {
    case "available":
    case "started":
      return { tone: "success" }
    case "completed":
      return { tone: "info" }
    case "cancelled":
    case "abandoned":
      return { tone: "danger" }
    default:
      return { tone: "neutral" }
  }
}

// Member ticket status -> pill
export function ticketStatusPill(status: string): PillSpec {
  switch (status) {
    case "resolved":
      return { tone: "success" }
    case "in_review":
      return { tone: "warning" }
    case "open":
      return { tone: "info" }
    default:
      return { tone: "neutral" }
  }
}

// Member account status -> pill
export function memberStatusPill(status: string): PillSpec {
  const s = status.toLowerCase()
  if (s.includes("expir") && s.includes("ing")) return { tone: "warning" }
  switch (s) {
    case "active":
      return { tone: "success" }
    case "expiring":
    case "expiring_soon":
      return { tone: "warning" }
    case "expired":
    case "inactive":
      return { tone: "danger" }
    default:
      return { tone: "neutral" }
  }
}

// Pass type / tier -> pill (tiered by value)
export function passTypePill(type: string): PillSpec & { label?: string } {
  const t = type.toLowerCase()
  if (t.includes("studio")) return { tone: "success", appearance: "solid" }
  if (t.includes("unlimited")) return { tone: "warning" }
  if (t.includes("class")) return { tone: "info" }
  if (t.includes("none") || t.includes("no pass") || t === "") return { tone: "neutral" }
  return { tone: "info" }
}

// Finance transaction kind -> pill
export function financeKindPill(kind: string): PillSpec {
  const k = kind.toLowerCase()
  if (k.includes("package") || k.includes("pass") || k.includes("subscription")) return { tone: "info" }
  if (k.includes("booking") || k.includes("class")) return { tone: "success" }
  if (k.includes("cafe") || k.includes("café") || k.includes("food")) return { tone: "warning" }
  if (k.includes("retail") || k.includes("boutique") || k.includes("shop")) return { tone: "neutral" }
  if (k.includes("refund")) return { tone: "danger" }
  return { tone: "neutral" }
}

// Payment method (PaymentMethod enum) -> pill + label
export function paymentMethodPill(method: string): PillSpec & { label: string } {
  switch (method) {
    case "razorpay_online":
    case "razorpay_completed":
      return { brand: "razorpay", label: "Razorpay" }
    case "pine_lab_card":
      return { brand: "pinelabs", label: "Pine Labs Card" }
    case "pine_lab_upi":
      return { brand: "pinelabs", label: "Pine Labs UPI" }
    case "direct_upi":
      return { brand: "upi", label: "UPI" }
    case "cash":
      return { tone: "success", label: "Cash" }
    default:
      return { tone: "neutral", label: method }
  }
}
