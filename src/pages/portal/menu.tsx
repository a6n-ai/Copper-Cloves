import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "@/lib/auth/client";
import { useStudioSWR } from "@/lib/swr";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

export const getServerSideProps = requireSessionSSP();
import { Plus, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MenuItemCard } from "@/components/cafe/MenuItemCard";
import { CategoryFilter } from "@/components/cafe/CategoryFilter";
import { ItemQuickView } from "@/components/cafe/ItemQuickView";
import { CartDrawer } from "@/components/cafe/CartDrawer";
import {
  CAFE_CATEGORIES,
  type CafeCartItem,
  type CafeClassSchedule,
  type CafeMenuItem,
} from "@/components/cafe/types";

function MenuGridSkeleton({ count = 6 }: Readonly<{ count?: number }>) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => `menu-skeleton-${i}`).map((key) => (
        <Card
          key={key}
          className="overflow-hidden rounded-2xl border border-border bg-white-warm p-0"
        >
          <Skeleton className="aspect-video w-full rounded-none" />
          <CardContent className="space-y-2 p-5">
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-6 w-3/5" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function MenuPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const authed = !!session?.user;
  // Cafe menu — SWR-shared with portal/book + admin/cafe (same URL key,
  // deduped within 15s). Eliminates a duplicate fetch when navigating
  // between /portal/menu and /portal/book.
  const {
    data: rawMenu,
    isLoading: menuLoading,
    error: menuError,
    mutate: mutateMenu,
  } = useStudioSWR<unknown[]>(
    authed ? "/api/cafe/items?available=true" : null,
  );
  const menuItems = useMemo<CafeMenuItem[]>(() => {
    const list = Array.isArray(rawMenu) ? rawMenu : [];
    return list.map((item) => {
      const r = item as Record<string, unknown>;
      return {
        ...(r as unknown as CafeMenuItem),
        description: typeof r.description === "string" ? r.description : "",
        image_url: typeof r.image_url === "string" ? r.image_url : "",
        price: Number(r.price),
      };
    });
  }, [rawMenu]);
  const [cart, setCart] = useState<CafeCartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  // Upcoming-classes month window, computed once per mount day. Hoisting the
  // URL key into a memo lets SWR dedupe with any other consumer that asks for
  // the same window.
  const upcomingClassesUrl = useMemo(() => {
    if (!authed) return null;
    const today = new Date();
    const params = new URLSearchParams({
      month: String(today.getMonth() + 1),
      year: String(today.getFullYear()),
    });
    return `/api/class-schedules?${params}`;
  }, [authed]);
  const { data: availableClassesRaw } = useStudioSWR<CafeClassSchedule[]>(upcomingClassesUrl);
  const availableClasses = availableClassesRaw ?? [];
  const [quickViewItem, setQuickViewItem] = useState<CafeMenuItem | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  // Auth gate + both data sources (menu items, upcoming classes) are now
  // SWR-driven above. No manual effect needed.

  const addToCart = (item: CafeMenuItem, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i,
        );
      }
      return [...prev, { ...item, quantity }];
    });
  };

  const removeFromCart = (itemId: string) =>
    setCart((prev) => prev.filter((i) => i.id !== itemId));

  const updateQuantity = (itemId: string, change: number) =>
    setCart(
      (prev) =>
        prev
          .map((item) => {
            if (item.id !== itemId) return item;
            const newQty = Math.max(0, item.quantity + change);
            return newQty === 0 ? null : { ...item, quantity: newQty };
          })
          .filter(Boolean) as CafeCartItem[],
    );

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: menuItems.length };
    for (const c of CAFE_CATEGORIES) {
      if (c.id === "all") continue;
      counts[c.id] = menuItems.filter((m) => m.category === c.id).length;
    }
    return counts;
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchCat =
        selectedCategory === "all" || item.category === selectedCategory;
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [menuItems, selectedCategory, search]);

  const openQuickView = (item: CafeMenuItem) => {
    setQuickViewItem(item);
    setQuickViewOpen(true);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/5">
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6 sm:pb-10 lg:px-8">
        <div className="mb-6">
          <PageHeader
            title="Today's Menu"
            subtitle="Nourish your body after movement"
          />
        </div>

        {menuLoading ? (
          <MenuGridSkeleton count={6} />
        ) : menuError ? (
          <div className="rounded-2xl border border-border bg-white-warm py-16 text-center">
            <p className="font-body text-charcoal/70">
              We couldn&apos;t load the menu. Please check your connection and try again.
            </p>
            <Button
              variant="sage-outline"
              className="mt-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1"
              onClick={() => mutateMenu()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            <CategoryFilter
              className="mb-8"
              selected={selectedCategory}
              onSelect={setSelectedCategory}
              search={search}
              onSearch={setSearch}
              counts={categoryCounts}
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredItems.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-border bg-white-warm py-16 text-center">
                  <p className="font-body text-charcoal/70">
                    {search || selectedCategory !== "all"
                      ? "No items match your search."
                      : "No café items are available yet. Check back soon."}
                  </p>
                </div>
              ) : (
                filteredItems.map((item, i) => {
                  const inCart = cart.find((c) => c.id === item.id);
                  return (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      index={i}
                      onSurfaceClick={() => openQuickView(item)}
                    >
                      {inCart ? (
                        <div className="flex items-center justify-between rounded-md border border-sage/30 bg-sage/5 px-2 py-1.5">
                          <Button
                            variant="sage-outline"
                            size="icon-sm"
                            className="rounded-md"
                            aria-label="Decrease quantity"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            −
                          </Button>
                          <span className="font-body text-sm text-charcoal">
                            {inCart.quantity} in cart
                          </span>
                          <Button
                            variant="sage-outline"
                            size="icon-sm"
                            className="rounded-md"
                            aria-label="Increase quantity"
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            +
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => addToCart(item)}
                          variant="sage"
                          className="h-11 w-full"
                        >
                          <Plus size={18} className="mr-2" />
                          Add to Cart
                        </Button>
                      )}
                    </MenuItemCard>
                  );
                })
              )}
            </div>
          </>
        )}
      </main>

      {/* Floating cart button — raised above bottom nav on mobile */}
      {cartCount > 0 && (
        <div className="fixed bottom-28 right-4 z-40 duration-300 zoom-in-90 slide-in-from-bottom-4 animate-in sm:bottom-8 sm:right-8">
          <Button
            onClick={() => setCartOpen(true)}
            size="lg"
            variant="sage"
            className="h-14 rounded-full px-6 text-base shadow-[0_8px_24px_rgba(51,51,51,0.18)] transition-transform duration-300 hover:scale-105 active:scale-95 sm:h-16 sm:px-8 sm:text-lg"
          >
            <ShoppingCart size={22} className="mr-2 sm:mr-3" />
            Cart ({cartCount})
          </Button>
        </div>
      )}

      <ItemQuickView
        item={quickViewItem}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        onAddToCart={addToCart}
      />

      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        cart={cart}
        onUpdateQuantity={updateQuantity}
        onRemove={removeFromCart}
        availableClasses={availableClasses}
        onOrderPlaced={() => {
          setCart([]);
          setCartOpen(false);
          router.push("/portal/dashboard");
        }}
      />
    </div>
  );
}
