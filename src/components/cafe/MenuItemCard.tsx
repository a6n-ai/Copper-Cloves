import type { ReactNode } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";
import { cdnUrl } from "@/lib/cdnUrl";
import { cafeCategoryLabel, type CafeMenuItem } from "./types";

interface MenuItemCardProps {
  item: CafeMenuItem;
  /** Opens quick-view / acts as the card's primary surface click. */
  onSurfaceClick?: () => void;
  /** Footer actions (add-to-cart for members, edit/delete for admin). */
  children?: ReactNode;
  /** Top-left badge over the image (e.g. "Unavailable"). */
  badge?: ReactNode;
  /** Override the category label (admin has user-defined categories the
   *  built-in `cafeCategoryLabel` lookup doesn't know about). */
  categoryLabel?: string;
  /** Position in the grid — drives a small staggered entrance delay. */
  index?: number;
  className?: string;
}

/**
 * Café menu card. Photography-led per DESIGN.md: the food image owns the card,
 * with category + INR price riding on a bottom scrim as solid white-warm chips
 * (no glassmorphism). Playfair carries the item name (a product name, the one
 * sanctioned display-font use in product UI); Montserrat handles everything
 * functional. Flat at rest, lifts on hover (shadow + border darken + a
 * restrained image zoom). No ratings/wishlist — no backing data to honour.
 */
export function MenuItemCard({
  item,
  onSurfaceClick,
  children,
  badge,
  categoryLabel,
  index,
  className,
}: MenuItemCardProps) {
  const surfaceInteractive = Boolean(onSurfaceClick);
  const priceLabel = `₹${Number(item.price).toLocaleString("en-IN")}`;

  return (
    <Card
      style={
        typeof index === "number"
          ? { animationDelay: `${Math.min(index, 11) * 60}ms` }
          : undefined
      }
      className={cn(
        "group flex flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-white-warm p-0 shadow-none ring-0",
        "transition-[transform,box-shadow,border-color] duration-300 ease-out",
        "hover:-translate-y-1 hover:border-charcoal/20 hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]",
        "fade-in-0 slide-in-from-bottom-4 fill-mode-both animate-in motion-reduce:animate-none motion-reduce:transition-none",
        !item.is_available && "opacity-75",
        className,
      )}
    >
      <div
        role={surfaceInteractive ? "button" : undefined}
        tabIndex={surfaceInteractive ? 0 : undefined}
        onClick={onSurfaceClick}
        onKeyDown={
          surfaceInteractive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSurfaceClick?.();
                }
              }
            : undefined
        }
        className={cn(
          "relative aspect-[4/3] w-full overflow-hidden bg-sand/40",
          surfaceInteractive &&
            "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-white-warm",
        )}
      >
        <Image
          src={item.image_url || cdnUrl("/food/A7401864.jpg")}
          alt={item.name}
          width={1200}
          height={900}
          unoptimized
          className="h-full w-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
        />

        {/* Bottom scrim — darkens only the lower band so the chips read; top
            stays clear for the optional status badge. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-charcoal/55 to-transparent" />

        {badge ? <div className="absolute left-3 top-3 z-10">{badge}</div> : null}

        <div className="absolute inset-x-3 bottom-3 z-10 flex items-end justify-between gap-2">
          <Pill tone="warning" size="sm" className="bg-white-warm font-semibold uppercase tracking-[0.08em]">
            {categoryLabel ?? cafeCategoryLabel(item.category)}
          </Pill>
          <span className="rounded-full border border-border bg-white-warm px-3 py-1 font-body text-base leading-none text-charcoal tabular-nums">
            {priceLabel}
          </span>
        </div>
      </div>

      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-1 flex-col gap-1.5">
          <h3 className="font-display text-xl leading-snug text-charcoal">
            {item.name}
          </h3>
          {item.description ? (
            <p className="line-clamp-2 font-body text-sm leading-relaxed text-charcoal/60">
              {item.description}
            </p>
          ) : null}
        </div>
        {children ? <div className="pt-1">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

export default MenuItemCard;
