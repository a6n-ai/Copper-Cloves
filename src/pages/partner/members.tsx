import { useEffect, useState } from "react";
import { Loader2, UserX } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

      <Card className="border-sage/20 bg-white/95">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-charcoal/50">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 font-body text-sm text-charcoal/40">
              <UserX className="h-4 w-4" /> No members have attended a session yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
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
                      <TableCell className="font-body font-medium text-charcoal">{m.name}</TableCell>
                      <TableCell className="font-body text-sm text-charcoal/70">
                        <div className="truncate">{m.email}</div>
                        {m.phone ? <div className="text-charcoal/50">{m.phone}</div> : null}
                      </TableCell>
                      <TableCell className="text-center font-display text-lg text-charcoal">{m.sessions}</TableCell>
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
                        <Badge
                          variant="outline"
                          className={
                            m.hasWaiver
                              ? "border-sage/30 text-sage bg-sage/5 font-body"
                              : "border-terracotta/30 text-terracotta bg-terracotta/5 font-body"
                          }
                        >
                          {m.hasWaiver ? "Signed ✓" : "Not signed"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
