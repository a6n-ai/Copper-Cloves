import { useEffect, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/router";
import { PortalNavigation } from "@/components/PortalNavigation";
import { Card, CardContent } from "@/components/ui/card";
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
  AlertCircle
} from "lucide-react";
import { useSession } from "next-auth/react";
import {
  startOfMondayWeekLocal,
  endOfSundayWeekLocal,
  isSameLocalCalendarDay,
} from "@/lib/calendarWeek";
import { expectedBookingCheckoutPaise } from "@/lib/financeBookingCheckout";
import { razorpayPaymentErrorHelp } from "@/lib/razorpayClientHints";
import { completePendingBookingCheckout, completePendingPackageCheckout } from "@/lib/completeRazorpayCheckout";
import {
  buildRazorpayReturnUrl,
  clearPendingRazorpayCheckout,
  loadPendingRazorpayCheckout,
  savePendingRazorpayCheckout,
} from "@/lib/pendingRazorpayCheckout";
import { payWithRazorpayOrder } from "@/lib/razorpayCheckout";
import { passCategoryForPackageType } from "@/lib/couponHelpers";

import { cdnUrl } from "@/lib/cdnUrl";
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
  category: string;
  description: string;
  image: string;
  price: number;
  quantity: number;
}

function formatCafeCategory(category: string): string {
  return category
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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
  /** False when start time is in the past (still listed for the weekly grid). */
  isBookable?: boolean;
}

