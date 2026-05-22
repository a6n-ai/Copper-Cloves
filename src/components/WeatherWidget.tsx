import { useEffect, useState } from "react";
import { Sun, Moon, Cloud, CloudSun, CloudMoon, CloudRain, CloudSnow, CloudFog, CloudLightning, Sunrise, Sunset, type LucideIcon } from "lucide-react";
import type { AuthWeather } from "@/hooks/useAuthWeather";
import { timeOfDay, type TimeOfDay } from "@/lib/weatherPalette";

function weatherIcon(condition: AuthWeather["condition"], isDay: boolean): LucideIcon {
  switch (condition) {
    case "clear":
      return isDay ? Sun : Moon;
    case "clouds":
      return isDay ? CloudSun : CloudMoon;
    case "fog":
      return CloudFog;
    case "rain":
      return CloudRain;
    case "snow":
      return CloudSnow;
    case "storm":
      return CloudLightning;
    default:
      return Cloud;
  }
}

const TOD_META: Record<TimeOfDay, { label: string; icon: LucideIcon }> = {
  dawn: { label: "Dawn", icon: Sunrise },
  morning: { label: "Morning", icon: Sunrise },
  midday: { label: "Midday", icon: Sun },
  afternoon: { label: "Golden hour", icon: Sunset },
  dusk: { label: "Dusk", icon: Sunset },
  night: { label: "Night", icon: Moon },
};

export function WeatherWidget({ weather }: { weather: AuthWeather | null }) {
  // Time-of-day comes from the viewer's clock; computed after mount to avoid SSR mismatch.
  const [tod, setTod] = useState<TimeOfDay | null>(null);
  useEffect(() => {
    setTod(timeOfDay(new Date().getHours()));
    const id = setInterval(() => setTod(timeOfDay(new Date().getHours())), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!weather && !tod) return null;

  const WIcon = weather ? weatherIcon(weather.condition, weather.isDay) : null;
  const todMeta = tod ? TOD_META[tod] : null;
  const TIcon = todMeta?.icon ?? null;

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-white/50 bg-white/40 px-3.5 py-1.5 backdrop-blur-md">
      {weather && WIcon && (
        <span className="inline-flex items-center gap-1.5">
          <WIcon className="h-4 w-4 text-sage" />
          <span className="font-body text-sm font-semibold text-charcoal">{Math.round(weather.tempC)}°</span>
          <span className="font-body text-xs text-charcoal/60">{weather.city}</span>
        </span>
      )}
      {weather && todMeta && <span className="h-3.5 w-px bg-charcoal/20" />}
      {todMeta && TIcon && (
        <span className="inline-flex items-center gap-1.5">
          <TIcon className="h-4 w-4 text-terracotta" />
          <span className="font-body text-xs font-medium text-charcoal/70">{todMeta.label}</span>
        </span>
      )}
    </div>
  );
}
