import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import type { GetServerSideProps } from "next";
import { format } from "date-fns";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ANALYTICS_VIEWER_EMAIL } from "@/lib/analyticsViewer";
import type { AccessRow } from "@/pages/api/analytics/access-log";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getStudioServerSession(
    ctx.req as Parameters<typeof getStudioServerSession>[0],
    ctx.res as Parameters<typeof getStudioServerSession>[1],
  );
  const email = (session?.user as { email?: string } | undefined)?.email;
  if (!session?.user || email !== ANALYTICS_VIEWER_EMAIL) {
    return { notFound: true }; // 404 — do not reveal the page exists
  }
  return { props: {} };
};

export default function AnalyticsPage() {
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/analytics/access-log");
        if (!r.ok) return;
        const data = (await r.json()) as { rows: AccessRow[] };
        if (!alive) return;
        setRows(data.rows);
        setUpdatedAt(Date.now());
      } catch {
        /* keep last data; retry next tick */
      }
    };
    load();
    timer.current = setInterval(load, 5000);
    return () => {
      alive = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Access Analytics</title>
      </Head>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-display text-2xl text-charcoal">Account Access</h1>
          <span className="font-body text-xs text-muted-foreground">
            live · {updatedAt ? `updated ${Math.round((Date.now() - updatedAt) / 1000)}s ago` : "loading…"}
          </span>
        </div>

        <ResponsiveTable stack>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>GPS location</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.email ?? "—"}</TableCell>
                  <TableCell>{format(new Date(row.time), "dd MMM yyyy, HH:mm")}</TableCell>
                  <TableCell>
                    {row.latitude != null && row.longitude != null ? (
                      <a
                        className="text-sage underline"
                        href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{row.device}</TableCell>
                  <TableCell className="font-mono text-xs">{row.ip ?? "—"}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No access records yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ResponsiveTable>
      </div>
    </>
  );
}
