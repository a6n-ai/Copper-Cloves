// Single source of truth for filter-control look + feel, so every filter
// (search, select, combobox, date-range, date) hovers, animates, and focuses
// identically. Brand: sage only — no terracotta, no white hover text.
//
// Hover = subtle bg tint + border + lift + soft shadow (design.md "Lifted").
// The `!` on text/bg overrides the shadcn outline Button variant, which would
// otherwise force terracotta bg + white text on hover.
export const FILTER_TRIGGER =
  "h-9 w-full font-body font-normal border-sage/20 bg-white-warm text-charcoal " +
  "transition-all duration-200 ease-out " +
  "hover:bg-sage/5! hover:text-charcoal! hover:border-sage/40 hover:-translate-y-0.5 " +
  "hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)] " +
  "focus-visible:ring-2 focus-visible:ring-sage/30 focus-visible:ring-offset-0";
