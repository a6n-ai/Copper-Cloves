import useSWR, { type SWRConfiguration } from "swr";

/**
 * Project-wide JSON fetcher. Always returns parsed JSON or throws — callers
 * surface errors through SWR's `error` slot.
 */
export async function jsonFetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `Request failed: ${res.status}`);
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
    ...config,
  });
}
