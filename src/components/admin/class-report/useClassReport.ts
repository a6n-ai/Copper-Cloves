import { useCallback, useEffect, useState } from "react";
import type { ClassReport } from "@/lib/classReport";

// Names from every report loaded this session, so the class dialog can title itself
// before its own request lands, and keep the name if that request fails.
export const knownClassNames = new Map<string, string>();

export function useClassReport(from: string, to: string, classId?: string) {
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
    if (classId) qs.set("classId", classId);
    fetch(`/api/admin/dashboard/class-report?${qs}`, { signal: ctrl.signal })
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
        if (body === null || typeof body !== "object") throw new Error("Invalid response from server");
        return body as ClassReport;
      })
      .then((d) => {
        if (ctrl.signal.aborted) return;
        for (const c of d.classes ?? []) knownClassNames.set(c.classId, c.name);
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
  }, [from, to, classId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, error, loading, retry };
}
