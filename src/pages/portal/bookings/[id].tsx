import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import type { Session } from "next-auth";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { format } from "date-fns";
import { ArrowLeft, Calendar, Clock, Loader2 } from "lucide-react";

import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/ui/pill";
import { bookingStatusPill, classStatusPill } from "@/lib/pillMaps";
import { useToast } from "@/hooks/use-toast";

/**
 * SSR auth guard — redirect unauthenticated callers to /login (preserving the
 * return URL). Mirrors `requireSessionSSP` but inlined here per the page spec,
 * using `getStudioServerSession` directly.
 */
export async function getServerSideProps(
  ctx: GetServerSidePropsContext,
): Promise<GetServerSidePropsResult<{ session: Session }>> {
  const session = await getStudioServerSession(
    ctx.req as Parameters<typeof getStudioServerSession>[0],
    ctx.res as Parameters<typeof getStudioServerSession>[1],
  );
  if (!session?.user) {
    const dest = `/login?redirect=${encodeURIComponent(ctx.resolvedUrl)}`;
    return { redirect: { destination: dest, permanent: false } };
  }
  return { props: { session: JSON.parse(JSON.stringify(session)) as Session } };
}

type BookingStatus = "payment_pending" | "confirmed" | "expired" | "cancelled";

interface BookingDetail {
  id: string;
  status: BookingStatus;
  confirmationStatus: string | null;
  className: string | null;
  classTime: string | null;
  classStatus: string | null;
  holdExpiresAt: string | null;
  financeSnapshot: unknown;
  razorpayOrderId: string | null;
  paymentNote: string | null;
  bookedAt: string | null;
  cancellationDate: string | null;
  cancellationReason: string | null;
  cancelledBy: string | null;
  refundStatus: string;
  refundAmountPaise: number | null;
  refundPassName: string | null;
  seatRefund: "class_pass" | "none_unlimited" | "none_no_pass";
  invitedByName: string | null;
  group: { name: string; status: string; refund: string }[];
  refundRoster: { name: string; isYou: boolean; refund: string }[];
  refundRequest: { kind: string; status: string; refund_type: string | null; refund_amount_paise: number | null } | null;
  canRequestRefund: boolean;
}

function refundStatusText(d: BookingDetail): string {
  switch (d.refundStatus) {
    case "auto_pass": return `Refunded — 1 Class Pass added${d.refundPassName ? "" : ""}`;
    case "requested": return "Refund requested — under studio review";
    case "approved_pass": return "Refund approved — 1 Class Pass added";
    case "approved_amount": return `Refund approved — ₹${Math.round((d.refundAmountPaise ?? 0) / 100).toLocaleString("en-IN")}`;
    case "denied": return "Refund request denied";
    default:
      return d.seatRefund === "none_unlimited"
        ? "No refund — unlimited pass (no class consumed)"
        : d.seatRefund === "none_no_pass"
          ? "No refund due"
          : "Not refunded";
  }
}

const STATUS_LABEL: Record<string, string> = {
  payment_pending: "Payment pending",
  confirmed: "Confirmed",
  expired: "Expired",
  cancelled: "Cancelled",
};

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

function classStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

function TimelineRow({ label, when, note, tone = "muted" }: {
  label: string;
  when: string | null;
  note?: string | null;
  tone?: "muted" | "sage" | "danger";
}) {
  const dot = tone === "sage" ? "bg-sage" : tone === "danger" ? "bg-[#cf5b48]" : "bg-charcoal/30";
  return (
    <li className="flex gap-3">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0">
        <p className="font-body text-sm font-medium text-charcoal">{label}</p>
        {when && <p className="font-body text-xs text-charcoal/50">{format(new Date(when), "MMM d, yyyy · h:mm a")}</p>}
        {note && <p className="font-body text-sm text-charcoal/70">{note}</p>}
      </div>
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="bg-white-warm rounded-xl border border-sage/10 p-6 space-y-4">
      <Skeleton className="h-8 w-56" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-28 rounded-md" />
        <Skeleton className="h-6 w-24 rounded-md" />
      </div>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-48" />
    </div>
  );
}

