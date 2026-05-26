import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useRouter } from "next/router";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useSession } from "next-auth/react";
import {
  Plus,
  Minus, 
  ShoppingCart, 
  Users,
  X,
  Check
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { CloseButton, QtyMinusButton, QtyPlusButton } from "@/components/ui/quick-actions";

import { cdnUrl } from "@/lib/cdnUrl";

const CATEGORIES = [
  { id: "all", label: "All Items" },
  { id: "smoothie_bowl", label: "Smoothie Bowls" },
  { id: "drink", label: "Drinks" },
  { id: "snack", label: "Snacks" },
  { id: "meal", label: "Meals" }
];

interface MenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image_url: string;
  is_available: boolean;
}

interface CartItem extends MenuItem {
  quantity: number;
}

interface ClassSchedule {
  id: string;
  start_time: string;
  class_model?: {
    name: string;
  };
  instructor?: {
    full_name: string;
  };
}

/** Mirrors a café menu Card: aspect-video image, category chip, title, description, price, add-to-cart button. */
function MenuItemCardSkeleton() {
  return (
    <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg overflow-hidden">
      <div className="aspect-video w-full overflow-hidden">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
      <CardContent className="p-6">
        <div className="mb-3">
          <Skeleton className="h-5 w-24 rounded-full mb-2" />
          <Skeleton className="h-7 w-3/5 mb-2" />
          <Skeleton className="h-3.5 w-full mb-1" />
          <Skeleton className="h-3.5 w-4/5 mb-3" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

function MenuGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <MenuItemCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default function MenuPage() {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showCheckout, setShowCheckout] = useState(false);
  
  const [addToClass, setAddToClass] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [availableClasses, setAvailableClasses] = useState<ClassSchedule[]>([]);
  const [guestCount, setGuestCount] = useState(0);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const paymentMethod = "online" as const;
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
  }, []);

  const categories = CATEGORIES;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/portal/login?redirect=/portal/menu");
      return;
    }
    if (status === "authenticated") {
      fetchMenuItems();
      fetchUpcomingClasses();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const fetchMenuItems = async () => {
    try {
      const res = await fetch("/api/cafe/items?available=true");
      const raw = res.ok ? await res.json() : [];
      const list = Array.isArray(raw) ? raw : [];
      const normalized: MenuItem[] = list.map((item: Record<string, unknown>) => ({
        ...(item as unknown as MenuItem),
        description: String(item.description ?? ""),
        image_url: String(item.image_url ?? ""),
        price: Number(item.price),
      }));
      setMenuItems(normalized);
    } catch (err) {
      console.error("Error fetching menu:", err);
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingClasses = async () => {
    try {
      const today = new Date();
      const params = new URLSearchParams({
        month: String(today.getMonth() + 1),
        year: String(today.getFullYear()),
      });
      const res = await fetch(`/api/class-schedules?${params}`, { credentials: "omit" });
      const data = res.ok ? await res.json() : [];
      setAvailableClasses(data);
    } catch (err) {
      console.error("Error fetching classes:", err);
    }
  };

  const addToCart = (item: MenuItem) => {
    setCart(prevCart => {
      const existing = prevCart.find(i => i.id === item.id);
      if (existing) {
        return prevCart.map(i => 
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prevCart, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prevCart => prevCart.filter(i => i.id !== itemId));
  };

  const updateQuantity = (itemId: string, change: number) => {
    setCart(prevCart => 
      prevCart.map(item => {
        if (item.id === itemId) {
          const newQty = Math.max(0, item.quantity + change);
          return newQty === 0 ? null : { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[]
    );
  };

  const getSubtotal = () =>
    cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const getFinalTotal = () => {
    const sub = getSubtotal();
    const off = couponDiscount && couponDiscount > 0 ? couponDiscount : 0;
    return Math.max(0, Math.round((sub - off) * 100) / 100);
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setCouponError(null);
    setCouponDiscount(null);
    setCouponCode("");
    setShowCheckout(true);
  };

  async function validateMenuCoupon() {
    setCouponError(null);
    const subtotal = getSubtotal();
    if (subtotal <= 0) return;
    const r = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: couponCode,
        context: "food",
        subtotal,
      }),
    });
    const d = r.ok ? await r.json() : { valid: false, error: "Could not validate" };
    if (!d.valid) {
      setCouponDiscount(null);
      setCouponError(typeof d.error === "string" ? d.error : "Invalid coupon");
      return;
    }
    setCouponDiscount(Number(d.discountInr) || 0);
  }

  const handleGuestCountChange = (count: number) => {
    const newCount = Math.max(0, Math.min(5, count));
    setGuestCount(newCount);
    setGuestNames(Array(newCount).fill(""));
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setOrderError(null);
    setIsProcessing(true);
    try {
      const items = cart.map((item) => ({
        cafe_item_id: item.id,
        quantity: item.quantity,
      }));
      const res = await fetch("/api/cafe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          coupon_code: couponCode.trim() || undefined,
          payment_method: paymentMethod,
          add_to_class: addToClass,
          class_schedule_id: addToClass && selectedClass ? selectedClass : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setOrderError(typeof body?.error === "string" ? body.error : "Order failed");
        return;
      }

      setOrderSuccess(true);
      successTimeoutRef.current = setTimeout(() => {
        setCart([]);
        setShowCheckout(false);
        setOrderSuccess(false);
        setCouponCode("");
        setCouponDiscount(null);
        router.push("/portal/dashboard");
      }, 2000);
    } catch (err) {
      console.error("Error placing order:", err);
      setOrderError(err instanceof Error ? err.message : "Could not place order");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredItems = useMemo(
    () => selectedCategory === "all"
      ? menuItems
      : menuItems.filter((item) => item.category === selectedCategory),
    [menuItems, selectedCategory],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/5">
        <main className="min-h-screen">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
            <MenuGridSkeleton count={6} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/5">
      <main className="min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          
          {/* Header */}
          <div className="mb-6">
            <PageHeader title="Today's Menu" subtitle="Nourish your body after movement" />
          </div>

          {/* Category Filters */}
          <div className="mb-8 flex gap-3 overflow-x-auto pb-2">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-6 py-2 rounded-full font-body text-sm whitespace-nowrap transition-all duration-300 ${
                  selectedCategory === cat.id
                    ? "bg-sage text-white shadow-lg"
                    : "bg-white/80 text-charcoal hover:bg-sage/10 border border-sage/20"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Menu Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {filteredItems.length === 0 ? (
              <div className="col-span-full text-center py-16 rounded-2xl bg-white/60 border border-sage/10">
                <p className="font-body text-charcoal/70">
                  No café items are available yet. Check back soon, or ask the studio to publish the menu in Admin → Café.
                </p>
              </div>
            ) : (
              filteredItems.map(item => (
              <Card key={item.id} className="border-0 bg-white/80 backdrop-blur-xl shadow-lg overflow-hidden group">
                <div className="aspect-video w-full overflow-hidden">
                  <Image
                    src={item.image_url || cdnUrl("/food/A7401864.jpg")}
                    alt={item.name}
                    width={1200}
                    height={675}
                    unoptimized
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                <CardContent className="p-4 sm:p-6">
                  <div className="mb-3">
                    <Badge variant="outline" className="mb-2 text-xs font-body border-sage/30 text-sage">
                      {categories.find(c => c.id === item.category)?.label}
                    </Badge>
                    <h3 className="font-display text-xl sm:text-2xl text-charcoal mb-1.5">{item.name}</h3>
                    <p className="font-body text-sm text-charcoal/70 mb-2 line-clamp-2">{item.description}</p>
                    <p className="font-display text-2xl sm:text-3xl text-sage">₹{item.price}</p>
                  </div>

                  <Button
                    onClick={() => addToCart(item)}
                    variant="sage"
                    className="w-full h-11"
                  >
                    <Plus size={18} className="mr-2" />
                    Add to Cart
                  </Button>
                </CardContent>
              </Card>
              ))
            )}
          </div>

          {/* Floating Cart Button — raised above bottom nav on mobile */}
          {cart.length > 0 && (
            <div className="fixed bottom-28 right-4 sm:bottom-8 sm:right-8 z-40">
              <Button
                onClick={handleCheckout}
                size="lg"
                variant="sage"
                className="shadow-2xl text-base sm:text-lg h-14 sm:h-16 px-6 sm:px-8 rounded-full"
              >
                <ShoppingCart size={22} className="mr-2 sm:mr-3" />
                Cart ({cart.length})
              </Button>
            </div>
          )}

        </div>
      </main>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-charcoal/60 backdrop-blur-xs" onClick={() => setShowCheckout(false)} />
          
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-xl border-b border-sage/10 p-6 z-10">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-3xl text-charcoal">Your Order</h2>
                <CloseButton onClick={() => setShowCheckout(false)} className="rounded-full" />
              </div>
            </div>

            {/* Cart Items */}
            <div className="p-6 space-y-4">
              {cart.map(item => (
                <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl bg-cream/30 border border-sage/10">
                  <Image
                    src={item.image_url || cdnUrl("/food/A7401864.jpg")}
                    alt={item.name}
                    width={80}
                    height={80}
                    unoptimized
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h4 className="font-display text-lg text-charcoal">{item.name}</h4>
                    <p className="font-body text-sm text-sage">₹{item.price} each</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <QtyMinusButton
                      onClick={() => updateQuantity(item.id, -1)}
                      className="rounded-full bg-sage/10"
                      label="Decrease quantity"
                    />
                    <span className="font-body text-lg w-8 text-center">{item.quantity}</span>
                    <QtyPlusButton
                      onClick={() => updateQuantity(item.id, 1)}
                      className="rounded-full bg-sage/10"
                      label="Increase quantity"
                    />
                  </div>
                  <Button
                    onClick={() => removeFromCart(item.id)}
                    variant="terracotta-ghost"
                    size="icon-sm"
                    aria-label="Remove"
                  >
                    <X size={20} />
                  </Button>
                </div>
              ))}

              {/* Add to Class */}
              <div className="p-6 rounded-xl bg-white/80 border border-sage/20">
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    checked={addToClass}
                    onChange={(e) => setAddToClass(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <label className="font-body text-charcoal">Add to a class booking</label>
                </div>
                
                {addToClass && (
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full p-3 rounded-lg border border-sage/30 font-body"
                  >
                    <option value="">Select a class</option>
                    {availableClasses.map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {cls.class_model?.name ?? "Class"} - {new Date(cls.start_time).toLocaleDateString()} at {new Date(cls.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Add Friends/Family */}
              <div className="p-6 rounded-xl bg-white/80 border border-sage/20">
                <div className="flex items-center justify-between mb-4">
                  <label className="font-body text-charcoal flex items-center gap-2">
                    <Users size={20} />
                    Order for friends/family
                  </label>
                  <div className="flex gap-2">
                    <QtyMinusButton
                      onClick={() => handleGuestCountChange(guestCount - 1)}
                      className="rounded-full bg-sage/10"
                      label="Decrease guests"
                    />
                    <span className="font-body px-4">{guestCount}</span>
                    <QtyPlusButton
                      onClick={() => handleGuestCountChange(guestCount + 1)}
                      className="rounded-full bg-sage/10"
                      label="Increase guests"
                    />
                  </div>
                </div>

                {guestCount > 0 && (
                  <div className="space-y-2">
                    {guestNames.map((_, index) => (
                      <Input
                        key={index}
                        placeholder={`Guest ${index + 1} name`}
                        value={guestNames[index]}
                        onChange={(e) => {
                          const newNames = [...guestNames];
                          newNames[index] = e.target.value;
                          setGuestNames(newNames);
                        }}
                        className="font-body"
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 rounded-xl bg-white/80 border border-sage/20 space-y-3">
                <h3 className="font-display text-lg text-charcoal">Coupon</h3>
                <div className="flex gap-2 flex-col sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Input
                      placeholder="Promo code"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setCouponDiscount(null);
                        setCouponError(null);
                      }}
                      className="font-mono uppercase"
                    />
                  </div>
                  <Button type="button" variant="sage-outline" onClick={() => void validateMenuCoupon()}>
                    Apply
                  </Button>
                </div>
                {couponError && <p className="text-sm text-red-600 font-body">{couponError}</p>}
              </div>

              {/* Payment Method */}
              <div className="p-6 rounded-xl bg-white/80 border border-sage/20">
                <h3 className="font-display text-lg text-charcoal mb-4">Payment Method</h3>
                <div className="grid grid-cols-1 gap-3">
                  <label 
                    className="flex items-center gap-3 p-4 rounded-xl border-2 cursor-default transition-all duration-300 border-sage bg-sage/5"
                  >
                    <input 
                      type="radio" 
                      name="payment" 
                      value="online"
                      checked={true}
                      readOnly
                      className="sr-only" 
                    />
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center border-sage">
                      <div className="w-3 h-3 rounded-full bg-sage" />
                    </div>
                    <div>
                      <span className="font-body block">Pay Online</span>
                      <span className="font-body text-xs text-charcoal/60">UPI / Cards</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Total */}
              <div className="p-6 rounded-xl bg-sage/10 border border-sage/20 space-y-2">
                <div className="flex justify-between items-center font-body text-charcoal/80">
                  <span>Subtotal</span>
                  <span>₹{getSubtotal()}</span>
                </div>
                {couponDiscount != null && couponDiscount > 0 && (
                  <div className="flex justify-between items-center font-body text-sage">
                    <span>Discount</span>
                    <span>−₹{couponDiscount}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-sage/20">
                  <span className="font-body text-lg text-charcoal">Total</span>
                  <span className="font-display text-4xl text-sage">₹{getFinalTotal()}</span>
                </div>
              </div>

              {/* Place Order Button */}
              {orderError && (
                <p className="text-sm text-red-600 font-body px-1">{orderError}</p>
              )}
              <Button
                onClick={handlePlaceOrder}
                disabled={isProcessing || orderSuccess}
                variant="sage"
                className="w-full h-14 text-lg"
              >
                {isProcessing ? (
                  <>
                    <Spinner className="mr-2 size-4" />
                    Processing...
                  </>
                ) : orderSuccess ? (
                  <>
                    <Check className="mr-2" size={20} />
                    Order Placed!
                  </>
                ) : (
                  "Place Order"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}