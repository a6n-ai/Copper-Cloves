import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { ChevronLeft, ChevronRight, Check, X, CreditCard, Loader2, AlertCircle, ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PortalNavigation } from "@/components/PortalNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Package {
  name: string;
  price: string;
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
  status: string;
  created_at: string;
  expires_at: string;
  remaining_credits: number;
  package_types?: PurchasePackageType;
}

const premiumPackages: Package[] = [
  {
    name: "1 Day Class Pass",
    price: "₹950",
    classes: 1,
    validity: "1 day",
    benefits: [
      "Access Any Class",
      "Flexible Scheduling",
      "Shower Facilities",
      "Cafe Credits"
    ],
  },
  {
    name: "4 Class Pass",
    price: "₹3,700",
    classes: 4,
    validity: "30 days",
    benefits: [
      "Access Any Class",
      "Flexible Scheduling",
      "Shower Facilities",
      "Cafe Credits"
    ],
  },
  {
    name: "8 Class Pass",
    price: "₹7,200",
    classes: 8,
    validity: "40 days",
    benefits: [
      "Access Any Class",
      "Flexible Scheduling",
      "Shower Facilities",
      "Cafe Credits"
    ],
  },
  {
    name: "12 Class Pass",
    price: "₹10,500",
    classes: 12,
    validity: "60 days",
    benefits: [
      "Access Any Class",
      "Flexible Scheduling",
      "Shower Facilities",
      "Cafe Credits"
    ],
  },
  {
    name: "1 Month Unlimited",
    price: "₹12,500",
    classes: "Unlimited",
    validity: "30 days",
    benefits: [
      "Access Any Class",
      "Flexible Scheduling",
      "Shower Facilities",
      "Flat 10% Off on Cafe",
      "Tote Bag",
      "1 Complimentary Aerial Class"
    ],
  },
  {
    name: "3 Month Unlimited",
    price: "₹36,000",
    classes: "Unlimited",
    validity: "90 days",
    benefits: [
      "Access Any Class",
      "Flexible Scheduling",
      "Shower Facilities",
      "Flat 12% Off on Cafe",
      "C+C Tote Bag + C+C Bottle",
      "2 Complimentary Aerial Class"
    ],
    featured: true,
    badge: "Most Popular",
  },
  {
    name: "6 Month Unlimited",
    price: "₹42,500",
    classes: "Unlimited",
    validity: "180 days",
    benefits: [
      "Access Any Class",
      "Flexible Scheduling",
      "Shower Facilities",
      "Flat 15% Off on Cafe",
      "C+C Tote Bag & C+C Bottle",
      "3 Complimentary Aerial Class",
      "Access to AI Features"
    ],
  },
  {
    name: "12 Month Unlimited",
    price: "₹51,000",
    classes: "Unlimited",
    validity: "365 days",
    benefits: [
      "Access Any Class",
      "Flexible Scheduling",
      "Shower Facilities",
      "Flat 20% Off on Cafe",
      "C+C Tote Bag & C+C Bottle",
      "4 Complimentary Aerial Class",
      "Access to AI Features"
    ],
  },
];

