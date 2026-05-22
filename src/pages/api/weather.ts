import type { NextApiRequest, NextApiResponse } from "next";
import { codeToCondition, type WeatherCondition } from "@/lib/weatherPalette";
import { FALLBACK_QUOTES } from "@/lib/weatherCopy";

// Studio location (Indiranagar, Bengaluru) — fallback when IP geo is unavailable.
const FALLBACK = { city: "Bengaluru", lat: 12.9716, lon: 77.5946 };

export interface WeatherResponse {
  city: string;
  tempC: number;
  condition: WeatherCondition;
  isDay: boolean;
  quote: { text: string; author: string };
}

function clientIp(req: NextApiRequest): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  const real = req.headers["x-real-ip"];
  if (typeof real === "string" && real.length) return real.trim();
  return req.socket.remoteAddress ?? null;
}

function isPrivateIp(ip: string | null): boolean {
  if (!ip) return true;
  const v = ip.replace(/^::ffff:/, "");
  return (
    v === "::1" ||
    v.startsWith("127.") ||
    v.startsWith("10.") ||
    v.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(v)
  );
}

async function fetchJson(url: string, ms = 6000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function randomFallbackQuote() {
  return FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let city = FALLBACK.city;
  let lat = FALLBACK.lat;
  let lon = FALLBACK.lon;

  // 1. Resolve location from client IP (skip private/localhost → keep fallback).
  const ip = clientIp(req);
  if (!isPrivateIp(ip)) {
    const geo = await fetchJson(`https://ipapi.co/${ip}/json/`);
    if (geo && typeof geo.latitude === "number" && typeof geo.longitude === "number") {
      lat = geo.latitude;
      lon = geo.longitude;
      if (typeof geo.city === "string" && geo.city) city = geo.city;
    }
  }

  // 2. Weather (Open-Meteo, keyless) + 3. a quote (ZenQuotes, keyless) in parallel.
  const [weather, quoteData] = await Promise.all([
    fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day`
    ),
    fetchJson("https://zenquotes.io/api/random"),
  ]);

  let tempC = 24;
  let condition: WeatherCondition = "clear";
  let isDay = true;
  if (weather?.current) {
    if (typeof weather.current.temperature_2m === "number") tempC = weather.current.temperature_2m;
    if (typeof weather.current.weather_code === "number")
      condition = codeToCondition(weather.current.weather_code);
    if (typeof weather.current.is_day === "number") isDay = weather.current.is_day === 1;
  }

  // ZenQuotes returns [{ q, a }]; guard against its rate-limit sentinel.
  const zq = Array.isArray(quoteData) ? quoteData[0] : null;
  const quote =
    zq && typeof zq.q === "string" && zq.a && zq.a !== "zenquotes.io"
      ? { text: zq.q, author: zq.a }
      : randomFallbackQuote();

  // Per-user cache only (response varies by IP) — never shared on a CDN.
  res.setHeader("Cache-Control", "private, max-age=600");
  const payload: WeatherResponse = { city, tempC, condition, isDay, quote };
  return res.status(200).json(payload);
}
