// Client-safe expense constants (no prisma import) so both the server lib and
// React components can share one source of truth for categories + styling.

export const EXPENSE_CATEGORIES = [
  "instructor_payout",
  "cafe_free_meal",
  "rent",
  "utilities",
  "supplies",
  "marketing",
  "maintenance",
  "refund",
  "other",
] as const;

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategoryValue, string> = {
  instructor_payout: "Instructor payout",
  cafe_free_meal: "Café free meal",
  rent: "Rent",
  utilities: "Utilities",
  supplies: "Supplies",
  marketing: "Marketing",
  maintenance: "Maintenance",
  refund: "Refund",
  other: "Other",
};

export type PillStyle = { bg: string; fg: string; border: string };

// Earthy categorical hues for the expense-category pill, in the brand family.
export function expenseCategoryStyle(category: string): PillStyle {
  switch (category) {
    case "instructor_payout":
      return { bg: "rgba(193,120,86,0.14)", fg: "#a05e38", border: "rgba(193,120,86,0.32)" }; // terracotta
    case "cafe_free_meal":
      return { bg: "rgba(176,138,62,0.16)", fg: "#866223", border: "rgba(176,138,62,0.34)" }; // ochre
    case "rent":
      return { bg: "rgba(108,94,140,0.12)", fg: "#6c5e8c", border: "rgba(108,94,140,0.30)" }; // violet
    case "utilities":
      return { bg: "rgba(51,149,255,0.10)", fg: "#1f6feb", border: "rgba(51,149,255,0.30)" }; // blue
    case "supplies":
      return { bg: "rgba(143,151,121,0.14)", fg: "#5f6b4f", border: "rgba(143,151,121,0.32)" }; // sage
    case "marketing":
      return { bg: "rgba(214,122,160,0.13)", fg: "#a8456f", border: "rgba(214,122,160,0.30)" }; // rose
    case "maintenance":
      return { bg: "rgba(120,130,140,0.13)", fg: "#566069", border: "rgba(120,130,140,0.30)" }; // slate-blue
    case "refund":
      return { bg: "rgba(178,74,58,0.12)", fg: "#9c4a36", border: "rgba(178,74,58,0.30)" }; // red
    default:
      return { bg: "rgba(51,51,51,0.06)", fg: "#5b5b5b", border: "rgba(51,51,51,0.15)" }; // neutral
  }
}
