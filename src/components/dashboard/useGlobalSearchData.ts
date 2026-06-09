// src/components/dashboard/useGlobalSearchData.ts
import { useEffect, useRef, useState } from "react";
import { SEARCH_MIN_CHARS, type SearchGroup } from "@/lib/search/types";

interface State { groups: SearchGroup[]; loading: boolean; error: boolean; }

const DEBOUNCE_MS = 200;

export function useGlobalSearchData(query: string): State {
  const [state, setState] = useState<State>({ groups: [], loading: false, error: false });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    abortRef.current?.abort();
    if (q.length < SEARCH_MIN_CHARS) {
      setState({ groups: [], loading: false, error: false });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: false }));
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { groups: SearchGroup[] };
        setState({ groups: data.groups ?? [], loading: false, error: false });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setState({ groups: [], loading: false, error: true });
      }
    }, DEBOUNCE_MS);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  return state;
}
