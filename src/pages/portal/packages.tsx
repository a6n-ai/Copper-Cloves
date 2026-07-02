import { useEffect, useMemo, useRef, useState } from "react";
import { useStudioSWR } from "@/lib/swr";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useRouter } from "next/router";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

export const getServerSideProps = requireSessionSSP();
import { CalendarClock, Check, CreditCard, Download, Flame, Infinity as InfinityIcon, Plus, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { FormAlert } from "@/components/ui/form-alert";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill } from "@/components/ui/pill";
import { packageStatePill } from "@/lib/pillMaps";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CloseButton } from "@/components/ui/quick-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
// Razorpay client helpers are loaded lazily inside the purchase handler — keeps
// the SDK loader + completion helpers out of the initial /portal/packages bundle.
import {
  buildRazorpayReturnUrl,
  clearPendingRazorpayCheckout,
  loadPendingRazorpayCheckout,
  savePendingRazorpayCheckout,
} from "@/lib/pendingRazorpayCheckout";
import { cn } from "@/lib/utils";
import { formatInr } from "@/lib/packageCatalog";
import { effectivePackagePrice } from "@/lib/packageOffer";
import { ResponsiveCards } from "@/components/responsive/ResponsiveTable";
import { MobilePagination } from "@/components/responsive/MobilePagination";

interface Package {
  // Canonical PackageType id (from GET /api/packages). Carried through so the
  // coupon + purchase steps read it locally instead of refetching the catalog.
  id: string;
  name: string;
  price: string;
  originalPrice?: string;
  offerLabel?: string;
  classes: number | string;
  validity: string;
  benefits: string[];
  featured?: boolean;
  badge?: string;
}

interface PurchasePackageType {
  name?: string;
  is_unlimited?: boolean;
  class_count?: number;
  duration_months?: number;
  price?: number;
}

interface PurchaseRecord {
  id: string;
  is_active: boolean;
  is_paused: boolean;
  created_at: string;
  expires_at: string;
  remaining_credits: number;
  package_types?: PurchasePackageType;
}

/** Package state derived from is_active/is_paused/expiry/credits (no `status` column exists). */
function packageState(p: PurchaseRecord): { key: string; label: string } {
  if (new Date(p.expires_at) < new Date()) return { key: "expired", label: "Expired" };
  // A class pass with no classes left is used up — not a live pass, even before
  // its expiry date. Unlimited passes never deplete.
  if (!p.package_types?.is_unlimited && (p.remaining_credits ?? 0) <= 0)
    return { key: "depleted", label: "Used up" };
  if (p.is_paused) return { key: "paused", label: "Paused" };
  if (p.is_active) return { key: "active", label: "Active" };
  return { key: "inactive", label: "Inactive" };
}

/** Raw published PackageType row as returned by GET /api/packages. */
interface DbPackage {
  id: string;
  name: string;
  price: number | string;
  class_count?: number | null;
  duration_months?: number | null;
  is_unlimited?: boolean;
  benefits?: string[] | null;
  featured?: boolean;
  badge?: string | null;
  is_published?: boolean;
  offer_price?: number | string | null;
  offer_label?: string | null;
  offer_starts_at?: string | null;
  offer_ends_at?: string | null;
}

/** Human validity label derived from the package duration (no label column exists). */
function validityLabel(durationMonths?: number | null): string {
  if (!durationMonths || durationMonths <= 0) return "—";
  return durationMonths === 1 ? "1 month" : `${durationMonths} months`;
}

/** Map a DB PackageType row to the card-render shape. */
function toPackage(p: DbPackage): Package {
  const eff = effectivePackagePrice(
    {
      price: p.price,
      offer_price: p.offer_price ?? null,
      offer_label: p.offer_label,
      offer_starts_at: p.offer_starts_at,
      offer_ends_at: p.offer_ends_at,
    },
    new Date(),
  );
  return {
    id: p.id,
    name: p.name,
    price: formatInr(eff.payableInr),
    originalPrice: eff.isOffer ? formatInr(eff.originalInr) : undefined,
    offerLabel: eff.isOffer ? eff.label ?? undefined : undefined,
    classes: p.is_unlimited ? "Unlimited" : p.class_count ?? 0,
    validity: validityLabel(p.duration_months),
    benefits: Array.isArray(p.benefits) ? p.benefits : [],
    featured: p.featured,
    badge: p.badge ?? undefined,
  };
}

const HISTORY_PAGE_SIZE = 6;

/** Mirrors a purchase-history row skeleton. */
function PurchaseHistoryRowSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-card/80 border border-sage/10">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-7 w-20" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, i) => `stat-skeleton-${i}`).map((key) => (
          <div key={key}>
            <Skeleton className="h-3 w-20 mb-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PurchaseHistorySkeleton({ rows = 4 }: Readonly<{ rows?: number }>) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => `purchase-skeleton-${i}`).map((key) => (
        <PurchaseHistoryRowSkeleton key={key} />
      ))}
    </div>
  );
}

