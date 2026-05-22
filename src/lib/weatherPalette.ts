/**
 * Mesh-gradient palette mapping for the auth pages, driven by time-of-day and
 * weather. Time-of-day is the primary driver (dawn → night); dramatic weather
 * (rain/snow/storm/fog) overrides it. Shared by /api/weather (server) and
 * useAuthWeather (client) — keep it dependency-free. All palettes stay
 * light-luminance so charcoal text on the auth panels keeps contrast.
 */

export type WeatherCondition = "clear" | "clouds" | "fog" | "rain" | "snow" | "storm";
export type TimeOfDay = "dawn" | "morning" | "midday" | "afternoon" | "dusk" | "night";

export interface MeshPalette {
  /** four radial-gradient / blob colors (rgba with alpha) */
  c1: string;
  c2: string;
  c3: string;
  c4: string;
  /** linear base gradient endpoints (opaque) */
  baseFrom: string;
  baseTo: string;
}

/** On-brand default — used before weather loads or when it's unavailable. */
export const DEFAULT_PALETTE: MeshPalette = {
  c1: "rgba(143, 151, 121, 0.55)",
  c2: "rgba(193, 120, 86, 0.45)",
  c3: "rgba(51, 51, 51, 0.35)",
  c4: "rgba(232, 228, 217, 0.70)",
  baseFrom: "#f7f5ef",
  baseTo: "#e8e4d9",
};

/** Weather palettes — only used for conditions that dominate the sky's mood. */
const WEATHER_PALETTES: Record<"fog" | "rain" | "snow" | "storm", MeshPalette> = {
  fog: {
    c1: "rgba(180, 184, 176, 0.50)",
    c2: "rgba(200, 196, 188, 0.45)",
    c3: "rgba(150, 154, 150, 0.30)",
    c4: "rgba(232, 230, 226, 0.75)",
    baseFrom: "#f3f3f0",
    baseTo: "#e8e7e3",
  },
  rain: {
    c1: "rgba(120, 140, 135, 0.50)",
    c2: "rgba(96, 124, 150, 0.50)",
    c3: "rgba(70, 90, 110, 0.35)",
    c4: "rgba(220, 226, 228, 0.70)",
    baseFrom: "#eef2f3",
    baseTo: "#dde6e8",
  },
  snow: {
    c1: "rgba(150, 180, 200, 0.45)",
    c2: "rgba(200, 214, 224, 0.55)",
    c3: "rgba(120, 150, 175, 0.30)",
    c4: "rgba(240, 244, 248, 0.80)",
    baseFrom: "#f4f8fb",
    baseTo: "#e6eef4",
  },
  storm: {
    c1: "rgba(110, 118, 130, 0.55)",
    c2: "rgba(150, 120, 150, 0.45)",
    c3: "rgba(80, 86, 104, 0.40)",
    c4: "rgba(214, 216, 222, 0.70)",
    baseFrom: "#eeeef2",
    baseTo: "#dedee6",
  },
};

/** Time-of-day palettes — the primary driver for clear / cloudy skies. */
const TOD_PALETTES: Record<TimeOfDay, MeshPalette> = {
  dawn: {
    c1: "rgba(143, 151, 121, 0.45)",
    c2: "rgba(232, 168, 146, 0.50)",
    c3: "rgba(206, 178, 206, 0.38)",
    c4: "rgba(240, 230, 222, 0.72)",
    baseFrom: "#fcf4ee",
    baseTo: "#f4e8df",
  },
  morning: {
    c1: "rgba(143, 151, 121, 0.55)",
    c2: "rgba(180, 196, 150, 0.45)",
    c3: "rgba(214, 200, 150, 0.40)",
    c4: "rgba(236, 232, 222, 0.72)",
    baseFrom: "#f9f8f0",
    baseTo: "#eef0e2",
  },
  midday: {
    c1: "rgba(150, 160, 128, 0.50)",
    c2: "rgba(214, 190, 120, 0.45)",
    c3: "rgba(193, 120, 86, 0.35)",
    c4: "rgba(238, 234, 224, 0.74)",
    baseFrom: "#fbf9f1",
    baseTo: "#f1ecdc",
  },
  afternoon: {
    c1: "rgba(193, 120, 86, 0.55)",
    c2: "rgba(225, 179, 99, 0.50)",
    c3: "rgba(143, 151, 121, 0.40)",
    c4: "rgba(238, 228, 212, 0.72)",
    baseFrom: "#fbf3e6",
    baseTo: "#f3e6d2",
  },
  dusk: {
    c1: "rgba(196, 140, 150, 0.50)",
    c2: "rgba(150, 134, 176, 0.45)",
    c3: "rgba(120, 124, 158, 0.35)",
    c4: "rgba(232, 226, 232, 0.72)",
    baseFrom: "#f6f0f3",
    baseTo: "#ece6ee",
  },
  night: {
    c1: "rgba(120, 124, 158, 0.50)",
    c2: "rgba(150, 140, 170, 0.40)",
    c3: "rgba(70, 72, 90, 0.35)",
    c4: "rgba(225, 224, 232, 0.70)",
    baseFrom: "#f1f0f5",
    baseTo: "#e4e3ec",
  },
};

export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour <= 7) return "dawn";
  if (hour >= 8 && hour <= 10) return "morning";
  if (hour >= 11 && hour <= 15) return "midday";
  if (hour >= 16 && hour <= 18) return "afternoon";
  if (hour >= 19 && hour <= 20) return "dusk";
  return "night";
}

/**
 * Resolve the active palette. Dramatic weather wins; otherwise the sky color
 * tracks the time of day (`hour` is the viewer's local 0–23 hour).
 */
export function paletteFor(condition: WeatherCondition, hour: number): MeshPalette {
  if (condition === "fog" || condition === "rain" || condition === "snow" || condition === "storm") {
    return WEATHER_PALETTES[condition];
  }
  return TOD_PALETTES[timeOfDay(hour)];
}

/** Map a WMO weather code (Open-Meteo `weather_code`) to a coarse condition. */
export function codeToCondition(code: number): WeatherCondition {
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "clouds";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "clouds";
}
