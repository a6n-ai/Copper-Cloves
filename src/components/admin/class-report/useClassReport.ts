import { useCallback, useEffect, useState } from "react";
import type { ClassReport } from "@/lib/classReport";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Only what the tab and dialog dereference unguarded.
function isClassReport(b: unknown): b is ClassReport {
  return (
    isObj(b) &&
    isObj(b.range) &&
    isObj(b.current) &&
    isObj(b.previous) &&
    isObj(b.heatmap) &&
    Array.isArray(b.trend) &&
    Array.isArray(b.classes)
  );
}

/** `filter` is extra query string, e.g. "classId=…", "instructorId=…" or "groupBy=instructor". */
export function useClassReport(from: string, to: string, filter = "") {
  const [data, setData] = useState<ClassReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Abort the in-flight request when the range changes so a slow older
    // response can never overwrite a newer one.
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ from, to });
    fetch(`/api/admin/dashboard/class-report?${qs}${filter && `&${filter}`}`, { signal: ctrl.signal })
      .then(async (r) => {
        let body: unknown = null;
        try {
          body = await r.json();
        } catch (e) {
          if (ctrl.signal.aborted) throw e;
        }
        if (!r.ok) {
          const msg = (body as { error?: string } | null)?.error;
          throw new Error(msg ?? `Request failed (${r.status})`);
        }
        if (!isClassReport(body)) throw new Error("Invalid response from server");
        return body;
      })
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setData(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (ctrl.signal.aborted) return;
        // fetch rejects with a TypeError only when the request never reached the server.
        setError(e instanceof TypeError ? "Couldn't reach the server. Check your connection and try again." : e.message);
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [from, to, filter, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, error, loading, retry };
}
