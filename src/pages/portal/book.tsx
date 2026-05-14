import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { PortalNavigation } from "@/components/PortalNavigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  X, 
  Clock, 
  User, 
  Calendar, 
  Zap, 
  Heart, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  Minus,
  UserPlus,
  CreditCard,
  Store,
  AlertCircle
} from "lucide-react";
import { useSession } from "next-auth/react";
import {
  startOfMondayWeekLocal,
  endOfSundayWeekLocal,
} from "@/lib/calendarWeek";

// Discount mapping based on unlimited tier (simplified - using package name)
const UNLIMITED_DISCOUNTS: Record<string, number> = {
  "1 Month Unlimited": 0.10,
  "3 Month Unlimited": 0.12,
  "6 Month Unlimited": 0.15,
  "12 Month Unlimited": 0.20,
};

// Class Pass gets 5% discount on food only
const CLASS_PASS_FOOD_DISCOUNT = 0.05;

// Tax rate (adjust as needed)
const TAX_RATE = 0.05; // 5% tax

interface FriendFamily {
  name: string;
  email: string;
  phone: string;
}

interface FoodItem {
  id: string;
  name: string;
  items: string[];
  image: string;
  price: number;
  quantity: number;
}

export interface Class {
  id: string;
  name: string;
  time: string;
  instructor: string;
  duration: string;
  intensity: string;
  spots: number;
  image: string;
  /** ISO datetime for this scheduled instance (for booking + sorting). */
  startTimeIso: string;
}

