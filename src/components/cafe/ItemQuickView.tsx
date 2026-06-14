import { useEffect, useState } from "react";
import Image from "next/image";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/responsive/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { cdnUrl } from "@/lib/cdnUrl";
import { cafeCategoryLabel, type CafeMenuItem } from "./types";

interface ItemQuickViewProps {
  item: CafeMenuItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: (item: CafeMenuItem, quantity: number) => void;
}

/**
 * Member-facing item quick-view — the gated `product-quick-view-03` equivalent,
 * re-skinned to DESIGN.md. Honest about data: shows image, café category,
 * description, INR price and a quantity stepper. No fabricated macros/ratings.
 */
export function ItemQuickView({
  item,
  open,
  onOpenChange,
  onAddToCart,
}: ItemQuickViewProps) {
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (open) setQty(1);
  }, [open, item?.id]);

  if (!item) return null;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-3xl overflow-hidden p-0 sm:rounded-2xl">
        <div className="grid md:grid-cols-2">
          <div className="relative aspect-square w-full bg-sand/40 md:aspect-auto">
            <Image
              src={item.image_url || cdnUrl("/food/A7401864.jpg")}
              alt={item.name}
              width={800}
              height={800}
              unoptimized
              className="h-full max-h-72 w-full object-cover md:max-h-none"
            />
          </div>
          <div className="flex flex-col gap-4 p-6">
            <ResponsiveDialogHeader className="space-y-2 p-0 text-left">
              <span className="font-body text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-terracotta">
                {cafeCategoryLabel(item.category)}
              </span>
              <ResponsiveDialogTitle className="font-display text-2xl leading-tight text-charcoal">
                {item.name}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="font-body text-sm leading-relaxed text-charcoal/70">
                {item.description || "A fresh pick from the studio café."}
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            <p className="font-body text-3xl text-charcoal tabular-nums">₹{item.price}</p>

            {item.is_available ? (
              <>
                <div className="flex items-center gap-4">
                  <span className="font-body text-sm text-charcoal/60">
                    Quantity
                  </span>
                  <div className="flex items-center gap-3 rounded-full border border-border bg-white-warm p-1">
                    <Button
                      type="button"
                      variant="sage-outline"
                      size="icon-sm"
                      className="rounded-md"
                      aria-label="Decrease quantity"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                    >
                      <Minus size={16} />
                    </Button>
                    <span className="w-6 text-center font-body text-lg">{qty}</span>
                    <Button
                      type="button"
                      variant="sage-outline"
                      size="icon-sm"
                      className="rounded-md"
                      aria-label="Increase quantity"
                      onClick={() => setQty((q) => q + 1)}
                    >
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>
                <Button
                  variant="sage"
                  className="mt-auto h-12 w-full text-base"
                  onClick={() => {
                    onAddToCart(item, qty);
                    onOpenChange(false);
                  }}
                >
                  <ShoppingCart size={18} className="mr-2" />
                  Add {qty} to cart · ₹{item.price * qty}
                </Button>
              </>
            ) : (
              <p className="mt-auto rounded-xl border border-border bg-sand/40 p-4 font-body text-sm text-charcoal/60">
                Currently unavailable. Check back soon.
              </p>
            )}
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export default ItemQuickView;
