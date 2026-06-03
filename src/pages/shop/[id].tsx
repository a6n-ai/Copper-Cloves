import { useState, useMemo } from "react";
import type { GetStaticPaths, GetStaticProps } from "next";
import prisma from "@/lib/prisma";
import { useRouter } from "next/router";
import { SEO } from "@/components/SEO";
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
} from "lucide-react";
import {
  NavPrevButton,
  NavNextButton,
  QtyMinusButton,
  QtyPlusButton,
} from "@/components/ui/quick-actions";
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

interface ProductDetailProps {
  product: RetailProduct | null;
  catalog: RetailProduct[];
}

function mapProduct(p: {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: unknown;
  stock: number;
  image_url: string | null;
  featured: boolean;
}): RetailProduct {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    price: Number(p.price ?? 0),
    stock: p.stock,
    image_url: p.image_url,
    featured: p.featured,
  };
}

export const getStaticPaths: GetStaticPaths = async () => {
  try {
    // Pre-render the most-trafficked products (featured first); everything
    // else is generated on first visit via `fallback: "blocking"`.
    const featured = await prisma.retailProduct.findMany({
      where: { is_active: true, featured: true },
      select: { id: true },
      take: 20,
    });
    return {
      paths: featured.map((p) => ({ params: { id: p.id } })),
      fallback: "blocking",
    };
  } catch {
    return { paths: [], fallback: "blocking" };
  }
};

export const getStaticProps: GetStaticProps<ProductDetailProps> = async ({ params }) => {
  const id = typeof params?.id === "string" ? params.id : "";
  if (!id) return { notFound: true, revalidate: 60 };
  try {
    const [p, all] = await Promise.all([
      prisma.retailProduct.findFirst({ where: { id, is_active: true } }),
      prisma.retailProduct.findMany({
        where: { is_active: true },
        orderBy: [{ featured: "desc" }, { created_at: "desc" }],
      }),
    ]);
    if (!p) return { notFound: true, revalidate: 60 };
    return {
      props: {
        product: mapProduct(p),
        catalog: all.map(mapProduct),
      },
      revalidate: 60,
    };
  } catch {
    return { notFound: true, revalidate: 60 };
  }
};

export default function ProductDetail({ product, catalog }: ProductDetailProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const { toast } = useToast();

  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);

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

  // `fallback: "blocking"` means Next renders this route on the server before
  // sending HTML — `router.isFallback` only flips when the slot is still being
  // generated for the very first time.
  if (router.isFallback) {
    return (
      <>
        <SEO title="Loading… | The Boutique" />
        <div className="min-h-screen bg-cream flex items-center justify-center pt-24">
          <p className="font-body text-charcoal/60">Loading product…</p>
        </div>
        <Footer />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <SEO title="Product Not Found | The Boutique" />
        <div className="min-h-screen flex items-center justify-center bg-cream">
          <div className="text-center px-4">
            <h1 className="font-display text-4xl text-charcoal mb-4">Product Not Found</h1>
            <p className="font-body text-charcoal/70 mb-6 max-w-md">
              This item may no longer be available. Browse the boutique for current products.
            </p>
            <Link href="/shop">
              <Button variant="sage-outline" className="mt-4">
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
    // Bulk add — single setState. Was N rerenders (one per loop iteration).
    addItem(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        image: thumbSrc,
        category: product.category,
      },
      qty,
    );
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


      <main className="min-h-screen bg-linear-to-br from-cream via-[#fafaf8] to-sage/5 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/shop">
            <Button
              type="button"
              variant="ghost"
              className="group mb-8 text-charcoal/70"
            >
              <ArrowLeft size={16} />
              Back to Shop
            </Button>
          </Link>

          <div className="grid lg:grid-cols-2 gap-12 mb-20">
            <div className="space-y-4">
              <div className="relative aspect-square rounded-3xl overflow-hidden bg-white-warm border border-sage/10 shadow-[0_8px_48px_-8px_rgba(51,51,51,0.14)] group">
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
                    <NavPrevButton
                      onClick={() =>
                        setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
                      }
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white-warm opacity-0 group-hover:opacity-100 text-charcoal"
                      label="Previous image"
                    />
                    <NavNextButton
                      onClick={() => setCurrentImageIndex((prev) => (prev + 1) % images.length)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white-warm opacity-0 group-hover:opacity-100 text-charcoal"
                      label="Next image"
                    />
                  </>
                )}

                {product.featured && (
                  <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-terracotta text-cream text-xs font-body font-medium">
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
                <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white-warm border border-sage/10">
                  <QtyMinusButton
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="rounded-full bg-sage/10 text-sage"
                  />
                  <span className="font-body text-lg text-charcoal w-8 text-center">{quantity}</span>
                  <QtyPlusButton
                    onClick={() => setQuantity(inStock ? Math.min(product.stock, quantity + 1) : quantity)}
                    className="rounded-full bg-sage/10 text-sage"
                    disabled={!inStock || quantity >= product.stock}
                  />
                </div>

                <Button
                  type="button"
                  variant="sage"
                  size="lg"
                  onClick={handleAddToCart}
                  disabled={!inStock}
                  className="flex-1 min-w-[200px] rounded-md"
                >
                  <ShoppingCart size={20} />
                  Add to Cart
                </Button>

                <Button
                  type="button"
                  variant={isWishlisted ? "terracotta" : "terracotta-ghost"}
                  size="icon-lg"
                  onClick={() => setIsWishlisted(!isWishlisted)}
                  className={`rounded-md ${isWishlisted ? "" : "bg-white-warm border border-sage/10"}`}
                  aria-label="Wishlist"
                >
                  <Heart size={20} className={isWishlisted ? "fill-current" : ""} />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  onClick={handleShare}
                  className="rounded-md bg-white-warm border border-sage/10 text-charcoal/60"
                  aria-label="Copy link"
                >
                  <Share2 size={20} />
                </Button>
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
                    <div className="group relative rounded-2xl overflow-hidden bg-white-warm border border-sage/10 hover:border-sage/30 transition-all duration-300 hover:shadow-xl hover:scale-105 cursor-pointer">
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
                          <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-terracotta text-cream text-xs font-body">
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
