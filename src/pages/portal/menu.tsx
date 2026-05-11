import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { PortalNavigation } from "@/components/PortalNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { 
  ArrowLeft, 
  Plus, 
  Minus, 
  ShoppingCart, 
  Users,
  X,
  Loader2,
  Check
} from "lucide-react";
import Link from "next/link";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image_url: string;
  is_available: boolean;
}

interface CartItem extends MenuItem {
  quantity: number;
}

interface ClassSchedule {
  id: string;
  start_time: string;
  class_model?: {
    name: string;
  };
  instructor?: {
    full_name: string;
  };
}

export default function MenuPage() {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showCheckout, setShowCheckout] = useState(false);
  
  const [addToClass, setAddToClass] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [availableClasses, setAvailableClasses] = useState<ClassSchedule[]>([]);
  const [guestCount, setGuestCount] = useState(0);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const paymentMethod: "online" = "online";
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const categories = [
    { id: "all", label: "All Items" },
    { id: "smoothie_bowl", label: "Smoothie Bowls" },
    { id: "drink", label: "Drinks" },
    { id: "snack", label: "Snacks" },
    { id: "meal", label: "Meals" }
  ];

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/portal/login?redirect=/portal/menu");
      return;
    }
    if (status === "authenticated") {
      fetchMenuItems();
      fetchUpcomingClasses();
    }
  }, [router, status]);

  const fetchMenuItems = async () => {
    try {
      const res = await fetch("/api/cafe/items?available=true");
      const raw = res.ok ? await res.json() : [];
      const list = Array.isArray(raw) ? raw : [];
      const normalized: MenuItem[] = list.map((item: Record<string, unknown>) => ({
        ...(item as unknown as MenuItem),
        description: String(item.description ?? ""),
        image_url: String(item.image_url ?? ""),
        price: Number(item.price),
      }));
      setMenuItems(normalized);
    } catch (err) {
      console.error("Error fetching menu:", err);
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingClasses = async () => {
    try {
      const today = new Date();
      const params = new URLSearchParams({
        month: String(today.getMonth() + 1),
        year: String(today.getFullYear()),
      });
      const res = await fetch(`/api/class-schedules?${params}`);
      const data = res.ok ? await res.json() : [];
      setAvailableClasses(data);
    } catch (err) {
      console.error("Error fetching classes:", err);
    }
  };

  const addToCart = (item: MenuItem) => {
    setCart(prevCart => {
      const existing = prevCart.find(i => i.id === item.id);
      if (existing) {
        return prevCart.map(i => 
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prevCart, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prevCart => prevCart.filter(i => i.id !== itemId));
  };

  const updateQuantity = (itemId: string, change: number) => {
    setCart(prevCart => 
      prevCart.map(item => {
        if (item.id === itemId) {
          const newQty = Math.max(0, item.quantity + change);
          return newQty === 0 ? null : { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[]
    );
  };

  const getTotalPrice = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setShowCheckout(true);
  };

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
      const responses = await Promise.all(
        cart.map(item =>
          fetch("/api/cafe/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cafe_item_id: item.id,
              quantity: item.quantity,
              payment_method: paymentMethod,
              ...(addToClass && selectedClass ? { class_schedule_id: selectedClass } : {}),
            }),
          })
        )
      );

      const errors: string[] = [];
      for (const r of responses) {
        if (r.ok) continue;
        let msg = `${r.status} ${r.statusText}`;
        try {
          const body = await r.json();
          if (body?.error) msg = String(body.error);
        } catch {
          /* ignore */
        }
        errors.push(msg);
      }
      if (errors.length > 0) {
        setOrderError(errors[0]);
        return;
      }

      setOrderSuccess(true);
      setTimeout(() => {
        setCart([]);
        setShowCheckout(false);
        setOrderSuccess(false);
        router.push("/portal/dashboard");
      }, 2000);
    } catch (err) {
      console.error("Error placing order:", err);
      setOrderError(err instanceof Error ? err.message : "Could not place order");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredItems = selectedCategory === "all" 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-cream via-cream to-sage/5">
        <Loader2 className="animate-spin text-sage" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-sage/5">
      <PortalNavigation />
      
      <main className="pt-20 min-h-screen">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          
          {/* Header */}
          <div className="mb-8">
            <Link href="/portal/dashboard">
              <button className="mb-4 flex items-center gap-2 text-charcoal/60 hover:text-charcoal transition-colors">
                <ArrowLeft size={20} />
                <span className="font-body text-sm">Back to Dashboard</span>
              </button>
            </Link>
            
            <h1 className="font-display text-5xl md:text-6xl text-charcoal mb-4">
              Today's Menu
            </h1>
            <p className="font-body text-lg text-charcoal/70">
              Nourish your body after movement
            </p>
          </div>

          {/* Category Filters */}
          <div className="mb-8 flex gap-3 overflow-x-auto pb-2">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-6 py-2 rounded-full font-body text-sm whitespace-nowrap transition-all duration-300 ${
                  selectedCategory === cat.id
                    ? "bg-sage text-white shadow-lg"
                    : "bg-white/80 text-charcoal hover:bg-sage/10 border border-sage/20"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Menu Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {filteredItems.length === 0 ? (
              <div className="col-span-full text-center py-16 rounded-2xl bg-white/60 border border-sage/10">
                <p className="font-body text-charcoal/70">
                  No café items are available yet. Check back soon, or ask the studio to publish the menu in Admin → Café.
                </p>
              </div>
            ) : (
              filteredItems.map(item => (
              <Card key={item.id} className="border-0 bg-white/80 backdrop-blur-xl shadow-lg overflow-hidden group">
                <div className="aspect-video w-full overflow-hidden">
                  <Image
                    src={item.image_url || "/food/A7401864.jpg"}
                    alt={item.name}
                    width={1200}
                    height={675}
                    unoptimized
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                <CardContent className="p-6">
                  <div className="mb-3">
                    <Badge variant="outline" className="mb-2 text-xs font-body border-sage/30 text-sage">
                      {categories.find(c => c.id === item.category)?.label}
                    </Badge>
                    <h3 className="font-display text-2xl text-charcoal mb-2">{item.name}</h3>
                    <p className="font-body text-sm text-charcoal/70 mb-3">{item.description}</p>
                    <p className="font-display text-3xl text-sage">₹{item.price}</p>
                  </div>
                  
                  <Button
                    onClick={() => addToCart(item)}
                    className="w-full bg-sage hover:bg-sage/90 text-white font-body"
                  >
                    <Plus size={18} className="mr-2" />
                    Add to Cart
                  </Button>
                </CardContent>
              </Card>
              ))
            )}
          </div>

          {/* Floating Cart Button */}
          {cart.length > 0 && (
            <div className="fixed bottom-8 right-8 z-40">
              <Button
                onClick={handleCheckout}
                size="lg"
                className="bg-sage hover:bg-sage/90 text-white shadow-2xl font-body text-lg h-16 px-8 rounded-full"
              >
                <ShoppingCart size={24} className="mr-3" />
                View Cart ({cart.length})
              </Button>
            </div>
          )}

        </div>
      </main>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={() => setShowCheckout(false)} />
          
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-xl border-b border-sage/10 p-6 z-10">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-3xl text-charcoal">Your Order</h2>
                <button
                  onClick={() => setShowCheckout(false)}
                  className="w-10 h-10 rounded-full hover:bg-sage/10 flex items-center justify-center transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Cart Items */}
            <div className="p-6 space-y-4">
              {cart.map(item => (
                <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl bg-cream/30 border border-sage/10">
                  <Image
                    src={item.image_url || "/food/A7401864.jpg"}
                    alt={item.name}
                    width={80}
                    height={80}
                    unoptimized
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h4 className="font-display text-lg text-charcoal">{item.name}</h4>
                    <p className="font-body text-sm text-sage">₹{item.price} each</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-8 h-8 rounded-full bg-sage/10 hover:bg-sage/20 flex items-center justify-center"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="font-body text-lg w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-8 h-8 rounded-full bg-sage/10 hover:bg-sage/20 flex items-center justify-center"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-terracotta hover:text-terracotta/80"
                  >
                    <X size={20} />
                  </button>
                </div>
              ))}

              {/* Add to Class */}
              <div className="p-6 rounded-xl bg-white/80 border border-sage/20">
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    checked={addToClass}
                    onChange={(e) => setAddToClass(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <label className="font-body text-charcoal">Add to a class booking</label>
                </div>
                
                {addToClass && (
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full p-3 rounded-lg border border-sage/30 font-body"
                  >
                    <option value="">Select a class</option>
                    {availableClasses.map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {cls.class_model?.name ?? "Class"} - {new Date(cls.start_time).toLocaleDateString()} at {new Date(cls.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Add Friends/Family */}
              <div className="p-6 rounded-xl bg-white/80 border border-sage/20">
                <div className="flex items-center justify-between mb-4">
                  <label className="font-body text-charcoal flex items-center gap-2">
                    <Users size={20} />
                    Order for friends/family
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleGuestCountChange(guestCount - 1)}
                      className="w-8 h-8 rounded-full bg-sage/10 hover:bg-sage/20"
                    >
                      <Minus size={16} className="mx-auto" />
                    </button>
                    <span className="font-body px-4">{guestCount}</span>
                    <button
                      onClick={() => handleGuestCountChange(guestCount + 1)}
                      className="w-8 h-8 rounded-full bg-sage/10 hover:bg-sage/20"
                    >
                      <Plus size={16} className="mx-auto" />
                    </button>
                  </div>
                </div>

                {guestCount > 0 && (
                  <div className="space-y-2">
                    {guestNames.map((_, index) => (
                      <Input
                        key={index}
                        placeholder={`Guest ${index + 1} name`}
                        value={guestNames[index]}
                        onChange={(e) => {
                          const newNames = [...guestNames];
                          newNames[index] = e.target.value;
                          setGuestNames(newNames);
                        }}
                        className="font-body"
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div className="p-6 rounded-xl bg-white/80 border border-sage/20">
                <h3 className="font-display text-lg text-charcoal mb-4">Payment Method</h3>
                <div className="grid grid-cols-1 gap-3">
                  <label 
                    className="flex items-center gap-3 p-4 rounded-xl border-2 cursor-default transition-all duration-300 border-sage bg-sage/5"
                  >
                    <input 
                      type="radio" 
                      name="payment" 
                      value="online"
                      checked={true}
                      readOnly
                      className="sr-only" 
                    />
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center border-sage">
                      <div className="w-3 h-3 rounded-full bg-sage" />
                    </div>
                    <div>
                      <span className="font-body block">Pay Online</span>
                      <span className="font-body text-xs text-charcoal/60">UPI / Cards</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Total */}
              <div className="p-6 rounded-xl bg-sage/10 border border-sage/20">
                <div className="flex justify-between items-center">
                  <span className="font-body text-lg text-charcoal">Total</span>
                  <span className="font-display text-4xl text-sage">₹{getTotalPrice()}</span>
                </div>
              </div>

              {/* Place Order Button */}
              {orderError && (
                <p className="text-sm text-red-600 font-body px-1">{orderError}</p>
              )}
              <Button
                onClick={handlePlaceOrder}
                disabled={isProcessing || orderSuccess}
                className="w-full bg-sage hover:bg-sage/90 text-white font-body h-14 text-lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={20} />
                    Processing...
                  </>
                ) : orderSuccess ? (
                  <>
                    <Check className="mr-2" size={20} />
                    Order Placed!
                  </>
                ) : (
                  "Place Order"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}