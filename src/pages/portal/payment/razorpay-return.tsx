import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  completePendingBookingCheckout,
  completePendingPackageCheckout,
  razorpayPayloadFromSearch,
} from "@/lib/completeRazorpayCheckout";
import {
  clearPendingRazorpayCheckout,
  loadPendingRazorpayCheckout,
} from "@/lib/pendingRazorpayCheckout";

export default function RazorpayReturnPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("Finishing your payment…");

  useEffect(() => {
    if (!router.isReady) return;

    let cancelled = false;

    void (async () => {
      const pending = loadPendingRazorpayCheckout();
      if (!pending) {
        if (!cancelled) {
          setStatus("error");
          setMessage(
            "No checkout session found (it may have expired). Book again from the same browser you used to pay.",
          );
        }
        return;
      }

      const payload = razorpayPayloadFromSearch(
        typeof window !== "undefined" ? window.location.search : "",
      );

      try {
        if (payload) {
          if (pending.purpose === "booking") {
            await completePendingBookingCheckout(pending, payload);
          } else {
            await completePendingPackageCheckout(pending, payload);
          }
        } else {
          const finishRes = await fetch("/api/payments/razorpay/finish-checkout", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pending }),
          });
          if (!finishRes.ok) {
            let msg = "Could not complete checkout after payment.";
            try {
              const errBody = await finishRes.json();
              if (typeof errBody?.error === "string") msg = errBody.error;
            } catch {
              /* ignore */
            }
            throw new Error(msg);
          }
        }

        clearPendingRazorpayCheckout();
        if (!cancelled) {
          setStatus("ok");
          setMessage(
            pending.purpose === "booking"
              ? "Booking confirmed. Your class is saved."
              : "Package purchased successfully.",
          );
          setTimeout(
            () =>
              void router.replace(
                pending.purpose === "booking" ? "/portal/bookings" : "/portal/dashboard",
              ),
            1500,
          );
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setMessage(e instanceof Error ? e.message : "Could not complete checkout.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, router.isReady]);

  return (
    <>
      <SEO title="Payment — The Studio" description="Completing your payment" />
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/5 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl border border-sage/20 bg-[#fafaf8]/95 p-8 text-center shadow-xl">
          {status === "working" ? (
            <Spinner className="size-10 text-sage mx-auto mb-4" />
          ) : null}
          <p className="font-body text-charcoal mb-6">{message}</p>
          {status === "error" ? (
            <div className="flex flex-col gap-2">
              <Button asChild variant="sage">
                <Link href="/portal/book">Back to Book Class</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/portal/dashboard">Portal home</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
