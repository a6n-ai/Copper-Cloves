import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { SEO as Seo } from "@/components/SEO";
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

const CONFETTI_COLORS = ["#8f9779", "#c17856", "#e8e4d9", "#a05e38"];

/** Lightweight hooray burst — no dependency, brand palette, reduced-motion safe. */
function Hooray() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto mb-4 h-16 w-16">
      <motion.div
        initial={reduce ? false : { scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-sage/20"
      >
        <Check className="h-8 w-8 text-sage" />
      </motion.div>
      {!reduce &&
        Array.from({ length: 14 }, (_, i) => {
          const angle = (i / 14) * Math.PI * 2;
          const dist = 46 + (i % 3) * 10;
          return (
            <motion.span
              key={i}
              className="absolute left-1/2 top-1/2 h-2 w-2 rounded-[2px]"
              style={{ backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length] }}
              initial={{ x: -4, y: -4, opacity: 0, scale: 0.6 }}
              animate={{
                x: Math.cos(angle) * dist - 4,
                y: Math.sin(angle) * dist - 4,
                opacity: [0, 1, 0],
                scale: 1,
              }}
              transition={{ duration: 0.9, delay: 0.05 + (i % 3) * 0.04, ease: "easeOut" }}
            />
          );
        })}
    </div>
  );
}

export default function RazorpayReturnPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("Finishing your payment…");

  // Block tab close / refresh while the payment is being finalized — losing this
  // window before finish-checkout is exactly how captures go missing.
  useEffect(() => {
    if (status !== "working") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

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
              : "Hooray! Your pass is ready.",
          );
          setTimeout(
            () =>
              void router.replace(
                pending.purpose === "booking" ? "/portal/bookings" : "/portal/dashboard",
              ),
            2200,
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
      <Seo title="Payment — The Studio" description="Completing your payment" />
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/5 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl border border-sage/20 bg-white-warm p-8 text-center transition-shadow hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
          {status === "working" && (
            <>
              <Spinner className="size-10 text-sage mx-auto mb-4" />
              <p className="font-body font-semibold text-xl text-charcoal mb-1">Completing your payment…</p>
              <p className="font-body text-sm font-semibold text-destructive mb-2">
                Please don&apos;t close or refresh this tab.
              </p>
            </>
          )}
          {status === "ok" && <Hooray />}
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
