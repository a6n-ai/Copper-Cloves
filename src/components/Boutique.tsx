import { useRef, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type RetailProduct = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  image_url: string | null;
  featured?: boolean;
};

const PLACEHOLDER_IMAGE = "/boutique-candle.jpg";

export function Boutique() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [products, setProducts] = useState<RetailProduct[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/retail-products");
        const data = res.ok ? await res.json() : [];
        if (!cancelled && Array.isArray(data)) {
          setProducts(data.filter((p: RetailProduct) => p?.id && p?.name).slice(0, 12));
        }
      } catch {
        if (!cancelled) setProducts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      const newScrollLeft =
        scrollRef.current.scrollLeft + (direction === "right" ? scrollAmount : -scrollAmount);
      scrollRef.current.scrollTo({
        left: newScrollLeft,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="relative py-16 md:py-20 bg-cream overflow-hidden">
      <div className="absolute top-20 left-10 w-64 h-64 bg-sage/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-64 h-64 bg-terracotta/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="font-display text-5xl md:text-6xl text-charcoal mb-3">the boutique</h2>
          <p className="font-display text-2xl md:text-3xl text-sage/80 italic lowercase">
            curated rituals for your home
          </p>
        </div>

        <div className="max-w-3xl mx-auto text-center mb-12">
          <p className="font-body text-lg text-charcoal/80 leading-relaxed">
            Featured retail from the studio — synced with what you manage in admin. Shop the full catalog
            online.
          </p>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => scroll("left")}
            className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 w-12 h-12 items-center justify-center rounded-full bg-white/90 backdrop-blur-xs border border-sage/20 text-sage hover:bg-sage hover:text-white transition-all duration-300 shadow-lg hover:shadow-xl"
            aria-label="Previous products"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 w-12 h-12 items-center justify-center rounded-full bg-white/90 backdrop-blur-xs border border-sage/20 text-sage hover:bg-sage hover:text-white transition-all duration-300 shadow-lg hover:shadow-xl"
            aria-label="Next products"
          >
            <ChevronRight size={24} />
          </button>

          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 lg:grid lg:grid-cols-4 lg:overflow-visible"
          >
            {products.length === 0 ? (
              <p className="font-body text-charcoal/60 py-12 w-full text-center lg:col-span-4">
                Products will appear here once added in admin.
              </p>
            ) : (
              products.map((product) => (
                <div key={product.id} className="group shrink-0 w-80 lg:w-auto snap-start">
                  <div className="relative h-full bg-white/80 backdrop-blur-xs rounded-2xl border border-sage/10 overflow-hidden transition-all duration-500 hover:border-sage/30 hover:shadow-xl hover:bg-sage/5">
                    <div className="relative h-80 overflow-hidden bg-linear-to-br from-sage/20 via-cream/50 to-terracotta/20">
                      <Image
                        src={product.image_url || PLACEHOLDER_IMAGE}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 320px, 25vw"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-charcoal/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="absolute top-4 right-4">
                        <span className="bg-white/90 backdrop-blur-xs px-3 py-1 rounded-full text-xs font-body text-charcoal/70 border border-sage/20">
                          {product.category}
                        </span>
                      </div>
                    </div>

                    <div className="p-6">
                      <h3 className="font-display text-2xl text-charcoal mb-3 group-hover:text-sage transition-colors duration-300">
                        {product.name}
                      </h3>
                      <p className="font-body text-sm text-charcoal/70 leading-relaxed mb-2">
                        {product.description || "Studio retail."}
                      </p>
                      <p className="font-body text-sage font-medium mb-6">₹{product.price.toLocaleString("en-IN")}</p>
                      <Link
                        href={`/shop/${product.id}`}
                        className="block w-full py-3 rounded-full border border-sage/30 text-sage font-body text-sm text-center hover:bg-sage hover:text-white transition-all duration-300 group-hover:border-sage"
                      >
                        view details
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="text-center mt-12">
          <p className="font-body text-sm text-charcoal/50 italic mb-6">bring the sanctuary home</p>
          <Link href="/shop">
            <span className="group inline-flex items-center gap-2 px-8 py-4 rounded-full bg-sage hover:bg-sage/90 text-white font-body text-sm transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 cursor-pointer">
              Explore All Products
              <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" size={18} />
            </span>
          </Link>
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}
