import { useEffect, useState } from "react";
import { useRouter } from "next/router";

/**
 * Tab state synced to a URL query param (default `?tab=`), so tabs become deep-linkable
 * and reachable from global search (e.g. /admin/finances?tab=ledger). Reads the param on
 * mount / when it changes; writes it (shallow, no refetch) when the tab changes.
 */
export function useTabQuery(
  valid: readonly string[],
  fallback: string,
  key = "tab"
): [string, (v: string) => void] {
  const router = useRouter();
  const [tab, setTab] = useState(fallback);
  const qv = router.query[key];

  useEffect(() => {
    if (typeof qv === "string" && valid.includes(qv)) setTab(qv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qv]);

  const change = (v: string) => {
    setTab(v);
    void router.replace(
      { pathname: router.pathname, query: { ...router.query, [key]: v } },
      undefined,
      { shallow: true }
    );
  };

  return [tab, change];
}
