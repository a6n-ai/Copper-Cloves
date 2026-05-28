import { useEffect, useMemo, useState } from "react";
import { DEFAULT_PALETTE, paletteFor, type MeshPalette, type WeatherCondition } from "@/lib/weatherPalette";
import { greetingFor } from "@/lib/weatherCopy";

export interface AuthWeather {
  city: string;
  tempC: number;
  condition: WeatherCondition;
  isDay: boolean;
  quote: { text: string; author: string };
}

export interface UseAuthWeatherResult {
  weather: AuthWeather | null;
  palette: MeshPalette;
  greeting: string | null;
  loading: boolean;
}

/**
 * Fetches IP-based weather + a quote from /api/weather, then derives the mesh
 * palette from the *viewer's* local hour (more accurate than the server) plus
 * the weather condition. Fails silently → keeps the on-brand default palette.
 */
export function useAuthWeather(): UseAuthWeatherResult {
  const [weather, setWeather] = useState<AuthWeather | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/weather")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AuthWeather | null) => {
        if (active && d && typeof d.tempC === "number") setWeather(d);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const palette = useMemo(
    () => (weather ? paletteFor(weather.condition, new Date().getHours()) : DEFAULT_PALETTE),
    [weather],
  );
  const greeting = useMemo(
    () => (weather ? greetingFor(weather.condition, weather.isDay, weather.city) : null),
    [weather],
  );

  return { weather, palette, greeting, loading };
}
