import { useStudioSWR } from "@/lib/swr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { ticketStatusPill } from "@/lib/pillMaps";
import { Skeleton } from "@/components/ui/skeleton";
import { History, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface PauseTicket {
  id: string;
  type: string;
  reason: string;
  status: string;
  admin_note: string | null;
  pause_from: string | null;
  pause_to: string | null;
  created_at: string;
  user_package?: {
    pass_type: string | null;
    package_type?: { name?: string | null } | null;
  } | null;
}

function passName(t: PauseTicket): string | null {
  const up = t.user_package;
  if (!up) return null;
  return up.package_type?.name?.trim()
    || (up.pass_type === "studio_pass" ? "Studio Pass" : up.pass_type === "class_pass" ? "Class Pass" : null);
}

// Member-facing label + pulse for a pause request. Status tone comes from the
// canonical `ticketStatusPill` for open/in_review/resolved; the extra
// pause-only outcomes (approved/rejected/declined) map to the nearest tone
// locally at the call-site without touching pillMaps.
const EXTRA_STATUS_TONE: Record<string, "success" | "danger"> = {
  approved: "success",
  rejected: "danger",
  declined: "danger",
};

function presentationFor(status: string): { label: string; pulse: boolean } {
  switch (status) {
    case "open": return { label: "Pending review", pulse: true };
    case "in_review": return { label: "In review", pulse: true };
    case "approved": return { label: "Approved", pulse: false };
    case "resolved": return { label: "Resolved", pulse: false };
    case "rejected":
    case "declined": return { label: "Declined", pulse: false };
    default: return { label: status.replace(/_/g, " "), pulse: false };
  }
}

function fmt(d: string | null) {
  return d ? format(new Date(d), "d MMM yyyy") : "—";
}

/**
 * Read-only history of the member's pause requests with their current status.
 * Shares the `/api/user/support-tickets` SWR key with PauseSubscriptionCard, so
 * rendering both on the page fires a single GET.
 */
export function PauseRequestsList() {
  const { data, isLoading } = useStudioSWR<PauseTicket[]>("/api/user/support-tickets");

  const requests = Array.isArray(data)
    ? data.filter((t) => t.type === "pause_subscription")
    : [];

  return (
    <Card className="border-sage/20 bg-[#fafaf8]/90">
      <CardHeader className="p-6 border-b border-sage/10 bg-linear-to-r from-cream/50 to-[#fafaf8]">
        <CardTitle className="font-display text-xl text-charcoal flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sage/10 flex items-center justify-center">
            <History className="text-sage" size={20} />
          </div>
          Your Pause Requests
        </CardTitle>
        <CardDescription className="font-body text-charcoal/60 mt-1">
          Track the status of past and current requests
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading && !data ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <p className="font-body text-sm text-charcoal/50 text-center py-6">
            You haven&apos;t raised any pause requests yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {requests.map((t) => {
              const s = presentationFor(t.status);
              const tone = EXTRA_STATUS_TONE[t.status] ?? ticketStatusPill(t.status).tone;
              return (
                <li key={t.id} className="rounded-lg border border-sage/15 bg-white-warm p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-body text-sm text-charcoal">
                      <span className="font-medium">{fmt(t.pause_from)} → {fmt(t.pause_to)}</span>
                      {passName(t) && (
                        <span className="block text-xs text-charcoal/50 mt-0.5">{passName(t)}</span>
                      )}
                    </div>
                    <Pill tone={tone} dot pulse={s.pulse} size="sm">{s.label}</Pill>
                  </div>
                  <p className="font-body text-xs text-charcoal/60 line-clamp-2">{t.reason}</p>
                  {t.admin_note && (
                    <div className="flex items-start gap-2 rounded-md bg-sage/5 border border-sage/15 px-3 py-2">
                      <MessageSquare size={13} className="text-sage shrink-0 mt-0.5" />
                      <p className="font-body text-xs text-charcoal/70">{t.admin_note}</p>
                    </div>
                  )}
                  <p className="font-body text-[11px] text-charcoal/40">
                    Requested {fmt(t.created_at)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