export default function BookingDetailPage() {
  const router = useRouter();
  const { toast } = useToast();
  const id = typeof router.query.id === "string" ? router.query.id : "";

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState<string | null>(null);
  const [requestingRefund, setRequestingRefund] = useState(false);
  const [refundReason, setRefundReason] = useState("");

  async function handleRequestRefund() {
    if (!booking) return;
    setRequestingRefund(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_refund", reason: refundReason.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast({ title: "Couldn't request refund", description: typeof data?.error === "string" ? data.error : "Please try again.", variant: "error" });
        return;
      }
      setBooking((prev) => (prev ? { ...prev, refundStatus: "requested", canRequestRefund: false } : prev));
      toast({ title: "Refund requested", description: "The studio will review and respond.", variant: "success" });
    } catch {
      toast({ title: "Couldn't request refund", description: "Please try again.", variant: "error" });
    } finally {
      setRequestingRefund(false);
    }
  }

  useEffect(() => {
    if (!router.isReady || !id) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/bookings/${id}`);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as BookingDetail;
        if (!cancelled) setBooking(data);
      } catch (error) {
        console.error("Error fetching booking:", error);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, id]);

  async function handleAlreadyPaid() {
    if (!booking) return;
    setReconciling(true);
    setReconcileMessage(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reconcile" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reconciled?: boolean;
        status?: string;
        error?: string;
      };
      if (!res.ok) {
        setReconcileMessage(
          typeof data?.error === "string"
            ? data.error
            : "Could not check your payment right now. Please try again shortly.",
        );
        return;
      }
      if (data.reconciled) {
        setBooking((prev) =>
          prev ? { ...prev, status: (data.status as BookingStatus) ?? "confirmed" } : prev,
        );
        setReconcileMessage(null);
        toast({ title: "Booking confirmed", description: "We found your payment. Your seat is confirmed.", variant: "success" });
      } else {
        setReconcileMessage(
          "We couldn't find a completed payment yet — if you just paid, wait a minute and try again, or complete payment below.",
        );
      }
    } catch (error) {
      console.error("Error reconciling booking:", error);
      setReconcileMessage("Could not check your payment right now. Please try again shortly.");
    } finally {
      setReconciling(false);
    }
  }

  const classTimeIso = booking?.classTime ?? null;
  const holdMs = booking?.holdExpiresAt ? new Date(booking.holdExpiresAt).getTime() : null;
  const holdActive = holdMs != null && holdMs > Date.now();

  const showRecovery =
    !!booking && (booking.status === "payment_pending" || booking.status === "expired");

  return (
    <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/5">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <PageHeader
          title="Booking Details"
          subtitle="View and manage this reservation"
          crumbs={[
            { label: "Dashboard", href: "/portal/dashboard" },
            { label: "My Bookings", href: "/portal/bookings" },
            { label: "Details" },
          ]}
        />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <Link
          href="/portal/bookings"
          className="inline-flex items-center gap-1.5 font-body text-sm text-charcoal/60 hover:text-sage transition-colors mb-4"
        >
          <ArrowLeft size={16} /> Back to My Bookings
        </Link>

        {isLoading ? (
          <DetailSkeleton />
        ) : notFound || !booking ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-sage/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="text-sage" size={40} />
            </div>
            <h3 className="font-display text-2xl text-charcoal mb-3">Booking not found</h3>
            <p className="font-body text-charcoal/60 mb-6">
              We couldn't find this booking. It may have been removed, or it isn't yours.
            </p>
            <Button onClick={() => router.push("/portal/bookings")} variant="sage">
              Back to My Bookings
            </Button>
          </div>
        ) : (
          <div className="bg-white-warm rounded-xl border border-sage/10 p-5 sm:p-7">
            <h2 className="font-display text-2xl sm:text-3xl text-charcoal">
              {booking.className ?? "Class"}
            </h2>

            <div className="flex flex-wrap gap-2 mt-3">
              <Pill {...bookingStatusPill(booking.status)}>{statusLabel(booking.status)}</Pill>
              {booking.classStatus && (
                <Pill {...classStatusPill(booking.classStatus)}>
                  {classStatusLabel(booking.classStatus)}
                </Pill>
              )}
            </div>

            {booking.paymentNote && (
              <p className="mt-3 rounded-md bg-terracotta/10 px-3 py-2 font-body text-sm text-terracotta">
                {booking.paymentNote}
              </p>
            )}

            <div className="mt-5 space-y-2 border-t border-sage/10 pt-5">
              {classTimeIso ? (
                <>
                  <div className="flex items-center gap-2 text-charcoal/70">
                    <Calendar size={16} className="text-sage" />
                    <span className="font-body text-sm">
                      {format(new Date(classTimeIso), "EEEE, MMMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-charcoal/70">
                    <Clock size={16} className="text-sage" />
                    <span className="font-body text-sm">
                      {format(new Date(classTimeIso), "h:mm a")}
                    </span>
                  </div>
                </>
              ) : (
                <p className="font-body text-sm text-charcoal/50">Class time to be confirmed.</p>
              )}

              {holdActive && (
                <p className="font-body text-sm text-terracotta">
                  Seat held until {format(new Date(holdMs), "h:mm a")}
                </p>
              )}
            </div>

            {showRecovery && (
              <div className="mt-6 border-t border-sage/10 pt-6 space-y-4">
                <div>
                  <h3 className="font-display text-lg text-charcoal">Payment pending</h3>
                  <p className="font-body text-sm text-charcoal/60 mt-1">
                    This booking isn't confirmed yet. If you've already paid, recover it below — otherwise
                    complete your payment to secure the seat.
                  </p>
                </div>

                {reconcileMessage && (
                  <div className="rounded-lg border border-terracotta/30 bg-terracotta/5 px-4 py-3">
                    <p className="font-body text-sm text-charcoal">{reconcileMessage}</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() => void handleAlreadyPaid()}
                    disabled={reconciling}
                    variant="outline"
                    className="border-sage/30 text-charcoal hover:bg-sage/5 hover:text-charcoal! h-11"
                  >
                    {reconciling ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" /> Checking…
                      </>
                    ) : (
                      "I've already paid"
                    )}
                  </Button>

                  {/* TODO: full in-page Razorpay re-checkout for the existing pending order
                      (would need order amount in paise + verify/finish-checkout wiring).
                      For now we send the member back to the booking flow to complete payment. */}
                  <Button asChild variant="sage" className="h-11">
                    <Link href="/portal/book">Complete payment</Link>
                  </Button>
                </div>
              </div>
            )}

            {booking.status === "confirmed" && (
              <div className="mt-6 border-t border-sage/10 pt-6">
                <p className="font-body text-sm text-charcoal/70">
                  Your seat is confirmed. See you in class!
                </p>
              </div>
            )}

            {booking.status === "cancelled" && (
              <div className="mt-6 border-t border-sage/10 pt-6 space-y-5">
                <h3 className="font-display text-lg text-charcoal">Cancellation</h3>

                <ol className="space-y-3">
                  {booking.bookedAt && <TimelineRow label="Booked" when={booking.bookedAt} tone="muted" />}
                  <TimelineRow
                    label={booking.cancelledBy ? `Cancelled by ${booking.cancelledBy}` : "Cancelled"}
                    when={booking.cancellationDate}
                    note={booking.cancellationReason}
                    tone="danger"
                  />
                  <li className="flex gap-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${booking.refundStatus === "auto_pass" || booking.refundStatus.startsWith("approved") ? "bg-sage" : "bg-charcoal/30"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm font-medium text-charcoal">Refund</p>
                      <p className="font-body text-sm text-charcoal/70">{refundStatusText(booking)}</p>
                      {/* Who got what — booker + each group member. */}
                      <ul className="mt-1.5 space-y-1">
                        {booking.refundRoster.map((r, i) => (
                          <li key={`${r.name}-${i}`} className="flex items-center justify-between font-body text-sm">
                            <span className="text-charcoal/70">{r.isYou ? "You" : r.name}</span>
                            <span className={r.refund === "1 Class Pass" || r.refund.startsWith("₹") ? "font-medium text-sage" : "text-charcoal/50"}>
                              {r.refund}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                </ol>

                {booking.group.length > 0 && (
                  <div>
                    <p className="font-body text-xs font-medium text-charcoal/60 mb-1.5">Group you brought</p>
                    <ul className="space-y-1">
                      {booking.group.map((g, i) => (
                        <li key={`${g.name}-${i}`} className="flex items-center justify-between font-body text-sm">
                          <span className="text-charcoal">{g.name}</span>
                          <Pill {...bookingStatusPill(g.status)}>{statusLabel(g.status)}</Pill>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {booking.canRequestRefund && (
                  <div className="rounded-lg border border-sage/20 bg-sage/[0.04] p-4 space-y-3">
                    <p className="font-body text-sm text-charcoal/70">
                      No refund was issued for this cancellation. You can request one — the studio decides
                      whether to refund as money or a class pass.
                    </p>
                    <Textarea
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      rows={2}
                      placeholder="Reason for your refund request (optional)…"
                    />
                    <Button onClick={() => void handleRequestRefund()} disabled={requestingRefund} variant="sage" className="h-11">
                      {requestingRefund ? "Submitting…" : "Request refund"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
