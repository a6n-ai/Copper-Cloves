import { useEffect, useState, useRef, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { SEO } from "@/components/SEO";
import { 
  Plus, 
  Edit, 
  Trash2, 
  X, 
  Save,
  Loader2,
  Image as ImageIcon,
  Upload
} from "lucide-react";

interface MenuItem {
  id?: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image_url: string;
  is_available: boolean;
}

export default function AdminCafe() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState<MenuItem>({
    name: "",
    category: "smoothie_bowl",
    description: "",
    price: 0,
    image_url: "",
    is_available: true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const menuPhotoInputRef = useRef<HTMLInputElement>(null);

  // Category management state
  const [categories, setCategories] = useState([
    { id: "smoothie_bowl", label: "Smoothie Bowl" },
    { id: "drink", label: "Drink" },
    { id: "snack", label: "Snack" },
    { id: "meal", label: "Meal" }
  ]);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategory, setNewCategory] = useState({ id: "", label: "" });
  const [editingCategory, setEditingCategory] = useState<{ id: string; label: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"menu" | "categories" | "orders">("menu");
  const [orderHistoryTab, setOrderHistoryTab] = useState<"active" | "history">("active");
  
  // Orders state
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const categories_display = categories;

  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/admin/login"); return; }
    const role = (session?.user as { role?: string })?.role;
    if (status === "authenticated" && role !== "admin") { router.push("/admin/login"); return; }
    if (status === "authenticated") {
      fetchMenuItems();
      fetchOrders();
      fetchOrderHistory();
    }

    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    const pollingInterval = setInterval(() => {
      fetchOrders();
      fetchOrderHistory();
    }, 10000);
    return () => {
      clearInterval(timeInterval);
      clearInterval(pollingInterval);
    };
  }, [status, session]);

  const fetchMenuItems = async () => {
    try {
      const res = await fetch("/api/cafe/items");
      setMenuItems(res.ok ? await res.json() : []);
    } catch (err) {
      console.error("Error fetching menu items:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/cafe/orders");
      const data = res.ok ? await res.json() : [];
      const active = data.filter((o: { status: string }) => !["completed", "cancelled"].includes(o.status));
      const classSortKey = (o: { booking?: { class_schedule?: { start_time?: string }; class_time?: string | null } }) =>
        o.booking?.class_schedule?.start_time ?? o.booking?.class_time ?? null;
      active.sort((a, b) => {
        const at = classSortKey(a);
        const bt = classSortKey(b);
        if (at && bt) return new Date(at).getTime() - new Date(bt).getTime();
        if (at) return -1;
        if (bt) return 1;
        return new Date(a.order_date).getTime() - new Date(b.order_date).getTime();
      });
      setOrders(active);
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchOrderHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/cafe/orders");
      const data = res.ok ? await res.json() : [];
      setOrderHistory(data.filter((o: { status: string }) => ["completed", "cancelled"].includes(o.status)));
    } catch (err) {
      console.error("Error fetching order history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/cafe/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      await fetchOrders();
      await fetchOrderHistory();
    } catch (err) {
      console.error("Error updating order status:", err);
      alert("Failed to update order status. Please try again.");
    }
  };

  const isOrderUrgent = (orderDate: string) => {
    const now = new Date();
    const ordered = new Date(orderDate);
    const minutesSinceOrder = Math.floor((now.getTime() - ordered.getTime()) / (1000 * 60));
    return minutesSinceOrder > 15;
  };

  const getOrderAlertLevel = (order: any) => {
    const now = new Date();
    const orderDate = new Date(order.order_date);
    const minutesSinceOrder = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60));
    
    const classStartTimeStr =
      order.booking?.class_schedule?.start_time ?? order.booking?.class_time ?? undefined;
    
    // If order is linked to a class
    if (classStartTimeStr) {
      const classStartTime = new Date(classStartTimeStr);
      const minutesSinceClassStart = Math.floor((now.getTime() - classStartTime.getTime()) / (1000 * 60));
      
      // Class duration is 60 minutes max
      const classDuration = 60;
      const classEndTime = new Date(classStartTime.getTime() + classDuration * 60 * 1000);
      const targetReadyTime = new Date(classEndTime.getTime() - 10 * 60 * 1000); // 10 min before class ends
      const minutesUntilTargetReady = Math.floor((targetReadyTime.getTime() - now.getTime()) / (1000 * 60));
      
      // Format target ready time
      const readyTimeStr = targetReadyTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
      });
      
      // Class hasn't started yet
      if (minutesSinceClassStart < 0) {
        return { 
          level: "normal", 
          message: `Class starts at ${classStartTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`,
          readyBy: readyTimeStr,
          blink: false, 
          critical: false 
        };
      }
      
      // After 40 min from class start → CRITICAL RED (ultra vigorous)
      if (minutesSinceClassStart >= 40) {
        return { 
          level: "red", 
          message: `${minutesSinceClassStart} min since class start!`, 
          readyBy: readyTimeStr,
          blink: true, 
          critical: true 
        };
      }
      // After 20 min from class start → ORANGE
      else if (minutesSinceClassStart >= 20) {
        return { 
          level: "orange", 
          message: `${minutesSinceClassStart} min since class start`, 
          readyBy: readyTimeStr,
          blink: false, 
          critical: false 
        };
      }
      // After 10 min from class start → YELLOW
      else if (minutesSinceClassStart >= 10) {
        return { 
          level: "yellow", 
          message: `${minutesSinceClassStart} min since class start`, 
          readyBy: readyTimeStr,
          blink: false, 
          critical: false 
        };
      }
      // Less than 10 min from class start → NORMAL but show ready time
      else {
        return { 
          level: "normal", 
          message: `Ready by ${readyTimeStr}`, 
          readyBy: readyTimeStr,
          blink: false, 
          critical: false 
        };
      }
    } 
    // Standalone order (no class link) - use order age
    else {
      // 45+ minutes → RED BLINKING
      if (minutesSinceOrder >= 45) {
        return { 
          level: "red", 
          message: `${minutesSinceOrder} min waiting!`, 
          readyBy: "ASAP",
          blink: true, 
          critical: true 
        };
      }
      // 30-45 minutes → ORANGE
      else if (minutesSinceOrder >= 30) {
        return { 
          level: "orange", 
          message: `${minutesSinceOrder} min waiting`, 
          readyBy: "ASAP",
          blink: false, 
          critical: false 
        };
      }
      // 15-30 minutes → YELLOW
      else if (minutesSinceOrder >= 15) {
        return { 
          level: "yellow", 
          message: `${minutesSinceOrder} min waiting`, 
          readyBy: "Soon",
          blink: false, 
          critical: false 
        };
      }
    }
    
    return { level: "normal", message: "", readyBy: "", blink: false, critical: false };
  };

  // Helper function to format time REMAINING (countdown from 60 min)
  const formatTimeRemaining = (classStartTime: string | undefined) => {
    if (!classStartTime) return "—";
    const start = new Date(classStartTime);
    const classDuration = 60 * 60 * 1000; // 60 minutes in milliseconds
    const classEndTime = new Date(start.getTime() + classDuration);
    const remaining = Math.floor((classEndTime.getTime() - currentTime.getTime()) / 1000); // seconds remaining
    
    // Class hasn't started yet
    if (currentTime < start) {
      const minutesUntil = Math.abs(Math.floor((start.getTime() - currentTime.getTime()) / (1000 * 60)));
      return `Starts in ${minutesUntil} min`;
    }
    
    // Class is over
    if (remaining <= 0) {
      return `ENDED`;
    }
    
    // Show countdown
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleAddCategory = () => {
    if (!newCategory.id || !newCategory.label) return;
    
    const categoryId = newCategory.id.toLowerCase().replace(/\s+/g, '_');
    const exists = categories.find(c => c.id === categoryId);
    
    if (exists) {
      alert("Category ID already exists!");
      return;
    }
    
    setCategories([...categories, { id: categoryId, label: newCategory.label }]);
    setNewCategory({ id: "", label: "" });
    setShowCategoryForm(false);
  };

  const handleDeleteCategory = (categoryId: string) => {
    const itemsInCategory = menuItems.filter(item => item.category === categoryId);
    if (itemsInCategory.length > 0) {
      alert(`Cannot delete category: ${itemsInCategory.length} menu items are using it.`);
      return;
    }
    if (!confirm("Are you sure you want to delete this category?")) return;
    setCategories(categories.filter(c => c.id !== categoryId));
  };

  const handleEditCategory = (category: { id: string; label: string }) => {
    setEditingCategory(category);
    setNewCategory(category);
    setShowCategoryForm(true);
  };

  const handleUpdateCategory = () => {
    if (!editingCategory || !newCategory.label) return;
    setCategories(categories.map(c => 
      c.id === editingCategory.id ? { ...c, label: newCategory.label } : c
    ));
    setEditingCategory(null);
    setNewCategory({ id: "", label: "" });
    setShowCategoryForm(false);
  };

  const handleCancelCategory = () => {
    setShowCategoryForm(false);
    setEditingCategory(null);
    setNewCategory({ id: "", label: "" });
  };

  const openAddMenuForm = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      category: "smoothie_bowl",
      description: "",
      price: 0,
      image_url: "",
      is_available: true,
    });
    setImageUploadError(null);
    setUploadingImage(false);
    setShowForm(true);
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData(item);
    setImageUploadError(null);
    setShowForm(true);
  };

  async function getCroppedFile(src: string, pixelCrop: Area, originalFile: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }
        ctx.drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
        const MAX_BYTES = 10 * 1024 * 1024;
        const qualities = [0.92, 0.85, 0.75, 0.65, 0.5, 0.4];
        const tryNext = (i: number) => {
          const q = qualities[i] ?? 0.4;
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error("Compression failed")); return; }
            if (blob.size <= MAX_BYTES || i >= qualities.length - 1) {
              resolve(new File([blob], originalFile.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
            } else {
              tryNext(i + 1);
            }
          }, "image/jpeg", q);
        };
        tryNext(0);
      };
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = src;
    });
  }

  const handleMenuImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    setImageUploadError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageUploadError("Please choose an image file.");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
    setCropFile(file);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleCropConfirm = async () => {
    if (!cropSrc || !cropFile || !croppedAreaPixels) return;
    setUploadingImage(true);
    setCropSrc(null);
    try {
      const croppedFile = await getCroppedFile(cropSrc, croppedAreaPixels, cropFile);
      URL.revokeObjectURL(cropSrc);
      const fd = new FormData();
      fd.append("file", croppedFile);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Upload failed");
      const url = data?.url;
      if (typeof url !== "string" || !url) throw new Error("Invalid upload response");
      setFormData(prev => ({ ...prev, image_url: url }));
    } catch (err) {
      setImageUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingImage(false);
      setCropFile(null);
    }
  };

  const handleCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropFile(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this menu item?")) return;
    try {
      const res = await fetch(`/api/cafe/items?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to delete item");
        return;
      }
      fetchMenuItems();
    } catch (err) {
      console.error("Error deleting item:", err);
      alert("Failed to delete item");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name, category: formData.category,
        description: formData.description, price: formData.price,
        image_url: formData.image_url, is_available: formData.is_available,
      };
      if (editingItem?.id) {
        await fetch("/api/cafe/items", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingItem.id, ...payload }),
        });
      } else {
        await fetch("/api/cafe/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      setEditingItem(null);
      setImageUploadError(null);
      setFormData({ name: "", category: "smoothie_bowl", description: "", price: 0, image_url: "", is_available: true });
      fetchMenuItems();
    } catch (err) {
      console.error("Error saving item:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingItem(null);
    setImageUploadError(null);
    setUploadingImage(false);
    setFormData({
      name: "", category: "smoothie_bowl", description: "", price: 0, image_url: "", is_available: true
    });
  };

  // Seed default menu items to DB so Admin can manage them
  const seedDefaultItems = async () => {
    if (menuItems.length > 0) return;
    setIsSaving(true);
    const defaults = [
      { name: "Green Power Combo", category: "meal", description: "Green Smoothie, Salted Espresso, Cacao Protein Balls", price: 350, image_url: "/food/BAG09574.jpg", is_available: true },
      { name: "Savory Strength Combo", category: "meal", description: "Smoked Mushroom Toastie, Flat White, Cacao Protein Ball", price: 350, image_url: "/food/BAG02755.jpg", is_available: true },
      { name: "Miso Banana Bowl", category: "smoothie_bowl", description: "Banana, Granola, Miso Caramel, Seeds", price: 280, image_url: "/food/A7401864.jpg", is_available: true },
      { name: "Avocado Sourdough Toast", category: "meal", description: "Avocado, Sourdough, Cherry Tomatoes, Microgreens", price: 320, image_url: "/food/BAG02768.jpg", is_available: true }
    ];
    try {
      for (const item of defaults) {
        await fetch("/api/cafe/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
      }
      fetchMenuItems();
    } catch (e) {}
    setIsSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-sage" size={48} />
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Café Management - Admin"
        description="Manage café orders and menu items"
      />
      
      <style jsx global>{`
        @keyframes pulse-red {
          0%, 100% {
            border-color: rgb(220, 38, 38);
            box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.9);
            transform: scale(1);
          }
          50% {
            border-color: rgb(239, 68, 68);
            box-shadow: 0 0 0 12px rgba(220, 38, 38, 0);
            transform: scale(1.02);
          }
        }
        
        @keyframes pulse-orange {
          0%, 100% {
            border-color: rgb(249, 115, 22);
            box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.5);
          }
          50% {
            border-color: rgb(251, 146, 60);
            box-shadow: 0 0 0 6px rgba(249, 115, 22, 0);
          }
        }
        
        @keyframes pulse-red-urgent {
          0%, 100% {
            border-color: rgb(220, 38, 38);
            box-shadow: 0 0 0 0 rgba(220, 38, 38, 1), 0 0 20px rgba(220, 38, 38, 0.6);
            transform: scale(1);
          }
          25% {
            border-color: rgb(239, 68, 68);
            box-shadow: 0 0 0 8px rgba(220, 38, 38, 0.3), 0 0 30px rgba(220, 38, 38, 0.8);
            transform: scale(1.03);
          }
          50% {
            border-color: rgb(220, 38, 38);
            box-shadow: 0 0 0 16px rgba(220, 38, 38, 0), 0 0 40px rgba(220, 38, 38, 1);
            transform: scale(1.01);
          }
          75% {
            border-color: rgb(239, 68, 68);
            box-shadow: 0 0 0 8px rgba(220, 38, 38, 0.3), 0 0 30px rgba(220, 38, 38, 0.8);
            transform: scale(1.03);
          }
        }
      `}</style>
      
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <AdminPageHeader
              title="Café Management"
              subtitle={
                activeTab === "menu"
                  ? "Add, edit, and manage café menu items"
                  : activeTab === "categories"
                  ? "Manage food categories"
                  : "Track and manage incoming food orders"
              }
              actions={
                activeTab !== "orders" ? (
                  <Button
                    onClick={() => {
                      if (activeTab === "menu") {
                        openAddMenuForm();
                      } else {
                        setShowCategoryForm(true);
                      }
                    }}
                    className="bg-sage hover:bg-sage/90 text-white font-body"
                  >
                    <Plus size={20} className="mr-2" />
                    {activeTab === "menu" ? "Add Menu Item" : "Add Category"}
                  </Button>
                ) : null
              }
            />

            {/* Tab Navigation */}
            <div className="flex gap-3 mb-8 border-b border-sage/10">
              <button
                onClick={() => setActiveTab("menu")}
                className={`px-6 py-3 font-body text-sm transition-all duration-300 border-b-2 ${
                  activeTab === "menu"
                    ? "border-sage text-sage"
                    : "border-transparent text-charcoal/60 hover:text-charcoal"
                }`}
              >
                Menu Items
              </button>
              <button
                onClick={() => setActiveTab("categories")}
                className={`px-6 py-3 font-body text-sm transition-all duration-300 border-b-2 ${
                  activeTab === "categories"
                    ? "border-sage text-sage"
                    : "border-transparent text-charcoal/60 hover:text-charcoal"
                }`}
              >
                Categories
              </button>
              <button
                onClick={() => setActiveTab("orders")}
                className={`px-6 py-3 font-body text-sm transition-all duration-300 border-b-2 ${
                  activeTab === "orders"
                    ? "border-sage text-sage"
                    : "border-transparent text-charcoal/60 hover:text-charcoal"
                }`}
              >
                Orders
                {orders.filter(o => o.status === "pending").length > 0 && (
                  <Badge className="ml-2 bg-terracotta text-white">
                    {orders.filter(o => o.status === "pending").length}
                  </Badge>
                )}
              </button>
            </div>

            {/* Category Management Section */}
            {activeTab === "categories" && (
              <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
                <CardHeader className="border-b border-sage/10">
                  <div>
                    <CardTitle className="font-display text-2xl text-charcoal">Menu Categories</CardTitle>
                    <p className="font-body text-sm text-charcoal/60 mt-1">Manage food categories</p>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {categories.map(cat => (
                      <div
                        key={cat.id}
                        className="p-4 rounded-xl bg-cream/30 border border-sage/10 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-display text-lg text-charcoal">{cat.label}</p>
                          <p className="font-body text-xs text-charcoal/50">ID: {cat.id}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleEditCategory(cat)}
                            size="sm"
                            variant="ghost"
                            className="text-sage hover:bg-sage/10"
                          >
                            <Edit size={14} />
                          </Button>
                          <Button
                            onClick={() => handleDeleteCategory(cat.id)}
                            size="sm"
                            variant="ghost"
                            className="text-terracotta hover:bg-terracotta/10"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Menu Items Grid */}
            {activeTab === "menu" && (
              <>
                {menuItems.length === 0 ? (
                  <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
                    <CardContent className="flex flex-col items-center justify-center py-20">
                      <ImageIcon className="text-sage/40 mb-4" size={64} />
                      <h3 className="font-display text-2xl text-charcoal mb-2">No Menu Items Yet</h3>
                      <p className="font-body text-charcoal/60 mb-6">Start building your café menu by adding items</p>
                      <div className="flex gap-4">
                        <Button
                          onClick={openAddMenuForm}
                          className="bg-sage hover:bg-sage/90 text-white font-body"
                        >
                          <Plus size={20} className="mr-2" />
                          Add First Item
                        </Button>
                        <Button
                          onClick={seedDefaultItems}
                          variant="outline"
                          className="border-sage/30 text-sage hover:bg-sage/10 font-body"
                          disabled={isSaving}
                        >
                          Seed Default Menu Items
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {menuItems.map(item => (
                      <Card key={item.id} className="border-0 bg-white/80 backdrop-blur-xl shadow-lg flex flex-col h-full">
                        <div className="aspect-video w-full overflow-hidden rounded-t-xl bg-sage/5 shrink-0">
                          {item.image_url ? (
                            <img 
                              src={item.image_url} 
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="text-sage/40" size={48} />
                            </div>
                          )}
                        </div>
                        <CardContent className="p-6 flex flex-col flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <Badge variant="outline" className="mb-2 text-xs font-body border-sage/30 text-sage">
                                {categories.find(c => c.id === item.category)?.label || item.category}
                              </Badge>
                              <h3 className="font-display text-xl text-charcoal mb-1">{item.name}</h3>
                            </div>
                            <Badge className={item.is_available ? "bg-green-100 text-green-700 ml-2" : "bg-gray-100 text-gray-600 ml-2"}>
                              {item.is_available ? "Available" : "Unavailable"}
                            </Badge>
                          </div>
                          
                          <p className="font-body text-sm text-charcoal/70 mb-4 flex-1">{item.description}</p>
                          <p className="font-display text-2xl text-sage mb-4">₹{item.price}</p>
                          
                          <div className="flex gap-2 mt-auto">
                            <Button
                              onClick={() => handleEdit(item)}
                              variant="outline"
                              size="sm"
                              className="flex-1 border-sage/30 text-sage hover:bg-sage/10"
                            >
                              <Edit size={16} className="mr-2" />
                              Edit
                            </Button>
                            <Button
                              onClick={() => handleDelete(item.id!)}
                              variant="outline"
                              size="sm"
                              className="border-terracotta/30 text-terracotta hover:bg-terracotta/10"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Orders Section */}
            {activeTab === "orders" && (
              <div className="space-y-4">
                {/* Sub-tabs for Active vs History */}
                <div className="flex gap-2 border-b border-sage/10 mb-6">
                  <button
                    onClick={() => setOrderHistoryTab("active")}
                    className={`px-4 py-2 font-body text-sm transition-all duration-300 border-b-2 ${
                      orderHistoryTab === "active"
                        ? "border-sage text-sage"
                        : "border-transparent text-charcoal/60 hover:text-charcoal"
                    }`}
                  >
                    Active Orders
                    {orders.length > 0 && (
                      <Badge className="ml-2 bg-terracotta text-white text-xs">
                        {orders.length}
                      </Badge>
                    )}
                  </button>
                  <button
                    onClick={() => setOrderHistoryTab("history")}
                    className={`px-4 py-2 font-body text-sm transition-all duration-300 border-b-2 ${
                      orderHistoryTab === "history"
                        ? "border-sage text-sage"
                        : "border-transparent text-charcoal/60 hover:text-charcoal"
                    }`}
                  >
                    Order History
                  </button>
                </div>

                {/* Active Orders */}
                {orderHistoryTab === "active" && (
                  <>
                    {loadingOrders ? (
                      <div className="text-center py-12">
                        <Loader2 className="animate-spin mx-auto text-sage mb-4" size={48} />
                        <p className="font-body text-charcoal/60">Loading orders...</p>
                      </div>
                    ) : orders.length === 0 ? (
                      <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
                        <CardContent className="flex flex-col items-center justify-center py-20">
                          <ImageIcon className="text-sage/40 mb-4" size={64} />
                          <h3 className="font-display text-2xl text-charcoal mb-2">No Active Orders</h3>
                          <p className="font-body text-charcoal/60">New food orders will appear here</p>
                        </CardContent>
                      </Card>
                    ) : (
                      orders.map(order => {
                        const alertLevel = getOrderAlertLevel(order);
                        const cafeItem = order.cafe_item;
                        const userProfile = order.profile;
                        const booking = order.booking;
                        const schedule = booking?.class_schedule;
                        // Define animation classes based on urgency
                        let borderClass = "";
                        let animationClass = "";
                        
                        if (order.status === "pending" || order.status === "preparing") {
                          if (alertLevel.level === "red" && alertLevel.blink) {
                            borderClass = "border-4 border-red-600";
                            animationClass = alertLevel.critical 
                              ? "animate-[pulse-red-urgent_0.5s_ease-in-out_infinite]"
                              : "animate-[pulse-red_1s_ease-in-out_infinite]";
                          } else if (alertLevel.level === "orange") {
                            borderClass = "border-2 border-orange-500";
                            animationClass = "animate-[pulse-orange_2s_ease-in-out_infinite]";
                          } else if (alertLevel.level === "yellow") {
                            borderClass = "border-2 border-yellow-500";
                            animationClass = "";
                          }
                        }
                        
                        return (
                          <Card
                            key={order.id}
                            className={`border-0 bg-white/80 backdrop-blur-xl shadow-lg transition-all duration-300 ${borderClass} ${animationClass}`}
                          >
                            <CardContent className="p-6">
                              <div className="flex flex-col md:flex-row gap-6">
                                {/* Item Image */}
                                <div className="w-32 h-32 rounded-xl overflow-hidden bg-sage/5 shrink-0">
                                  {cafeItem?.image_url ? (
                                    <img 
                                      src={cafeItem.image_url} 
                                      alt={cafeItem.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <ImageIcon className="text-sage/40" size={32} />
                                    </div>
                                  )}
                                </div>

                                {/* Order Details */}
                                <div className="flex-1">
                                  <div className="flex items-start justify-between mb-4">
                                    <div>
                                      <h3 className="font-display text-xl text-charcoal mb-1">
                                        {cafeItem?.name}
                                      </h3>
                                      <p className="font-body text-sm text-charcoal/60">
                                        Quantity: {order.quantity}
                                      </p>
                                    </div>
                                    <Badge className={
                                      order.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                                      order.status === "preparing" ? "bg-blue-100 text-blue-700" :
                                      order.status === "ready" ? "bg-green-100 text-green-700" :
                                      "bg-gray-100 text-gray-600"
                                    }>
                                      {order.status.toUpperCase()}
                                    </Badge>
                                  </div>

                                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                                    {/* ALWAYS show class section if booking exists */}
                                    {booking && (
                                      <div className="md:col-span-2 p-4 rounded-lg bg-sage/5 border border-sage/20">
                                        <div className="flex items-start justify-between mb-2">
                                          <div className="flex-1">
                                            <p className="font-body text-xs text-charcoal/50 mb-1">🏋️ Linked Class</p>
                                            
                                            {/* Class name */}
                                            <p className="font-display text-xl text-charcoal mb-1">
                                              {schedule?.class_model?.name || booking?.class_name || "—"}
                                            </p>
                                            
                                            {/* Class time */}
                                            <p className="font-body text-sm text-charcoal/70">
                                              <strong>Class Time:</strong>{" "}
                                              {schedule?.start_time 
                                                ? new Date(schedule.start_time).toLocaleString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit"
                                                  })
                                                : booking?.class_time 
                                                  ? new Date(booking.class_time).toLocaleString("en-US", {
                                                      month: "short",
                                                      day: "numeric",
                                                      hour: "2-digit",
                                                      minute: "2-digit"
                                                    })
                                                  : "Time pending"
                                              }
                                            </p>
                                          </div>
                                          
                                          {/* COUNTDOWN Timer (60 min → 0) */}
                                          {(schedule?.start_time || booking?.class_time) && (
                                            <div className="text-right">
                                              <p className="font-body text-xs text-charcoal/50 mb-1">⏱️ Countdown</p>
                                              <p className={`font-mono text-2xl font-bold ${
                                                alertLevel.level === "red" ? "text-red-600" :
                                                alertLevel.level === "orange" ? "text-orange-600" :
                                                alertLevel.level === "yellow" ? "text-yellow-600" :
                                                "text-sage"
                                              }`}>
                                                {formatTimeRemaining(schedule?.start_time || booking?.class_time)}
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                        
                                        <div className="flex items-center gap-4 text-sm pt-2 border-t border-sage/10">
                                          {alertLevel.readyBy && (
                                            <p className="font-body text-sage font-semibold">
                                              <strong>Ready by:</strong> {alertLevel.readyBy}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    
                                    <div>
                                      <p className="font-body text-xs text-charcoal/50 mb-1">Customer</p>
                                      <p className="font-body text-sm text-charcoal">
                                        {userProfile?.full_name || "Unknown"}
                                      </p>
                                      <p className="font-body text-xs text-charcoal/50">
                                        {userProfile?.email}
                                      </p>
                                    </div>

                                    <div>
                                      <p className="font-body text-xs text-charcoal/50 mb-1">Order Time</p>
                                      <p className="font-body text-sm text-charcoal">
                                        {new Date(order.order_date).toLocaleString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit"
                                        })}
                                      </p>
                                      {alertLevel.level !== "normal" && alertLevel.message && (
                                        <p className={`font-body text-xs font-semibold ${
                                          alertLevel.level === "red" ? "text-red-600" :
                                          alertLevel.level === "orange" ? "text-orange-600" :
                                          "text-yellow-600"
                                        }`}>
                                          ⚠️ {alertLevel.message}
                                        </p>
                                      )}
                                    </div>

                                    <div className="md:col-span-2">
                                      <p className="font-body text-xs text-charcoal/50 mb-1">Total</p>
                                      <p className="font-display text-lg text-sage">
                                        ₹{Number(cafeItem?.price ?? 0) * order.quantity}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Status Update Buttons */}
                                  <div className="flex gap-2 flex-wrap">
                                    {order.status === "pending" && (
                                      <Button
                                        onClick={() => updateOrderStatus(order.id, "preparing")}
                                        size="sm"
                                        className="bg-blue-500 hover:bg-blue-600 text-white font-body"
                                      >
                                        Start Preparing
                                      </Button>
                                    )}
                                    {order.status === "preparing" && (
                                      <Button
                                        onClick={() => updateOrderStatus(order.id, "ready")}
                                        size="sm"
                                        className="bg-green-500 hover:bg-green-600 text-white font-body"
                                      >
                                        Mark Ready
                                      </Button>
                                    )}
                                    {order.status === "ready" && (
                                      <Button
                                        onClick={() => updateOrderStatus(order.id, "completed")}
                                        size="sm"
                                        className="bg-sage hover:bg-sage/90 text-white font-body"
                                      >
                                        Complete Order
                                      </Button>
                                    )}
                                    {/* Cancel button available at any status except completed */}
                                    {order.status !== "completed" && order.status !== "cancelled" && (
                                      <Button
                                        onClick={() => updateOrderStatus(order.id, "cancelled")}
                                        size="sm"
                                        variant="outline"
                                        className="border-red-500 text-red-600 hover:bg-red-50 font-body"
                                      >
                                        Cancel Order
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </>
                )}

                {/* Order History */}
                {orderHistoryTab === "history" && (
                  <>
                    {loadingHistory ? (
                      <div className="text-center py-12">
                        <Loader2 className="animate-spin mx-auto text-sage mb-4" size={48} />
                        <p className="font-body text-charcoal/60">Loading order history...</p>
                      </div>
                    ) : orderHistory.length === 0 ? (
                      <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
                        <CardContent className="flex flex-col items-center justify-center py-20">
                          <ImageIcon className="text-sage/40 mb-4" size={64} />
                          <h3 className="font-display text-2xl text-charcoal mb-2">No Order History</h3>
                          <p className="font-body text-charcoal/60">Completed orders will appear here</p>
                        </CardContent>
                      </Card>
                    ) : (
                      orderHistory.map(order => {
                        const cafeItem = order.cafe_item;
                        const userProfile = order.profile;
                        const booking = order.booking;
                        const schedule = booking?.class_schedule;
                        
                        return (
                          <Card
                            key={order.id}
                            className="border-0 bg-white/60 backdrop-blur-xl shadow-md opacity-80"
                          >
                            <CardContent className="p-6">
                              <div className="flex flex-col md:flex-row gap-6">
                                {/* Item Image */}
                                <div className="w-32 h-32 rounded-xl overflow-hidden bg-sage/5 shrink-0">
                                  {cafeItem?.image_url ? (
                                    <img 
                                      src={cafeItem.image_url} 
                                      alt={cafeItem.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <ImageIcon className="text-sage/40" size={32} />
                                    </div>
                                  )}
                                </div>

                                {/* Order Details */}
                                <div className="flex-1">
                                  <div className="flex items-start justify-between mb-4">
                                    <div>
                                      <h3 className="font-display text-xl text-charcoal mb-1">
                                        {cafeItem?.name}
                                      </h3>
                                      <p className="font-body text-sm text-charcoal/60">
                                        Quantity: {order.quantity}
                                      </p>
                                    </div>
                                    <Badge className={
                                      order.status === "completed" ? "bg-gray-100 text-gray-600" :
                                      "bg-red-100 text-red-700"
                                    }>
                                      {order.status.toUpperCase()}
                                    </Badge>
                                  </div>

                                  <div className="grid md:grid-cols-3 gap-4">
                                    {(schedule?.class_model || booking?.class_name) && (
                                      <div className="md:col-span-3 p-3 rounded-lg bg-sage/5 border border-sage/10">
                                        <p className="font-body text-xs text-charcoal/50 mb-1">🏋️ Class</p>
                                        <p className="font-body text-sm text-charcoal">
                                          {schedule?.class_model?.name || booking?.class_name}
                                          {' • '}
                                          {schedule?.start_time 
                                            ? new Date(schedule.start_time).toLocaleString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit"
                                              })
                                            : booking?.class_time
                                          }
                                        </p>
                                      </div>
                                    )}
                                    
                                    <div>
                                      <p className="font-body text-xs text-charcoal/50 mb-1">Customer</p>
                                      <p className="font-body text-sm text-charcoal">
                                        {userProfile?.full_name || "Unknown"}
                                      </p>
                                    </div>

                                    <div>
                                      <p className="font-body text-xs text-charcoal/50 mb-1">Order Time</p>
                                      <p className="font-body text-sm text-charcoal">
                                        {new Date(order.order_date).toLocaleString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit"
                                        })}
                                      </p>
                                    </div>

                                    <div>
                                      <p className="font-body text-xs text-charcoal/50 mb-1">Total</p>
                                      <p className="font-display text-lg text-charcoal/70">
                                        ₹{Number(cafeItem?.price ?? 0) * order.quantity}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </>
                )}
              </div>
            )}

          </div>
        </main>

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-charcoal/60 backdrop-blur-xs" onClick={handleCancel} />
            
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl flex flex-col">
              <div className="bg-white/95 backdrop-blur-xl border-b border-sage/10 p-6 z-10 shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-3xl text-charcoal">
                    {editingItem ? "Edit Menu Item" : "Add Menu Item"}
                  </h2>
                  <button
                    onClick={handleCancel}
                    className="w-10 h-10 rounded-full hover:bg-sage/10 flex items-center justify-center transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                <div>
                  <label className="font-body text-sm font-medium text-charcoal/80 mb-2 block">Item Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Miso Banana Bowl"
                    className="font-body"
                  />
                </div>

                <div>
                  <label className="font-body text-sm text-charcoal/70 mb-2 block">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-3 rounded-lg border border-sage/30 font-body"
                  >
                    {categories_display.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-body text-sm font-medium text-charcoal/80 mb-2 block">Description</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the item..."
                    rows={4}
                    className="font-body resize-none"
                  />
                </div>

                <div>
                  <label className="font-body text-sm font-medium text-charcoal/80 mb-2 block">Price (₹)</label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    placeholder="0"
                    className="font-body"
                  />
                </div>

                <div>
                  <label className="font-body text-sm font-medium text-charcoal/80 mb-2 block">Item photo</label>
                  <input
                    ref={menuPhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    id="cafe-menu-photo"
                    onChange={handleMenuImageFile}
                    disabled={uploadingImage}
                  />
                  <div className="flex flex-col gap-3">
                    {formData.image_url ? (
                      <div className="rounded-xl overflow-hidden border border-sage/20 bg-sage/5 max-h-56 w-full">
                        <img
                          src={formData.image_url}
                          alt=""
                          className="w-full h-48 object-cover"
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-sage/30 bg-sage/5 flex flex-col items-center justify-center py-10 text-charcoal/50">
                        <ImageIcon className="mb-2 opacity-60" size={40} />
                        <p className="font-body text-sm">No photo yet</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="font-body border-sage/30"
                        disabled={uploadingImage}
                        onClick={() => menuPhotoInputRef.current?.click()}
                      >
                        {uploadingImage ? (
                          <>
                            <Loader2 className="animate-spin mr-2" size={18} />
                            Uploading…
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2" size={18} />
                            {formData.image_url ? "Replace image" : "Choose image"}
                          </>
                        )}
                      </Button>
                      {formData.image_url ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="font-body text-terracotta hover:text-terracotta/90"
                          disabled={uploadingImage}
                          onClick={() => setFormData(prev => ({ ...prev, image_url: "" }))}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                    {imageUploadError ? (
                      <p className="text-sm text-red-600 font-body">{imageUploadError}</p>
                    ) : null}
                    <p className="text-xs text-charcoal/50 font-body">
                      Pick a photo from your device. JPEG, PNG, WebP, or GIF up to 10&nbsp;MB. Files are stored in{" "}
                      <span className="text-charcoal/70">public/uploads/</span>.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-sage/5 p-4 rounded-lg border border-sage/10">
                  <input
                    type="checkbox"
                    id="is_available"
                    checked={formData.is_available}
                    onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                    className="w-5 h-5 accent-sage cursor-pointer"
                  />
                  <label htmlFor="is_available" className="font-body text-charcoal cursor-pointer font-medium">
                    Item is currently available for order
                  </label>
                </div>
              </div>
              
              <div className="p-6 border-t border-sage/10 bg-white shrink-0 flex gap-3">
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="flex-1 border-charcoal/20 text-charcoal hover:bg-charcoal/5 h-12"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || uploadingImage || !formData.name || !formData.price}
                  className="flex-1 bg-sage hover:bg-sage/90 text-white h-12"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="animate-spin mr-2" size={18} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2" size={18} />
                      Save Menu Item
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Category Form Modal */}
        {showCategoryForm && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-charcoal/60 backdrop-blur-xs" onClick={handleCancelCategory} />
            
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl overflow-y-auto">
              <div className="sticky top-0 bg-white/95 backdrop-blur-xl border-b border-sage/10 p-6 z-10">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-3xl text-charcoal">
                    {editingCategory ? "Edit Category" : "Add New Category"}
                  </h2>
                  <button
                    onClick={handleCancelCategory}
                    className="w-10 h-10 rounded-full hover:bg-sage/10 flex items-center justify-center transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="font-body text-sm text-charcoal/70 mb-2 block">Category ID</label>
                  <Input
                    value={newCategory.id}
                    onChange={(e) => setNewCategory({ ...newCategory, id: e.target.value })}
                    placeholder="e.g., dessert"
                    className="font-body"
                    disabled={!!editingCategory}
                  />
                  <p className="font-body text-xs text-charcoal/50 mt-1">
                    Lowercase, use underscores for spaces (e.g., "hot_beverage")
                  </p>
                </div>

                <div>
                  <label className="font-body text-sm text-charcoal/70 mb-2 block">Category Label</label>
                  <Input
                    value={newCategory.label}
                    onChange={(e) => setNewCategory({ ...newCategory, label: e.target.value })}
                    placeholder="e.g., Dessert"
                    className="font-body"
                  />
                  <p className="font-body text-xs text-charcoal/50 mt-1">
                    Display name shown to users
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleCancelCategory}
                    variant="outline"
                    className="flex-1 border-sage/30 text-charcoal font-body"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={editingCategory ? handleUpdateCategory : handleAddCategory}
                    className="flex-1 bg-sage hover:bg-sage/90 text-white font-body"
                  >
                    {editingCategory ? "Update Category" : "Add Category"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image Crop Modal */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-sage/20">
              <h3 className="font-display text-lg text-charcoal">Adjust image</h3>
              <button onClick={handleCropCancel} className="text-charcoal/50 hover:text-charcoal">
                <X size={20} />
              </button>
            </div>
            <div className="relative bg-black" style={{ height: 360 }}>
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="font-body text-sm text-charcoal/60 w-12">Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-sage"
                />
              </div>
              <p className="font-body text-xs text-charcoal/40">Drag to reposition · pinch or use slider to zoom</p>
              <div className="flex gap-3 justify-end pt-1">
                <Button variant="outline" className="font-body border-sage/20" onClick={handleCropCancel}>
                  Cancel
                </Button>
                <Button className="font-body bg-sage hover:bg-sage/90 text-white" onClick={handleCropConfirm}>
                  Use this image
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}