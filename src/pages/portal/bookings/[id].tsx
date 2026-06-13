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

function DetailSkeleton() {
  return (
    <div className="bg-white-warm rounded-xl shadow-xs border border-sage/10 p-6 space-y-4">
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
          <div className="bg-white-warm rounded-xl shadow-xs border border-sage/10 p-5 sm:p-7">
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
                  Seat held until {format(new Date(holdMs!), "h:mm a")}
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
          </div>
        )}
      </div>
    </div>
  );
}
