/** Weather-aware greeting lines for the auth panels. Shared client/server-safe. */
import { timeOfDay, type WeatherCondition } from "@/lib/weatherPalette";

const CONDITION_LABEL: Record<WeatherCondition, string> = {
  clear: "Clear",
  clouds: "Cloudy",
  fog: "Foggy",
  rain: "Rainy",
  snow: "Snowy",
  storm: "Stormy",
};

const TOD_WORD: Record<string, string> = {
  dawn: "dawn",
  morning: "morning",
  midday: "midday",
  afternoon: "afternoon",
  dusk: "evening",
  night: "night",
};

/**
 * One-line TL;DR: condition + temp + day & time-of-day + place.
 * e.g. "Clear 24° · Friday morning in Bengaluru". Uses the viewer's local clock.
 */
export function weatherSummary(
  condition: WeatherCondition,
  tempC: number,
  city: string,
  date: Date = new Date()
): string {
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const tod = TOD_WORD[timeOfDay(date.getHours())];
  return `${CONDITION_LABEL[condition]} ${Math.round(tempC)}° · ${weekday} ${tod} in ${city}`;
}

const PART_OF_DAY: Record<string, string> = {
  dawn: "this morning",
  morning: "this morning",
  midday: "today",
  afternoon: "this afternoon",
  dusk: "this evening",
  night: "tonight",
};

/**
 * Quirky, human one-liner that folds in condition + temp + time-of-day + place.
 * e.g. "Clear skies over Bengaluru tonight — a calm 24°. Perfect for big plans."
 */
export function quirkyWeatherLine(
  condition: WeatherCondition,
  tempC: number,
  city: string,
  date: Date = new Date()
): string {
  const tod = timeOfDay(date.getHours());
  const part = PART_OF_DAY[tod];
  const t = Math.round(tempC);
  const dark = tod === "night" || tod === "dusk";
  switch (condition) {
    case "clear":
      return dark
        ? `Clear, still skies over ${city} ${part} — a calm ${t}°. Unwind with a cup of something warm.`
        : `Sunlight pouring over ${city} ${part}, a bright ${t}° — perfect for a slow matcha and a deep breath.`;
    case "clouds":
      return `Soft, overcast light over ${city} ${part} — a mellow ${t}°, made for herbal tea and good company.`;
    case "fog":
      return `A gentle mist settles over ${city} ${part}, ${t}° and dreamy. Slow down, breathe in.`;
    case "rain":
      return `Rain over ${city} ${part} — a cosy ${t}°. A golden-milk-and-a-good-book kind of day.`;
    case "snow":
      return `A rare hush of snow over ${city} ${part}, a crisp ${t}°. Warm up with something nourishing.`;
    case "storm":
      return `A wild sky over ${city} ${part}, ${t}° and dramatic. Stay grounded, stay well.`;
    default:
      return `A lovely ${t}° over ${city} ${part}. Come nourish yourself.`;
  }
}

export function greetingFor(condition: WeatherCondition, isDay: boolean, city: string): string {
  const where = city || "the studio";
  switch (condition) {
    case "clear":
      return isDay
        ? `Clear skies over ${where} — a beautiful day to move.`
        : `A calm, clear night in ${where}. Breathe and unwind.`;
    case "clouds":
      return `Soft, cloudy light over ${where} — gentle energy for today.`;
    case "fog":
      return `A misty hush over ${where}. Find your center.`;
    case "rain":
      return `Rain over ${where} — the perfect excuse for a mindful session indoors.`;
    case "snow":
      return `Snowfall in ${where}. Warm up from the inside out.`;
    case "storm":
      return `Stormy skies over ${where}. Stay grounded with us.`;
    default:
      return `Welcome to the studio, ${where}.`;
  }
}

/** Local fallback quotes used when the quotes API is unavailable. */
export const FALLBACK_QUOTES: { text: string; author: string }[] = [
  { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
  { text: "Movement is a medicine for creating change in a person's physical, emotional, and mental states.", author: "Carol Welch" },
  { text: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott" },
  { text: "The body benefits from movement, and the mind benefits from stillness.", author: "Sakyong Mipham" },
  { text: "Wellness is the complete integration of body, mind, and spirit.", author: "Greg Anderson" },
];
