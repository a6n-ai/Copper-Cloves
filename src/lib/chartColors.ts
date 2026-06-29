// Recharts can't consume Tailwind classes, so charts need raw hex. These mirror
// the brand tokens in src/styles/globals.css (--sage/--terracotta/--sand/
// --charcoal + cream page bg + warm-red/slate-blue pill hues). Keep in sync with
// globals.css. NO #ffffff — pie strokes use cream (#f5f2ea, white-warm page bg).
export const chartColors = {
  sage: "#8f9779",
  terracotta: "#c17856",
  sand: "#e8e4d9",
  charcoal: "#333333",
  cream: "#f5f2ea",
  warmRed: "#cf5b48",
  slateBlue: "#5b7a91",
  // Ordered palette for multi-series charts (sage leads, terracotta accents).
  series: ["#8f9779", "#c17856", "#5b7a91", "#cf5b48", "#e8e4d9", "#333333"],
} as const

export type ChartColor = keyof typeof chartColors
