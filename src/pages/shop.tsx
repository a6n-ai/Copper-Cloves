import { useState, useEffect, useMemo } from "react";
import type { GetStaticProps } from "next";
import prisma from "@/lib/prisma";
import type { LucideIcon } from "lucide-react";
import { SEO as Seo } from "@/components/SEO";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Pill } from "@/components/ui/pill";
import {
  ShoppingCart,
  ArrowLeft,
  ArrowRight,
  Leaf,
  Loader2,
  Sparkles,
  Coffee,
  Heart,
  Check,
  Search,
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CloseButton,
  DeleteButton,
  QtyMinusButton,
  QtyPlusButton,
} from "@/components/ui/quick-actions";
import { FilterSearch, FilterSelect } from "@/components/filters";
import type { SelectOption } from "@/components/filters";

import { cdnUrl } from "@/lib/cdnUrl";
interface RetailProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string;
  stock: number;
  featured?: boolean;
}

const PLACEHOLDER_IMAGE = cdnUrl("/boutique-candle.jpg");

/** Rupee money treatment — grouped digits, always rendered tabular-nums in JSX. */
function inr(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatCategoryLabel(raw: string) {
  return raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function categoryIcon(cat: string): LucideIcon {
  const c = cat.toLowerCase();
  if (c.includes("aroma") || c.includes("candle")) return Leaf;
  if (c.includes("mind") || c.includes("journal")) return Heart;
  if (c.includes("personal") || c.includes("care") || c.includes("skin")) return Sparkles;
  if (c.includes("wellness") || c.includes("matcha") || c.includes("food")) return Coffee;
  if (c.includes("athleisure") || c.includes("yoga") || c.includes("mat")) return Leaf;
  return Sparkles;
}

function toSortBy(value: string): "featured" | "price-low" | "price-high" {
  if (value === "price-low" || value === "price-high" || value === "featured") {
    return value;
  }
  return "featured";
}

interface ShopProps {
  initialProducts: RetailProduct[];
}

export const getStaticProps: GetStaticProps<ShopProps> = async () => {
  try {
    const rows = await prisma.retailProduct.findMany({
      where: { is_active: true },
      orderBy: [{ featured: "desc" }, { created_at: "desc" }],
    });
    const initialProducts: RetailProduct[] = rows.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      price: Number(p.price ?? 0),
      stock: p.stock,
      image_url: p.image_url,
      featured: p.featured,
    }));
    return { props: { initialProducts }, revalidate: 60 };
  } catch {
    // Fall back to empty list on build-time DB error; client never refetches,
    // so a deploy with a temporarily broken DB will serve an empty shop until
    // the next ISR window. Acceptable tradeoff for the LCP win.
    return { props: { initialProducts: [] }, revalidate: 60 };
  }
};

