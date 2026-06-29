import { useEffect, useState } from "react";
import { UserX } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";

function PartnerMembersSkeleton() {
  return (
    <ResponsiveTable>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="text-center">Sessions</TableHead>
            <TableHead>Last session</TableHead>
            <TableHead className="text-right">Waiver</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-sage/10">
          {Array.from({ length: 6 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell>
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24 mt-1.5" />
              </TableCell>
              <TableCell className="text-center"><Skeleton className="h-6 w-8 mx-auto" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-6 w-20 rounded-full ml-auto" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ResponsiveTable>
  );
}

interface PartnerMemberRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  sessions: number;
  lastSession: string | null;
  hasWaiver: boolean;
}

export default function PartnerMembersPage() {
  const [rows, setRows] = useState<PartnerMemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/partner/members");
        const d = r.ok ? await r.json() : [];
        if (!cancelled) setRows(Array.isArray(d) ? d : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signedCount = rows.filter((r) => r.hasWaiver).length;

  return (
    <main className="max-w-5xl mx-auto p-4 lg:p-6 space-y-6">
      <PageHeader
        title="Members"
        subtitle={
          loading
            ? "Loading…"
            : `${rows.length} attended · ${signedCount} with signed waiver`
        }
      />

      <Card className="border-sage/20 bg-white-warm">
        <CardContent className="p-0">
          {loading ? (
            <PartnerMembersSkeleton />
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 font-body text-sm text-charcoal/40">
              <UserX className="h-4 w-4" /> No members have attended a session yet.
            </div>
          ) : (
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-center">Sessions</TableHead>
                    <TableHead>Last session</TableHead>
                    <TableHead className="text-right">Waiver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-sage/10">
                  {rows.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-body text-charcoal">{m.name}</TableCell>
                      <TableCell className="font-body text-sm text-charcoal/70">
                        <div className="truncate">{m.email}</div>
                        {m.phone ? <div className="text-charcoal/50">{m.phone}</div> : null}
                      </TableCell>
                      <TableCell className="text-center font-body font-semibold tabular-nums text-lg text-charcoal">{m.sessions}</TableCell>
                      <TableCell className="font-body text-sm text-charcoal/60 whitespace-nowrap">
                        {m.lastSession
                          ? new Date(m.lastSession).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Pill
                          tone={m.hasWaiver ? "success" : "warning"}

                          className="font-body"
                        >
                          {m.hasWaiver ? "Signed ✓" : "Not signed"}
                        </Pill>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
