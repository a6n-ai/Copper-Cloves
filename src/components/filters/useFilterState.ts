import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import type { FilterCodec } from "./types";
import { serializeFilters, deserializeFilters, stringCodec } from "./urlFilterCodec";

type Codecs<T> = Partial<{ [K in keyof T]: FilterCodec<T[K]> }>;

interface Options<T> {
  urlSync?: boolean;
  codecs?: Codecs<T>;
  debounceUrlMs?: number;
}

export interface FilterState<T> {
  values: T;
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  setMany: (partial: Partial<T>) => void;
  reset: () => void;
  activeCount: number;
  isActive: boolean;
}

/** Build a codec map: explicit codecs win; string dimensions get a default stringCodec. */
function resolveCodecs<T extends Record<string, any>>(defaults: T, provided?: Codecs<T>) {
  const map: Record<string, FilterCodec<any>> = {};
  for (const key of Object.keys(defaults)) {
    const explicit = provided?.[key as keyof T];
    if (explicit) {
      map[key] = explicit as FilterCodec<any>;
    } else if (typeof defaults[key] === "string") {
      map[key] = stringCodec(key, defaults[key]);
    }
    // non-string dimensions without an explicit codec are local-only (no URL sync)
  }
  return map;
}

export function useFilterState<T extends Record<string, any>>(
  defaults: T,
  options: Options<T> = {},
): FilterState<T> {
  const { urlSync = false, codecs: provided, debounceUrlMs = 300 } = options;
  const router = useRouter();
  const defaultsRef = useRef(defaults);
  const providedRef = useRef(provided);
  const codecs = useMemo(() => resolveCodecs(defaultsRef.current, providedRef.current), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [values, setValues] = useState<T>(() => {
    if (urlSync && router.isReady) {
      return deserializeFilters(router.query, codecs, defaultsRef.current) as T;
    }
    return defaults;
  });

  // hydrate once the router is ready (query is empty on first SSR pass)
  const hydrated = useRef(false);
  useEffect(() => {
    if (!urlSync || !router.isReady || hydrated.current) return;
    hydrated.current = true;
    setValues(deserializeFilters(router.query, codecs, defaultsRef.current) as T);
  }, [urlSync, router.isReady, codecs]); // eslint-disable-line react-hooks/exhaustive-deps

  // push values → URL (debounced, shallow, only when the serialized query changes)
  const lastQuery = useRef<string>("");
  useEffect(() => {
    if (!urlSync || !router.isReady) return;
    const next = serializeFilters(values, codecs);
    const nextStr = JSON.stringify(next);
    if (nextStr === lastQuery.current) return;
    // capture unrelated keys synchronously (not inside the timeout)
    const owned = new Set(Object.values(codecs).flatMap((c) => c.keys));
    const preserved: Record<string, any> = {};
    for (const k of Object.keys(router.query)) {
      if (!owned.has(k)) preserved[k] = router.query[k];
    }
    const id = setTimeout(() => {
      lastQuery.current = nextStr;
      router.replace({ query: { ...preserved, ...next } }, undefined, { shallow: true });
    }, debounceUrlMs);
    return () => clearTimeout(id);
  }, [values, urlSync, router.isReady, codecs, debounceUrlMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);
  const setMany = useCallback((partial: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...partial }));
  }, []);
  const reset = useCallback(() => setValues(defaultsRef.current), []);

  const activeCount = useMemo(() => {
    let n = 0;
    for (const key of Object.keys(defaultsRef.current)) {
      const codec = codecs[key];
      const isDefault = codec ? codec.isDefault(values[key]) : values[key] === defaultsRef.current[key];
      if (!isDefault) n++;
    }
    return n;
  }, [values, codecs]);

  return { values, set, setMany, reset, activeCount, isActive: activeCount > 0 };
}
