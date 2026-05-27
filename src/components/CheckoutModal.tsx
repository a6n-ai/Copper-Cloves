import { useEffect, useRef, useState } from "react";
import { X, Check, CreditCard, AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CloseButton } from "@/components/ui/quick-actions";
import { useRouter } from "next/router";

interface CheckoutModalProps {
  packageDetails: {
    name: string;
    price: string;
    validity: string;
    classes: string | number;
    packageTypeId?: string;
  };
  onClose: () => void;
  userId: string;
}

export function CheckoutModal({ packageDetails, onClose, userId }: CheckoutModalProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    paymentMethod: "online" as const
  });
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
  }, []);

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!formData.fullName || !formData.email || !formData.phone) {
      setError("Please fill in all required fields");
      return;
    }

    setIsProcessing(true);

    try {
      const allPkgsRes = await fetch("/api/packages");
      const allPkgs = allPkgsRes.ok ? await allPkgsRes.json() : [];
      let packageType = allPkgs.find((p: { name: string }) => p.name === packageDetails.name);

      if (!packageType) {
        const durationMonths = packageDetails.validity.includes("days")
          ? Math.round(parseInt(packageDetails.validity) / 30)
          : packageDetails.validity.includes("Month") ? parseInt(packageDetails.validity) : null;
        const createRes = await fetch("/api/packages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: packageDetails.name, type: "standard",
            class_count: typeof packageDetails.classes === "number" ? packageDetails.classes : null,
            duration_months: durationMonths,
            price: parseInt(packageDetails.price.replace(/[^0-9]/g, "")) || 0,
            includes_physique_57: true,
            is_unlimited: packageDetails.classes === "Unlimited",
            description: `Package: ${packageDetails.name}`,
          }),
        });
        packageType = createRes.ok ? await createRes.json() : null;
      }

      if (!packageType) throw new Error("Could not find or create package type");

      const purchaseRes = await fetch("/api/user-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          package_type_id: packageType.id,
          pass_type: packageDetails.classes === "Unlimited" ? "studio_pass" : "class_pass",
        }),
      });
      if (!purchaseRes.ok) throw new Error("Purchase failed");

      setSuccess(true);
      redirectTimeoutRef.current = setTimeout(() => router.push("/portal/dashboard"), 2000);
      
    } catch (err) {
      console.error("Purchase error:", err);
      setError(err instanceof Error ? err.message : "Failed to complete purchase. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-md animate-in fade-in duration-300">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl animate-in zoom-in-95 duration-500 text-center">
          <div className="w-16 h-16 rounded-full bg-sage/20 flex items-center justify-center mx-auto mb-4">
            <Check className="text-sage" size={32} />
          </div>
          <h2 className="font-display text-3xl text-charcoal mb-2">Purchase Successful!</h2>
          <p className="font-body text-charcoal/70 mb-6">
            Your {packageDetails.name} has been activated. Redirecting to your dashboard...
          </p>
          <div className="flex items-center justify-center gap-2">
            <Spinner className="size-5 text-sage" />
            <span className="font-body text-sm text-charcoal/60">Redirecting...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-500">
        {/* Header */}
        <div className="sticky top-0 bg-linear-to-br from-sage/10 via-cream to-terracotta/10 p-6 border-b border-sage/10">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-3xl text-charcoal mb-2">Complete Your Purchase</h2>
              <p className="font-body text-sm text-charcoal/60">
                Secure checkout for {packageDetails.name}
              </p>
            </div>
            <CloseButton
              onClick={onClose}
              label="Close checkout"
              className="rounded-full bg-white/80 backdrop-blur-xl border border-sage/20"
            />
          </div>
        </div>

        {/* Package Summary */}
        <div className="p-6 border-b border-sage/10 bg-sage/5">
          <h3 className="font-display text-xl text-charcoal mb-4">Package Summary</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="font-body text-sm text-charcoal/60 mb-1">Package Name</p>
              <p className="font-display text-lg text-charcoal">{packageDetails.name}</p>
            </div>
            <div>
              <p className="font-body text-sm text-charcoal/60 mb-1">Classes Included</p>
              <p className="font-display text-lg text-charcoal">{packageDetails.classes}</p>
            </div>
            <div>
              <p className="font-body text-sm text-charcoal/60 mb-1">Validity</p>
              <p className="font-display text-lg text-charcoal">{packageDetails.validity}</p>
            </div>
            <div>
              <p className="font-body text-sm text-charcoal/60 mb-1">Total Amount</p>
              <p className="font-display text-2xl text-sage">{packageDetails.price}</p>
            </div>
          </div>
        </div>

        {/* Checkout Form */}
        <form onSubmit={handlePurchase} className="p-6 space-y-6">
          <div>
            <h3 className="font-display text-xl text-charcoal mb-4">Contact Information</h3>
            <div className="space-y-4">
              <div>
                <label className="font-body text-sm text-charcoal/70 mb-2 block">Full Name *</label>
                <Input
                  value={formData.fullName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Enter your full name"
                  className="border-sage/20 focus:border-sage"
                  required
                />
              </div>
              
              <div>
                <label className="font-body text-sm text-charcoal/70 mb-2 block">Email Address *</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="your.email@example.com"
                  className="border-sage/20 focus:border-sage"
                  required
                />
              </div>
              
              <div>
                <label className="font-body text-sm text-charcoal/70 mb-2 block">Phone Number *</label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className="border-sage/20 focus:border-sage"
                  required
                />
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <h3 className="font-display text-xl text-charcoal mb-4">Payment Method</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, paymentMethod: "online" })}
                className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                  formData.paymentMethod === "online"
                    ? "border-sage bg-sage/5"
                    : "border-sage/20 hover:border-sage/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    formData.paymentMethod === "online" ? "border-sage" : "border-sage/20"
                  }`}>
                    {formData.paymentMethod === "online" && (
                      <div className="w-3 h-3 rounded-full bg-sage" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-body font-semibold text-charcoal">Online Payment</p>
                    <p className="font-body text-xs text-charcoal/60">Pay now via UPI/Card</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
              <p className="font-body text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={onClose}
              type="button"
              className="flex-1 border-sage/20 font-body"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="sage"
              className="flex-1"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Spinner className="mr-2 size-[18px]" />
                  Processing...
                </>
              ) : (
                "Proceed to Payment"
              )}
            </Button>
          </div>

          <p className="text-center font-body text-xs text-charcoal/50 mt-4">
            By completing this purchase, you agree to our Terms of Service and Privacy Policy
          </p>
        </form>
      </div>
    </div>
  );
}