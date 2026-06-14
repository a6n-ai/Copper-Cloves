// src/components/filters/urlFilterCodec.ts
import { format } from "date-fns";
import type { ParsedUrlQuery } from "querystring";
import type { DateRange } from "react-day-picker";
import type { FilterCodec } from "./types";

function str(q: ParsedUrlQuery, key: string): string | undefined {
  const v = q[key];
  if (Array.isArray(v)) return v[0];
  return v ?? undefined;
}

/** plain string dimension owning one query key */
export function stringCodec(key: string, def = ""): FilterCodec<string> {
  return {
    keys: [key],
    isDefault: (v) => (v ?? "") === def,
    toQuery: (v) => ({ [key]: v && v !== def ? v : undefined }),
    fromQuery: (q) => str(q, key) ?? def,
  };
}

/** date range dimension owning two query keys (yyyy-MM-dd) */
export function dateRangeCodec(fromKey = "from", toKey = "to"): FilterCodec<DateRange | undefined> {
  return {
    keys: [fromKey, toKey],
    isDefault: (v) => !v?.from,
    toQuery: (v) => ({
      [fromKey]: v?.from ? format(v.from, "yyyy-MM-dd") : undefined,
      [toKey]: v?.to ? format(v.to, "yyyy-MM-dd") : undefined,
    }),
    fromQuery: (q) => {
      const f = str(q, fromKey);
      const t = str(q, toKey);
      if (!f) return undefined;
      const parseLocal = (s: string) => {
        const [y, m, d] = s.split("-").map(Number);
        return new Date(y, m - 1, d); // local midnight
      };
      const from = parseLocal(f);
      const to = t ? parseLocal(t) : undefined;
      return { from, to };
    },
  };
}

type CodecMap = Record<string, FilterCodec<unknown>>;

/** values → flat query record, stripping defaults */
export function serializeFilters(values: Record<string, unknown>, codecs: CodecMap): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(codecs)) {
    const codec = codecs[key];
    if (codec.isDefault(values[key])) continue;
    const frag = codec.toQuery(values[key]);
    for (const qk of Object.keys(frag)) {
      const qv = frag[qk];
      if (qv != null && qv !== "") out[qk] = qv;
    }
  }
  return out;
}

/** query → values, falling back to defaults when a dimension is absent */
export function deserializeFilters(
  query: ParsedUrlQuery,
  codecs: CodecMap,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(codecs)) {
    const codec = codecs[key];
    const present = codec.keys.some((k) => query[k] != null && query[k] !== "");
    out[key] = present ? codec.fromQuery(query) : defaults[key];
  }
  return out;
}