export default function BookClass() {
  const router = useRouter();
  const { toast } = useToast();
  const { status } = useSession();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  /** True while confirming booking / running Razorpay (does not replace entire page). */
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  /** Razorpay dismissed or failed — offer retry without a runtime error overlay. */
  const [paymentRecovery, setPaymentRecovery] = useState<
    null | { variant: "cancelled" | "failed"; detail?: string }
  >(null);
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
  const [loadingFoodItems, setLoadingFoodItems] = useState(false);
  const [foodItemsLoadError, setFoodItemsLoadError] = useState<string | null>(null);
  
  // Checkout
  // Featured Studio Pass (no-package upsell)
  const [featuredPackage, setFeaturedPackage] = useState<{ id: string; name: string; price: number; duration_months: number | null } | null>(null);
  const [addingPass, setAddingPass] = useState(false);

  // Coupon code
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountInr: number } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  
  // Pagination & filters
  const [currentPage, setCurrentPage] = useState(1);
  const [filterClassName, setFilterClassName] = useState<string>("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const classesPerPage = 6;

  const [weekSummary, setWeekSummary] = useState("");

  // Classes from database
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const weekMonday = useMemo(() => {
    const base = startOfMondayWeekLocal(new Date());
    const d = new Date(base);
    d.setDate(d.getDate() + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOffset]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekMonday);
      d.setDate(d.getDate() + i);
      return d;
    }),
  [weekMonday]);

  const uniqueClassNames = useMemo(() => {
    const names = new Set(allClasses.map(c => c.name));
    return Array.from(names).sort();
  }, [allClasses]);

  const filteredClasses = allClasses.filter(cls => {
    const nameMatch = filterClassName === "all" || cls.name === filterClassName;
    const dayMatch = selectedDayIndex === null || isSameLocalCalendarDay(new Date(cls.startTimeIso), weekDays[selectedDayIndex]);
    return nameMatch && dayMatch;
  });

  const totalPages = Math.ceil(filteredClasses.length / classesPerPage);
  const startIndex = (currentPage - 1) * classesPerPage;
  const paginatedClasses = filteredClasses.slice(startIndex, startIndex + classesPerPage);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/portal/login?redirect=/portal/book");
      return;
    }
    if (status === "authenticated") {
      setIsAuthenticated(true);
      checkAuthAndLoadData();
    }
  }, [status]);

  useEffect(() => {
    if (status === "authenticated") {
      setSelectedDayIndex(null);
      setFilterClassName("all");
      fetchClasses(weekOffset);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, weekOffset]);

  async function fetchClasses(offset = 0) {
    try {
      setLoadingClasses(true);
      const base = startOfMondayWeekLocal(new Date());
      const weekStart = new Date(base);
      weekStart.setDate(weekStart.getDate() + offset * 7);
      weekStart.setHours(0, 0, 0, 0);
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
            s.status !== "cancelled"
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
          image: schedule.class_model?.image_url || cdnUrl("/placeholder.jpg"),
          startTimeIso:
            typeof schedule.start_time === "string"
              ? schedule.start_time
              : new Date(schedule.start_time).toISOString(),
          isBookable: new Date(schedule.start_time).getTime() > nowMs,
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
      const [profileRes, packagesRes, allPkgRes] = await Promise.all([
        fetch("/api/user/profile"),
        fetch("/api/user-packages?active=true"),
        fetch("/api/packages"),
      ]);

      const profile = profileRes.ok ? await profileRes.json() : null;
      const packages = packagesRes.ok ? await packagesRes.json() : [];
      const allPkgTypes = allPkgRes.ok ? await allPkgRes.json() : [];
      // Pick highest-priced unlimited 3-month pass as the featured upsell
      const studioPass3m = Array.isArray(allPkgTypes)
        ? (allPkgTypes
            .filter((p: { is_unlimited: boolean; duration_months: number | null }) => p.is_unlimited && p.duration_months === 3)
            .sort((a: { price: number | string }, b: { price: number | string }) => Number(b.price) - Number(a.price))[0]
          || allPkgTypes.find((p: { is_unlimited: boolean }) => p.is_unlimited)
          || null)
        : null;
      if (studioPass3m) {
        setFeaturedPackage({ id: studioPass3m.id, name: studioPass3m.name, price: Number(studioPass3m.price), duration_months: studioPass3m.duration_months ?? null });
      }

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
          type: packageType ? passCategoryForPackageType(packageType) : "class_pass",
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
    setLoadingFoodItems(true);
    setFoodItemsLoadError(null);
    try {
      const res = await fetch("/api/cafe/items?available=true");
      const raw = res.ok ? await res.json() : [];
      const list = Array.isArray(raw) ? raw : [];
      setFoodItems(
        list.map(
          (item: {
            id: string;
            name: string;
            category?: string;
            description?: string | null;
            image_url?: string | null;
            price: number | string;
          }) => ({
            id: item.id,
            name: item.name,
            category: item.category ?? "other",
            description: item.description?.trim() ?? "",
            image: item.image_url?.trim() || cdnUrl("/placeholder.jpg"),
            price: Number(item.price),
            quantity: 0,
          }),
        ),
      );
    } catch (err) {
      console.error("Error loading cafe items:", err);
      setFoodItems([]);
      setFoodItemsLoadError("Could not load the café menu. You can continue without add-ons.");
    } finally {
      setLoadingFoodItems(false);
    }
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [filterClassName, selectedDayIndex]);

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
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);

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
    const couponDiscount = appliedCoupon?.discountInr ?? 0;
    const finalTotal = Math.max(0, totalAfterDiscount - couponDiscount);
    // Prices are tax-inclusive; extract GST for display only
    const taxIncluded = Math.round((finalTotal * TAX_RATE / (1 + TAX_RATE)) * 100) / 100;

    return { classTotal, foodTotal, discount, couponDiscount, subtotal, taxIncluded, finalTotal };
  }

  async function processGuests(classScheduleId: string) {
    if (friendsFamily.length === 0) return;
    try {
      await fetch("/api/bookings/process-guests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classScheduleId,
          guests: friendsFamily.map((g) => ({
            name: g.name,
            email: g.email,
            phone: g.phone,
          })),
        }),
      });
    } catch (err) {
      console.error("[processGuests]", err);
    }
  }

  async function handleAddPass() {
    if (!featuredPackage) return;
    setAddingPass(true);
    try {
      const amountPaise = featuredPackage.price * 100;
      const createRes = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "package",
          package_type_id: featuredPackage.id,
          pass_type: "studio_pass",
        }),
      });
      if (!createRes.ok) {
        let msg = "Could not start checkout.";
        try { const e = await createRes.json(); if (e?.error) msg = e.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const orderPayload = await createRes.json() as { order_id?: string; amount?: number | string; currency?: string; key_id?: string; razorpay_mode?: "test" | "live" | "unknown" };
      if (!orderPayload.order_id || orderPayload.key_id == null || orderPayload.amount == null) {
        throw new Error("Invalid payment setup from server.");
      }
      const amountPaiseServer = Number(orderPayload.amount);

      savePendingRazorpayCheckout({
        purpose: "package",
        razorpayOrderId: orderPayload.order_id,
        package_type_id: featuredPackage.id,
        pass_type: "studio_pass",
        savedAt: Date.now(),
      });

      const checkoutResult = await payWithRazorpayOrder({
        keyId: String(orderPayload.key_id).trim(),
        amountPaise: amountPaiseServer,
        currency: orderPayload.currency ?? "INR",
        orderId: orderPayload.order_id,
        name: "Copper Cloves",
        description: featuredPackage.name,
        prefill: { email: userEmail || undefined, name: userName || undefined },
        callbackUrl: buildRazorpayReturnUrl("package"),
        redirect: false,
      });

      if (checkoutResult.kind === "cancelled") {
        clearPendingRazorpayCheckout();
        toast({ title: "Cancelled", description: "Pass purchase cancelled.", variant: "error" });
        return;
      }
      if (checkoutResult.kind === "failed") {
        clearPendingRazorpayCheckout();
        toast({ title: "Payment failed", description: razorpayPaymentErrorHelp(checkoutResult.message, String(orderPayload.key_id).trim(), orderPayload.razorpay_mode), variant: "error" });
        return;
      }

      const pending = loadPendingRazorpayCheckout();
      if (!pending || pending.purpose !== "package") throw new Error("Checkout session lost.");
      if (checkoutResult.kind !== "success") throw new Error("Unexpected checkout state.");
      await completePendingPackageCheckout(pending, checkoutResult.payload);
      clearPendingRazorpayCheckout();

      // Refresh user package state so Step 2 shows the new pass
      const pkgRes = await fetch("/api/user-packages?active=true", { credentials: "include" });
      const pkgs = pkgRes.ok ? await pkgRes.json() : [];
      const now = new Date();
      const active = Array.isArray(pkgs) ? pkgs.find((p: { expiration_date: string; is_active: boolean }) => p.is_active && new Date(p.expiration_date) > now) : null;
      if (active) {
        const pt = active.package_type;
        setUserPackage({ type: "studio_pass", name: pt?.name ?? featuredPackage.name, classesRemaining: null, isUnlimited: true });
      }

      toast({ title: "Pass activated!", description: "Your Studio Pass is now active. Class is covered.", variant: "success" });
      setBookingStep(3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pass purchase failed.";
      toast({ title: "Error", description: msg, variant: "error" });
    } finally {
      setAddingPass(false);
    }
  }

  async function handleConfirmBooking() {
    try {
      setIsSubmittingBooking(true);

      const packagesRes = await fetch("/api/user-packages?active=true", { credentials: "include" });
      const packages = packagesRes.ok ? await packagesRes.json() : [];
      const now = new Date();
      const packageToUse =
        packages.find(
          (p: { expiration_date: string; is_active: boolean }) =>
            p.is_active && new Date(p.expiration_date) > now,
        ) || null;

      if (userPackage.type === "class_pass" && useCredits) {
        if (!packageToUse) throw new Error("No active package found. Please purchase a package first.");
        if ((packageToUse.credits_remaining ?? 0) < 1) throw new Error("You don't have any classes remaining.");
      }

      const owedTotals = calculateTotals();
      const { classTotal, foodTotal, discount, taxIncluded, finalTotal } = owedTotals;
      const totalPeople = 1 + friendsFamily.length;
      let dayPassEquivalentCount = totalPeople;
      if (userPackage.type === null) dayPassEquivalentCount = totalPeople;
      else if (userPackage.type === "studio_pass") dayPassEquivalentCount = friendsFamily.length;
      else if (userPackage.type === "class_pass") {
        dayPassEquivalentCount = useCredits ? friendsFamily.length : totalPeople;
      }

      const guestAttendeesPayload = friendsFamily.map((p) => ({
        name: p.name || "",
        email: p.email || "",
        phone: p.phone || "",
      }));

      const financeSnapshotPayload = {
        version: 1 as const,
        classFeeInr: classTotal,
        foodFeeInr: foodTotal,
        foodDiscountInr: discount,
        couponDiscountInr: owedTotals.couponDiscount,
        taxInr: taxIncluded,
        totalInr: finalTotal,
        dayPassEquivalentCount,
        noActivePackageCheckout: userPackage.type === null,
        paymentMethod: "online" as const,
      };

      let paidViaRazorpay = false;
      let razorpayOrderIdForBooking: string | null = null;
      const oweOnline = finalTotal > 0;

      if (oweOnline) {
        const amountPaiseExpected = expectedBookingCheckoutPaise(finalTotal);
        const createRes = await fetch("/api/payments/razorpay/create-order", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purpose: "booking",
            pending_checkout: {
              class_schedule_id: selectedClass?.id ?? "",
              class_name: selectedClass?.name ?? null,
              class_time: selectedClass?.startTimeIso ?? null,
              user_package_id:
                userPackage.type === "class_pass" && useCredits
                  ? packageToUse?.id ?? null
                  : null,
              extra_guest_count: friendsFamily.length,
              guest_attendees: guestAttendeesPayload,
              finance_snapshot: financeSnapshotPayload,
              cafe_items: foodItems
                .filter((item) => item.quantity > 0)
                .map((item) => ({ id: item.id, quantity: item.quantity })),
            },
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
          orderPayload.key_id == null ||
          String(orderPayload.key_id).trim() === "" ||
          orderPayload.amount == null
        ) {
          throw new Error("Invalid payment setup from server.");
        }

        const amountPaise = Number(orderPayload.amount);
        if (!Number.isFinite(amountPaise)) {
          throw new Error("Invalid order amount from Razorpay.");
        }

        const classTimeISO = selectedClass?.startTimeIso ?? null;
        const userPackageIdForBooking =
          userPackage.type === "class_pass" && useCredits ? packageToUse?.id ?? null : null;

        savePendingRazorpayCheckout({
          purpose: "booking",
          razorpayOrderId: orderPayload.order_id,
          class_schedule_id: selectedClass?.id ?? "",
          class_name: selectedClass?.name ?? null,
          class_time: classTimeISO,
          user_package_id: userPackageIdForBooking,
          extra_guest_count: friendsFamily.length,
          guest_attendees: guestAttendeesPayload,
          finance_snapshot: financeSnapshotPayload,
          cafe_items: foodItems
            .filter((item) => item.quantity > 0)
            .map((item) => ({ id: item.id, quantity: item.quantity })),
          savedAt: Date.now(),
        });

        const checkoutResult = await payWithRazorpayOrder({
          keyId: String(orderPayload.key_id).trim(),
          amountPaise,
          currency: orderPayload.currency ?? "INR",
          orderId: orderPayload.order_id,
          name: "Copper Cloves",
          description: selectedClass?.name ? `Class — ${selectedClass.name}` : "Studio booking",
          prefill: { email: userEmail || undefined, name: userName || undefined },
          callbackUrl: buildRazorpayReturnUrl("booking"),
          redirect: false,
        });
        if (checkoutResult.kind === "cancelled") {
          clearPendingRazorpayCheckout();
          setPaymentRecovery({ variant: "cancelled" });
          return;
        }
        if (checkoutResult.kind === "failed") {
          clearPendingRazorpayCheckout();
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

        const pending = loadPendingRazorpayCheckout();
        if (!pending || pending.purpose !== "booking") {
          throw new Error("Checkout session lost. Please try again.");
        }
        if (checkoutResult.kind !== "success") throw new Error("Unexpected checkout state.");
        await completePendingBookingCheckout(pending, checkoutResult.payload);
        clearPendingRazorpayCheckout();
        paidViaRazorpay = true;
        await processGuests(selectedClass?.id ?? "");
        toast({ title: "Payment successful", description: `Booking confirmed for ₹${finalTotal.toFixed(0)}.`, variant: "success" });
        setShowBookingPanel(false);
        router.push("/portal/dashboard");
        return;
      }

      const classTimeISO = selectedClass?.startTimeIso ?? null;

      const bookingRes = await fetch("/api/bookings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_schedule_id: selectedClass?.id ?? null,
          class_name: selectedClass?.name,
          class_time: classTimeISO,
          user_package_id: userPackage.type === "class_pass" && useCredits ? packageToUse?.id : null,
          razorpay_order_id: razorpayOrderIdForBooking,
          extra_guest_count: friendsFamily.length,
          guest_attendees: guestAttendeesPayload,
          finance_snapshot: financeSnapshotPayload,
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

      const cafePaymentMethod = paidViaRazorpay ? "razorpay" : "pay_at_studio";
      const orderedFoodItems = foodItems.filter((item) => item.quantity > 0);
      for (const item of orderedFoodItems) {
        const foodRes = await fetch("/api/cafe/orders", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cafe_item_id: item.id,
            booking_id: bookingId,
            quantity: item.quantity,
            payment_method: cafePaymentMethod,
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

      await processGuests(selectedClass?.id ?? "");

      if (finalTotal > 0) {
        toast({ title: "Booking confirmed", description: `Payment of ₹${finalTotal.toFixed(0)} processed.`, variant: "success" });
      } else {
        toast({ title: "Booking confirmed", description: "No payment required.", variant: "success" });
      }

      setShowBookingPanel(false);
      router.push("/portal/dashboard");
    } catch (err: unknown) {
      console.error("BOOKING ERROR:", err);
      const message = err instanceof Error ? err.message : "Failed to complete booking. Please try again.";
      toast({ title: "Booking failed", description: message, variant: "error" });
    } finally {
      setIsSubmittingBooking(false);
    }
  }

  if (isLoading || loadingClasses) {
    return (
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/5 flex items-center justify-center">
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
    <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/5">
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
            <p className="font-body text-charcoal/60 text-base">
              {filteredClasses.length > 0
                ? `${filteredClasses.length} class${filteredClasses.length !== 1 ? "es" : ""} found`
                : "No classes match your filters"}
            </p>
          </div>

          {/* Week Navigation */}
          <div className="mb-6 bg-white/80 backdrop-blur-xs rounded-2xl border border-sage/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setWeekOffset(o => o - 1)}
                className="p-2 rounded-full hover:bg-sage/10 text-sage transition-colors"
                aria-label="Previous week"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="font-body text-sm text-charcoal/70 font-medium flex items-center gap-2">
                {weekSummary || "Loading…"}
                {weekOffset === 0 && <span className="text-xs text-sage bg-sage/10 px-2 py-0.5 rounded-full">This Week</span>}
                {weekOffset === 1 && <span className="text-xs text-sage bg-sage/10 px-2 py-0.5 rounded-full">Next Week</span>}
                {weekOffset < 0 && <span className="text-xs text-terracotta/80 bg-terracotta/10 px-2 py-0.5 rounded-full">Past</span>}
                {weekOffset > 1 && <span className="text-xs text-sage bg-sage/10 px-2 py-0.5 rounded-full">Upcoming</span>}
              </span>
              <button
                onClick={() => setWeekOffset(o => o + 1)}
                className="p-2 rounded-full hover:bg-sage/10 text-sage transition-colors"
                aria-label="Next week"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day, i) => {
                const today = new Date();
                const isToday = isSameLocalCalendarDay(day, today);
                const isPast = !isToday && day < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const isSelected = selectedDayIndex === i;
                const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDayIndex(isSelected ? null : i)}
                    className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all ${
                      isSelected
                        ? "bg-sage text-white"
                        : isPast
                        ? "opacity-40 cursor-default"
                        : isToday
                        ? "bg-sage/15 text-sage border border-sage/30"
                        : "hover:bg-sage/10 text-charcoal/70"
                    }`}
                  >
                    <span className="text-[10px] font-body uppercase tracking-wide leading-none mb-1">
                      {dayNames[i]}
                    </span>
                    <span className={`text-base font-display leading-none ${
                      isSelected ? "text-white" : isPast ? "text-charcoal/40" : isToday ? "text-sage" : "text-charcoal"
                    }`}>
                      {day.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Class Filter */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setFilterClassName("all")}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-body transition-all border ${
                filterClassName === "all"
                  ? "bg-sage text-white border-sage"
                  : "border-sage/30 text-charcoal hover:border-sage hover:bg-sage/5"
              }`}
            >
              All Classes
            </button>
            {uniqueClassNames.map(name => (
              <button
                key={name}
                onClick={() => setFilterClassName(filterClassName === name ? "all" : name)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-body transition-all border ${
                  filterClassName === name
                    ? "bg-sage text-white border-sage"
                    : "border-sage/30 text-charcoal hover:border-sage hover:bg-sage/5"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          {/* Class Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {paginatedClasses.map(cls => (
              <Card 
                key={cls.id} 
                className="border-sage/20 bg-white/80 backdrop-blur-xs hover:border-sage hover:shadow-xl transition-all duration-600 overflow-hidden group"
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
                      <div className="absolute inset-0 bg-linear-to-t from-charcoal/60 via-charcoal/20 to-transparent" />
                      <Badge 
                        className={`absolute top-4 left-4 ${
                          cls.intensity === 'high' 
                            ? 'bg-terracotta/90 hover:bg-terracotta' 
                            : cls.intensity === 'moderate'
                            ? 'bg-sage/90 hover:bg-sage'
                            : 'bg-charcoal/90 hover:bg-charcoal'
                        } text-white border-none backdrop-blur-xs font-body`}
                      >
                        {cls.intensity}
                      </Badge>
                      <div className="absolute top-4 right-4 bg-cream/90 backdrop-blur-xs rounded-lg px-3 py-2">
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
                        onClick={() => cls.isBookable !== false && handleSelectClass(cls)} 
                        disabled={cls.isBookable === false}
                        className="bg-sage hover:bg-sage/90 text-white font-body w-full transition-all duration-600 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                      >
                        {cls.isBookable === false ? "Session started" : "Reserve Your Spot"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/80 backdrop-blur-xs rounded-xl p-6 border border-sage/20">
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
            <Card className="border-sage/20 bg-white/80 backdrop-blur-xs">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Calendar className="w-16 h-16 text-sage/40 mb-4" />
                <h3 className="font-display text-2xl text-charcoal mb-2">No Classes Available</h3>
                <p className="font-body text-charcoal/60 mb-6">Try adjusting your filters or check back soon.</p>
                <Button
                  onClick={() => { setFilterClassName("all"); setSelectedDayIndex(null); }}
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
          <div className="sticky top-0 z-10 p-6 flex items-center justify-between border-b border-sage/10 bg-linear-to-r from-cream/80 to-white/80 backdrop-blur-xl">
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
                <div className="p-6 rounded-xl bg-linear-to-br from-sage/10 to-cream/30 border border-sage/20">
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

                  {userPackage.type === null && featuredPackage && (
                    <div className="p-5 rounded-xl border-2 border-sage/40 bg-sage/5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-5 h-5 rounded-full border-2 border-sage bg-sage/20 mt-0.5 flex items-center justify-center shrink-0">
                          <span className="text-sage text-[10px] font-bold">★</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-body text-charcoal font-medium mb-0.5">
                            {featuredPackage.name}
                          </p>
                          <p className="font-body text-xs text-charcoal/60 mb-2">
                            Unlimited classes · ₹{featuredPackage.price.toLocaleString("en-IN")}
                            {featuredPackage.duration_months ? ` · Valid ${featuredPackage.duration_months} months` : ""}
                          </p>
                          <p className="font-body text-xs text-charcoal/50">
                            No active package — you&apos;re paying ₹{(1 + friendsFamily.length) * 945} per class. Pass pays off after {Math.ceil(featuredPackage.price / 945)} visits.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-2 border-t border-sage/20">
                        <button
                          onClick={handleAddPass}
                          disabled={addingPass}
                          className="flex-1 text-center font-body text-xs font-medium bg-sage text-white rounded-lg py-2 px-3 hover:bg-sage/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {addingPass ? "Processing…" : "Add this Pass →"}
                        </button>
                        <a
                          href="/portal/packages"
                          className="font-body text-xs text-sage hover:text-sage/80 underline underline-offset-2 transition-colors whitespace-nowrap"
                        >
                          Explore all Packages
                        </a>
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
                      <span className="block text-sage mt-1 font-bold">
                        ✓ Your {userPackage.name} includes {((UNLIMITED_DISCOUNTS[userPackage.name] || 0) * 100).toFixed(0)}% off on café items
                      </span>
                    )}
                  </p>
                </div>

                <div className="space-y-4">
                  {loadingFoodItems ? (
                    <p className="font-body text-sm text-charcoal/60 text-center py-8">
                      Loading café menu…
                    </p>
                  ) : null}
                  {!loadingFoodItems && foodItemsLoadError ? (
                    <p className="font-body text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      {foodItemsLoadError}
                    </p>
                  ) : null}
                  {!loadingFoodItems && !foodItemsLoadError && foodItems.length === 0 ? (
                    <p className="font-body text-sm text-charcoal/60 text-center py-8">
                      No café items are available right now. Mark items as available in Admin → Café → Menu.
                    </p>
                  ) : null}
                  {foodItems.map((item) => (
                    <div 
                      key={item.id}
                      className="p-4 rounded-xl bg-white border border-sage/10 hover:border-sage/30 transition-all"
                    >
                      <div className="flex gap-4">
                        <img 
                          src={item.image}
                          alt={item.name}
                          className="w-24 h-24 rounded-lg object-cover bg-sage/10"
                        />
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h4 className="font-display text-lg text-charcoal">{item.name}</h4>
                            <Badge variant="outline" className="border-sage/30 text-charcoal/70 text-[10px]">
                              {formatCafeCategory(item.category)}
                            </Badge>
                          </div>
                          {item.description ? (
                            <p className="font-body text-xs text-charcoal/60 mb-2">{item.description}</p>
                          ) : null}
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
                <div className="p-6 rounded-xl bg-linear-to-br from-cream/40 to-sage/5 border border-sage/10 space-y-4">
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

                {/* Coupon Code */}
                {totals.finalTotal > 0 && (
                  <div className="p-5 rounded-xl bg-white border border-sage/10">
                    <p className="font-body text-sm font-medium text-charcoal mb-3">Have a coupon code?</p>
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between">
                        <span className="font-body text-sm text-sage font-medium">
                          ✓ {appliedCoupon.code} — -₹{appliedCoupon.discountInr.toFixed(0)} off
                        </span>
                        <button
                          onClick={() => { setAppliedCoupon(null); setCouponCode(""); setCouponError(null); }}
                          className="font-body text-xs text-charcoal/50 hover:text-terracotta underline underline-offset-2 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(null); }}
                          placeholder="Enter code"
                          className="flex-1 font-body text-sm px-3 py-2 rounded-lg border border-sage/30 focus:outline-hidden focus:ring-1 focus:ring-sage bg-white text-charcoal placeholder:text-charcoal/30 uppercase"
                        />
                        <button
                          disabled={!couponCode.trim() || couponLoading}
                          onClick={async () => {
                            setCouponLoading(true);
                            setCouponError(null);
                            try {
                              const ctx = totals.classTotal > 0
                                ? (userPackage.type === "studio_pass" ? "studio_pass" : "class_pass")
                                : "food";
                              const r = await fetch("/api/coupons/validate", {
                                method: "POST",
                                credentials: "include",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ code: couponCode.trim(), context: ctx, subtotal: totals.finalTotal }),
                              });
                              const d = await r.json();
                              if (d.valid) {
                                setAppliedCoupon({ code: d.code, discountInr: d.discountInr });
                              } else {
                                setCouponError(d.error ?? "Invalid coupon");
                              }
                            } catch {
                              setCouponError("Could not apply coupon. Try again.");
                            } finally {
                              setCouponLoading(false);
                            }
                          }}
                          className="font-body text-sm px-4 py-2 rounded-lg bg-sage text-white hover:bg-sage/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {couponLoading ? "…" : "Apply"}
                        </button>
                      </div>
                    )}
                    {couponError && (
                      <p className="font-body text-xs text-terracotta mt-2">{couponError}</p>
                    )}
                  </div>
                )}

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
                        Package discount (
                        {userPackage.type === "class_pass"
                          ? "5% on food"
                          : `${((UNLIMITED_DISCOUNTS[userPackage.name] || 0) * 100).toFixed(0)}% on food`
                        })
                      </span>
                      <span className="text-sage">-₹{totals.discount.toFixed(0)}</span>
                    </div>
                  )}

                  {totals.couponDiscount > 0 && (
                    <div className="flex justify-between font-body text-sm">
                      <span className="text-sage">Coupon ({appliedCoupon?.code})</span>
                      <span className="text-sage">-₹{totals.couponDiscount.toFixed(0)}</span>
                    </div>
                  )}

                  <div className="pt-3 border-t border-sage/10 flex justify-between font-display text-xl">
                    <span className="text-charcoal">Total</span>
                    <span className="text-sage">₹{totals.finalTotal.toFixed(0)}</span>
                  </div>

                  {totals.taxIncluded > 0 && (
                    <p className="font-body text-xs text-charcoal/40 text-right">
                      Incl. 5% GST: ₹{totals.taxIncluded.toFixed(0)}
                    </p>
                  )}

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

                {/* Payment method — online only */}
                {totals.finalTotal > 0 && (
                  <Card className="border-sage/20 bg-white/95">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-sage/10 flex items-center justify-center shrink-0">
                          <CreditCard className="h-5 w-5 text-sage" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-body font-semibold text-charcoal">Pay online via Razorpay</p>
                          <p className="font-body text-sm text-charcoal/60">Card, UPI, netbanking — secure checkout</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

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
          <div className="sticky bottom-0 p-6 bg-linear-to-t from-cream/50 to-white border-t border-sage/10 backdrop-blur-xs">
            <div className="flex gap-3">
              {bookingStep > 1 && (
                <Button
                  onClick={handleBackStep}
                  variant="outline"
                  disabled={isSubmittingBooking}
                  className="border-sage/30 text-charcoal hover:bg-sage/5"
                >
                  <ChevronLeft size={18} className="mr-2" />
                  Back
                </Button>
              )}
              
              {bookingStep < 4 ? (
                <Button
                  onClick={handleNextStep}
                  disabled={isSubmittingBooking}
                  className="flex-1 bg-sage hover:bg-sage/90 text-white transition-all duration-600 hover:scale-105 active:scale-95 text-base py-6"
                >
                  Continue
                  <ChevronRight size={18} className="ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleConfirmBooking}
                  disabled={isSubmittingBooking}
                  className="flex-1 bg-sage hover:bg-sage/90 text-white transition-all duration-600 hover:scale-105 active:scale-95 text-base py-6 disabled:opacity-60 disabled:hover:scale-100"
                >
                  {isSubmittingBooking
                    ? "Working…"
                    : totals.finalTotal > 0
                      ? `Confirm & Pay ₹${totals.finalTotal.toFixed(0)}`
                      : "Confirm Booking"}
                </Button>
              )}
            </div>

            <Button 
              variant="ghost" 
              onClick={() => setShowBookingPanel(false)} 
              disabled={isSubmittingBooking}
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
          className="fixed inset-0 bg-charcoal/40 backdrop-blur-xs z-40 transition-opacity duration-600 animate-in fade-in"
          onClick={() => setShowBookingPanel(false)}
        />
      )}

      <AlertDialog
        open={paymentRecovery !== null}
        onOpenChange={(open) => {
          if (!open) setPaymentRecovery(null);
        }}
      >
        <AlertDialogContent className="border-sage/20 bg-white font-body">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-charcoal">
              {paymentRecovery?.variant === "failed" ? "Payment didn’t go through" : "Payment cancelled"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-charcoal/70 space-y-2">
              {paymentRecovery?.variant === "cancelled" ? (
                <span>You closed checkout before completing payment. Your booking hasn&apos;t been placed yet.</span>
              ) : (
                <span className="whitespace-pre-line block">
                  {paymentRecovery?.detail ?? "Something went wrong with this payment attempt."}
                </span>
              )}
              <span className="block pt-1">
                You can try paying again — we&apos;ll open Razorpay checkout with a fresh order.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-sage/30 text-charcoal"
              onClick={() => setPaymentRecovery(null)}
            >
              Close
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-sage hover:bg-sage/90 text-white"
              onClick={() => {
                setPaymentRecovery(null);
                void handleConfirmBooking();
              }}
            >
              Retry payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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