export default function Shop({ initialProducts }: Readonly<ShopProps>) {
  const { data: session } = useSession();
  const [products] = useState<RetailProduct[]>(initialProducts);
  // Always false — products are SSG'd via `getStaticProps`. Kept as a local
  // const so the existing loading branches in the JSX still compile.
  const catalogLoading = false;
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"featured" | "price-low" | "price-high">("featured");
  const [showCart, setShowCart] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "details" | "payment" | "success">("cart");
  const [searchQuery, setSearchQuery] = useState("");
  const cart = useCart();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState<number | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Products are served from `getStaticProps` + 60s ISR — no client fetch.

  const sessionEmail = (session?.user as { email?: string } | undefined)?.email?.trim();
  useEffect(() => {
    if (sessionEmail) {
      setCustomerEmail((prev) => (prev.trim() ? prev : sessionEmail));
    }
  }, [sessionEmail]);

  const categoryTabs = useMemo(() => {
    const uniq = [...new Set(products.map((p) => p.category))].sort((a, b) => a.localeCompare(b));
    return [
      { id: "all", name: "All Products", icon: Sparkles },
      ...uniq.map((id) => ({ id, name: formatCategoryLabel(id), icon: categoryIcon(id) })),
    ];
  }, [products]);

  // Precompute lowercased haystack per product once per `products` change —
  // was rebuilding 5 toLowerCase() strings per product on every keystroke.
  const productsIndex = useMemo(
    () =>
      products.map((p) => ({
        p,
        haystack: `${p.name} ${p.description ?? ""} ${formatCategoryLabel(p.category)} ${p.category}`.toLowerCase(),
      })),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = productsIndex
      .filter(({ p, haystack }) => {
        if (selectedCategory !== "all" && p.category !== selectedCategory) return false;
        if (q && !haystack.includes(q)) return false;
        return true;
      })
      .map(({ p }) => p);
    if (sortBy === "featured") {
      return [...filtered].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    }
    if (sortBy === "price-low") return [...filtered].sort((a, b) => a.price - b.price);
    if (sortBy === "price-high") return [...filtered].sort((a, b) => b.price - a.price);
    return filtered;
  }, [productsIndex, selectedCategory, searchQuery, sortBy]);

  const deliveryFee = 50;
  const shopOrderTotal =
    Math.max(0, Math.round((cart.subtotal - (couponDiscount ?? 0) + deliveryFee) * 100) / 100);

  async function validateShopCoupon() {
    setCouponError(null);
    const email =
      customerEmail.trim() ||
      (session?.user as { email?: string } | undefined)?.email?.trim() ||
      "";
    const r = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: couponCode,
        context: "ecommerce",
        subtotal: cart.subtotal,
        email: email || undefined,
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

  async function completeRetailOrder() {
    setCheckoutError(null);
    if (!customerName.trim() || !customerEmail.trim() || !shippingAddress.trim()) {
      setCheckoutError("Please complete delivery details.");
      return;
    }
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/retail/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.items.map((i) => ({ productId: i.id, quantity: i.quantity })),
          customer_name: customerName,
          customer_email: customerEmail,
          shipping_address: [shippingAddress, customerPhone ? `Phone: ${customerPhone}` : ""]
            .filter(Boolean)
            .join("\n"),
          payment_method: "online",
          coupon_code: couponCode.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCheckoutError(typeof body?.error === "string" ? body.error : "Order failed");
        return;
      }
      setCheckoutStep("success");
      setTimeout(() => {
        cart.clearCart();
        setShowCart(false);
        setCheckoutStep("cart");
        setCustomerName("");
        setCustomerEmail("");
        setCustomerPhone("");
        setShippingAddress("");
        setCouponCode("");
        setCouponDiscount(null);
        setCouponError(null);
      }, 3000);
    } catch {
      setCheckoutError("Could not place order");
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <>
      <Seo
        title="Shop | The Studio by Copper + Cloves"
        description="Curated wellness products for your home sanctuary. Aromatherapy, mindfulness tools, personal care, and more."
      />
      
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-16 px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-cream via-white-warm to-sage/5 -z-10" />

        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sage/10 border border-sage/20 mb-6">
            <ShoppingCart className="text-sage" size={16} />
            <span className="font-body text-xs text-charcoal font-medium tracking-wide uppercase">The Boutique</span>
          </div>
          
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-charcoal mb-6">
            Curated Rituals for Your Home
          </h1>
          
          <p className="font-body text-lg md:text-xl text-charcoal/70 max-w-3xl mx-auto leading-relaxed">
            From local artisans and unique wellness brands you won't find elsewhere. Each product is chosen to extend your sanctuary experience beyond the studio.
          </p>
        </div>
      </section>

      {/* Filters & Cart Button */}
      <section className="sticky top-0 z-40 bg-white-warm border-b border-sage/10 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
          {/* Search Bar */}
          <div className="mb-4 max-w-md">
            <FilterSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search products by name or category..."
              aria-label="Search products"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            {/* Category Filter */}
            {(() => {
              const categoryOptions: SelectOption[] = categoryTabs.map((cat) => ({
                value: cat.id,
                label: cat.name,
              }));
              return (
                <FilterSelect
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                  options={categoryOptions}
                  ariaLabel="Filter by category"
                  placeholder="All Products"
                />
              );
            })()}

            {/* Sort & Cart */}
            <div className="flex shrink-0 items-center gap-3">
              {(() => {
                const sortOptions: SelectOption[] = [
                  { value: "featured", label: "Featured" },
                  { value: "price-low", label: "Price: Low to High" },
                  { value: "price-high", label: "Price: High to Low" },
                ];
                return (
                  <FilterSelect
                    value={sortBy}
                    onChange={(v) => setSortBy(toSortBy(v))}
                    options={sortOptions}
                    placeholder="Sort"
                    ariaLabel="Sort products"
                  />
                );
              })()}

              <Button
                type="button"
                variant="sage"
                onClick={() => setShowCart(true)}
                className="relative px-6"
              >
                <ShoppingCart />
                Cart
                {cart.itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-terracotta text-xs font-semibold tabular-nums text-cream">
                    {cart.itemCount}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Product Grid */}
      <section className="py-16 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {catalogLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden" aria-hidden="true">
                  <div className="h-80 bg-sand motion-safe:animate-pulse" />
                  <CardContent className="space-y-3 p-6 pt-6">
                    <div className="h-3 w-20 rounded bg-sand motion-safe:animate-pulse" />
                    <div className="h-6 w-3/4 rounded bg-sand motion-safe:animate-pulse" />
                    <div className="h-4 w-full rounded bg-sand motion-safe:animate-pulse" />
                    <div className="h-8 w-24 rounded bg-sand motion-safe:animate-pulse" />
                  </CardContent>
                </Card>
              ))
            ) : (
            filteredProducts.map((product) => (
              <Link key={product.id} href={`/shop/${product.id}`}>
                <div className="group relative bg-white-warm rounded-3xl border border-sage/10 overflow-hidden transition-all duration-500 hover:border-sage/30 hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)] hover:bg-sage/5 cursor-pointer">
                  {/* Image */}
                  <div className="relative h-80 overflow-hidden">
                    <div className="absolute inset-0 bg-linear-to-br from-sage/20 via-cream/50 to-terracotta/20" />
                    <Image
                      src={product.image_url || PLACEHOLDER_IMAGE}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    
                    {/* Badges */}
                    <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                      {product.featured && (
                        <Pill tone="success" appearance="solid">Featured</Pill>
                      )}
                      {product.stock <= 0 && (
                        <Pill tone="danger" className="bg-white-warm">Out of Stock</Pill>
                      )}
                    </div>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-linear-to-t from-charcoal/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    {/* View Details Hint */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                      <span className="px-4 py-2 rounded-full bg-white-warm text-charcoal font-body text-sm">
                        View Details
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="mb-3">
                      <span className="font-body text-xs text-sage uppercase tracking-wide">
                        {formatCategoryLabel(product.category)}
                      </span>
                    </div>
                    
                    <h3 className="font-display text-2xl text-charcoal mb-3 group-hover:text-sage transition-colors duration-300">
                      {product.name}
                    </h3>
                    
                    <p className="font-body text-sm text-charcoal/70 leading-relaxed mb-6 line-clamp-2">
                      {product.description ?? "Studio retail."}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="font-body text-3xl text-charcoal tabular-nums">
                        ₹{product.price.toLocaleString("en-IN")}
                      </span>
                      
                      <div className="inline-flex items-center gap-2 text-sage font-body text-sm group-hover:gap-3 transition-all">
                        View
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))
            )}
          </div>

          {/* No Results */}
          {!catalogLoading && filteredProducts.length === 0 && (
            <EmptyState
              className="py-20"
              icon={Search}
              title="No products found"
              description="Try adjusting your search or filters to see more of the boutique."
              action={
                <Button
                  type="button"
                  variant="sage"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )}
        </div>
      </section>

      {/* Shopping Cart Sidebar */}
      <Drawer
        direction="right"
        open={showCart}
        onOpenChange={(o) => { if (!o) setShowCart(false); }}
      >
        <DrawerContent direction="right" className="w-full max-w-md overflow-y-auto">
            <DrawerTitle className="sr-only">Your Cart</DrawerTitle>
            <DrawerDescription className="sr-only">
              Shopping cart and checkout
            </DrawerDescription>
            {checkoutStep === "cart" && (
              <>
                {/* Header */}
                <div className="sticky top-0 z-10 border-b border-border bg-white-warm p-6">
                  <div className="mb-1 flex items-center justify-between">
                    <h2 className="font-body text-xl font-semibold text-charcoal">Your Cart</h2>
                    <CloseButton onClick={() => setShowCart(false)} />
                  </div>
                  <p className="font-body text-sm tabular-nums text-muted-foreground">
                    {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"}
                  </p>
                </div>

                {/* Cart Items */}
                <div className="space-y-3 p-6">
                  {cart.items.length === 0 ? (
                    <EmptyState
                      icon={ShoppingCart}
                      title="Your cart is empty"
                      description="Browse the boutique and add a few rituals to get started."
                      action={
                        <Button variant="sage" onClick={() => setShowCart(false)}>
                          Browse products
                        </Button>
                      }
                    />
                  ) : (
                    cart.items.map((item) => (
                      <Card key={item.id} className="flex gap-4 p-4">
                        {item.image ? (
                          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg">
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          </div>
                        ) : (
                          <div className="size-20 shrink-0 rounded-lg bg-sand" />
                        )}

                        <div className="min-w-0 flex-1">
                          <h3 className="mb-1 truncate font-body font-medium text-charcoal">
                            {item.name}
                          </h3>
                          <p className="mb-3 font-body text-sm tabular-nums text-muted-foreground">
                            {inr(item.price)}
                          </p>

                          <div className="flex items-center gap-3">
                            <QtyMinusButton
                              onClick={() => cart.updateQuantity(item.id, item.quantity - 1)}
                            />
                            <span className="w-8 text-center font-body text-sm tabular-nums text-charcoal">
                              {item.quantity}
                            </span>
                            <QtyPlusButton
                              onClick={() => cart.updateQuantity(item.id, item.quantity + 1)}
                            />
                            <DeleteButton
                              skipConfirm
                              onClick={() => cart.removeItem(item.id)}
                              label="Remove item"
                              className="ml-auto"
                            />
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>

                {/* Footer */}
                {cart.items.length > 0 && (
                  <div className="sticky bottom-0 border-t border-border bg-white-warm p-6">
                    <div className="mb-6 flex items-center justify-between">
                      <span className="font-body text-base font-medium text-charcoal">Subtotal</span>
                      <span className="font-body text-2xl font-semibold tabular-nums text-sage">
                        {inr(cart.subtotal)}
                      </span>
                    </div>

                    <Button
                      variant="sage"
                      size="lg"
                      onClick={() => setCheckoutStep("details")}
                      className="w-full"
                    >
                      Proceed to Checkout
                      <ArrowRight />
                    </Button>
                  </div>
                )}
              </>
            )}

            {checkoutStep === "details" && (
              <div className="p-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCheckoutStep("cart")}
                  className="-ml-2 mb-6 text-muted-foreground hover:text-sage"
                >
                  <ArrowLeft />
                  Back to Cart
                </Button>

                <h2 className="mb-6 font-body text-xl font-semibold text-charcoal">Delivery Details</h2>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="shop-customer-name">Full Name</Label>
                    <Input
                      id="shop-customer-name"
                      type="text"
                      placeholder="Enter your name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shop-customer-email">Email</Label>
                    <Input
                      id="shop-customer-email"
                      type="email"
                      placeholder="your@email.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shop-customer-phone">Phone</Label>
                    <Input
                      id="shop-customer-phone"
                      type="tel"
                      placeholder="Phone number"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shop-shipping-address">Address</Label>
                    <Textarea
                      id="shop-shipping-address"
                      className="resize-none"
                      rows={3}
                      placeholder="Delivery address"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  variant="sage"
                  size="lg"
                  onClick={() => setCheckoutStep("payment")}
                  className="mt-6 w-full"
                >
                  Continue to Payment
                  <ArrowRight />
                </Button>
              </div>
            )}

            {checkoutStep === "payment" && (
              <div className="space-y-4 p-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCheckoutStep("details")}
                  className="-ml-2 text-muted-foreground hover:text-sage"
                >
                  <ArrowLeft />
                  Back
                </Button>

                <h2 className="font-body text-xl font-semibold text-charcoal">Payment</h2>

                {/* Payment method */}
                <div className="space-y-3">
                  <Card className="border-sage bg-sage/5">
                    <CardContent className="flex items-center gap-3 p-4">
                      <span className="flex size-5 items-center justify-center rounded-full border-2 border-sage bg-sage">
                        <span className="size-2 rounded-full bg-white-warm" />
                      </span>
                      <span className="font-body text-sm font-medium text-charcoal">
                        Pay Online (UPI / Cards)
                      </span>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                      <span className="size-5 rounded-full border-2 border-input" />
                      <span className="font-body text-sm text-muted-foreground">Cash on Delivery</span>
                      <Pill tone="neutral" className="ml-auto">Coming soon</Pill>
                    </CardContent>
                  </Card>
                </div>

                {/* Promo code */}
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <Label htmlFor="shop-promo-code">Promo code</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id="shop-promo-code"
                        className="font-mono uppercase"
                        placeholder="Code"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase());
                          setCouponDiscount(null);
                          setCouponError(null);
                        }}
                      />
                      <Button
                        type="button"
                        variant="sage-outline"
                        className="shrink-0"
                        onClick={() => void validateShopCoupon()}
                      >
                        Apply
                      </Button>
                    </div>
                    {couponError && (
                      <p className="font-body text-sm text-destructive">{couponError}</p>
                    )}
                    {couponDiscount !== null && couponDiscount !== undefined && couponDiscount > 0 && (
                      <p className="font-body text-sm text-sage">
                        Coupon applied — you save {inr(couponDiscount)}.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Order summary */}
                <Card>
                  <CardContent className="p-4">
                    <div className="mb-2 flex justify-between font-body text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="tabular-nums text-charcoal">{inr(cart.subtotal)}</span>
                    </div>
                    {couponDiscount !== null && couponDiscount !== undefined && couponDiscount > 0 && (
                      <div className="mb-2 flex justify-between font-body text-sm text-sage">
                        <span>Discount</span>
                        <span className="tabular-nums">−{inr(couponDiscount)}</span>
                      </div>
                    )}
                    <div className="mb-2 flex justify-between font-body text-sm">
                      <span className="text-muted-foreground">Delivery</span>
                      <span className="tabular-nums text-charcoal">{inr(deliveryFee)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="font-body text-base font-semibold text-charcoal">Total</span>
                      <span className="font-body text-2xl font-semibold tabular-nums text-sage">
                        {inr(shopOrderTotal)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {checkoutError && (
                  <p className="font-body text-sm text-destructive">{checkoutError}</p>
                )}

                <Button
                  variant="sage"
                  size="lg"
                  onClick={() => void completeRetailOrder()}
                  disabled={checkoutLoading}
                  className="w-full"
                >
                  {checkoutLoading ? (
                    <>
                      <Loader2 className="motion-safe:animate-spin" />
                      Processing…
                    </>
                  ) : (
                    <>
                      Complete Order
                      <Check />
                    </>
                  )}
                </Button>
              </div>
            )}

            {checkoutStep === "success" && (
              <div className="flex h-full flex-col items-center justify-center p-6">
                <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-sage/10">
                  <Check className="text-sage" size={40} />
                </div>
                <h2 className="mb-3 text-center font-body text-xl font-semibold text-charcoal">
                  Order Placed!
                </h2>
                <p className="mb-6 text-center font-body text-muted-foreground">
                  Thank you for your purchase. We'll send you a confirmation email shortly.
                </p>
                <Link href="/">
                  <Button variant="sage" className="px-8">
                    Back to Home
                  </Button>
                </Link>
              </div>
            )}
        </DrawerContent>
      </Drawer>

      <Footer />
      
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
}