import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { SEO } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ShoppingCart,
  Heart,
  Share2,
  Check,
  Minus,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { cdnUrl } from "@/lib/cdnUrl";
type RetailProduct = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  featured: boolean;
};

const PLACEHOLDER = cdnUrl("/boutique-candle.jpg");

function formatCategoryLabel(raw: string) {
  return raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default function ProductDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { addItem } = useCart();
  const { toast } = useToast();

  const [catalog, setCatalog] = useState<RetailProduct[]>([]);
  const [product, setProduct] = useState<RetailProduct | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");

  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);

  useEffect(() => {
    if (!router.isReady || typeof id !== "string") return undefined;

    const productId = id;
    let cancelled = false;

    async function load() {
      setStatus("loading");
      try {
        const [oneRes, allRes] = await Promise.all([
          fetch(`/api/retail-products?id=${encodeURIComponent(productId)}`),
          fetch("/api/retail-products"),
        ]);

        if (cancelled) return;

        if (!oneRes.ok) {
          setProduct(null);
          setStatus("notfound");
          return;
        }

        const p = (await oneRes.json()) as RetailProduct;
        const rawAll = allRes.ok ? await allRes.json() : [];
        const all = Array.isArray(rawAll) ? (rawAll as RetailProduct[]) : [];

        if (cancelled) return;
        setProduct(p);
        setCatalog(all);
        setQuantity(1);
        setCurrentImageIndex(0);
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setProduct(null);
          setStatus("notfound");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, id]);

  const images = useMemo(() => [product?.image_url || PLACEHOLDER], [product?.image_url]);

  const relatedProducts = useMemo(() => {
    if (!product || catalog.length === 0) return [];
    return catalog
      .filter((r) => r.id !== product.id)
      .sort((a, b) => {
        const as = a.category === product.category ? 0 : 1;
        const bs = b.category === product.category ? 0 : 1;
        if (as !== bs) return as - bs;
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      })
      .slice(0, 4);
  }, [catalog, product]);

  const seoDescription =
    product?.description?.slice(0, 160)?.replace(/\s+/g, " ").trim() || "Copper + Cloves boutique retail.";

  if (!router.isReady || typeof id !== "string") {
    return null;
  }

  if (status === "loading") {
    return (
      <>
        <SEO title="Loading… | The Boutique" />
        <Navigation />
        <div className="min-h-screen bg-cream flex items-center justify-center pt-24">
          <p className="font-body text-charcoal/60">Loading product…</p>
        </div>
        <Footer />
      </>
    );
  }

  if (status === "notfound" || !product) {
    return (
      <>
        <SEO title="Product Not Found | The Boutique" />
        <Navigation />
        <div className="min-h-screen flex items-center justify-center bg-cream">
          <div className="text-center px-4">
            <h1 className="font-display text-4xl text-charcoal mb-4">Product Not Found</h1>
            <p className="font-body text-charcoal/70 mb-6 max-w-md">
              This item may no longer be available. Browse the boutique for current products.
            </p>
            <Link href="/shop">
              <Button variant="outline" className="mt-4">
                <ArrowLeft size={16} className="mr-2" />
                Back to Shop
              </Button>
            </Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const inStock = product.stock > 0;
  const thumbSrc = images[0];

  const handleAddToCart = () => {
    if (!inStock) return;
    const qty = Math.min(quantity, product.stock);
    for (let i = 0; i < qty; i++) {
      addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        image: thumbSrc,
        category: product.category,
      });
    }
    toast({
      title: "Added to cart!",
      description: `${qty} × ${product.name}`,
    });
  };

  const handleShare = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/shop/${product.id}`
        : `/shop/${product.id}`;
    try {
      await navigator.clipboard?.writeText(url);
      toast({ title: "Link copied", description: "Paste to share this product." });
    } catch {
      toast({
        title: "Share URL",
        description: url,
      });
    }
  };

  return (
    <>
      <SEO
        title={`${product.name} - The Boutique`}
        description={seoDescription}
        image={thumbSrc}
      />

      <Navigation />

      <main className="min-h-screen bg-linear-to-br from-cream via-white to-sage/5 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/shop">
            <button
              type="button"
              className="group inline-flex items-center gap-2 font-body text-sm text-charcoal/70 hover:text-sage mb-8 transition-colors"
            >
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
              Back to Shop
            </button>
          </Link>

          <div className="grid lg:grid-cols-2 gap-12 mb-20">
            <div className="space-y-4">
              <div className="relative aspect-square rounded-3xl overflow-hidden bg-white/60 backdrop-blur-xl border border-sage/10 shadow-2xl group">
                <div className="absolute inset-0 bg-linear-to-br from-sage/20 via-transparent to-terracotta/20 pointer-events-none z-1" />
                <Image
                  src={images[currentImageIndex]}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
                      }
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/80 backdrop-blur-xs flex items-center justify-center hover:bg-white transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="text-charcoal" size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentImageIndex((prev) => (prev + 1) % images.length)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/80 backdrop-blur-xs flex items-center justify-center hover:bg-white transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                      aria-label="Next image"
                    >
                      <ChevronRight className="text-charcoal" size={20} />
                    </button>
                  </>
                )}

                {product.featured && (
                  <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-terracotta/90 backdrop-blur-xs text-white text-xs font-body font-medium">
                    Featured
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sage/10 border border-sage/20">
                <span className="text-sage text-xs font-body font-medium uppercase tracking-wide">
                  {formatCategoryLabel(product.category)}
                </span>
              </div>

              <div>
                <h1 className="font-display text-4xl md:text-5xl text-charcoal mb-3">{product.name}</h1>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="font-display text-4xl text-sage">
                  ₹{product.price.toLocaleString("en-IN")}
                </span>
                <span className="font-body text-sm text-charcoal/60">incl. taxes</span>
              </div>

              <p className="font-body text-lg text-charcoal/80 leading-relaxed">
                {product.description || "Premium studio retail curated by Copper + Cloves."}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-4">
                <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/60 backdrop-blur-xl border border-sage/10">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 rounded-full bg-sage/10 hover:bg-sage/20 flex items-center justify-center transition-colors"
                  >
                    <Minus size={16} className="text-sage" />
                  </button>
                  <span className="font-body text-lg text-charcoal w-8 text-center">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(inStock ? Math.min(product.stock, quantity + 1) : quantity)}
                    className="w-8 h-8 rounded-full bg-sage/10 hover:bg-sage/20 flex items-center justify-center transition-colors disabled:opacity-40"
                    disabled={!inStock || quantity >= product.stock}
                  >
                    <Plus size={16} className="text-sage" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!inStock}
                  className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-sage hover:bg-sage/90 text-white font-body transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <ShoppingCart size={20} />
                  Add to Cart
                </button>

                <button
                  type="button"
                  onClick={() => setIsWishlisted(!isWishlisted)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    isWishlisted
                      ? "bg-terracotta text-white"
                      : "bg-white/60 backdrop-blur-xl border border-sage/10 text-charcoal/60 hover:text-terracotta"
                  }`}
                  aria-label="Wishlist"
                >
                  <Heart size={20} className={isWishlisted ? "fill-current" : ""} />
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="w-14 h-14 rounded-full bg-white/60 backdrop-blur-xl border border-sage/10 flex items-center justify-center text-charcoal/60 hover:text-sage transition-colors"
                  aria-label="Copy link"
                >
                  <Share2 size={20} />
                </button>
              </div>

              <div className="flex items-center gap-2 pt-2">
                {inStock ? (
                  <>
                    <Check className="text-sage" size={18} />
                    <span className="font-body text-sm text-charcoal/70">
                      In stock ({product.stock} available) — ships within 2–3 days
                    </span>
                  </>
                ) : (
                  <span className="font-body text-sm text-terracotta">Out of stock — check back soon.</span>
                )}
              </div>
            </div>
          </div>

          <div className="pt-16 border-t border-sage/10">
            <h2 className="font-display text-2xl md:text-3xl text-charcoal mb-3">Reviews</h2>
            <p className="font-body text-charcoal/65 max-w-2xl">
              Product ratings and verified reviews aren&apos;t shown on this page yet — we appreciate your patience
              as we expand the storefront.
            </p>
          </div>

          {relatedProducts.length > 0 && (
            <div className="pt-16 border-t border-sage/10">
              <h2 className="font-display text-3xl md:text-4xl text-charcoal mb-8 text-center">
                You Might Also Like
              </h2>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {relatedProducts.map((rp) => (
                  <Link key={rp.id} href={`/shop/${rp.id}`}>
                    <div className="group relative rounded-2xl overflow-hidden bg-white/60 backdrop-blur-xl border border-sage/10 hover:border-sage/30 transition-all duration-300 hover:shadow-xl hover:scale-105 cursor-pointer">
                      <div className="relative aspect-square overflow-hidden">
                        <div className="absolute inset-0 bg-linear-to-br from-sage/20 via-transparent to-terracotta/20" />
                        <Image
                          src={rp.image_url || PLACEHOLDER}
                          alt={rp.name}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-110"
                          sizes="(max-width: 640px) 100vw, 25vw"
                        />
                        {rp.featured && (
                          <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-terracotta/90 backdrop-blur-xs text-white text-xs font-body">
                            Featured
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <p className="font-body text-xs text-sage uppercase tracking-wide mb-1">
                          {formatCategoryLabel(rp.category)}
                        </p>
                        <h3 className="font-display text-lg text-charcoal mb-2 group-hover:text-sage transition-colors">
                          {rp.name}
                        </h3>
                        <p className="font-display text-xl text-sage">
                          ₹{rp.price.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
