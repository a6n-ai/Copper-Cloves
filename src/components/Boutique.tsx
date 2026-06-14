import { useRef, useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

import { cdnUrl } from "@/lib/cdnUrl";
import { SectionHeading } from "@/components/SectionHeading";

type RetailProduct = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  image_url: string | null;
  featured?: boolean;
};

const PLACEHOLDER_IMAGE = cdnUrl("/boutique-candle.jpg");

export function Boutique() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [products, setProducts] = useState<RetailProduct[]>([]);
  const [isScrolling, setIsScrolling] = useState(false);

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
    if (!scrollRef.current || isScrolling) return;
    setIsScrolling(true);
    const container = scrollRef.current;
    const start = container.scrollLeft;
    const target = start + (direction === "right" ? 420 : -420);
    const startTime = performance.now();
    const duration = 500;
    const stepFn = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      container.scrollLeft = start + (target - start) * eased;
      if (progress < 1) {
        requestAnimationFrame(stepFn);
      } else {
        setIsScrolling(false);
      }
    };
    requestAnimationFrame(stepFn);
  };

  // No products → render nothing on the public landing page (was a dead
  // "added in admin" placeholder). Stays hidden during the initial fetch too.
  if (products.length === 0) return null;

  return (
    <section className="relative py-14 md:py-20 bg-cream overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        <SectionHeading
          eyebrow="The Studio · Boutique"
          title="The boutique"
          subtitle="Curated rituals for your home. Featured retail from the studio, shop the full catalog online."
          className="mb-12"
        />

        <div className="group relative">
          <Button
            type="button"
            variant="sage-outline"
            size="icon-lg"
            onClick={() => scroll("left")}
            disabled={isScrolling}
            className="absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-md border-sage/20 bg-white-warm opacity-0 transition-opacity duration-200 group-hover:opacity-100 lg:flex"
            aria-label="Previous products"
          >
            <ChevronLeft className="text-sage" size={24} />
          </Button>
          <Button
            type="button"
            variant="sage-outline"
            size="icon-lg"
            onClick={() => scroll("right")}
            disabled={isScrolling}
            className="absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-md border-sage/20 bg-white-warm opacity-0 transition-opacity duration-200 group-hover:opacity-100 lg:flex"
            aria-label="Next products"
          >
            <ChevronRight className="text-sage" size={24} />
          </Button>

          <div
            ref={scrollRef}
            className="scrollbar-hide flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-px-2 scroll-smooth px-2 pb-4"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {products.map((product) => (
                <div key={product.id} className="group/card w-80 shrink-0 snap-start">
                  <div className="relative h-full bg-white-warm rounded-2xl border border-sage/10 overflow-hidden transition-all duration-500 hover:border-sage/30 hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)] hover:bg-sage/5">
                    <div className="relative h-80 overflow-hidden bg-sand">
                      <Image
                        src={product.image_url || PLACEHOLDER_IMAGE}
                        alt={product.name}
                        fill
                        className="object-cover transition-transform duration-500 ease-out group-hover/card:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
                        sizes="(max-width: 1024px) 320px, 25vw"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-charcoal/40 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
                      <div className="absolute top-4 right-4">
                        <span className="bg-white-warm px-3 py-1 rounded-full text-xs font-body text-charcoal/70 border border-sage/20">
                          {product.category}
                        </span>
                      </div>
                    </div>

                    <div className="p-6">
                      <h3 className="font-display text-2xl text-charcoal mb-3 group-hover/card:text-sage transition-colors duration-300">
                        {product.name}
                      </h3>
                      <p className="font-body text-sm text-charcoal/70 leading-relaxed mb-2">
                        {product.description || "Studio retail."}
                      </p>
                      <p className="font-body text-sage font-medium mb-6">₹{product.price.toLocaleString("en-IN")}</p>
                      <Button asChild variant="sage-outline" size="lg" className="w-full">
                        <Link href={`/shop/${product.id}`}>
                          view details
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="mb-4 font-body text-sm italic text-charcoal/50">bring the sanctuary home</p>
          <Link
            href="/shop"
            className="group inline-flex items-center gap-1.5 font-body text-sm font-semibold text-sage transition-colors duration-200"
          >
            Explore all products
            <ArrowRight
              size={16}
              className="transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
        </div>
      </div>

      <style jsx>{`
      `}</style>
    </section>
  );
}
