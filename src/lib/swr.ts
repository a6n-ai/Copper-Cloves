import useSWR, { type SWRConfiguration } from "swr";

/**
 * Project-wide JSON fetcher. Always returns parsed JSON or throws — callers
 * surface errors through SWR's `error` slot.
 */
export async function jsonFetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(body || `Request failed: ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

/**
 * Thin wrapper around `useSWR` with our default fetcher and conservative
 * dedupe/refetch policies tuned for studio data:
 *   - `dedupingInterval` 15s — multiple components asking for the same URL
 *     within 15s share one in-flight request and one cached value.
 *   - `revalidateOnFocus` true — admins flipping between tabs see fresh data.
 *   - `revalidateIfStale` true — first focus after the cache window refetches.
 *   - `keepPreviousData` true — UI doesn't blank between key changes.
 */
export function useStudioSWR<T = unknown>(
  key: string | null,
  config?: SWRConfiguration<T>,
) {
  return useSWR<T>(key, jsonFetcher as (url: string) => Promise<T>, {
    dedupingInterval: 15_000,
    revalidateOnFocus: true,
    revalidateIfStale: true,
    keepPreviousData: true,
    // Don't retry-storm client errors (401/403/404) — a mis-scoped or forbidden
    // key would otherwise refetch ~5× per mount with backoff. Server (5xx) and
    // network errors still retry, capped.
    errorRetryCount: 3,
    shouldRetryOnError: (err: Error & { status?: number }) =>
      !(typeof err?.status === "number" && err.status >= 400 && err.status < 500),
    ...config,
  });
}