export default function BookClass() {
  const router = useRouter();
  const { status } = useSession();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  // User data states
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // Booking panel states
  const [showBookingPanel, setShowBookingPanel] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [friendsFamily, setFriendsFamily] = useState<{ name: string; email: string; phone: string }[]>([]);
  const [tempFriend, setTempFriend] = useState({ name: "", phone: "" });
  const [showAddPersonForm, setShowAddPersonForm] = useState(false);
  const [newPerson, setNewPerson] = useState({ name: "", email: "", phone: "" });
  
  // User package states - fetch from database
  const [userPackage, setUserPackage] = useState<{
    type: "studio_pass" | "class_pass" | null;
    name: string;
    classesRemaining: number | null;
    isUnlimited: boolean;
  }>({
    type: null,
    name: "",
    classesRemaining: null,
    isUnlimited: false
  });
  
  // Credits & payment
  const [useCredits, setUseCredits] = useState(true);
  const [pendingAmount, setPendingAmount] = useState(0);
  
  // Food ordering
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  
  // Checkout
  const [paymentMethod, setPaymentMethod] = useState<"online" | "studio">("online");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [filterIntensity, setFilterIntensity] = useState<string>("all");
  const classesPerPage = 6;

  /** ISO week (Mon–Sun) containing “today”, always used for booking (avoids wrong week near year boundaries). */
  const [weekSummary, setWeekSummary] = useState("");

  // Classes from database
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const filteredClasses = filterIntensity === "all" 
    ? allClasses 
    : allClasses.filter(cls => cls.intensity === filterIntensity);

  const totalPages = Math.ceil(filteredClasses.length / classesPerPage);
  const startIndex = (currentPage - 1) * classesPerPage;
  const paginatedClasses = filteredClasses.slice(startIndex, startIndex + classesPerPage);

  // Check authentication on mount
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/portal/login?redirect=/portal/book");
      return;
    }
    if (status === "authenticated") {
      setIsAuthenticated(true);
      checkAuthAndLoadData();
      fetchClasses();
    }
  }, [status]);

  async function fetchClasses() {
    try {
      setLoadingClasses(true);
      const now = new Date();
      const weekStart = startOfMondayWeekLocal(now);
      const weekEnd = endOfSundayWeekLocal(weekStart);
      setWeekSummary(
        `${weekStart.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}`
      );

      const params = new URLSearchParams({
        fromMs: String(weekStart.getTime()),
        toMs: String(weekEnd.getTime()),
      });
      const res = await fetch(`/api/class-schedules?${params}`, { credentials: "omit" });
      const raw = res.ok ? await res.json() : [];

      const nowMs = Date.now();

      const transformedClasses: Class[] = raw
        .filter((s: { start_time: string; status?: string }) => {
          const t = new Date(s.start_time).getTime();
          return (
            t >= weekStart.getTime() &&
            t <= weekEnd.getTime() &&
            s.status !== "cancelled" &&
            t > nowMs
          );
        })
        .map((schedule: {
          id: string;
          start_time: string;
          class_model?: { name?: string; duration?: number; category?: string; max_capacity?: number; image_url?: string };
          instructor?: { name?: string };
        }) => ({
          id: schedule.id,
          name: schedule.class_model?.name || "Unknown Class",
          time: new Date(schedule.start_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
          instructor: schedule.instructor?.name || "Instructor",
          duration: `${schedule.class_model?.duration || 60} min`,
          intensity: schedule.class_model?.category?.toLowerCase() || "moderate",
          spots: schedule.class_model?.max_capacity || 10,
          image: schedule.class_model?.image_url || "/placeholder.jpg",
          startTimeIso:
            typeof schedule.start_time === "string"
              ? schedule.start_time
              : new Date(schedule.start_time).toISOString(),
        }))
        .sort(
          (a, b) =>
            new Date(a.startTimeIso).getTime() - new Date(b.startTimeIso).getTime()
        );

      setAllClasses(transformedClasses);
    } catch (error) {
      console.error("Error fetching classes:", error);
      setAllClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  }

  async function checkAuthAndLoadData() {
    try {
      const [profileRes, packagesRes] = await Promise.all([
        fetch("/api/user/profile"),
        fetch("/api/user-packages?active=true"),
      ]);

      const profile = profileRes.ok ? await profileRes.json() : null;
      const packages = packagesRes.ok ? await packagesRes.json() : [];

      if (profile) {
        setUserName(profile.full_name || "Member");
        setUserEmail(profile.email || "");
      }

      const now = new Date();
      const activePackages = packages.filter(
        (p: { expiration_date: string; is_active: boolean }) =>
          p.is_active && new Date(p.expiration_date) > now
      );

      if (activePackages.length > 0) {
        const pkg = activePackages[0];
        const packageType = pkg.package_type;
        setUserPackage({
          type: packageType?.is_unlimited ? "studio_pass" : "class_pass",
          name: packageType?.name || "Package",
          classesRemaining: packageType?.is_unlimited ? null : pkg.credits_remaining,
          isUnlimited: packageType?.is_unlimited || false,
        });
      } else {
        setUserPackage({ type: null, name: "No Active Package", classesRemaining: 0, isUnlimited: false });
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading user data:", error);
      setIsLoading(false);
    }
  }

  async function fetchCafeItems() {
    try {
      const res = await fetch("/api/cafe/items?available=true&name=combo");
      const data = res.ok ? await res.json() : [];
      if (data.length > 0) {
        setFoodItems(data.map((item: { id: string; name: string; description?: string; image_url?: string; price: number }) => ({
          id: item.id,
          name: item.name,
          items: item.description?.split(", ") || [],
          image: item.image_url || "",
          price: item.price,
          quantity: 0,
        })));
      }
    } catch (err) {
      console.error("Error loading cafe items:", err);
    }
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [filterIntensity]);

  // Handlers
  function handleSelectClass(cls: any) {
    setSelectedClass(cls);
    setShowBookingPanel(true);
    setBookingStep(1);
    // Reset state
    setFriendsFamily([]);
    setFoodItems(prev => prev.map(item => ({ ...item, quantity: 0 })));
    setUseCredits(true);
    setPendingAmount(0);
    setPaymentMethod("online");
    
    // Fetch cafe items for Step 3
    fetchCafeItems();
  }

  function handleAddPerson() {
    if (newPerson.name && newPerson.email && newPerson.phone) {
      setFriendsFamily([...friendsFamily, newPerson]);
      setNewPerson({ name: "", email: "", phone: "" });
      setShowAddPersonForm(false);
    }
  }

  function handleRemovePerson(index: number) {
    setFriendsFamily(friendsFamily.filter((_, i) => i !== index));
  }

  function handleNextStep() {
    if (bookingStep === 1) {
      // Step 1 -> 2: Add People -> Credit Management
      setBookingStep(2);
    } else if (bookingStep === 2) {
      // Step 2 -> 3: Credits -> Food
      if (userPackage.type === "class_pass" && !useCredits) {
        // Calculate pending amount
        const totalPeople = 1 + friendsFamily.length;
        const classPrice = 945; // Price per class
        const creditsToUse = Math.min(userPackage.classesRemaining || 0, totalPeople);
        const shortfall = totalPeople - creditsToUse;
        setPendingAmount(shortfall * classPrice);
      }
      setBookingStep(3);
    } else if (bookingStep === 3) {
      // Step 3 -> 4: Food -> Checkout
      setBookingStep(4);
    }
  }

  function handleBackStep() {
    if (bookingStep > 1) {
      setBookingStep(bookingStep - 1);
    }
  }

  function handleFoodQuantity(id: string, change: number) {
    setFoodItems(prev => prev.map(item => 
      item.id === id 
        ? { ...item, quantity: Math.max(0, item.quantity + change) }
        : item
    ));
  }

  function calculateTotals() {
    const totalPeople = 1 + friendsFamily.length;
    const classPrice = 945;
    
    // Class cost
    let classTotal = 0;
    if (userPackage.type === "class_pass") {
      if (useCredits) {
        // Class Pass holder: Primary user's class is deducted (free)
        // Friends/family pay separately (NOT deducted from user's classes)
        classTotal = friendsFamily.length * classPrice;
      } else {
        // User chose not to use their classes - pay for everyone
        classTotal = totalPeople * classPrice;
      }
    } else if (userPackage.type === "studio_pass") {
      // Unlimited - primary user covered, charge for friends/family
      classTotal = friendsFamily.length * classPrice;
    } else {
      // No package - charge everyone
      classTotal = totalPeople * classPrice;
    }
    
    // Food cost
    const foodTotal = foodItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Discount logic - ONLY on food items
    let discount = 0;
    if (foodTotal > 0) {
      if (userPackage.type === "class_pass") {
        // Class Pass: 5% discount on food only
        discount = foodTotal * CLASS_PASS_FOOD_DISCOUNT;
      } else if (userPackage.isUnlimited) {
        // Studio Pass: Tiered discount on food
        const discountRate = UNLIMITED_DISCOUNTS[userPackage.name] || 0;
        discount = foodTotal * discountRate;
      }
    }
    
    const subtotal = classTotal + foodTotal;
    const totalAfterDiscount = subtotal - discount;
    const tax = totalAfterDiscount * TAX_RATE;
    const finalTotal = totalAfterDiscount + tax;
    
    return { classTotal, foodTotal, discount, subtotal, tax, finalTotal };
  }

  async function handleConfirmBooking() {
    const { finalTotal } = calculateTotals();
    
    try {
      setIsLoading(true);

      // Get active package to determine user_package_id
      const packagesRes = await fetch("/api/user-packages?active=true");
      const packages = packagesRes.ok ? await packagesRes.json() : [];
      const now = new Date();
      const packageToUse = packages.find(
        (p: { expiration_date: string; is_active: boolean }) =>
          p.is_active && new Date(p.expiration_date) > now
      ) || null;

      if (userPackage.type === "class_pass" && useCredits) {
        if (!packageToUse) throw new Error("No active package found. Please purchase a package first.");
        if ((packageToUse.credits_remaining ?? 0) < 1) throw new Error("You don't have any classes remaining.");
      }

      const classTimeISO = selectedClass?.startTimeIso ?? null;

      const bookingRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_schedule_id: selectedClass?.id ?? null,
          class_name: selectedClass?.name,
          class_time: classTimeISO,
          user_package_id: userPackage.type === "class_pass" && useCredits ? packageToUse?.id : null,
        }),
      });
      if (!bookingRes.ok) {
        let msg = "Failed to save class booking. Please contact support.";
        try {
          const errBody = await bookingRes.json();
          if (typeof errBody?.error === "string") msg = errBody.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const bookingData = await bookingRes.json();
      const bookingId = bookingData.id;

      const orderedFoodItems = foodItems.filter(item => item.quantity > 0);
      for (const item of orderedFoodItems) {
        const foodRes = await fetch("/api/cafe/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cafe_item_id: item.id,
            booking_id: bookingId,
            quantity: item.quantity,
            payment_method: "pay_at_studio",
          }),
        });
        if (!foodRes.ok) {
          let msg = "Could not add café order.";
          try {
            const errBody = await foodRes.json();
            if (errBody?.error) msg = String(errBody.error);
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }
      }
      
      console.log("=== BOOKING FLOW COMPLETE ===");
      
      if (paymentMethod === "online" && finalTotal > 0) {
        alert(`Processing online payment of ₹${finalTotal.toFixed(0)}...\n\nBooking confirmed!`);
      } else {
        alert(`Booking confirmed!\n\n${finalTotal > 0 ? `Pay ₹${finalTotal.toFixed(0)} at the studio.` : "No payment required."}`);
      }
      
      setShowBookingPanel(false);
      router.push("/portal/dashboard");
    } catch (err: any) {
      console.error("❌ BOOKING ERROR:", err);
      alert(err.message || "Failed to complete booking. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading || loadingClasses) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-sage/5 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-sage/30 border-t-sage rounded-full animate-spin mx-auto mb-4" />
          <p className="font-body text-charcoal/60">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-sage/5">
      <PortalNavigation 
        userName={userName}
        userEmail={userEmail}
        creditsRemaining={userPackage.classesRemaining || 0}
        currentBadge="The Seeker"
      />
      
      <main className="pt-24 px-4 sm:px-6 lg:px-8 pb-12 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {/* Page Header */}
          <div className="mb-8 md:mb-12">
            <h1 className="font-display text-4xl md:text-5xl text-charcoal mb-3">Book Your Next Session</h1>
            <p className="font-body text-sage text-base md:text-lg">
              Showing {startIndex + 1}-{Math.min(startIndex + classesPerPage, filteredClasses.length)} of {filteredClasses.length} upcoming classes
            </p>
            <p className="font-body text-charcoal/70 text-sm mt-2">
              {weekSummary ? `This week: ${weekSummary}. Past days and sessions that already started are hidden.` : "Loading schedule…"}
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
            <Button 
              onClick={() => setFilterIntensity("all")}
              variant={filterIntensity === "all" ? "default" : "outline"}
              className={`${
                filterIntensity === "all" 
                  ? "bg-sage text-white hover:bg-sage/90" 
                  : "border-sage/30 text-charcoal hover:border-sage hover:bg-sage/5"
              } transition-all duration-600 font-body`}
            >
              All Classes
            </Button>
            <Button 
              onClick={() => setFilterIntensity("high")}
              variant={filterIntensity === "high" ? "default" : "outline"}
              className={`${
                filterIntensity === "high" 
                  ? "bg-sage text-white hover:bg-sage/90" 
                  : "border-sage/30 text-charcoal hover:border-sage hover:bg-sage/5"
              } transition-all duration-600 font-body`}
            >
              High Intensity
            </Button>
            <Button 
              onClick={() => setFilterIntensity("moderate")}
              variant={filterIntensity === "moderate" ? "default" : "outline"}
              className={`${
                filterIntensity === "moderate" 
                  ? "bg-sage text-white hover:bg-sage/90" 
                  : "border-sage/30 text-charcoal hover:border-sage hover:bg-sage/5"
              } transition-all duration-600 font-body`}
            >
              Moderate
            </Button>
            <Button 
              onClick={() => setFilterIntensity("gentle")}
              variant={filterIntensity === "gentle" ? "default" : "outline"}
              className={`${
                filterIntensity === "gentle" 
                  ? "bg-sage text-white hover:bg-sage/90" 
                  : "border-sage/30 text-charcoal hover:border-sage hover:bg-sage/5"
              } transition-all duration-600 font-body`}
            >
              Gentle
            </Button>
          </div>

          {/* Class Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {paginatedClasses.map(cls => (
              <Card 
                key={cls.id} 
                className="border-sage/20 bg-white/80 backdrop-blur-sm hover:border-sage hover:shadow-xl transition-all duration-600 overflow-hidden group"
              >
                <CardContent className="p-0">
                  <div className="flex flex-col">
                    {/* Class Image */}
                    <div className="relative w-full h-48 overflow-hidden">
                      <img 
                        src={cls.image} 
                        alt={cls.name}
                        className="w-full h-full object-cover transition-transform duration-600 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 via-charcoal/20 to-transparent" />
                      <Badge 
                        className={`absolute top-4 left-4 ${
                          cls.intensity === 'high' 
                            ? 'bg-terracotta/90 hover:bg-terracotta' 
                            : cls.intensity === 'moderate'
                            ? 'bg-sage/90 hover:bg-sage'
                            : 'bg-charcoal/90 hover:bg-charcoal'
                        } text-white border-none backdrop-blur-sm font-body`}
                      >
                        {cls.intensity}
                      </Badge>
                      <div className="absolute top-4 right-4 bg-cream/90 backdrop-blur-sm rounded-lg px-3 py-2">
                        <p className="text-xs font-body text-charcoal/60">Spots Left</p>
                        <p className="text-2xl font-display text-sage">{cls.spots}</p>
                      </div>
                    </div>

                    {/* Class Info */}
                    <div className="p-6">
                      <h3 className="font-display text-2xl text-charcoal mb-3 group-hover:text-sage transition-colors duration-600">
                        {cls.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-sm font-body text-charcoal/70 mb-4">
                        <span className="flex items-center gap-2">
                          <Clock size={16} className="text-sage" />
                          {cls.time}
                        </span>
                        <span className="flex items-center gap-2">
                          <Zap size={16} className="text-terracotta" />
                          {cls.duration}
                        </span>
                        <span className="flex items-center gap-2">
                          <User size={16} className="text-sage" />
                          {cls.instructor}
                        </span>
                      </div>
                      <Button 
                        onClick={() => handleSelectClass(cls)} 
                        className="bg-sage hover:bg-sage/90 text-white font-body w-full transition-all duration-600 hover:scale-105 active:scale-95"
                      >
                        Reserve Your Spot
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-sage/20">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="border-sage/30 text-sage hover:bg-sage/10 disabled:opacity-30 disabled:cursor-not-allowed font-body transition-all duration-600 w-full sm:w-auto"
              >
                <ChevronLeft size={16} className="mr-2" />
                Previous
              </Button>

              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 rounded-lg font-body text-sm transition-all duration-600 ${
                      page === currentPage
                        ? "bg-sage text-white shadow-md"
                        : "text-charcoal/60 hover:bg-sage/10"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="border-sage/30 text-sage hover:bg-sage/10 disabled:opacity-30 disabled:cursor-not-allowed font-body transition-all duration-600 w-full sm:w-auto"
              >
                Next
                <ChevronRight size={16} className="ml-2" />
              </Button>
            </div>
          )}

          {/* Empty State */}
          {paginatedClasses.length === 0 && (
            <Card className="border-sage/20 bg-white/80 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Calendar className="w-16 h-16 text-sage/40 mb-4" />
                <h3 className="font-display text-2xl text-charcoal mb-2">No Classes Available</h3>
                <p className="font-body text-charcoal/60 mb-6">Try adjusting your filters or check back soon.</p>
                <Button 
                  onClick={() => setFilterIntensity("all")}
                  variant="outline"
                  className="border-sage text-sage hover:bg-sage hover:text-white transition-all duration-600"
                >
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Booking Panel - Multi-Step Flow */}
      <div 
        className={`fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl transform transition-all duration-600 ease-in-out z-50 overflow-y-auto ${
          showBookingPanel ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Panel Header */}
          <div className="sticky top-0 z-10 p-6 flex items-center justify-between border-b border-sage/10 bg-gradient-to-r from-cream/80 to-white/80 backdrop-blur-xl">
            <div>
              <h2 className="font-display text-2xl md:text-3xl text-charcoal mb-1">
                {bookingStep === 1 && "Who's Coming?"}
                {bookingStep === 2 && "Credit Management"}
                {bookingStep === 3 && "Add Nourishment"}
                {bookingStep === 4 && "Checkout"}
              </h2>
              <p className="font-body text-sm text-charcoal/60">
                Step {bookingStep} of 4 • {selectedClass?.name}
              </p>
            </div>
            <button 
              onClick={() => setShowBookingPanel(false)} 
              className="p-2 rounded-full hover:bg-sage/10 text-sage hover:text-charcoal transition-all duration-600 hover:rotate-90"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Step 1: Add People */}
            {bookingStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-display text-xl text-charcoal mb-2">Primary Attendee</h3>
                  <div className="p-4 rounded-xl bg-sage/5 border border-sage/20">
                    <p className="font-body text-charcoal font-medium">{userName}</p>
                    <p className="font-body text-sm text-charcoal/60">{userEmail}</p>
                  </div>
                </div>

                {/* Friends & Family List */}
                {friendsFamily.length > 0 && (
                  <div>
                    <h3 className="font-display text-xl text-charcoal mb-3">
                      Friends & Family ({friendsFamily.length})
                    </h3>
                    <div className="space-y-3">
                      {friendsFamily.map((person, index) => (
                        <div key={index} className="p-4 rounded-xl bg-white border border-sage/10 flex items-center justify-between">
                          <div>
                            <p className="font-body text-charcoal font-medium">{person.name}</p>
                            <p className="font-body text-sm text-charcoal/60">{person.email}</p>
                            <p className="font-body text-xs text-charcoal/50">{person.phone}</p>
                          </div>
                          <button
                            onClick={() => handleRemovePerson(index)}
                            className="p-2 rounded-full hover:bg-terracotta/10 text-terracotta transition-all"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Person Form */}
                {showAddPersonForm ? (
                  <div className="p-6 rounded-xl bg-cream/30 border border-sage/20 space-y-4">
                    <h3 className="font-display text-lg text-charcoal mb-3">Add Friend or Family Member</h3>
                    <div>
                      <Label htmlFor="person-name" className="font-body text-sm text-charcoal/70 mb-2 block">
                        Full Name *
                      </Label>
                      <Input
                        id="person-name"
                        value={newPerson.name}
                        onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
                        placeholder="Enter name"
                        className="border-sage/20 focus:border-sage"
                      />
                    </div>
                    <div>
                      <Label htmlFor="person-email" className="font-body text-sm text-charcoal/70 mb-2 block">
                        Email Address *
                      </Label>
                      <Input
                        id="person-email"
                        type="email"
                        value={newPerson.email}
                        onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })}
                        placeholder="email@example.com"
                        className="border-sage/20 focus:border-sage"
                      />
                    </div>
                    <div>
                      <Label htmlFor="person-phone" className="font-body text-sm text-charcoal/70 mb-2 block">
                        Phone Number *
                      </Label>
                      <Input
                        id="person-phone"
                        type="tel"
                        value={newPerson.phone}
                        onChange={(e) => setNewPerson({ ...newPerson, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                        className="border-sage/20 focus:border-sage"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleAddPerson}
                        className="flex-1 bg-sage hover:bg-sage/90 text-white"
                      >
                        Add Person
                      </Button>
                      <Button
                        onClick={() => {
                          setShowAddPersonForm(false);
                          setNewPerson({ name: "", email: "", phone: "" });
                        }}
                        variant="outline"
                        className="flex-1 border-sage/30 text-charcoal"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => setShowAddPersonForm(true)}
                    variant="outline"
                    className="w-full border-2 border-dashed border-sage/30 hover:border-sage hover:bg-sage/5 text-sage"
                  >
                    <UserPlus size={18} className="mr-2" />
                    Add Friend or Family Member
                  </Button>
                )}

                <div className="pt-4 border-t border-sage/10">
                  <p className="font-body text-sm text-charcoal/60 mb-2">
                    Total Attendees: <span className="font-semibold text-charcoal">{1 + friendsFamily.length}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Credit Management */}
            {bookingStep === 2 && (
              <div className="space-y-6">
                <div className="p-6 rounded-xl bg-gradient-to-br from-sage/10 to-cream/30 border border-sage/20">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-body text-sm text-charcoal/60 uppercase tracking-wide mb-1">
                        Your Package
                      </p>
                      <p className="font-display text-2xl text-charcoal">
                        {userPackage.name}
                      </p>
                    </div>
                    {userPackage.type === "class_pass" && (
                      <div className="text-right">
                        <p className="font-body text-sm text-charcoal/60 uppercase tracking-wide mb-1">
                          Classes Remaining
                        </p>
                        <p className="font-display text-3xl text-sage">
                          {userPackage.classesRemaining || 0}
                        </p>
                      </div>
                    )}
                    {userPackage.type === "studio_pass" && (
                      <div className="text-right">
                        <p className="font-body text-sm text-charcoal/60 uppercase tracking-wide mb-1">
                          Access Type
                        </p>
                        <p className="font-display text-3xl text-sage">
                          Unlimited
                        </p>
                      </div>
                    )}
                  </div>

                  {userPackage.isUnlimited && (
                    <div className="pt-4 border-t border-sage/20">
                      <p className="font-body text-sm text-charcoal/60 uppercase tracking-wide mb-1">
                        Current Package
                      </p>
                      <p className="font-body text-charcoal">
                        {userPackage.name}
                      </p>
                      <p className="font-body text-xs text-sage mt-2">
                        ✓ {((UNLIMITED_DISCOUNTS[userPackage.name] || 0) * 100).toFixed(0)}% discount on café items
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {userPackage.type === "studio_pass" && (
                    <div 
                      className="p-5 rounded-xl border-2 border-sage bg-sage/5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full border-2 border-sage bg-sage mt-0.5 flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-body text-charcoal font-medium mb-1">
                            Unlimited Access - No Charge
                          </p>
                          <p className="font-body text-sm text-charcoal/60">
                            Your {userPackage.name} includes unlimited classes. Book as many as you like!
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {userPackage.type === "class_pass" && (
                    <>
                      <div 
                        className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                          useCredits
                            ? "border-sage bg-sage/5"
                            : "border-sage/20 bg-white hover:border-sage/40"
                        }`}
                        onClick={() => setUseCredits(true)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                            useCredits ? "border-sage bg-sage" : "border-sage/30"
                          }`}>
                            {useCredits && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-body text-charcoal font-medium mb-1">
                              Use My Classes
                            </p>
                            <p className="font-body text-sm text-charcoal/60">
                              {(() => {
                                const classesAvailable = userPackage.classesRemaining || 0;
                                
                                if (classesAvailable < 1) {
                                  return (
                                    <span className="text-terracotta">
                                      ⚠️ No classes remaining. Pay ₹{(1 + friendsFamily.length) * 945} for all attendees.
                                    </span>
                                  );
                                } else if (friendsFamily.length > 0) {
                                  return `1 class deducted for you. Pay ₹${friendsFamily.length * 945} for ${friendsFamily.length} guest${friendsFamily.length > 1 ? 's' : ''}.`;
                                } else {
                                  return "1 class will be deducted for your spot.";
                                }
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div 
                        className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                          !useCredits
                            ? "border-sage bg-sage/5"
                            : "border-sage/20 bg-white hover:border-sage/40"
                        }`}
                        onClick={() => setUseCredits(false)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                            !useCredits ? "border-sage bg-sage" : "border-sage/30"
                          }`}>
                            {!useCredits && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-body text-charcoal font-medium mb-1">
                              Pay for This Class
                            </p>
                            <p className="font-body text-sm text-charcoal/60">
                              Save your classes. Pay ₹{(1 + friendsFamily.length) * 945} at checkout.
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {userPackage.type === null && (
                    <div className="p-5 rounded-xl border-2 border-terracotta/30 bg-terracotta/5">
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full border-2 border-terracotta bg-terracotta/20 mt-0.5 flex items-center justify-center">
                          <X className="text-terracotta" size={14} />
                        </div>
                        <div className="flex-1">
                          <p className="font-body text-charcoal font-medium mb-1">
                            No Active Package
                          </p>
                          <p className="font-body text-sm text-charcoal/60">
                            Please purchase a package to book classes. Pay ₹{(1 + friendsFamily.length) * 945} now or buy a package first.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                  {userPackage.type === "studio_pass" && (
                  <div className="p-5 rounded-xl bg-sage/5 border border-sage/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center">
                        <AlertCircle className="text-sage" size={20} />
                      </div>
                      <h3 className="font-display text-lg text-charcoal">Class Coverage</h3>
                    </div>
                    <p className="font-body text-sm text-charcoal/70 mb-3">
                      Your unlimited package covers <strong>1 person</strong> (you).
                    </p>
                    {friendsFamily.length > 0 && (
                      <div className="pt-3 border-t border-sage/10">
                        <p className="font-body text-sm text-charcoal/70 mb-2">
                          <strong>Additional Guests:</strong> {friendsFamily.length} × ₹945 = ₹{friendsFamily.length * 945}
                        </p>
                        <p className="font-body text-xs text-charcoal/60 italic">
                          Friends and family will be charged at the class rate (₹945 per person).
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Add Food */}
            {bookingStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-display text-2xl text-charcoal mb-2">
                    Add Nourishment
                  </h3>
                  <p className="font-body text-charcoal/60 mb-6">
                    Select meals for after your class. Perfect for refueling!
                    {userPackage.type === "class_pass" && (
                      <span className="block text-sage mt-1">
                        ✓ Get 5% off on all café items
                      </span>
                    )}
                    {userPackage.isUnlimited && UNLIMITED_DISCOUNTS[userPackage.name] && (
                      <span className="block text-sage mt-1">
                        ✓ Your {userPackage.name} includes {((UNLIMITED_DISCOUNTS[userPackage.name] || 0) * 100).toFixed(0)}% off on café items
                      </span>
                    )}
                  </p>
                </div>

                <div className="space-y-4">
                  {foodItems.map((item) => (
                    <div 
                      key={item.id}
                      className="p-4 rounded-xl bg-white border border-sage/10 hover:border-sage/30 transition-all"
                    >
                      <div className="flex gap-4">
                        <img 
                          src={item.image}
                          alt={item.name}
                          className="w-24 h-24 rounded-lg object-cover"
                        />
                        <div className="flex-1">
                          <h4 className="font-display text-lg text-charcoal mb-1">{item.name}</h4>
                          <p className="font-body text-xs text-charcoal/60 mb-2">
                            {item.items.join(" • ")}
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="font-body text-sage font-semibold">₹{item.price}</p>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleFoodQuantity(item.id, -1)}
                                disabled={item.quantity === 0}
                                className="w-8 h-8 rounded-full bg-sage/10 hover:bg-sage/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                              >
                                <Minus size={14} className="text-sage" />
                              </button>
                              <span className="font-body text-charcoal font-medium w-8 text-center">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleFoodQuantity(item.id, 1)}
                                className="w-8 h-8 rounded-full bg-sage/10 hover:bg-sage/20 flex items-center justify-center transition-all"
                              >
                                <Plus size={14} className="text-sage" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-5 rounded-xl bg-cream/30 border border-sage/10">
                  <p className="font-body text-sm text-charcoal/60">
                    Food Subtotal: <span className="font-semibold text-charcoal">₹{totals.foodTotal}</span>
                    {totals.discount > 0 && (
                      <span className="text-sage block mt-1">
                        Discount Applied: -₹{totals.discount.toFixed(0)} 
                        {userPackage.type === "class_pass" && " (5% off)"}
                        {userPackage.isUnlimited && ` (${((UNLIMITED_DISCOUNTS[userPackage.name] || 0) * 100).toFixed(0)}% off)`}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Checkout */}
            {bookingStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-display text-2xl text-charcoal mb-2">
                    Review & Confirm
                  </h3>
                  <p className="font-body text-charcoal/60">
                    Please review your booking details before confirming.
                  </p>
                </div>

                {/* Booking Summary */}
                <div className="p-6 rounded-xl bg-gradient-to-br from-cream/40 to-sage/5 border border-sage/10 space-y-4">
                  <div>
                    <p className="font-body text-xs text-charcoal/60 uppercase tracking-wide mb-1">Class</p>
                    <p className="font-display text-xl text-charcoal">{selectedClass?.name}</p>
                    <p className="font-body text-sm text-charcoal/60">{selectedClass?.time} • {selectedClass?.instructor}</p>
                  </div>

                  <div className="pt-4 border-t border-sage/10">
                    <p className="font-body text-xs text-charcoal/60 uppercase tracking-wide mb-2">Attendees</p>
                    <div className="space-y-1">
                      <p className="font-body text-sm text-charcoal">• {userName}</p>
                      {friendsFamily.map((person, index) => (
                        <p key={index} className="font-body text-sm text-charcoal">• {person.name}</p>
                      ))}
                    </div>
                  </div>

                  {foodItems.filter(item => item.quantity > 0).length > 0 && (
                    <div className="pt-4 border-t border-sage/10">
                      <p className="font-body text-xs text-charcoal/60 uppercase tracking-wide mb-2">Food Items</p>
                      <div className="space-y-1">
                        {foodItems.filter(item => item.quantity > 0).map(item => (
                          <p key={item.id} className="font-body text-sm text-charcoal">
                            • {item.name} × {item.quantity}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Breakdown */}
                <div className="p-6 rounded-xl bg-white border border-sage/10 space-y-3">
                  <h4 className="font-display text-lg text-charcoal mb-3">Payment Breakdown</h4>
                  
                  {totals.classTotal > 0 && (
                    <div className="flex justify-between font-body text-sm">
                      <span className="text-charcoal/70">
                        {userPackage.type === "class_pass" && useCredits
                          ? `Guest Fees (${friendsFamily.length} × ₹945)`
                          : userPackage.type === "studio_pass"
                          ? `Additional Guests (${friendsFamily.length} × ₹945)`
                          : `Class Fee (${1 + friendsFamily.length} × ₹945)`
                        }
                      </span>
                      <span className="text-charcoal">₹{totals.classTotal}</span>
                    </div>
                  )}
                  
                  {totals.foodTotal > 0 && (
                    <div className="flex justify-between font-body text-sm">
                      <span className="text-charcoal/70">Food Items</span>
                      <span className="text-charcoal">₹{totals.foodTotal}</span>
                    </div>
                  )}
                  
                  {totals.discount > 0 && (
                    <div className="flex justify-between font-body text-sm">
                      <span className="text-sage">
                        Discount (
                        {userPackage.type === "class_pass" 
                          ? "5% on food" 
                          : `${((UNLIMITED_DISCOUNTS[userPackage.name] || 0) * 100).toFixed(0)}% on food`
                        })
                      </span>
                      <span className="text-sage">-₹{totals.discount.toFixed(0)}</span>
                    </div>
                  )}
                  
                  {totals.tax > 0 && (
                    <div className="flex justify-between font-body text-sm pt-2 border-t border-sage/10">
                      <span className="text-charcoal/70">Tax ({(TAX_RATE * 100).toFixed(0)}%)</span>
                      <span className="text-charcoal">₹{totals.tax.toFixed(0)}</span>
                    </div>
                  )}
                  
                  <div className="pt-3 border-t border-sage/10 flex justify-between font-display text-xl">
                    <span className="text-charcoal">Total</span>
                    <span className="text-sage">₹{totals.finalTotal.toFixed(0)}</span>
                  </div>

                  {userPackage.type === "class_pass" && useCredits && (
                    <p className="font-body text-xs text-charcoal/60 italic pt-2">
                      * 1 class will be deducted from your account (for your spot only)
                    </p>
                  )}
                  
                  {userPackage.type === "studio_pass" && (
                    <p className="font-body text-xs text-charcoal/60 italic pt-2">
                      * Your {userPackage.name} includes unlimited classes - no deduction
                    </p>
                  )}
                  
                  {userPackage.type === null && (
                    <p className="font-body text-xs text-terracotta/80 italic pt-2">
                      * No active package - full payment required
                    </p>
                  )}
                </div>

                {/* Payment Method Selection - Online Only */}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                  <CardContent className="p-6">
                    <h3 className="font-display text-xl text-charcoal mb-4">Payment Method</h3>
                    <div className="space-y-3">
                      <Card className="border-sage/20 bg-white cursor-pointer hover:border-sage/40 transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="h-5 w-5 rounded-full border-2 border-sage bg-sage flex items-center justify-center">
                              <div className="h-2.5 w-2.5 rounded-full bg-white" />
                            </div>
                            <div className="flex-1">
                              <p className="font-body font-semibold text-charcoal mb-1">Pay Online</p>
                              <p className="font-body text-sm text-charcoal/60">
                                Secure payment via Razorpay
                              </p>
                            </div>
                            <CreditCard className="h-5 w-5 text-sage" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>

                {totals.finalTotal === 0 && (
                  <div className="p-5 rounded-xl bg-sage/5 border border-sage/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center">
                        <Heart className="text-sage" size={20} fill="currentColor" />
                      </div>
                      <div>
                        <p className="font-body text-charcoal font-medium">No Payment Required</p>
                        <p className="font-body text-sm text-charcoal/60">Your unlimited package covers everything!</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Panel Footer - Navigation */}
          <div className="sticky bottom-0 p-6 bg-gradient-to-t from-cream/50 to-white border-t border-sage/10 backdrop-blur-sm">
            <div className="flex gap-3">
              {bookingStep > 1 && (
                <Button
                  onClick={handleBackStep}
                  variant="outline"
                  className="border-sage/30 text-charcoal hover:bg-sage/5"
                >
                  <ChevronLeft size={18} className="mr-2" />
                  Back
                </Button>
              )}
              
              {bookingStep < 4 ? (
                <Button
                  onClick={handleNextStep}
                  className="flex-1 bg-sage hover:bg-sage/90 text-white transition-all duration-600 hover:scale-105 active:scale-95 text-base py-6"
                >
                  Continue
                  <ChevronRight size={18} className="ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleConfirmBooking}
                  className="flex-1 bg-sage hover:bg-sage/90 text-white transition-all duration-600 hover:scale-105 active:scale-95 text-base py-6"
                >
                  {totals.finalTotal > 0 
                    ? `Confirm & ${paymentMethod === "online" ? "Pay" : "Book"} ₹${totals.finalTotal.toFixed(0)}`
                    : "Confirm Booking"
                  }
                </Button>
              )}
            </div>

            <Button 
              variant="ghost" 
              onClick={() => setShowBookingPanel(false)} 
              className="w-full text-charcoal/50 hover:text-charcoal font-body text-sm transition-all duration-600 hover:bg-sage/5 mt-2"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
      
      {/* Overlay */}
      {showBookingPanel && (
        <div 
          className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-40 transition-opacity duration-600 animate-in fade-in"
          onClick={() => setShowBookingPanel(false)}
        />
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