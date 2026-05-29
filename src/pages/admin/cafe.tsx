import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { mutate as swrMutate } from "swr";
import Image from "next/image";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

// Admin OR chef (kitchen role uses the same café page).
export const getServerSideProps = requireSessionSSP({ roles: ["admin", "chef"] });

import type CropperType from "react-easy-crop";
import type { Area } from "react-easy-crop";

// react-easy-crop is only mounted when the user actually opens the image-crop
// modal. Dynamic-import + ssr:false keeps it out of the admin/cafe initial
// bundle. Cast back to the typed component so JSX props still type-check.
const Cropper = dynamic(() => import("react-easy-crop"), {
  ssr: false,
}) as unknown as typeof CropperType;
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
  Save,
  Image as ImageIcon,
  Upload,
  Search,
  LayoutGrid,
  UtensilsCrossed,
  Tags,
  ClipboardList,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { CloseButton, EditButton, DeleteButton } from "@/components/ui/quick-actions";

import { cdnUrl } from "@/lib/cdnUrl";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { MenuItemCard } from "@/components/cafe/MenuItemCard";
// CafeStats pulls in recharts (~300KB+) but only renders behind the Overview
// tab. Dynamic-import keeps recharts out of the admin/cafe initial bundle.
const CafeStats = dynamic(
  () => import("@/components/cafe/CafeStats").then((m) => m.CafeStats),
  { ssr: false },
);
import { OrderStatusTimeline } from "@/components/cafe/OrderStatusTimeline";
import type { CafeMenuItem } from "@/components/cafe/types";
interface MenuItem {
  id?: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image_url: string;
  image_file_id?: string | null;
  is_available: boolean;
}

const CAFE_TABS = [
  { v: "menu", l: "Menu Items", I: UtensilsCrossed },
  { v: "overview", l: "Overview", I: LayoutGrid },
  { v: "categories", l: "Categories", I: Tags },
  { v: "orders", l: "Orders", I: ClipboardList },
] as const;

function CafeMenuLoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Menu item card grid — mirrors café item cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card
            key={i}
            className="border border-border bg-white-warm shadow-none ring-0 flex flex-col h-full"
          >
            {/* Image */}
            <Skeleton className="aspect-video w-full rounded-t-xl rounded-b-none shrink-0" />
            <CardContent className="p-6 flex flex-col flex-1">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 space-y-2">
                  {/* Category badge */}
                  <Skeleton className="h-5 w-20 rounded-full" />
                  {/* Title */}
                  <Skeleton className="h-6 w-3/4" />
                </div>
                {/* Availability badge */}
                <Skeleton className="h-6 w-20 rounded-full ml-2" />
              </div>
              {/* Description */}
              <div className="mb-4 flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              {/* Price */}
              <Skeleton className="h-7 w-16 mb-4" />
              {/* Edit / Delete buttons */}
              <div className="flex gap-2 mt-auto">
                <Skeleton className="h-9 flex-1 rounded-md" />
                <Skeleton className="h-9 w-10 rounded-md" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
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
  const [activeTab, setActiveTab] = useState<"overview" | "menu" | "categories" | "orders">("menu");
  const [menuSearch, setMenuSearch] = useState("");
  const [orderHistoryTab, setOrderHistoryTab] = useState<"active" | "history">("active");
  
  // Orders state
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const categories_display = categories;

  // Build id → label Map once per categories change. Replaces `categories.find()`
  // per row in the menu items table (was O(items × categories)).
  const categoryLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.label);
    return m;
  }, [categories]);

  const filteredMenuItems = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (categoryLabelById.get(item.category) ?? item.category)
          .toLowerCase()
          .includes(q),
    );
  }, [menuItems, menuSearch, categoryLabelById]);

  const { data: session, status } = useSession();

  const userRole = (session?.user as { role?: string })?.role;
  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated" && userRole !== "admin" && userRole !== "chef") { router.push("/login"); return; }
    if (status === "authenticated") {
      fetchMenuItems();
      fetchAllOrders();
    }

    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    const pollingInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchAllOrders();
    }, 10000);
    return () => {
      clearInterval(timeInterval);
      clearInterval(pollingInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole]);

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

  // Single fetch — derive active/history client-side. Replaces two duplicate calls.
  const fetchAllOrders = async () => {
    setLoadingOrders(true);
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/cafe/orders");
      const data: any[] = res.ok ? await res.json() : [];
      const active = data.filter((o: { status: string }) => !["completed", "cancelled"].includes(o.status));
      const history = data.filter((o: { status: string }) => ["completed", "cancelled"].includes(o.status));
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
      setOrderHistory(history);
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoadingOrders(false);
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
      await fetchAllOrders();
    } catch (err) {
      console.error("Error updating order status:", err);
      toast.error("Failed to update order status. Please try again.");
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
      toast.error("Category ID already exists!");
      return;
    }
    
    setCategories([...categories, { id: categoryId, label: newCategory.label }]);
    setNewCategory({ id: "", label: "" });
    setShowCategoryForm(false);
  };

  const handleDeleteCategory = (categoryId: string) => {
    const itemsInCategory = menuItems.filter(item => item.category === categoryId);
    if (itemsInCategory.length > 0) {
      toast.error(`Cannot delete category: ${itemsInCategory.length} menu items are using it.`);
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
      const img = new window.Image();
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
      fd.append("purpose", "cafe_item_image");
      if (editingItem?.id) fd.append("ownerId", editingItem.id);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Upload failed");
      const url = data?.url;
      if (typeof url !== "string" || !url) throw new Error("Invalid upload response");
      const fileId = typeof data?.fileId === "string" ? data.fileId : null;
      setFormData(prev => ({ ...prev, image_url: url, image_file_id: fileId }));
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
        toast.error(data.error ?? "Failed to delete item");
        return;
      }
      fetchMenuItems();
      // Member-facing menu (/portal/menu, /portal/book) reads the same
      // endpoint via SWR — bust their cache so the item disappears live.
      void swrMutate("/api/cafe/items?available=true");
    } catch (err) {
      console.error("Error deleting item:", err);
      toast.error("Failed to delete item");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name, category: formData.category,
        description: formData.description, price: formData.price,
        image_url: formData.image_url, image_file_id: formData.image_file_id ?? null,
        is_available: formData.is_available,
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
      void swrMutate("/api/cafe/items?available=true");
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
      { name: "Green Power Combo", category: "meal", description: "Green Smoothie, Salted Espresso, Cacao Protein Balls", price: 350, image_url: cdnUrl("/food/BAG09574.jpg"), is_available: true },
      { name: "Savory Strength Combo", category: "meal", description: "Smoked Mushroom Toastie, Flat White, Cacao Protein Ball", price: 350, image_url: cdnUrl("/food/BAG02755.jpg"), is_available: true },
      { name: "Miso Banana Bowl", category: "smoothie_bowl", description: "Banana, Granola, Miso Caramel, Seeds", price: 280, image_url: cdnUrl("/food/A7401864.jpg"), is_available: true },
      { name: "Avocado Sourdough Toast", category: "meal", description: "Avocado, Sourdough, Cherry Tomatoes, Microgreens", price: 320, image_url: cdnUrl("/food/BAG02768.jpg"), is_available: true }
    ];
    try {
      for (const item of defaults) {
        await fetch("/api/cafe/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
      }
      fetchMenuItems();
      void swrMutate("/api/cafe/items?available=true");
    } catch (e) {}
    setIsSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <CafeMenuLoadingSkeleton />
          </div>
        </main>
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
                activeTab === "overview"
                  ? "Café performance at a glance"
                  : activeTab === "menu"
                  ? "Add, edit, and manage café menu items"
                  : activeTab === "categories"
                  ? "Manage food categories"
                  : "Track and manage incoming food orders"
              }
              actions={
                activeTab === "categories" ? (
                  <Button onClick={() => setShowCategoryForm(true)} variant="sage">
                    <Plus size={20} className="mr-2" />
                    Add Category
                  </Button>
                ) : null
              }
            />

            {/* Tabs — same design as the admin dashboard (mobile Select + desktop segmented) */}
            <div className="mb-8">
              <Select
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as typeof activeTab)}
              >
                <SelectTrigger className="w-full border-sage/20 font-body md:hidden">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAFE_TABS.map((t) => (
                    <SelectItem key={t.v} value={t.v} className="font-body">
                      {t.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="hidden w-auto flex-wrap justify-start gap-1 rounded-lg border border-sage/15 bg-cream/50 p-1 md:inline-flex">
                {CAFE_TABS.map((t) => {
                  const active = activeTab === t.v;
                  const pendingCount = orders.filter((o) => o.status === "pending").length;
                  return (
                    <button
                      key={t.v}
                      onClick={() => setActiveTab(t.v)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-body text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sage ${
                        active
                          ? "bg-sage text-white shadow-xs"
                          : "text-charcoal/60 hover:text-charcoal"
                      }`}
                    >
                      <t.I className="h-4 w-4" />
                      {t.l}
                      {t.v === "orders" && pendingCount > 0 && (
                        <span
                          className={`rounded-full px-1.5 text-xs ${
                            active ? "bg-white/20 text-white" : "bg-terracotta text-white"
                          }`}
                        >
                          {pendingCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Overview Section */}
            {activeTab === "overview" && (
              <CafeStats orders={[...orders, ...orderHistory]} />
            )}

            {/* Category Management Section */}
            {activeTab === "categories" && (
              <Card className="border border-border bg-white-warm shadow-none ring-0">
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
                          <EditButton onClick={() => handleEditCategory(cat)} />
                          <DeleteButton onClick={() => handleDeleteCategory(cat.id)} />
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
                  <Card className="border border-border bg-white-warm shadow-none ring-0">
                    <CardContent className="flex flex-col items-center justify-center py-20">
                      <ImageIcon className="text-sage/40 mb-4" size={64} />
                      <h3 className="font-display text-2xl text-charcoal mb-2">No Menu Items Yet</h3>
                      <p className="font-body text-charcoal/60 mb-6">Start building your café menu by adding items</p>
                      <div className="flex gap-4">
                        <Button
                          onClick={openAddMenuForm}
                          variant="sage"
                        >
                          <Plus size={20} className="mr-2" />
                          Add First Item
                        </Button>
                        <Button
                          onClick={seedDefaultItems}
                          variant="sage-outline"
                          className="font-body"
                          disabled={isSaving}
                        >
                          Seed Default Menu Items
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="relative w-full sm:max-w-md">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-charcoal/40" />
                        <Input
                          value={menuSearch}
                          onChange={(e) => setMenuSearch(e.target.value)}
                          placeholder="Search menu items…"
                          className="h-11 rounded-full border-border bg-white-warm pl-10 font-body"
                          aria-label="Search menu items"
                        />
                      </div>
                      <Button onClick={openAddMenuForm} variant="sage" className="shrink-0">
                        <Plus size={18} className="mr-2" />
                        Add Menu Item
                      </Button>
                    </div>

                    {filteredMenuItems.length === 0 ? (
                      <div className="rounded-2xl border border-border bg-white-warm py-16 text-center">
                        <p className="font-body text-charcoal/70">
                          No menu items match “{menuSearch}”.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredMenuItems.map((item, i) => (
                          <MenuItemCard
                            key={item.id}
                            item={item as CafeMenuItem}
                            index={i}
                            categoryLabel={categoryLabelById.get(item.category) || item.category}
                            badge={
                              !item.is_available ? (
                                <Badge className="bg-terracotta text-white-warm">
                                  Unavailable
                                </Badge>
                              ) : undefined
                            }
                          >
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleEdit(item)}
                                variant="sage-outline"
                                size="sm"
                                className="flex-1"
                              >
                                <Edit size={16} className="mr-2" />
                                Edit
                              </Button>
                              <DeleteButton onClick={() => handleDelete(item.id!)} />
                            </div>
                          </MenuItemCard>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Orders Section */}
            {activeTab === "orders" && (
              <div className="space-y-4">
                {/* Sub-tabs for Active vs History — pill segmented control */}
                <div className="mb-6 inline-flex items-center gap-1 rounded-full border border-border bg-white-warm p-1">
                  <button
                    onClick={() => setOrderHistoryTab("active")}
                    aria-pressed={orderHistoryTab === "active"}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-full px-5 py-2 font-body text-sm transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-sage ${
                      orderHistoryTab === "active"
                        ? "bg-sage text-white-warm"
                        : "text-charcoal/60 hover:text-charcoal"
                    }`}
                  >
                    Active Orders
                    {orders.length > 0 && (
                      <span
                        className={`rounded-full px-1.5 text-xs ${
                          orderHistoryTab === "active"
                            ? "bg-white-warm/20 text-white-warm"
                            : "bg-terracotta text-white-warm"
                        }`}
                      >
                        {orders.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setOrderHistoryTab("history")}
                    aria-pressed={orderHistoryTab === "history"}
                    className={`whitespace-nowrap rounded-full px-5 py-2 font-body text-sm transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-sage ${
                      orderHistoryTab === "history"
                        ? "bg-sage text-white-warm"
                        : "text-charcoal/60 hover:text-charcoal"
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
                        <Spinner className="mx-auto size-12 text-sage mb-4" />
                        <p className="font-body text-charcoal/60">Loading orders...</p>
                      </div>
                    ) : orders.length === 0 ? (
                      <Card className="border border-border bg-white-warm shadow-none ring-0">
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
                        
                        const classTime = schedule?.start_time ?? booking?.class_time ?? null;
                        const statusPill =
                          order.status === "pending" ? "bg-sand text-charcoal" :
                          order.status === "preparing" ? "bg-terracotta/15 text-terracotta" :
                          order.status === "ready" ? "bg-sage/15 text-sage" :
                          "bg-sand text-charcoal/60";
                        const urgencyText =
                          alertLevel.level === "red" ? "text-red-600" :
                          alertLevel.level === "orange" ? "text-orange-600" :
                          alertLevel.level === "yellow" ? "text-yellow-600" :
                          "text-sage";

                        return (
                          <Card
                            key={order.id}
                            className={`overflow-hidden bg-white-warm shadow-none ring-0 transition-all duration-300 ${borderClass || "border border-border"} ${animationClass}`}
                          >
                            <CardContent className="p-5 sm:p-6">
                              {/* Header: thumb · name/meta · status */}
                              <div className="flex gap-4">
                                <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-sand/40 sm:size-20">
                                  {cafeItem?.image_url ? (
                                    <Image
                                      src={cafeItem.image_url}
                                      alt={cafeItem.name}
                                      width={160}
                                      height={160}
                                      className="h-full w-full object-cover"
                                      unoptimized
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <ImageIcon className="text-sage/40" size={28} />
                                    </div>
                                  )}
                                </div>

                                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <h3 className="truncate font-display text-xl leading-snug text-charcoal">
                                      {cafeItem?.name}
                                    </h3>
                                    <p className="mt-0.5 font-body text-sm text-charcoal/60">
                                      Qty {order.quantity}
                                      <span className="mx-1.5 text-charcoal/30">·</span>
                                      <span className="font-medium text-charcoal">
                                        ₹{(Number(cafeItem?.price ?? 0) * order.quantity).toLocaleString("en-IN")}
                                      </span>
                                    </p>
                                  </div>
                                  <span className={`shrink-0 rounded-full px-3 py-1 font-body text-[0.7rem] font-semibold uppercase tracking-[0.06em] ${statusPill}`}>
                                    {order.status}
                                  </span>
                                </div>
                              </div>

                              <OrderStatusTimeline status={order.status} className="mt-5 max-w-md" />

                              {/* Linked class strip */}
                              {booking && (
                                <div className="mt-5 rounded-xl border border-border bg-sand/30 p-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                      <p className="font-body text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-terracotta">
                                        Linked class
                                      </p>
                                      <p className="mt-1 font-display text-lg leading-snug text-charcoal">
                                        {schedule?.class_model?.name || booking?.class_name || "—"}
                                      </p>
                                      <p className="mt-0.5 font-body text-sm text-charcoal/60">
                                        {classTime
                                          ? new Date(classTime).toLocaleString("en-US", {
                                              month: "short",
                                              day: "numeric",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })
                                          : "Time pending"}
                                      </p>
                                    </div>
                                    {classTime && (
                                      <div className="shrink-0 text-right">
                                        <p className="font-body text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-charcoal/45">
                                          Countdown
                                        </p>
                                        <p className={`font-mono text-2xl font-bold tabular-nums ${urgencyText}`}>
                                          {formatTimeRemaining(classTime)}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                  {alertLevel.readyBy && (
                                    <p className="mt-3 border-t border-border pt-2 font-body text-sm font-semibold text-sage">
                                      Ready by {alertLevel.readyBy}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Customer · order time */}
                              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <div>
                                  <p className="font-body text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-charcoal/45">
                                    Customer
                                  </p>
                                  <p className="mt-1 font-body text-sm text-charcoal">
                                    {userProfile?.full_name || "Unknown"}
                                  </p>
                                  {userProfile?.email && (
                                    <p className="font-body text-xs text-charcoal/50">
                                      {userProfile.email}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <p className="font-body text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-charcoal/45">
                                    Ordered
                                  </p>
                                  <p className="mt-1 font-body text-sm text-charcoal">
                                    {new Date(order.order_date).toLocaleString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                  {alertLevel.level !== "normal" && alertLevel.message && (
                                    <p className={`font-body text-xs font-semibold ${urgencyText}`}>
                                      ⚠️ {alertLevel.message}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                                {order.status === "pending" && (
                                  <Button
                                    onClick={() => updateOrderStatus(order.id, "preparing")}
                                    size="sm"
                                    variant="terracotta"
                                  >
                                    Start preparing
                                  </Button>
                                )}
                                {order.status === "preparing" && (
                                  <Button
                                    onClick={() => updateOrderStatus(order.id, "ready")}
                                    size="sm"
                                    variant="sage"
                                  >
                                    Mark ready
                                  </Button>
                                )}
                                {order.status === "ready" && (
                                  <Button
                                    onClick={() => updateOrderStatus(order.id, "completed")}
                                    size="sm"
                                    variant="sage"
                                  >
                                    Complete order
                                  </Button>
                                )}
                                {order.status !== "completed" && order.status !== "cancelled" && (
                                  <Button
                                    onClick={() => updateOrderStatus(order.id, "cancelled")}
                                    size="sm"
                                    variant="outline"
                                    className="border-red-500/60 text-red-600 hover:bg-red-50 hover:text-red-700 font-body"
                                  >
                                    Cancel
                                  </Button>
                                )}
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
                        <Spinner className="mx-auto size-12 text-sage mb-4" />
                        <p className="font-body text-charcoal/60">Loading order history...</p>
                      </div>
                    ) : orderHistory.length === 0 ? (
                      <Card className="border border-border bg-white-warm shadow-none ring-0">
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
                            className="border border-border bg-white-warm shadow-none ring-0 opacity-90"
                          >
                            <CardContent className="p-5 sm:p-6">
                              <div className="flex gap-4">
                                <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-sand/40">
                                  {cafeItem?.image_url ? (
                                    <Image
                                      src={cafeItem.image_url}
                                      alt={cafeItem.name}
                                      width={128}
                                      height={128}
                                      className="h-full w-full object-cover"
                                      unoptimized
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <ImageIcon className="text-sage/40" size={24} />
                                    </div>
                                  )}
                                </div>

                                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <h3 className="truncate font-display text-lg leading-snug text-charcoal">
                                      {cafeItem?.name}
                                    </h3>
                                    <p className="mt-0.5 font-body text-sm text-charcoal/60">
                                      Qty {order.quantity}
                                      <span className="mx-1.5 text-charcoal/30">·</span>
                                      <span className="font-medium text-charcoal/80">
                                        ₹{(Number(cafeItem?.price ?? 0) * order.quantity).toLocaleString("en-IN")}
                                      </span>
                                    </p>
                                  </div>
                                  <span className={`shrink-0 rounded-full px-3 py-1 font-body text-[0.7rem] font-semibold uppercase tracking-[0.06em] ${
                                    order.status === "completed" ? "bg-sand text-charcoal/60" : "bg-red-500/10 text-red-600"
                                  }`}>
                                    {order.status}
                                  </span>
                                </div>
                              </div>

                              <OrderStatusTimeline status={order.status} className="mt-5 max-w-md" />

                              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 font-body text-sm">
                                {(schedule?.class_model || booking?.class_name) && (
                                  <span className="text-charcoal/70">
                                    <span className="text-charcoal/45">Class</span>{" "}
                                    {schedule?.class_model?.name || booking?.class_name}
                                  </span>
                                )}
                                <span className="text-charcoal/70">
                                  <span className="text-charcoal/45">Customer</span>{" "}
                                  {userProfile?.full_name || "Unknown"}
                                </span>
                                <span className="text-charcoal/70">
                                  <span className="text-charcoal/45">Ordered</span>{" "}
                                  {new Date(order.order_date).toLocaleString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
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

        {/* Add/Edit Form Drawer (vaul, slides from right) */}
        <Drawer
          direction="right"
          open={showForm}
          onOpenChange={(o) => { if (!o) handleCancel(); }}
        >
          <DrawerContent direction="right" className="max-w-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-sage/10 p-6">
              <DrawerTitle className="font-display text-3xl text-charcoal">
                {editingItem ? "Edit Menu Item" : "Add Menu Item"}
              </DrawerTitle>
              <CloseButton onClick={handleCancel} className="rounded-full" />
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-6">
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
                        <Image
                          src={formData.image_url}
                          alt=""
                          width={640}
                          height={192}
                          className="w-full h-48 object-cover"
                          unoptimized
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
                        variant="sage-outline"
                        className="font-body"
                        disabled={uploadingImage}
                        onClick={() => menuPhotoInputRef.current?.click()}
                      >
                        {uploadingImage ? (
                          <>
                            <Spinner className="mr-2 size-4" />
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
                          variant="terracotta-ghost"
                          className="font-body"
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
              
              <div className="p-6 border-t border-sage/10 bg-white-warm shrink-0 flex gap-3">
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="flex-1 border-charcoal/20 text-charcoal hover:bg-charcoal/5 hover:text-charcoal h-12"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || uploadingImage || !formData.name || !formData.price}
                  variant="sage"
                  className="flex-1 h-12"
                >
                  {isSaving ? (
                    <>
                      <Spinner className="mr-2 size-4" />
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
            </DrawerContent>
          </Drawer>

        {/* Category Form Drawer (vaul, slides from right) */}
        <Drawer
          direction="right"
          open={showCategoryForm}
          onOpenChange={(o) => { if (!o) handleCancelCategory(); }}
        >
          <DrawerContent direction="right" className="max-w-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-sage/10 p-6">
              <DrawerTitle className="font-display text-3xl text-charcoal">
                {editingCategory ? "Edit Category" : "Add New Category"}
              </DrawerTitle>
              <CloseButton onClick={handleCancelCategory} className="rounded-full" />
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-6">
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
                    variant="sage"
                    className="flex-1"
                  >
                    {editingCategory ? "Update Category" : "Add Category"}
                  </Button>
                </div>
              </div>
            </DrawerContent>
          </Drawer>
      </div>

      {/* Image Crop Modal */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-white-warm rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-sage/20">
              <h3 className="font-display text-lg text-charcoal">Adjust image</h3>
              <CloseButton onClick={handleCropCancel} />
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
                <Button variant="sage-outline" onClick={handleCropCancel}>
                  Cancel
                </Button>
                <Button variant="sage" onClick={handleCropConfirm}>
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