export default function PackagesPage() {
  const router = useRouter();
  const { status } = useSession();
  const { selected } = router.query;
  const [selectedCategory, setSelectedCategory] = useState<"studio" | "class">("studio");
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    paymentMethod: "online" as const
  });

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/portal/login"); return; }
    if (status === "authenticated") {
      loadProfileAndHistory();
    }
    if (selected && typeof selected === "string") {
      const pkg = premiumPackages.find(p => p.name === selected);
      if (pkg) setSelectedCategory(pkg.classes === "Unlimited" ? "studio" : "class");
    }
  }, [router, selected, status]);

  async function loadProfileAndHistory() {
    try {
      const [profileRes, historyRes] = await Promise.all([
        fetch("/api/user/profile"),
        fetch("/api/user-packages"),
      ]);
      const profile = profileRes.ok ? await profileRes.json() : null;
      const history = historyRes.ok ? await historyRes.json() : [];
      if (profile) {
        setFormData({ fullName: profile.full_name || "", email: profile.email || "", phone: profile.phone || "", paymentMethod: "online" });
      }
      setPurchaseHistory(history);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoadingHistory(false);
    }
  }

  const generateInvoicePDF = async (purchase: PurchaseRecord) => {
    const packageType = purchase.package_types;
    
    // Create invoice HTML
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
              <span class="status-badge ${purchase.status === 'active' ? 'status-active' : 'status-expired'}">
                ${purchase.status === 'active' && new Date(purchase.expires_at) > new Date() ? 'ACTIVE' : 'EXPIRED'}
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
              <span class="detail-label">Credits Used:</span>
              <span class="detail-value">${packageType?.is_unlimited ? 'Unlimited' : `${(packageType?.class_count || 0) - (purchase.remaining_credits || 0)} / ${packageType?.class_count || 0}`}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Credits Remaining:</span>
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
    
    // Create a new window and print
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
      printWindow.focus();
      
      // Trigger print dialog
      setTimeout(() => {
        printWindow.print();
      }, 250);
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
  };

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.fullName || !formData.email || !formData.phone) {
      setError("Please fill in all required fields");
      return;
    }
    if (!selectedPackage) { setError("Invalid purchase request"); return; }
    setIsProcessing(true);
    try {
      // Find or create package type
      const allPkgsRes = await fetch("/api/packages");
      const allPkgs = allPkgsRes.ok ? await allPkgsRes.json() : [];
      let packageType = allPkgs.find((p: { name: string }) => p.name === selectedPackage.name);

      if (!packageType) {
        const durationMonths = selectedPackage.validity.includes("days")
          ? Math.round(parseInt(selectedPackage.validity) / 30)
          : selectedPackage.validity.includes("Month")
          ? parseInt(selectedPackage.validity)
          : null;
        const createRes = await fetch("/api/packages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: selectedPackage.name,
            type: "standard",
            class_count: typeof selectedPackage.classes === "number" ? selectedPackage.classes : null,
            duration_months: durationMonths,
            price: parseInt(selectedPackage.price.replace(/[^0-9]/g, "")) || 0,
            includes_physique_57: true,
            is_unlimited: selectedPackage.classes === "Unlimited",
            description: `Package: ${selectedPackage.name}`,
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
          pass_type: selectedPackage.classes === "Unlimited" ? "studio_pass" : "class_pass",
        }),
      });
      if (!purchaseRes.ok) throw new Error("Purchase failed");

      setSuccess(true);
      setTimeout(() => router.push("/portal/dashboard"), 2000);
    } catch (err) {
      console.error("Purchase error:", err);
      setError(err instanceof Error ? err.message : "Failed to complete purchase. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 350;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-white to-cream">
      <PortalNavigation />
      
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link href="/portal/dashboard">
          <button className="mb-8 flex items-center gap-2 text-charcoal/60 hover:text-charcoal transition-colors">
            <ArrowLeft size={20} />
            <span className="font-body text-sm">Back to Dashboard</span>
          </button>
        </Link>

        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="font-display text-4xl md:text-5xl text-charcoal mb-4">
            Choose Your Package
          </h1>
          <p className="font-body text-lg text-charcoal/60 max-w-2xl mx-auto">
            Select the perfect package for your wellness journey
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-white/80 backdrop-blur-xl rounded-full p-2 shadow-lg border border-sage/10">
            <button
              onClick={() => setSelectedCategory("class")}
              className={`px-6 py-3 rounded-full font-body text-sm font-medium transition-all duration-300 ${
                selectedCategory === "class"
                  ? "bg-sage text-white shadow-md"
                  : "text-charcoal/70 hover:text-charcoal"
              }`}
            >
              Class Pass
            </button>
            <button
              onClick={() => setSelectedCategory("studio")}
              className={`px-6 py-3 rounded-full font-body text-sm font-medium transition-all duration-300 ${
                selectedCategory === "studio"
                  ? "bg-sage text-white shadow-md"
                  : "text-charcoal/70 hover:text-charcoal"
              }`}
            >
              Studio Pass
            </button>
          </div>
        </div>

        {/* Mobile Scroll Buttons */}
        <div className="flex justify-center gap-4 mb-6 lg:hidden">
          <button
            onClick={() => scroll("left")}
            className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-xl shadow-md flex items-center justify-center hover:bg-white transition-all"
          >
            <ChevronLeft className="text-charcoal" size={20} />
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-xl shadow-md flex items-center justify-center hover:bg-white transition-all"
          >
            <ChevronRight className="text-charcoal" size={20} />
          </button>
        </div>

        {/* Packages Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory scrollbar-hide lg:grid lg:grid-cols-4 lg:gap-8 lg:overflow-visible"
        >
          {currentPackages.map((pkg, index) => (
            <div
              key={index}
              className={`flex-shrink-0 w-80 lg:w-auto snap-center ${
                pkg.featured ? "lg:scale-105" : ""
              }`}
            >
              <div
                className={`relative h-full rounded-3xl p-8 transition-all duration-500 hover:shadow-2xl ${
                  pkg.featured
                    ? "bg-white/90 backdrop-blur-xl border-2 border-sage shadow-xl"
                    : "bg-white/80 backdrop-blur-xl border border-sage/10 shadow-lg hover:border-sage/30"
                }`}
              >
                {pkg.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-sage text-white px-4 py-1.5 rounded-full text-xs font-body font-semibold shadow-md">
                      {pkg.badge}
                    </span>
                  </div>
                )}

                <h3 className="font-display text-2xl text-charcoal mb-2 mt-2">
                  {pkg.name}
                </h3>

                <div className="text-charcoal/60 font-body text-sm mb-6">
                  {typeof pkg.classes === "number" ? `${pkg.classes} ${pkg.classes === 1 ? "class" : "classes"}` : pkg.classes}
                </div>

                <div className="mb-8">
                  <div className="font-display text-3xl text-charcoal mb-2">
                    {pkg.price}
                  </div>
                  <div className="text-charcoal/50 font-body text-sm">
                    Valid for {pkg.validity}
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {pkg.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-sage/10 flex items-center justify-center mt-0.5">
                        <Check className="text-sage" size={14} />
                      </div>
                      <span className="font-body text-sm text-charcoal/80 leading-relaxed">
                        {benefit}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleChoosePlan(pkg)}
                  className="w-full py-3 px-6 bg-sage hover:bg-sage/90 text-white font-body text-sm rounded-full transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  Choose Plan
                  <Check size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Purchase History Section */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 mt-12">
        <div className="mb-8">
          <h2 className="font-display text-3xl text-charcoal mb-2">Purchase History</h2>
          <p className="font-body text-sm text-charcoal/60">
            View all your past package purchases and transactions
          </p>
        </div>

        {loadingHistory ? (
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto text-sage mb-4" size={48} />
            <p className="font-body text-charcoal/60">Loading purchase history...</p>
          </div>
        ) : purchaseHistory.length === 0 ? (
          <div className="text-center py-20 px-6 rounded-2xl bg-white/60 backdrop-blur-xl border border-sage/10">
            <CreditCard className="mx-auto mb-4 text-charcoal/20" size={64} />
            <h3 className="font-display text-2xl text-charcoal mb-2">No purchases yet</h3>
            <p className="font-body text-charcoal/60">
              Your purchase history will appear here once you buy a package
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {purchaseHistory.map((purchase) => {
              const packageType = purchase.package_types;
              const isActive = purchase.status === "active" && new Date(purchase.expires_at) > new Date();
              const isExpired = new Date(purchase.expires_at) < new Date();
              
              return (
                <div
                  key={purchase.id}
                  className="p-6 rounded-2xl bg-white/80 backdrop-blur-xl border border-sage/10 hover:border-sage/30 transition-all duration-300"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-display text-xl text-charcoal">
                          {packageType?.name || "Unknown Package"}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-body font-semibold ${
                          isActive 
                            ? "bg-green-100 text-green-700"
                            : isExpired
                            ? "bg-gray-100 text-gray-600"
                            : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {isActive ? "Active" : isExpired ? "Expired" : purchase.status}
                        </span>
                      </div>
                      
                      <div className="grid md:grid-cols-3 gap-4 mt-4">
                        <div>
                          <p className="font-body text-xs text-charcoal/50 mb-1">Purchase Date</p>
                          <p className="font-body text-sm text-charcoal">
                            {new Date(purchase.created_at).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric"
                            })}
                          </p>
                        </div>
                        
                        <div>
                          <p className="font-body text-xs text-charcoal/50 mb-1">Expires On</p>
                          <p className="font-body text-sm text-charcoal">
                            {new Date(purchase.expires_at).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric"
                            })}
                          </p>
                        </div>
                        
                        <div>
                          <p className="font-body text-xs text-charcoal/50 mb-1">Credits Remaining</p>
                          <p className="font-body text-sm text-charcoal">
                            {packageType?.is_unlimited 
                              ? "Unlimited" 
                              : `${purchase.remaining_credits || 0} / ${packageType?.class_count || 0}`}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-body text-xs text-charcoal/50 mb-1">Amount Paid</p>
                      <p className="font-display text-2xl text-sage">
                        ₹{packageType?.price?.toLocaleString("en-IN") || "0"}
                      </p>
                      <Button
                        onClick={() => generateInvoicePDF(purchase)}
                        variant="outline"
                        size="sm"
                        className="mt-4 border-sage/30 text-sage hover:bg-sage/10"
                      >
                        <Download size={16} className="mr-2" />
                        Download Invoice
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {showCheckout && selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-md animate-in fade-in duration-300">
          {success ? (
            <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl animate-in zoom-in-95 duration-500 text-center">
              <div className="w-16 h-16 rounded-full bg-sage/20 flex items-center justify-center mx-auto mb-4">
                <Check className="text-sage" size={32} />
              </div>
              <h2 className="font-display text-3xl text-charcoal mb-2">Purchase Successful!</h2>
              <p className="font-body text-charcoal/70 mb-6">
                Your {selectedPackage.name} has been activated. Redirecting to your dashboard...
              </p>
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin text-sage" size={20} />
                <span className="font-body text-sm text-charcoal/60">Redirecting...</span>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-500 relative">
              {/* Header */}
              <div className="sticky top-0 z-20 bg-white pt-6 px-6 pb-4 border-b border-sage/10 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-display text-3xl text-charcoal mb-2">Complete Your Purchase</h2>
                    <p className="font-body text-charcoal/60">
                      Secure checkout for {selectedPackage?.name}
                    </p>
                  </div>
                  <button
                    onClick={closeCheckout}
                    className="w-10 h-10 rounded-full bg-white border border-sage/20 hover:border-sage/40 flex items-center justify-center transition-all duration-300 hover:scale-110"
                    aria-label="Close checkout"
                  >
                    <X className="text-charcoal" size={20} />
                  </button>
                </div>
              </div>

              {/* Package Summary */}
              <div className="p-6 border-b border-sage/10 bg-sage/5">
                <h3 className="font-display text-xl text-charcoal mb-4">Package Summary</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-body text-sm text-charcoal/60 mb-1">Package Name</p>
                    <p className="font-display text-lg text-charcoal">{selectedPackage.name}</p>
                  </div>
                  <div>
                    <p className="font-body text-sm text-charcoal/60 mb-1">Classes Included</p>
                    <p className="font-display text-lg text-charcoal">{selectedPackage.classes}</p>
                  </div>
                  <div>
                    <p className="font-body text-sm text-charcoal/60 mb-1">Validity</p>
                    <p className="font-display text-lg text-charcoal">{selectedPackage.validity}</p>
                  </div>
                  <div>
                    <p className="font-body text-sm text-charcoal/60 mb-1">Total Amount</p>
                    <p className="font-display text-2xl text-sage">{selectedPackage.price}</p>
                  </div>
                </div>
              </div>

              {/* Checkout Form */}
              <form onSubmit={handlePurchase} className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="font-body text-charcoal">
                    Full Name *
                  </Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Enter your full name"
                    required
                    className="border-sage/20 focus:ring-sage font-body placeholder:text-charcoal/40"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="font-body text-charcoal">
                    Email Address *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                    required
                    className="border-sage/20 focus:ring-sage font-body placeholder:text-charcoal/40"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="font-body text-charcoal">
                    Phone Number *
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    required
                    className="border-sage/20 focus:ring-sage font-body placeholder:text-charcoal/40"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <h3 className="font-display text-xl text-charcoal mb-4">Payment Method</h3>
                  <div className="grid md:grid-cols-1 gap-4">
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
                    <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                    <p className="font-body text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Submit Buttons */}
                <div className="flex gap-3 pt-4 border-t border-sage/10">
                  <Button
                    type="button"
                    onClick={closeCheckout}
                    variant="outline"
                    className="flex-1 border-sage/30 text-charcoal hover:bg-sage/10"
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-sage hover:bg-sage/90 text-white"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={18} />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard size={18} className="mr-2" />
                        Complete Purchase
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-center font-body text-xs text-charcoal/50 mt-4">
                  By completing this purchase, you agree to our Terms of Service and Privacy Policy
                </p>
              </form>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}