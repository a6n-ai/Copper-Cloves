import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, Minus, Plus, ShoppingCart, Users, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cdnUrl } from "@/lib/cdnUrl";
import { cn } from "@/lib/utils";
import type { CafeCartItem, CafeClassSchedule } from "./types";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CafeCartItem[];
  onUpdateQuantity: (id: string, change: number) => void;
  onRemove: (id: string) => void;
  availableClasses: CafeClassSchedule[];
  /** Called after a successful order; parent clears cart + redirects. */
  onOrderPlaced: () => void;
}

const sectionBox = "rounded-xl border border-border bg-white-warm p-5";

/**
 * Member cart + checkout drawer — re-skin of the gated `checkout-01` block into
 * a right-side Sheet (full-width on mobile). Owns all checkout state and posts
 * to the existing `/api/cafe/checkout`; pricing/coupon logic is unchanged.
 */
export function CartDrawer({
  open,
  onOpenChange,
  cart,
  onUpdateQuantity,
  onRemove,
  availableClasses,
  onOrderPlaced,
}: CartDrawerProps) {
  const [addToClass, setAddToClass] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [guestCount, setGuestCount] = useState(0);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const paymentMethod = "online" as const;

  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    },
    [],
  );

  // Reset coupon state each time the drawer opens (matches prior handleCheckout).
  useEffect(() => {
    if (open) {
      setCouponError(null);
      setCouponDiscount(null);
      setCouponCode("");
      setOrderError(null);
    }
  }, [open]);

  const getSubtotal = () =>
    cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const getFinalTotal = () => {
    const sub = getSubtotal();
    const off = couponDiscount && couponDiscount > 0 ? couponDiscount : 0;
    return Math.max(0, Math.round((sub - off) * 100) / 100);
  };

  async function validateMenuCoupon() {
    setCouponError(null);
    const subtotal = getSubtotal();
    if (subtotal <= 0) return;
    const r = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponCode, context: "food", subtotal }),
    });
    const d = r.ok
      ? await r.json()
      : { valid: false, error: "Could not validate" };
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
          class_schedule_id:
            addToClass && selectedClass ? selectedClass : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setOrderError(
          typeof body?.error === "string" ? body.error : "Order failed",
        );
        return;
      }
      setOrderSuccess(true);
      successTimeoutRef.current = setTimeout(() => {
        setOrderSuccess(false);
        setCouponCode("");
        setCouponDiscount(null);
        onOrderPlaced();
      }, 2000);
    } catch (err) {
      console.error("Error placing order:", err);
      setOrderError(
        err instanceof Error ? err.message : "Could not place order",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        direction="right"
        className="w-full gap-0 overflow-y-auto bg-cream p-0 sm:max-w-xl"
      >
        <div className="sticky top-0 z-10 border-b border-border bg-cream/95 px-6 py-5 backdrop-blur">
          <DrawerTitle className="font-display text-3xl text-charcoal">
            Your Order
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Review your café items and check out.
          </DrawerDescription>
        </div>

        <div className="flex flex-col gap-4 p-6">
          {cart.length === 0 ? (
            <div className="rounded-xl border border-border bg-white-warm p-8 text-center font-body text-charcoal/60">
              Your cart is empty.
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-white-warm p-4"
              >
                <Image
                  src={item.image_url || cdnUrl("/food/A7401864.jpg")}
                  alt={item.name}
                  width={80}
                  height={80}
                  unoptimized
                  className="size-20 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <h4 className="font-display text-lg text-charcoal">
                    {item.name}
                  </h4>
                  <p className="font-body text-sm text-terracotta">
                    ₹{item.price} each
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="sage-outline"
                    size="icon-sm"
                    className="rounded-md"
                    aria-label="Decrease quantity"
                    onClick={() => onUpdateQuantity(item.id, -1)}
                  >
                    <Minus size={16} />
                  </Button>
                  <span className="w-7 text-center font-body text-lg">
                    {item.quantity}
                  </span>
                  <Button
                    variant="sage-outline"
                    size="icon-sm"
                    className="rounded-md"
                    aria-label="Increase quantity"
                    onClick={() => onUpdateQuantity(item.id, 1)}
                  >
                    <Plus size={16} />
                  </Button>
                </div>
                <Button
                  onClick={() => onRemove(item.id)}
                  variant="terracotta-ghost"
                  size="icon-sm"
                  aria-label="Remove"
                >
                  <X size={18} />
                </Button>
              </div>
            ))
          )}

          {/* Add to class */}
          <div className={sectionBox}>
            <label className="flex items-center gap-3 font-body text-charcoal">
              <input
                type="checkbox"
                checked={addToClass}
                onChange={(e) => setAddToClass(e.target.checked)}
                className="size-5 accent-[#8f9779]"
              />
              Add to a class booking
            </label>
            {addToClass && (
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="mt-4 w-full rounded-lg border border-border bg-white-warm p-3 font-body"
              >
                <option value="">Select a class</option>
                {availableClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.class_model?.name ?? "Class"} —{" "}
                    {new Date(cls.start_time).toLocaleDateString()} at{" "}
                    {new Date(cls.start_time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Kolkata",
                    })}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Guests */}
          <div className={sectionBox}>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-body text-charcoal">
                <Users size={20} />
                Order for friends/family
              </label>
              <div className="flex items-center gap-2">
                <Button
                  variant="sage-outline"
                  size="icon-sm"
                  className="rounded-md"
                  aria-label="Decrease guests"
                  onClick={() => handleGuestCountChange(guestCount - 1)}
                >
                  <Minus size={16} />
                </Button>
                <span className="w-6 text-center font-body">{guestCount}</span>
                <Button
                  variant="sage-outline"
                  size="icon-sm"
                  className="rounded-md"
                  aria-label="Increase guests"
                  onClick={() => handleGuestCountChange(guestCount + 1)}
                >
                  <Plus size={16} />
                </Button>
              </div>
            </div>
            {guestCount > 0 && (
              <div className="mt-4 space-y-2">
                {guestNames.map((_, index) => (
                  <Input
                    key={index}
                    placeholder={`Guest ${index + 1} name`}
                    value={guestNames[index]}
                    onChange={(e) => {
                      const next = [...guestNames];
                      next[index] = e.target.value;
                      setGuestNames(next);
                    }}
                    className="font-body"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Coupon */}
          <div className={cn(sectionBox, "space-y-3")}>
            <h3 className="font-display text-lg text-charcoal">Coupon</h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Input
                placeholder="Promo code"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  setCouponDiscount(null);
                  setCouponError(null);
                }}
                className="flex-1 font-mono uppercase"
              />
              <Button
                type="button"
                variant="sage-outline"
                onClick={() => void validateMenuCoupon()}
              >
                Apply
              </Button>
            </div>
            {couponError && (
              <p className="font-body text-sm text-destructive">{couponError}</p>
            )}
          </div>

          {/* Payment method (online only) */}
          <div className={sectionBox}>
            <h3 className="mb-4 font-display text-lg text-charcoal">
              Payment Method
            </h3>
            <div className="flex items-center gap-3 rounded-xl border-2 border-sage bg-sage/5 p-4">
              <div className="flex size-5 items-center justify-center rounded-full border-2 border-sage">
                <div className="size-3 rounded-full bg-sage" />
              </div>
              <div>
                <span className="block font-body">Pay Online</span>
                <span className="font-body text-xs text-charcoal/60">
                  UPI / Cards
                </span>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-2 rounded-xl border border-sage/30 bg-sage/10 p-5">
            <div className="flex items-center justify-between font-body text-charcoal/80">
              <span>Subtotal</span>
              <span>₹{getSubtotal()}</span>
            </div>
            {couponDiscount != null && couponDiscount > 0 && (
              <div className="flex items-center justify-between font-body text-sage">
                <span>Discount</span>
                <span>−₹{couponDiscount}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-sage/20 pt-2">
              <span className="font-body text-lg text-charcoal">Total</span>
              <span className="font-display text-4xl text-charcoal">
                ₹{getFinalTotal()}
              </span>
            </div>
          </div>

          {orderError && (
            <p className="px-1 font-body text-sm text-destructive">
              {orderError}
            </p>
          )}
          <Button
            onClick={handlePlaceOrder}
            disabled={isProcessing || orderSuccess || cart.length === 0}
            variant="sage"
            className="h-14 w-full text-lg"
          >
            {isProcessing ? (
              <>
                <Spinner className="mr-2 size-4" />
                Processing…
              </>
            ) : orderSuccess ? (
              <>
                <Check className="mr-2" size={20} />
                Order Placed!
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2" size={20} />
                Place Order
              </>
            )}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default CartDrawer;
