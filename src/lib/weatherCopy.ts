/** Weather-aware greeting lines for the auth panels. Shared client/server-safe. */
import type { WeatherCondition } from "@/lib/weatherPalette";

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