/** pricing-02 style tier card */
function PackageTierCard({
  pkg,
  isRecommended,
  onChoose,
}: Readonly<{
  pkg: Package;
  isRecommended: boolean;
  onChoose: (pkg: Package) => void;
}>) {
  let classesLabel: string | number;
  if (typeof pkg.classes === "number") {
    classesLabel = `${pkg.classes} ${pkg.classes === 1 ? "class" : "classes"}`;
  } else {
    classesLabel = pkg.classes;
  }

  return (
    <div
      className={cn(
        "relative flex-1 flex flex-col w-full",
        isRecommended && "md:scale-105 z-10"
      )}
    >
      <Card
        className={cn(
          "relative flex-1 flex flex-col rounded-2xl p-4 gap-4 sm:p-6 sm:gap-6 transition-shadow duration-300",
          isRecommended
            ? "border-2 border-sage hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]"
            : "border border-sage/20 hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]"
        )}
      >
        <CardHeader className="p-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <CardTitle className="font-body font-semibold text-xl text-charcoal">
              {pkg.name}
            </CardTitle>
            {isRecommended && (
              <Pill tone="success" appearance="solid" className="font-body font-semibold shrink-0" icon={<Flame size={12} />}>
                {pkg.badge ?? "Popular"}
              </Pill>
            )}
          </div>
          <CardDescription className="font-body text-sm text-charcoal/60">
            {classesLabel} · Valid {pkg.validity}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col flex-1 gap-4 sm:gap-6 p-0">
          {/* Big price */}
          <div className="flex flex-col">
            {pkg.offerLabel && (
              <span className="mb-1 inline-block w-fit rounded-md bg-terracotta/12 px-2 py-0.5 font-body text-xs font-semibold text-terracotta">
                {pkg.offerLabel}
              </span>
            )}
            <div className="flex items-baseline gap-2">
              {pkg.originalPrice && (
                <span className="font-body text-lg line-through text-charcoal/40 tabular-nums">{pkg.originalPrice}</span>
              )}
              <span className="font-body text-3xl sm:text-4xl font-semibold tabular-nums text-charcoal">{pkg.price}</span>
            </div>
          </div>

          <Separator className="bg-sage/10" />

          {/* Feature checklist */}
          <ul className="flex flex-col gap-2.5 sm:gap-3 flex-1">
            {pkg.benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3 font-body text-sm text-charcoal/70">
                <Check className="size-4 text-sage shrink-0" />
                {benefit}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <Button
            onClick={() => onChoose(pkg)}
            variant={isRecommended ? "sage" : "sage-outline"}
            className="w-full min-h-[44px] font-semibold rounded-full"
          >
            Choose Plan
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PackagesPage() {
  const router = useRouter();
  const { status } = useSession();
  const { selected } = router.query;
  const [selectedCategory, setSelectedCategory] = useState<"studio" | "class">("studio");
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [premiumPackages, setPremiumPackages] = useState<Package[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  // Catalog is revealed on demand — members land on their own passes first.
  const [showCatalog, setShowCatalog] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    paymentMethod: "online" as const
  });

  // Profile via shared SWR (deduped across the portal). Seed the purchase form
  // once so focus-revalidation can't overwrite what the buyer is typing.
  const { data: profileData } = useStudioSWR<{ full_name?: string; email?: string; phone?: string }>("/api/user/profile");
  const profileSeededRef = useRef(false);
  useEffect(() => {
    if (!profileData || profileSeededRef.current) return;
    profileSeededRef.current = true;
    setFormData((prev) => ({
      ...prev,
      fullName: profileData.full_name || "",
      email: profileData.email || "",
      phone: profileData.phone || "",
    }));
  }, [profileData]);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number | null>(null);
  const [paymentRecovery, setPaymentRecovery] = useState<
    | { variant: "cancelled" }
    | { variant: "failed"; detail: string }
    | null
  >(null);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated") {
      loadProfileAndHistory();
    }
  }, [router, status]);

  // Packages come from the DB (GET /api/packages → published only). The code
  // catalog is seed data only; the portal never renders it directly.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/packages");
        const rows: DbPackage[] = res.ok ? await res.json() : [];
        // Published-only: the admin /api/packages GET returns all rows, so guard
        // here too — a member-facing buy list must never show hidden packages.
        const published = Array.isArray(rows) ? rows.filter((r) => r.is_published !== false) : [];
        if (!cancelled) setPremiumPackages(published.map(toPackage));
      } catch (err) {
        console.error("Error loading packages:", err);
      } finally {
        if (!cancelled) setLoadingPackages(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Honor ?selected=<name> once packages have loaded.
  useEffect(() => {
    if (!selected || typeof selected !== "string" || premiumPackages.length === 0) return;
    const pkg = premiumPackages.find((p) => p.name === selected);
    if (pkg) {
      setSelectedCategory(pkg.classes === "Unlimited" ? "studio" : "class");
      setShowCatalog(true);
    }
  }, [selected, premiumPackages]);

  async function loadProfileAndHistory() {
    try {
      // Profile loads via shared SWR (deduped across the portal); only the
      // page-specific purchase history is fetched here.
      // /api/user-packages returns raw Prisma userPackage rows (expiration_date,
      // purchase_date, credits_remaining, is_active, package_type). Map to the
      // shape this page renders — there is no `status` column, so derive it.
      const historyRes = await fetch("/api/user-packages");
      const raw = historyRes.ok ? await historyRes.json() : [];
      const history: PurchaseRecord[] = Array.isArray(raw)
        ? raw.map((p: Record<string, any>) => ({
            id: p.id,
            is_active: Boolean(p.is_active),
            is_paused: Boolean(p.is_paused),
            created_at: p.purchase_date ?? p.created_at,
            expires_at: p.expiration_date,
            remaining_credits: p.credits_remaining ?? 0,
            package_types: p.package_type ?? undefined,
          }))
        : [];
      setPurchaseHistory(history);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoadingHistory(false);
    }
  }

  const generateInvoicePDF = async (purchase: PurchaseRecord) => {
    const packageType = purchase.package_types;
    const state = packageState(purchase);
    const statusBadgeClass = {
      success: "status-active",
      warning: "status-paused",
      danger: "status-expired",
      info: "status-active",
      neutral: "status-expired",
    }[packageStatePill(state.key).tone ?? "neutral"];

    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice - ${purchase.id}</title>
        <style>
          body { font-family: 'Helvetica', Arial, sans-serif; margin: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #8F9779; padding-bottom: 20px; }
          .company-name { font-size: 28px; font-weight: bold; color: #8F9779; margin-bottom: 5px; }
          .tagline { font-size: 14px; color: #666; }
          .invoice-details { margin: 30px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
          .detail-label { font-weight: 600; color: #666; }
          .detail-value { color: #333; }
          .package-section { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 30px 0; }
          .package-name { font-size: 22px; font-weight: bold; margin-bottom: 15px; color: #8F9779; }
          .total-section { margin-top: 40px; text-align: right; padding: 20px; background: #f0f4f0; border-radius: 8px; }
          .total-amount { font-size: 32px; font-weight: bold; color: #8F9779; }
          .footer { margin-top: 60px; text-align: center; font-size: 12px; color: #999; padding-top: 20px; border-top: 1px solid #eee; }
          .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: 600; }
          .status-active { background: #d4edda; color: #155724; }
          .status-paused { background: #f3e2d6; color: #8a4b2f; }
          .status-expired { background: #f8d7da; color: #721c24; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
          th { background: #8F9779; color: white; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">The Studio by Copper + Cloves</div>
          <div class="tagline">Your home away from home</div>
        </div>

        <h2 style="color: #8F9779;">INVOICE</h2>

        <div class="invoice-details">
          <div class="detail-row">
            <span class="detail-label">Invoice Number:</span>
            <span class="detail-value">${purchase.id.substring(0, 8).toUpperCase()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date Issued:</span>
            <span class="detail-value">${new Date(purchase.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="detail-value">
              <span class="status-badge ${statusBadgeClass}">
                ${state.label.toUpperCase()}
              </span>
            </span>
          </div>
        </div>

        <div class="package-section">
          <div class="package-name">${packageType?.name || "Package"}</div>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Details</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>${packageType?.name}</strong></td>
                <td>
                  ${packageType?.is_unlimited ? 'Unlimited Classes' : `${packageType?.class_count} Classes`}<br>
                  Valid for ${packageType?.duration_months} month(s)<br>
                  Expires: ${new Date(purchase.expires_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </td>
                <td><strong>₹${packageType?.price?.toLocaleString("en-IN")}</strong></td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 20px;">
            <div class="detail-row">
              <span class="detail-label">Classes Used:</span>
              <span class="detail-value">${packageType?.is_unlimited ? 'Unlimited' : `${(packageType?.class_count || 0) - (purchase.remaining_credits || 0)} / ${packageType?.class_count || 0}`}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Classes Remaining:</span>
              <span class="detail-value">${packageType?.is_unlimited ? 'Unlimited' : purchase.remaining_credits || 0}</span>
            </div>
          </div>
        </div>

        <div class="total-section">
          <div style="font-size: 16px; color: #666; margin-bottom: 10px;">Total Amount Paid</div>
          <div class="total-amount">₹${packageType?.price?.toLocaleString("en-IN") || "0"}</div>
        </div>

        <div class="footer">
          <p><strong>The Studio by Copper + Cloves</strong></p>
          <p>Thank you for choosing us for your wellness journey!</p>
          <p style="margin-top: 20px;">Questions? Contact us at hello@copperandcloves.com</p>
        </div>
      </body>
      </html>
    `;

    const blobUrl = URL.createObjectURL(new Blob([invoiceHTML], { type: "text/html" }));
    const printWindow = window.open(blobUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        URL.revokeObjectURL(blobUrl);
      }, 250);
    } else {
      URL.revokeObjectURL(blobUrl);
    }
  };

  const handleChoosePlan = (pkg: Package) => {
    setSelectedPackage(pkg);
    setShowCheckout(true);
  };

  const closeCheckout = () => {
    setShowCheckout(false);
    setSelectedPackage(null);
    setError(null);
    setSuccess(false);
    setCouponCode("");
    setCouponError(null);
    setCouponDiscount(null);
    setPaymentRecovery(null);
  };

  const packageSubtotalInr = (pkg: typeof selectedPackage) => {
    if (!pkg?.price) return 0;
    return parseInt(String(pkg.price).replace(/\D/g, ""), 10) || 0;
  };

  async function validatePackageCoupon(pkg: NonNullable<typeof selectedPackage>) {
    setCouponError(null);
    const subtotal = packageSubtotalInr(pkg);
    if (subtotal <= 0) return;
    const ctx = pkg.classes === "Unlimited" ? "studio_pass" : "class_pass";
    const packageTypeId = pkg.id || undefined;
    const r = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponCode, context: ctx, subtotal, package_type_id: packageTypeId }),
    });
    const d = r.ok ? await r.json() : { valid: false, error: "Could not validate" };
    if (!d.valid) {
      setCouponDiscount(null);
      setCouponError(typeof d.error === "string" ? d.error : "Invalid coupon");
      return;
    }
    setCouponDiscount(Number(d.discountInr) || 0);
  }

  const handlePurchase = async (e?: React.SyntheticEvent<HTMLFormElement>) => {
    e?.preventDefault();
    setError(null);
    if (!formData.fullName || !formData.email || !formData.phone) {
      setError("Please fill in all required fields");
      return;
    }
    if (!selectedPackage) {
      setError("Invalid purchase request");
      return;
    }
    setIsProcessing(true);
    const razorpayOrderIdForPackage: string | null = null;
    try {
      // Package id is carried on the card (from the catalog load), so no refetch
      // needed. The server (create-order / user-packages) still validates the id
      // against the canonical catalog — the member flow never creates a type.
      const packageType = { id: selectedPackage.id };

      if (!packageType.id) throw new Error("This package isn't available right now. Please contact the studio.");

      const subtotal = packageSubtotalInr(selectedPackage);
      const discount = couponDiscount ?? 0;
      const payableInr = Math.max(0, subtotal - discount);

      if (payableInr > 0) {
        const createRes = await fetch("/api/payments/razorpay/create-order", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purpose: "package",
            package_type_id: packageType.id,
            pass_type: selectedPackage.classes === "Unlimited" ? "studio_pass" : "class_pass",
            coupon_code: couponCode.trim() || undefined,
          }),
        });
        if (!createRes.ok) {
          let msg = "Could not start Razorpay checkout.";
          try {
            const errBody = await createRes.json();
            if (typeof errBody?.error === "string") msg = errBody.error;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }

        const orderPayload = (await createRes.json()) as {
          order_id?: string;
          amount?: number | string;
          currency?: string;
          key_id?: string;
          razorpay_mode?: "test" | "live" | "unknown";
        };

        if (
          !orderPayload.order_id ||
          orderPayload.key_id === null ||
          orderPayload.key_id === undefined ||
          String(orderPayload.key_id).trim() === "" ||
          orderPayload.amount === null ||
          orderPayload.amount === undefined
        ) {
          throw new Error("Invalid payment setup from server.");
        }

        const amountPaise = Number(orderPayload.amount);
        if (!Number.isFinite(amountPaise)) {
          throw new Error("Invalid order amount from Razorpay.");
        }

        savePendingRazorpayCheckout({
          purpose: "package",
          razorpayOrderId: orderPayload.order_id,
          package_type_id: packageType.id,
          pass_type: selectedPackage.classes === "Unlimited" ? "studio_pass" : "class_pass",
          coupon_code: couponCode.trim() || undefined,
          savedAt: Date.now(),
        });

        const { payWithRazorpayOrder } = await import("@/lib/razorpayCheckout");
        const checkoutResult = await payWithRazorpayOrder({
          keyId: String(orderPayload.key_id).trim(),
          amountPaise,
          currency: orderPayload.currency ?? "INR",
          orderId: orderPayload.order_id,
          name: "Copper Cloves",
          description: selectedPackage.name ? `Package — ${selectedPackage.name}` : "Studio package",
          prefill: { email: formData.email || undefined, name: formData.fullName || undefined },
          callbackUrl: buildRazorpayReturnUrl("package"),
          // Full-page redirect (not modal+handler) so a closed tab / mobile
          // backgrounding can't drop the capture — Razorpay returns to the
          // return page, which finalizes and shows the hooray.
          redirect: true,
        });
        if (checkoutResult.kind === "cancelled") {
          clearPendingRazorpayCheckout();
          setPaymentRecovery({ variant: "cancelled" });
          return;
        }
        if (checkoutResult.kind === "failed") {
          clearPendingRazorpayCheckout();
          const { razorpayPaymentErrorHelp } = await import("@/lib/razorpayClientHints");
          setPaymentRecovery({
            variant: "failed",
            detail: razorpayPaymentErrorHelp(
              checkoutResult.message,
              String(orderPayload.key_id).trim(),
              orderPayload.razorpay_mode,
            ),
          });
          return;
        }

        if (checkoutResult.kind !== "success") {
          return;
        }
        const pending = loadPendingRazorpayCheckout();
        if (!pending || pending.purpose !== "package") {
          throw new Error("Checkout session lost. Please try again.");
        }
        const { completePendingPackageCheckout } = await import("@/lib/completeRazorpayCheckout");
        await completePendingPackageCheckout(pending, checkoutResult.payload);
        clearPendingRazorpayCheckout();
        setShowCheckout(false);
        router.push("/portal/dashboard");
        return;
      }

      const purchaseRes = await fetch("/api/user-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          package_type_id: packageType.id,
          pass_type: selectedPackage.classes === "Unlimited" ? "studio_pass" : "class_pass",
          coupon_code: couponCode.trim() || undefined,
          razorpay_order_id: payableInr > 0 ? razorpayOrderIdForPackage : null,
        }),
      });
      if (!purchaseRes.ok) {
        let msg = "Purchase failed";
        try {
          const errBody = await purchaseRes.json();
          if (typeof errBody?.error === "string") msg = errBody.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }

      setSuccess(true);
      setTimeout(() => router.push("/portal/dashboard"), 2000);
    } catch (err) {
      console.error("Purchase error:", err);
      setError(err instanceof Error ? err.message : "Failed to complete purchase. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter packages based on active tab
  const classPassPackages = premiumPackages.filter(pkg =>
    typeof pkg.classes === "number"
  );

  const studioPassPackages = premiumPackages.filter(pkg =>
    pkg.classes === "Unlimited"
  );

  const currentPackages = selectedCategory === "class"
    ? classPassPackages
    : studioPassPackages;

  // Recommended: use featured flag if present; fall back to middle card.
  const recommendedIndex = useMemo(() => {
    const fi = currentPackages.findIndex((p) => p.featured);
    if (fi !== -1) return fi;
    return Math.floor((currentPackages.length - 1) / 2);
  }, [currentPackages]);

  // Member's live passes — active (not expired/paused-out) — expiring soonest first,
  // matching the order the booking flow spends them.
  const activePasses = useMemo(
    () =>
      purchaseHistory
        .filter((p) => packageState(p).key === "active")
        .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()),
    [purchaseHistory],
  );
  // Show the catalog by default only when there's nothing active to show.
  useEffect(() => {
    if (!loadingHistory && activePasses.length === 0) setShowCatalog(true);
  }, [loadingHistory, activePasses.length]);

  const totalHistoryPages = Math.max(1, Math.ceil(purchaseHistory.length / HISTORY_PAGE_SIZE));
  const pagedHistory = useMemo(
    () => purchaseHistory.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE),
    [purchaseHistory, historyPage],
  );

  return (
    <div className="min-h-screen bg-linear-to-b from-cream via-card to-cream">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12">
        {/* Header */}
        <div className="mb-6">
          <PageHeader
            title="Your Packages"
            subtitle="Your active passes — and everything you can add"
          />
        </div>

        {/* My active passes */}
        <section className="mb-10">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-body font-semibold text-2xl text-charcoal">Active passes</h2>
              <p className="font-body text-sm text-charcoal/60">
                {activePasses.length > 0
                  ? "Classes are used from the pass expiring soonest."
                  : "You don't have an active pass yet."}
              </p>
            </div>
            {!showCatalog && (
              <Button
                variant="sage"
                size="lg"
                className="w-full cursor-pointer sm:w-auto"
                onClick={() => {
                  setShowCatalog(true);
                  requestAnimationFrame(() =>
                    document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  );
                }}
              >
                <Plus size={18} className="mr-1.5" />
                Buy a package
              </Button>
            )}
          </div>

          {loadingHistory ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 2 }, (_, i) => `active-skeleton-${i}`).map((key) => (
                <Skeleton key={key} className="h-40 rounded-2xl" />
              ))}
            </div>
          ) : activePasses.length === 0 ? (
            <div className="rounded-2xl border border-sage/10 bg-white-warm px-6 py-12 text-center">
              <CreditCard className="mx-auto mb-3 text-charcoal/20" size={40} />
              <h3 className="mb-1 font-body text-lg font-semibold text-charcoal">No active passes</h3>
              <p className="font-body text-sm text-charcoal/60">
                Pick a package below to start booking classes.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activePasses.map((pass, index) => {
                const pt = pass.package_types;
                const unlimited = !!pt?.is_unlimited;
                const total = pt?.class_count ?? 0;
                const left = pass.remaining_credits ?? 0;
                const daysLeft = Math.max(
                  0,
                  Math.ceil((new Date(pass.expires_at).getTime() - Date.now()) / 86400000),
                );
                const expiringSoon = daysLeft <= 7;
                const soonest = index === 0;
                return (
                  <div
                    key={pass.id}
                    className={`relative rounded-2xl border bg-white-warm p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)] ${
                      soonest ? "border-sage/40" : "border-sage/15"
                    }`}
                  >
                    {soonest && activePasses.length > 1 && (
                      <Pill tone="success" className="absolute right-4 top-4">Used next</Pill>
                    )}
                    <h3 className="truncate pr-20 font-body text-lg font-semibold text-charcoal">
                      {pt?.name || "Package"}
                    </h3>
                    <div className="mt-4 flex items-end gap-2">
                      {unlimited ? (
                        <span className="inline-flex items-center gap-1.5 text-sage">
                          <InfinityIcon size={28} />
                          <span className="font-body text-lg font-semibold">Unlimited</span>
                        </span>
                      ) : (
                        <>
                          <span className="font-body text-4xl font-semibold leading-none tabular-nums text-sage">
                            {left}
                          </span>
                          <span className="mb-1 font-body text-sm text-charcoal/50">
                            of {total} classes left
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-body text-sm text-charcoal/60">
                      <CalendarClock size={15} className={expiringSoon ? "text-terracotta" : "text-charcoal/40"} />
                      <span className={expiringSoon ? "font-medium text-terracotta" : ""}>
                        {daysLeft === 0 ? "Expires today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                      </span>
                      <span className="text-charcoal/30">·</span>
                      <span>
                        {new Date(pass.expires_at).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Buy catalog — revealed on demand */}
        {showCatalog && (
          <section id="catalog" className="scroll-mt-24">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-body text-2xl font-semibold text-charcoal">Buy a package</h2>
                <p className="font-body text-sm text-charcoal/60">Choose a pass that fits your rhythm.</p>
              </div>
              {activePasses.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Hide packages"
                  className="cursor-pointer text-charcoal/50 hover:text-charcoal"
                  onClick={() => setShowCatalog(false)}
                >
                  <X size={18} />
                </Button>
              )}
            </div>

            {/* Tab Switcher */}
            <div className="mb-8 flex justify-center">
              <div className="inline-flex w-full max-w-xs rounded-full border border-sage/10 bg-white-warm p-1.5 sm:w-auto">
                <button
                  onClick={() => setSelectedCategory("class")}
                  className={`flex-1 rounded-full px-5 py-2.5 font-body text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1 sm:flex-none ${
                    selectedCategory === "class"
                      ? "bg-sage text-cream"
                      : "text-charcoal/70 hover:text-charcoal"
                  }`}
                >
                  Class Pass
                </button>
                <button
                  onClick={() => setSelectedCategory("studio")}
                  className={`flex-1 rounded-full px-5 py-2.5 font-body text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1 sm:flex-none ${
                    selectedCategory === "studio"
                      ? "bg-sage text-cream"
                      : "text-charcoal/70 hover:text-charcoal"
                  }`}
                >
                  Studio Pass
                </button>
              </div>
            </div>

            {/* Pricing tier cards — pricing-02 layout */}
            {loadingPackages ? (
              <div className="flex flex-col gap-5 md:flex-row md:items-stretch md:gap-6">
                {Array.from({ length: 3 }, (_, i) => `pkg-skeleton-${i}`).map((key) => (
                  <Skeleton key={key} className="h-80 flex-1 rounded-2xl" />
                ))}
              </div>
            ) : currentPackages.length === 0 ? (
              <div className="rounded-2xl border border-sage/10 bg-white-warm px-6 py-16 text-center">
                <CreditCard className="mx-auto mb-4 text-charcoal/20" size={48} />
                <h3 className="mb-1 font-body text-xl font-semibold text-charcoal">No packages available</h3>
                <p className="font-body text-sm text-charcoal/60">
                  Please check back soon or contact the studio.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-5 md:flex-row md:items-stretch md:gap-6">
                {currentPackages.map((pkg, index) => (
                  <PackageTierCard
                    key={pkg.name}
                    pkg={pkg}
                    isRecommended={index === recommendedIndex}
                    onChoose={handleChoosePlan}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Purchase History Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 mt-4 border-t border-sage/10">
        <div className="mb-6">
          <h2 className="font-body font-semibold text-2xl text-charcoal mb-1">Purchase History</h2>
          <p className="font-body text-sm text-charcoal/60">
            Your past package purchases and transactions
          </p>
        </div>

        {loadingHistory && <PurchaseHistorySkeleton rows={4} />}
        {!loadingHistory && purchaseHistory.length === 0 && (
          <div className="text-center py-16 px-6 rounded-2xl bg-white-warm border border-sage/10">
            <CreditCard className="mx-auto mb-4 text-charcoal/20" size={48} />
            <h3 className="font-body font-semibold text-xl text-charcoal mb-1">No purchases yet</h3>
            <p className="font-body text-sm text-charcoal/60">
              Your purchase history will appear here once you buy a package
            </p>
          </div>
        )}
        {!loadingHistory && purchaseHistory.length > 0 && (
          <>
            <ResponsiveCards
              data={pagedHistory}
              renderCard={(purchase, _i) => {
                const packageType = purchase.package_types;
                const { key: cardStatusKey, label: cardStatusLabel } = packageState(purchase);
                return (
                  <div
                    key={purchase.id}
                    className="p-4 rounded-xl bg-white-warm border border-sage/10 hover:border-sage/30 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-body font-semibold text-base text-charcoal truncate">
                          {packageType?.name || "Unknown Package"}
                        </h3>
                        <Pill {...packageStatePill(cardStatusKey)} className="mt-1">
                          {cardStatusLabel}
                        </Pill>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-body text-xs text-charcoal/50 mb-0.5">Amount Paid</p>
                        <p className="font-body text-lg font-semibold tabular-nums text-sage">
                          ₹{packageType?.price?.toLocaleString("en-IN") || "0"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                      <div>
                        <p className="font-body text-xs text-charcoal/50 mb-0.5">Purchased</p>
                        <p className="font-body text-sm text-charcoal">
                          {new Date(purchase.created_at).toLocaleDateString("en-US", {
                            year: "numeric", month: "short", day: "numeric"
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="font-body text-xs text-charcoal/50 mb-0.5">Expires</p>
                        <p className="font-body text-sm text-charcoal">
                          {new Date(purchase.expires_at).toLocaleDateString("en-US", {
                            year: "numeric", month: "short", day: "numeric"
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="font-body text-xs text-charcoal/50 mb-0.5">Classes</p>
                        <p className="font-body text-sm text-charcoal">
                          {packageType?.is_unlimited
                            ? "Unlimited"
                            : `${purchase.remaining_credits || 0} / ${packageType?.class_count || 0}`}
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={() => generateInvoicePDF(purchase)}
                      variant="sage-outline"
                      size="sm"
                      className="text-xs"
                    >
                      <Download size={14} className="mr-1.5" />
                      Download Invoice
                    </Button>
                  </div>
                );
              }}
              renderTable={() => (
                <div className="space-y-3">
                  {pagedHistory.map((purchase) => {
                    const packageType = purchase.package_types;
                    const { key: rowStatusKey, label: rowStatusLabel } = packageState(purchase);
                    return (
                      <div
                        key={purchase.id}
                        className="p-4 rounded-xl bg-white-warm border border-sage/10 hover:border-sage/30 transition-all duration-200"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-body font-semibold text-base text-charcoal">
                              {packageType?.name || "Unknown Package"}
                            </h3>
                            <Pill {...packageStatePill(rowStatusKey)} className="mt-1">
                              {rowStatusLabel}
                            </Pill>
                          </div>
                          <div className="text-sm text-charcoal/70 font-body shrink-0">
                            {new Date(purchase.created_at).toLocaleDateString("en-US", {
                              year: "numeric", month: "short", day: "numeric"
                            })}
                          </div>
                          <div className="text-sm text-charcoal/70 font-body shrink-0">
                            {new Date(purchase.expires_at).toLocaleDateString("en-US", {
                              year: "numeric", month: "short", day: "numeric"
                            })}
                          </div>
                          <div className="text-sm text-charcoal/70 font-body shrink-0">
                            {packageType?.is_unlimited
                              ? "Unlimited"
                              : `${purchase.remaining_credits || 0} / ${packageType?.class_count || 0}`}
                          </div>
                          <div className="font-body text-lg font-semibold tabular-nums text-sage shrink-0">
                            ₹{packageType?.price?.toLocaleString("en-IN") || "0"}
                          </div>
                          <Button
                            onClick={() => generateInvoicePDF(purchase)}
                            variant="sage-outline"
                            size="sm"
                            className="shrink-0 text-xs"
                          >
                            <Download size={14} className="mr-1.5" />
                            Invoice
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            />

            {totalHistoryPages > 1 && (
              <MobilePagination
                currentPage={historyPage}
                totalPages={totalHistoryPages}
                onPageChange={(p) => { setHistoryPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="mt-4"
              />
            )}
          </>
        )}
      </div>

      {/* Checkout Modal — bottom sheet on phones, centered dialog on md+ */}
      {showCheckout && selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-charcoal/60 animate-in fade-in duration-300">
          {success ? (
            <div className="bg-white-warm rounded-3xl max-w-md w-full p-8 shadow-[0_8px_48px_rgba(51,51,51,0.14)] animate-in zoom-in-95 duration-500 text-center">
              <div className="w-14 h-14 rounded-full bg-sage/20 flex items-center justify-center mx-auto mb-3">
                <Check className="text-sage" size={28} />
              </div>
              <h2 className="font-body font-semibold text-2xl text-charcoal mb-2">Purchase Successful!</h2>
              <p className="font-body text-sm text-charcoal/70 mb-4">
                Your {selectedPackage.name} has been activated. Redirecting to your dashboard...
              </p>
              <div className="flex items-center justify-center gap-2">
                <Spinner className="size-4 text-sage" />
                <span className="font-body text-sm text-charcoal/60">Redirecting...</span>
              </div>
            </div>
          ) : (
            // Compact checkout: max-h-[100dvh] so it never overflows the phone screen
            <div className="bg-white-warm rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto shadow-[0_8px_48px_rgba(51,51,51,0.14)] animate-in slide-in-from-bottom sm:zoom-in-95 duration-400 relative">
              {/* Drag handle — mobile only */}
              <div className="sm:hidden flex justify-center pt-2.5 pb-0">
                <div className="w-9 h-1 rounded-full bg-charcoal/20" />
              </div>

              {/* Compact header */}
              <div className="sticky top-0 z-20 bg-white-warm pt-2 sm:pt-4 px-4 sm:px-5 pb-3 border-b border-sage/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-body font-semibold text-lg sm:text-2xl text-charcoal leading-tight">Complete Your Purchase</h2>
                    <p className="font-body text-xs text-charcoal/60 mt-0.5">{selectedPackage?.name}</p>
                  </div>
                  <CloseButton
                    onClick={closeCheckout}
                    label="Close checkout"
                    className="rounded-full shrink-0"
                  />
                </div>
              </div>

              {/* Compact summary */}
              <div className="px-4 sm:px-5 py-3 border-b border-sage/10 bg-sage/5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-baseline gap-2">
                    <span className="font-body text-xs text-charcoal/50 shrink-0">Classes</span>
                    <span className="font-body text-sm font-semibold text-charcoal">{selectedPackage.classes}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-body text-xs text-charcoal/50 shrink-0">Valid</span>
                    <span className="font-body text-sm font-semibold text-charcoal">{selectedPackage.validity}</span>
                  </div>
                  <div className="col-span-2 flex items-baseline gap-2">
                    <span className="font-body text-xs text-charcoal/50 shrink-0">Total</span>
                    <span className="font-body text-xl font-semibold tabular-nums text-sage">{selectedPackage.price}</span>
                    {couponDiscount !== null && couponDiscount !== undefined && couponDiscount > 0 && (
                      <span className="font-body text-sm text-sage">
                        → ₹{Math.max(0, packageSubtotalInr(selectedPackage) - couponDiscount).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Coupon row — inline on one line */}
                <div className="mt-2 flex gap-2">
                  <Input
                    className="h-8 border-sage/20 font-mono uppercase text-sm flex-1"
                    aria-label="Promo code"
                    placeholder="Promo code"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setCouponDiscount(null);
                      setCouponError(null);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-sage/30 h-8 shrink-0"
                    onClick={() => selectedPackage && void validatePackageCoupon(selectedPackage)}
                  >
                    Apply
                  </Button>
                </div>
                {couponError && (
                  <p className="text-xs text-destructive font-body mt-1">{couponError}</p>
                )}
              </div>

              {/* Compact form */}
              <form onSubmit={handlePurchase} className="px-4 sm:px-5 py-3 space-y-3">
                {/* Name + Phone side by side on sm+ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="fullName" className="font-body text-xs text-charcoal">Full Name *</Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="Your name"
                      required
                      className="h-9 border-sage/20 font-body text-sm placeholder:text-charcoal/40"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="phone" className="font-body text-xs text-charcoal">Phone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      required
                      className="h-9 border-sage/20 font-body text-sm placeholder:text-charcoal/40"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="email" className="font-body text-xs text-charcoal">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                    required
                    className="h-9 border-sage/20 font-body text-sm placeholder:text-charcoal/40"
                  />
                </div>

                {/* Payment method — compact single option */}
                <div className="flex items-center gap-3 p-3 rounded-xl border border-sage/20 bg-sage/5">
                  <div className="w-4 h-4 rounded-full border-2 border-sage flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-sage" />
                  </div>
                  <div>
                    <p className="font-body text-sm font-semibold text-charcoal">Online Payment</p>
                    <p className="font-body text-xs text-charcoal/50">Pay now via UPI / Card</p>
                  </div>
                </div>

                <FormAlert message={error} variant="error" />

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={closeCheckout}
                    variant="outline"
                    className="flex-1 border-sage/30 text-charcoal hover:bg-sage/10 h-11 hover:text-charcoal!"
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="sage"
                    className="flex-1 h-11 font-semibold"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Spinner className="mr-2 size-4" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard size={16} className="mr-2" />
                        Pay Now
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-center font-body text-xs text-charcoal/40 pb-1">
                  By purchasing you agree to our Terms of Service
                </p>
              </form>
            </div>
          )}
        </div>
      )}

      <AlertDialog
        open={paymentRecovery !== null}
        onOpenChange={(open) => {
          if (!open) setPaymentRecovery(null);
        }}
      >
        <AlertDialogContent className="border-sage/20 bg-white-warm text-charcoal">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {paymentRecovery?.variant === "failed" ? "Payment didn't go through" : "Payment cancelled"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {paymentRecovery?.variant === "cancelled" ? (
                <span>You closed the checkout. You can try again when you're ready.</span>
              ) : (
                <span className="whitespace-pre-line block">
                  {paymentRecovery?.detail ?? "Something went wrong with this payment attempt."}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPaymentRecovery(null)}>Close</AlertDialogCancel>
            <AlertDialogAction
              className="bg-sage hover:bg-sage/90"
              onClick={() => {
                setPaymentRecovery(null);
                void handlePurchase();
              }}
            >
              Try again
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
