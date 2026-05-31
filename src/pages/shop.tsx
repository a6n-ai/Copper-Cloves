import { useState, useEffect, useMemo } from "react";
import type { GetStaticProps } from "next";
import prisma from "@/lib/prisma";
import type { LucideIcon } from "lucide-react";
import { SEO } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  X,
  Plus,
  Minus,
  ArrowRight,
  Leaf,
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
import { CloseButton, QtyMinusButton, QtyPlusButton } from "@/components/ui/quick-actions";

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

export default function Shop({ initialProducts }: ShopProps) {
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
    const uniq = [...new Set(products.map((p) => p.category))].sort();
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
      <SEO 
        title="Shop | The Studio by Copper + Cloves"
        description="Curated wellness products for your home sanctuary. Aromatherapy, mindfulness tools, personal care, and more."
      />
      
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-16 px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-cream via-[#fafaf8] to-sage/5 -z-10" />

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
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/40" size={20} />
              <input
                type="text"
                placeholder="Search products by name or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-full bg-white-warm border border-sage/10 font-body text-sm text-charcoal placeholder:text-charcoal/40 focus:outline-hidden focus:ring-2 focus:ring-sage/30 focus:border-sage transition-all"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-charcoal/40"
                >
                  <X size={16} />
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            {/* Category Filter */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {categoryTabs.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full font-body text-sm whitespace-nowrap transition-all duration-300 ${
                      selectedCategory === cat.id
                        ? "bg-sage text-white shadow-lg"
                        : "bg-white-warm text-charcoal/70 hover:bg-sage/10 border border-sage/10"
                    }`}
                  >
                    <Icon size={16} />
                    {cat.name}
                  </button>
                );
              })}
            </div>

            {/* Sort & Cart */}
            <div className="flex items-center gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(toSortBy(e.target.value))}
                className="px-4 py-2 rounded-full bg-white-warm border border-sage/10 font-body text-sm text-charcoal focus:outline-hidden focus:ring-2 focus:ring-sage/30"
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>

              <Button
                type="button"
                variant="sage"
                onClick={() => setShowCart(true)}
                className="relative rounded-full px-6"
              >
                <ShoppingCart size={18} />
                Cart
                {cart.itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-terracotta text-white text-xs font-bold rounded-full flex items-center justify-center">
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
              <p className="font-body text-charcoal/60 py-16 md:col-span-2 lg:col-span-3 text-center">
                Loading catalogue…
              </p>
            ) : (
            filteredProducts.map((product) => (
              <Link key={product.id} href={`/shop/${product.id}`}>
                <div className="group relative bg-white-warm rounded-3xl border border-sage/10 overflow-hidden transition-all duration-500 hover:border-sage/30 hover:shadow-2xl hover:bg-sage/5 cursor-pointer">
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
                        <Badge className="bg-sage text-white">Featured</Badge>
                      )}
                      {product.stock <= 0 && (
                        <Badge variant="outline" className="bg-white-warm">Out of Stock</Badge>
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
                      <span className="font-display text-3xl text-charcoal">
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
            <div className="text-center py-20">
              <Search className="mx-auto mb-4 text-charcoal/20" size={64} />
              <h3 className="font-display text-2xl text-charcoal mb-2">No products found</h3>
              <p className="font-body text-charcoal/60 mb-6">
                Try adjusting your search or filters
              </p>
              <Button
                type="button"
                variant="sage"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="rounded-full px-6"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Shopping Cart Sidebar */}
      <Drawer
        direction="right"
        open={showCart}
        onOpenChange={(o) => { if (!o) setShowCart(false); }}
      >
        <DrawerContent direction="right" className="max-w-md overflow-y-auto">
            <DrawerTitle className="sr-only">Your Cart</DrawerTitle>
            <DrawerDescription className="sr-only">
              Shopping cart and checkout
            </DrawerDescription>
            {checkoutStep === "cart" && (
              <>
                {/* Header */}
                <div className="sticky top-0 bg-white-warm border-b border-sage/10 p-6 z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-display text-3xl text-charcoal">Your Cart</h2>
                    <CloseButton onClick={() => setShowCart(false)} />
                  </div>
                  <p className="font-body text-sm text-charcoal/60">
                    {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"}
                  </p>
                </div>

                {/* Cart Items */}
                <div className="p-6 space-y-4">
                  {cart.items.length === 0 ? (
                    <div className="text-center py-12">
                      <ShoppingCart className="mx-auto mb-4 text-charcoal/20" size={48} />
                      <p className="font-body text-charcoal/60">Your cart is empty</p>
                    </div>
                  ) : (
                    <>
                      {cart.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex gap-4 p-4 rounded-2xl bg-cream/30 border border-sage/10"
                        >
                          <div className="w-20 h-20 rounded-xl bg-linear-to-br from-sage/20 via-cream/50 to-terracotta/20 shrink-0" />
                          
                          <div className="flex-1">
                            <h4 className="font-display text-lg text-charcoal mb-1">
                              {item.name}
                            </h4>
                            <p className="font-body text-sm text-charcoal/60 mb-3">
                              ₹{item.price}
                            </p>
                            
                            <div className="flex items-center gap-3">
                              <QtyMinusButton
                                onClick={() => cart.updateQuantity(item.id, item.quantity - 1)}
                                className="rounded-full bg-white-warm border border-sage/20 text-charcoal"
                              />
                              <span className="font-body text-sm text-charcoal w-8 text-center">
                                {item.quantity}
                              </span>
                              <QtyPlusButton
                                onClick={() => cart.updateQuantity(item.id, item.quantity + 1)}
                                className="rounded-full bg-white-warm border border-sage/20 text-charcoal"
                              />

                              <Button
                                type="button"
                                variant="terracotta-ghost"
                                size="icon-sm"
                                onClick={() => cart.removeItem(item.id)}
                                className="ml-auto"
                              >
                                <X size={18} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Footer */}
                {cart.items.length > 0 && (
                  <div className="sticky bottom-0 bg-white-warm border-t border-sage/10 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <span className="font-display text-xl text-charcoal">Subtotal</span>
                      <span className="font-display text-3xl text-sage">₹{cart.subtotal}</span>
                    </div>
                    
                    <Button
                      variant="sage"
                      size="lg"
                      onClick={() => setCheckoutStep("details")}
                      className="w-full rounded-full"
                    >
                      Proceed to Checkout
                      <ArrowRight className="ml-2" size={18} />
                    </Button>
                  </div>
                )}
              </>
            )}

            {checkoutStep === "details" && (
              <div className="p-6">
                <button
                  onClick={() => setCheckoutStep("cart")}
                  className="flex items-center gap-2 text-charcoal/60 hover:text-sage transition-colors mb-6"
                >
                  ← Back to Cart
                </button>
                
                <h2 className="font-display text-3xl text-charcoal mb-6">Delivery Details</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="font-body text-sm text-charcoal/70 mb-2 block">Full Name</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-sage/20 focus:border-sage focus:outline-hidden font-body"
                      placeholder="Enter your name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="font-body text-sm text-charcoal/70 mb-2 block">Email</label>
                    <input
                      type="email"
                      className="w-full px-4 py-3 rounded-xl border border-sage/20 focus:border-sage focus:outline-hidden font-body"
                      placeholder="your@email.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="font-body text-sm text-charcoal/70 mb-2 block">Phone</label>
                    <input
                      type="tel"
                      className="w-full px-4 py-3 rounded-xl border border-sage/20 focus:border-sage focus:outline-hidden font-body"
                      placeholder="Phone number"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="font-body text-sm text-charcoal/70 mb-2 block">Address</label>
                    <textarea
                      className="w-full px-4 py-3 rounded-xl border border-sage/20 focus:border-sage focus:outline-hidden font-body resize-none"
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
                  className="w-full mt-6 rounded-full"
                >
                  Continue to Payment
                  <ArrowRight className="ml-2" size={18} />
                </Button>
              </div>
            )}

            {checkoutStep === "payment" && (
              <div className="p-6">
                <button
                  onClick={() => setCheckoutStep("details")}
                  className="flex items-center gap-2 text-charcoal/60 hover:text-sage transition-colors mb-6"
                >
                  ← Back
                </button>
                
                <h2 className="font-display text-3xl text-charcoal mb-6">Payment</h2>
                
                <div className="space-y-4 mb-6">
                  <div className="p-4 rounded-xl border-2 border-sage bg-sage/5">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border-2 border-sage bg-sage flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white-warm" />
                      </div>
                      <span className="font-body text-charcoal">Pay Online (UPI/Cards)</span>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-xl border border-sage/20">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border-2 border-charcoal/20" />
                      <span className="font-body text-charcoal/60">Cash on Delivery</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 rounded-xl bg-cream/50 mb-4 space-y-3">
                  <label className="font-body text-sm text-charcoal/70 block">Promo code</label>
                  <div className="flex gap-2 flex-col sm:flex-row">
                    <Input
                      className="font-mono uppercase border-sage/20"
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
                      variant="outline"
                      className="border-sage/30 shrink-0"
                      onClick={() => void validateShopCoupon()}
                    >
                      Apply
                    </Button>
                  </div>
                  {couponError && (
                    <p className="text-sm text-red-600 font-body">{couponError}</p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-cream/50 mb-6">
                  <div className="flex justify-between font-body text-sm mb-2">
                    <span className="text-charcoal/70">Subtotal</span>
                    <span className="text-charcoal">₹{cart.subtotal}</span>
                  </div>
                  {couponDiscount != null && couponDiscount > 0 && (
                    <div className="flex justify-between font-body text-sm mb-2 text-sage">
                      <span>Discount</span>
                      <span>−₹{couponDiscount}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-body text-sm mb-2">
                    <span className="text-charcoal/70">Delivery</span>
                    <span className="text-charcoal">₹{deliveryFee}</span>
                  </div>
                  <div className="pt-2 border-t border-sage/20 flex justify-between">
                    <span className="font-display text-lg text-charcoal">Total</span>
                    <span className="font-display text-2xl text-sage">₹{shopOrderTotal}</span>
                  </div>
                </div>

                {checkoutError && (
                  <p className="text-sm text-red-600 font-body mb-4">{checkoutError}</p>
                )}

                <Button
                  variant="sage"
                  size="lg"
                  onClick={() => void completeRetailOrder()}
                  disabled={checkoutLoading}
                  className="w-full rounded-full"
                >
                  {checkoutLoading ? "Processing…" : "Complete Order"}
                  <Check className="ml-2" size={18} />
                </Button>
              </div>
            )}

            {checkoutStep === "success" && (
              <div className="p-6 flex flex-col items-center justify-center h-full">
                <div className="w-20 h-20 rounded-full bg-sage/10 flex items-center justify-center mb-6">
                  <Check className="text-sage" size={40} />
                </div>
                <h2 className="font-display text-3xl text-charcoal mb-3 text-center">
                  Order Placed!
                </h2>
                <p className="font-body text-charcoal/70 text-center mb-6">
                  Thank you for your purchase. We'll send you a confirmation email shortly.
                </p>
                <Link href="/">
                  <Button variant="sage" className="rounded-full px-8">
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