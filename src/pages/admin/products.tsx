import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });
import { SEO } from "@/components/SEO";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { EditButton, DeleteButton } from "@/components/ui/quick-actions";
import { Pill } from "@/components/ui/pill";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FilterBar, FilterSearch, FilterSelect, useFilterState } from "@/components/filters";
import {
  Package,
  Plus,
  Edit,
  Trash2,
  X,
  Check,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Eye,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

import { cdnUrl } from "@/lib/cdnUrl";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { toast } from "sonner";
interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  inStock: boolean;
  featured: boolean;
  description: string;
  image: string;
  sales: number;
}

interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  items: { productId: string; productName: string; quantity: number; price: number }[];
  total: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  paymentMethod: "online" | "studio";
  orderDate: string;
  shippingAddress: string;
}

type CategoryRow = { id: string; name: string };

interface RetailProductApi {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  featured: boolean;
  sales_count: number;
  is_active: boolean;
}

function apiToProduct(r: RetailProductApi): Product {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    price: r.price,
    stock: r.stock,
    inStock: r.stock > 0 && r.is_active,
    featured: r.featured,
    description: r.description ?? "",
    image: r.image_url || cdnUrl("/placeholder.jpg"),
    sales: r.sales_count ?? 0,
  };
}

function prettifyCatId(id: string) {
  const known: Record<string, string> = {
    aromatherapy: "Aromatherapy",
    mindfulness: "Mindfulness",
    "personal-care": "Personal Care",
    wellness: "Wellness",
    athleisure: "Athleisure",
  };
  return known[id] ?? id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const DEFAULT_CATEGORY_PRESETS: CategoryRow[] = [
  { id: "aromatherapy", name: "Aromatherapy" },
  { id: "mindfulness", name: "Mindfulness" },
  { id: "personal-care", name: "Personal Care" },
  { id: "wellness", name: "Wellness" },
  { id: "athleisure", name: "Athleisure" },
];

export default function AdminProducts() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<"products" | "orders" | "categories">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>(DEFAULT_CATEGORY_PRESETS);
  const f = useFilterState(
    { search: "", category: "all", stock: "all", featured: "all" },
    { urlSync: true }
  );
  const [showProductForm, setShowProductForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  // Pagination
  const [productPage, setProductPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const itemsPerPage = 10;

  // Product form state
  const [formData, setFormData] = useState({
    name: "",
    category: "aromatherapy",
    price: "",
    stock: "",
    description: "",
    featured: false,
    images: ["", "", "", ""]
  });

  // Category form state
  const [categoryFormData, setCategoryFormData] = useState({
    id: "",
    name: ""
  });

  // Build the id→name Map once; categoryRows is a sorted view of it for selects.
  const categoryById = useMemo((): Map<string, string> => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.name));
    products.forEach((p) => {
      if (p.category) m.set(p.category, prettifyCatId(p.category));
    });
    return m;
  }, [products, categories]);
  const categoryRows = useMemo((): CategoryRow[] => {
    return [...categoryById.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categoryById]);

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "All categories" },
      ...categoryRows.map((c) => ({ value: c.id, label: c.name })),
    ],
    [categoryRows]
  );

  const loadRetail = useCallback(async () => {
    const [prRes, ordRes] = await Promise.all([
      fetch("/api/admin/retail-products?all=true"),
      fetch("/api/admin/retail-orders"),
    ]);
    if (prRes.ok) {
      const rows: RetailProductApi[] = await prRes.json();
      setProducts(rows.map(apiToProduct));
    }
    if (ordRes.ok) {
      setOrders(await ordRes.json());
    }
  }, []);

  // Calculate stats — single pass over orders rather than three separate scans.
  const orderStats = useMemo(() => {
    let totalRevenue = 0;
    let pendingOrders = 0;
    for (const o of orders) {
      totalRevenue += o.total;
      if (o.status === "pending" || o.status === "processing") pendingOrders += 1;
    }
    const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
    return { totalRevenue, pendingOrders, avgOrderValue };
  }, [orders]);
  const totalProducts = products.length;
  const { totalRevenue, pendingOrders, avgOrderValue } = orderStats;

  // Filter products — toLowerCase the haystack once, not twice per product.
  const filteredProducts = useMemo(() => {
    const q = f.values.search.trim().toLowerCase();
    return products.filter((p) => {
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      const matchCategory = f.values.category === "all" || p.category === f.values.category;
      const matchStock =
        f.values.stock === "all" ||
        (f.values.stock === "in" ? p.inStock : !p.inStock);
      const matchFeatured = f.values.featured === "all" || p.featured;
      return matchSearch && matchCategory && matchStock && matchFeatured;
    });
  }, [products, f.values]);

  const paginatedProducts = useMemo(
    () => filteredProducts.slice((productPage - 1) * itemsPerPage, productPage * itemsPerPage),
    [filteredProducts, productPage, itemsPerPage],
  );

  const paginatedOrders = useMemo(
    () => orders.slice((orderPage - 1) * itemsPerPage, orderPage * itemsPerPage),
    [orders, orderPage, itemsPerPage],
  );

  const totalProductPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const totalOrderPages = Math.ceil(orders.length / itemsPerPage);

  const handleAddProduct = async () => {
    if (!formData.name || !formData.price || !formData.stock || !formData.description) {
      toast.error("Please fill all required fields");
      return;
    }

    const primaryImage =
      formData.images.find((u) => u.trim())?.trim() || cdnUrl("/food/A7401864.jpg");

    try {
      const res = await fetch("/api/admin/retail-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          category: formData.category,
          price: parseInt(formData.price, 10),
          stock: parseInt(formData.stock, 10),
          description: formData.description,
          image_url: primaryImage,
          featured: formData.featured,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as { error?: string }).error ?? "Could not save product");
        return;
      }
      await loadRetail();
      resetForm();
    } catch {
      toast.error("Could not save product");
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct || !formData.name || !formData.price || !formData.stock || !formData.description) {
      toast.error("Please fill all required fields");
      return;
    }

    const primaryImage =
      formData.images.find((u) => u.trim())?.trim() || editingProduct.image;

    try {
      const res = await fetch("/api/admin/retail-products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingProduct.id,
          name: formData.name,
          category: formData.category,
          price: parseInt(formData.price, 10),
          stock: parseInt(formData.stock, 10),
          description: formData.description,
          image_url: primaryImage,
          featured: formData.featured,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as { error?: string }).error ?? "Could not update product");
        return;
      }
      await loadRetail();
      resetForm();
    } catch {
      toast.error("Could not update product");
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      price: product.price.toString(),
      stock: product.stock.toString(),
      description: product.description,
      featured: product.featured,
      images: [product.image, "", "", ""],
    });
    setShowProductForm(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await fetch(`/api/admin/retail-products?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Could not delete product");
        return;
      }
      await loadRetail();
    } catch {
      toast.error("Could not delete product");
    }
  };

  const resetForm = () => {
    setShowProductForm(false);
    setEditingProduct(null);
    setFormData({
      name: "",
      category: "aromatherapy",
      price: "",
      stock: "",
      description: "",
      featured: false,
      images: ["", "", "", ""],
    });
  };

  const handleAddCategory = () => {
    if (!categoryFormData.name.trim()) {
      toast.error("Please enter a category name");
      return;
    }

    const newId = categoryFormData.name.toLowerCase().replace(/\s+/g, "-");
    const newCategory = {
      id: newId,
      name: categoryFormData.name,
    };

    setCategories([...categories, newCategory]);
    resetCategoryForm();
  };

  const handleUpdateCategory = () => {
    if (!editingCategory || !categoryFormData.name.trim()) {
      toast.error("Please enter a category name");
      return;
    }

    const updatedCategories = categories.map((c) =>
      c.id === editingCategory.id ? { ...c, name: categoryFormData.name } : c
    );

    setCategories(updatedCategories);
    resetCategoryForm();
  };

  const handleEditCategory = (category: CategoryRow) => {
    setEditingCategory(category);
    setCategoryFormData({
      id: category.id,
      name: category.name,
    });
    setShowCategoryForm(true);
  };

  const handleDeleteCategory = (id: string) => {
    const productsInCategory = products.filter((p) => p.category === id);

    if (productsInCategory.length > 0) {
      toast.error(`Cannot delete category. ${productsInCategory.length} product(s) are using this category.`);
      return;
    }

    if (confirm("Are you sure you want to delete this category?")) {
      setCategories(categories.filter((c) => c.id !== id));
    }
  };

  const resetCategoryForm = () => {
    setShowCategoryForm(false);
    setEditingCategory(null);
    setCategoryFormData({
      id: "",
      name: "",
    });
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order["status"]) => {
    try {
      const res = await fetch("/api/admin/retail-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
      if (!res.ok) {
        toast.error("Could not update order");
        return;
      }
      await loadRetail();
    } catch {
      toast.error("Could not update order");
    }
  };

  const getStatusPillTone = (status: Order["status"]): "success" | "warning" | "danger" | "neutral" => {
    switch (status) {
      case "pending":
      case "processing": return "warning";
      case "delivered": return "success";
      case "cancelled": return "danger";
      default: return "neutral";
    }
  };

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/admin/login");
      return;
    }
    const role = (session?.user as { role?: string })?.role;
    if (status === "authenticated" && role !== "admin") {
      router.push("/admin/login");
      return;
    }
    if (status === "authenticated" && role === "admin") {
      void loadRetail();
    }
  }, [status, session, router, loadRetail]);

  return (
    <>
      <SEO title="Boutique Management - Admin" />
      
      <div className="flex min-h-screen bg-linear-to-br from-cream via-[#fafaf8] to-sage/5">
        
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <AdminPageHeader
              title="Boutique Management"
              subtitle="Manage products and track orders"
              actions={
                <Button
                  onClick={() => setShowProductForm(true)}
                  variant="sage"
                >
                  <Plus size={20} className="mr-2" />
                  Add Product
                </Button>
              }
            />

            <div className="p-6 lg:p-8">
              {/* Stats Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="p-6 rounded-2xl bg-white-warm border border-sage/10 hover:border-sage/30 transition-all duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <Package className="text-sage/60" size={24} />
                    <TrendingUp className="text-sage" size={20} />
                  </div>
                  <p className="font-display text-3xl text-charcoal mb-1">{totalProducts}</p>
                  <p className="font-body text-sm text-charcoal/60">Total Products</p>
                </div>

                <div className="p-6 rounded-2xl bg-white-warm border border-sage/10 hover:border-sage/30 transition-all duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <DollarSign className="text-sage/60" size={24} />
                    <TrendingUp className="text-sage" size={20} />
                  </div>
                  <p className="font-display text-3xl text-charcoal mb-1">₹{totalRevenue.toLocaleString()}</p>
                  <p className="font-body text-sm text-charcoal/60">Total Revenue</p>
                </div>

                <div className="p-6 rounded-2xl bg-white-warm border border-sage/10 hover:border-sage/30 transition-all duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <ShoppingCart className="text-sage/60" size={24} />
                    <TrendingUp className="text-terracotta" size={20} />
                  </div>
                  <p className="font-display text-3xl text-charcoal mb-1">{pendingOrders}</p>
                  <p className="font-body text-sm text-charcoal/60">Pending Orders</p>
                </div>

                <div className="p-6 rounded-2xl bg-white-warm border border-sage/10 hover:border-sage/30 transition-all duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="text-sage/60" size={24} />
                    <TrendingUp className="text-sage" size={20} />
                  </div>
                  <p className="font-display text-3xl text-charcoal mb-1">₹{avgOrderValue.toFixed(0)}</p>
                  <p className="font-body text-sm text-charcoal/60">Avg Order Value</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 p-1 rounded-full bg-white-warm border border-sage/10">
                  <button
                    onClick={() => setActiveTab("products")}
                    className={`px-6 py-2 rounded-full font-body text-sm transition-all duration-300 ${
                      activeTab === "products"
                        ? "bg-sage text-cream shadow-lg"
                        : "text-charcoal/60 hover:text-charcoal"
                    }`}
                  >
                    Products ({totalProducts})
                  </button>
                  <button
                    onClick={() => setActiveTab("orders")}
                    className={`px-6 py-2 rounded-full font-body text-sm transition-all duration-300 ${
                      activeTab === "orders"
                        ? "bg-sage text-cream shadow-lg"
                        : "text-charcoal/60 hover:text-charcoal"
                    }`}
                  >
                    Orders ({orders.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("categories")}
                    className={`px-6 py-2 rounded-full font-body text-sm transition-all duration-300 ${
                      activeTab === "categories"
                        ? "bg-sage text-cream shadow-lg"
                        : "text-charcoal/60 hover:text-charcoal"
                    }`}
                  >
                    Categories ({categoryRows.length})
                  </button>
                </div>
              </div>

              {/* Products Tab */}
              {activeTab === "products" && (
                <div className="space-y-6">
                  {/* Search + filters */}
                  <FilterBar reset={f.isActive ? f.reset : undefined} className="mb-4">
                    <FilterSearch
                      value={f.values.search}
                      onChange={(v) => { f.set("search", v); setProductPage(1); }}
                      placeholder="Search products..."
                      aria-label="Search products"
                    />
                    <FilterSelect
                      ariaLabel="Category"
                      value={f.values.category}
                      onChange={(v) => { f.set("category", v); setProductPage(1); }}
                      placeholder="All categories"
                      options={categoryOptions}
                    />
                    <FilterSelect
                      ariaLabel="Stock"
                      value={f.values.stock}
                      onChange={(v) => { f.set("stock", v); setProductPage(1); }}
                      placeholder="All stock"
                      options={[
                        { value: "all", label: "All stock" },
                        { value: "in", label: "In stock" },
                        { value: "out", label: "Out of stock" },
                      ]}
                    />
                    <FilterSelect
                      ariaLabel="Featured"
                      placeholder="Featured"
                      value={f.values.featured}
                      onChange={(v) => { f.set("featured", v); setProductPage(1); }}
                      options={[
                        { value: "all", label: "All products" },
                        { value: "featured", label: "Featured only" },
                      ]}
                    />
                  </FilterBar>

                  {/* Products Table */}
                  <div className="rounded-2xl bg-white-warm border border-sage/10 overflow-hidden">
                    <ResponsiveTable>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-sage/10 bg-sage/5">
                            <th className="text-left p-4 font-body text-sm font-semibold text-charcoal">Product</th>
                            <th className="text-left p-4 font-body text-sm font-semibold text-charcoal">Category</th>
                            <th className="text-left p-4 font-body text-sm font-semibold text-charcoal">Price</th>
                            <th className="text-left p-4 font-body text-sm font-semibold text-charcoal">Stock</th>
                            <th className="text-left p-4 font-body text-sm font-semibold text-charcoal">Sales</th>
                            <th className="text-left p-4 font-body text-sm font-semibold text-charcoal">Status</th>
                            <th className="text-right p-4 font-body text-sm font-semibold text-charcoal">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedProducts.map((product) => (
                            <tr key={product.id} className="border-b border-sage/10 hover:bg-sage/5 transition-colors">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-lg bg-linear-to-br from-sage/20 via-cream/50 to-terracotta/20 shrink-0" />
                                  <div>
                                    <p className="font-body text-sm font-medium text-charcoal">{product.name}</p>
                                    {product.featured && (
                                      <Pill tone="success" size="sm" className="mt-1">Featured</Pill>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <p className="font-body text-sm text-charcoal/70 capitalize">
                                  {categoryById.get(product.category) ??
                                    prettifyCatId(product.category)}
                                </p>
                              </td>
                              <td className="p-4">
                                <p className="font-body text-sm font-medium text-charcoal">₹{product.price}</p>
                              </td>
                              <td className="p-4">
                                <p className={`font-body text-sm ${product.stock < 10 ? 'text-terracotta font-semibold' : 'text-charcoal/70'}`}>
                                  {product.stock} units
                                </p>
                              </td>
                              <td className="p-4">
                                <p className="font-body text-sm text-charcoal/70">{product.sales} sold</p>
                              </td>
                              <td className="p-4">
                                {product.inStock ? (
                                  <Pill tone="success">In Stock</Pill>
                                ) : (
                                  <Pill tone="neutral">Out of Stock</Pill>
                                )}
                              </td>
                              <td className="p-4">
                                <div className="flex items-center justify-end gap-2">
                                  <EditButton onClick={() => handleEditProduct(product)} />
                                  <DeleteButton onClick={() => handleDeleteProduct(product.id)} />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ResponsiveTable>

                    {/* Pagination */}
                    {totalProductPages > 1 && (
                      <div className="flex items-center justify-center gap-2 p-4 border-t border-sage/10">
                        <button
                          onClick={() => setProductPage(Math.max(1, productPage - 1))}
                          disabled={productPage === 1}
                          className="p-2 rounded-lg hover:bg-sage/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <span className="font-body text-sm text-charcoal/70 px-4">
                          Page {productPage} of {totalProductPages}
                        </span>
                        <button
                          onClick={() => setProductPage(Math.min(totalProductPages, productPage + 1))}
                          disabled={productPage === totalProductPages}
                          className="p-2 rounded-lg hover:bg-sage/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Categories Tab */}
              {activeTab === "categories" && (
                <div className="space-y-6">
                  {/* Add Category Button */}
                  <div className="flex justify-between items-center">
                    <p className="font-body text-sm text-charcoal/60">
                      Manage product categories used across your boutique
                    </p>
                    <Button
                      onClick={() => setShowCategoryForm(true)}
                      variant="sage"
                    >
                      <Plus size={20} className="mr-2" />
                      Add Category
                    </Button>
                  </div>

                  {/* Categories Grid */}
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categoryRows.map((category) => {
                      const productCount = products.filter(p => p.category === category.id).length;
                      
                      return (
                        <div
                          key={category.id}
                          className="p-6 rounded-2xl bg-white-warm border border-sage/10 hover:border-sage/30 transition-all duration-300 group"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h3 className="font-display text-2xl text-charcoal mb-2">
                                {category.name}
                              </h3>
                              <p className="font-body text-sm text-charcoal/60">
                                {productCount} product{productCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-linear-to-br from-sage/20 via-cream/50 to-terracotta/20 flex items-center justify-center">
                              <Package size={24} className="text-sage" />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-4 border-t border-sage/10">
                            <button
                              onClick={() => handleEditCategory(category)}
                              className="flex-1 px-4 py-2 rounded-lg bg-sage/10 hover:bg-sage/20 text-sage font-body text-sm transition-colors flex items-center justify-center gap-2"
                            >
                              <Edit size={16} />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(category.id)}
                              disabled={productCount > 0}
                              className="flex-1 px-4 py-2 rounded-lg bg-[#a05e38]/10 hover:bg-[#a05e38]/20 text-[#a05e38] font-body text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 size={16} />
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Empty State */}
                  {categoryRows.length === 0 && (
                    <div className="text-center py-20 px-6 rounded-2xl bg-white-warm border border-sage/10">
                      <Package className="mx-auto mb-4 text-charcoal/20" size={64} />
                      <h3 className="font-display text-2xl text-charcoal mb-2">No categories yet</h3>
                      <p className="font-body text-charcoal/60 mb-6">
                        Create your first product category to organize your boutique
                      </p>
                      <Button
                        onClick={() => setShowCategoryForm(true)}
                        variant="sage"
                      >
                        <Plus size={20} className="mr-2" />
                        Add Category
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Orders Tab */}
              {activeTab === "orders" && (
                <div className="space-y-6">
                  {paginatedOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-6 rounded-2xl bg-white-warm border border-sage/10 hover:border-sage/30 transition-all duration-300"
                    >
                      {/* Order Header */}
                      <div className="flex items-start justify-between mb-4 pb-4 border-b border-sage/10">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-display text-xl text-charcoal">{order.id}</h3>
                            <Pill tone={getStatusPillTone(order.status)}>
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </Pill>
                          </div>
                          <p className="font-body text-sm text-charcoal/60 mb-1">
                            {order.customerName} • {order.customerEmail}
                          </p>
                          <p className="font-body text-xs text-charcoal/50">
                            {new Date(order.orderDate).toLocaleDateString('en-US', { 
                              month: 'long', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-2xl text-sage mb-1">₹{order.total}</p>
                          <p className="font-body text-xs text-charcoal/60">
                            {order.paymentMethod === "online" ? "Paid Online" : "Pay at Studio"}
                          </p>
                        </div>
                      </div>

                      {/* Order Items */}
                      <div className="space-y-2 mb-4">
                        {order.items.map((item, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span className="font-body text-charcoal/70">
                              {item.productName} × {item.quantity}
                            </span>
                            <span className="font-body text-charcoal">₹{item.price * item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      {/* Shipping Address */}
                      <div className="p-3 rounded-lg bg-sage/5 mb-4">
                        <p className="font-body text-xs text-charcoal/60 mb-1">Shipping Address:</p>
                        <p className="font-body text-sm text-charcoal">{order.shippingAddress}</p>
                      </div>

                      {/* Status Update */}
                      <div className="flex items-center gap-3">
                        <p className="font-body text-sm text-charcoal/60">Update Status:</p>
                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as Order["status"])}
                          className="px-3 py-2 rounded-lg border border-sage/20 font-body text-sm text-charcoal focus:outline-hidden focus:ring-2 focus:ring-sage/30"
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-auto border-sage/30 text-sage hover:bg-sage/10"
                        >
                          <Eye size={16} className="mr-2" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Pagination */}
                  {totalOrderPages > 1 && (
                    <div className="flex items-center justify-center gap-2 p-4">
                      <button
                        onClick={() => setOrderPage(Math.max(1, orderPage - 1))}
                        disabled={orderPage === 1}
                        className="p-2 rounded-lg hover:bg-sage/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <span className="font-body text-sm text-charcoal/70 px-4">
                        Page {orderPage} of {totalOrderPages}
                      </span>
                      <button
                        onClick={() => setOrderPage(Math.min(totalOrderPages, orderPage + 1))}
                        disabled={orderPage === totalOrderPages}
                        className="p-2 rounded-lg hover:bg-sage/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Add/Edit Product Modal */}
        <Drawer
          direction="right"
          open={showProductForm}
          onOpenChange={(o) => { if (!o) resetForm(); }}
        >
          <DrawerContent direction="right" className="max-w-2xl">
              <div className="shrink-0 border-b border-sage/10 bg-white-warm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <DrawerTitle className="font-display text-3xl text-charcoal">
                      {editingProduct ? "Edit Product" : "Add New Product"}
                    </DrawerTitle>
                    <DrawerDescription className="font-body text-sm text-charcoal/60">
                      {editingProduct ? "Update product details" : "Create a new boutique product"}
                    </DrawerDescription>
                  </div>
                  <button
                    onClick={resetForm}
                    className="w-10 h-10 rounded-full hover:bg-sage/10 flex items-center justify-center transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <label className="font-body text-sm text-charcoal/70 mb-2 block">Product Name *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Sanctuary Candle"
                    className="border-sage/20 focus:border-sage"
                  />
                </div>

                <div>
                  <label className="font-body text-sm text-charcoal/70 mb-2 block">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-sage/20 font-body text-sm focus:outline-hidden focus:ring-2 focus:ring-sage/30"
                  >
                    {categoryRows.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-body text-sm text-charcoal/70 mb-2 block">Price (₹) *</label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="850"
                      className="border-sage/20 focus:border-sage"
                    />
                  </div>
                  <div>
                    <label className="font-body text-sm text-charcoal/70 mb-2 block">Stock *</label>
                    <Input
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      placeholder="45"
                      className="border-sage/20 focus:border-sage"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-body text-sm text-charcoal/70 mb-2 block">Description *</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Hand-poured soy candle with calming lavender & eucalyptus"
                    rows={3}
                    className="border-sage/20 focus:border-sage resize-none"
                  />
                </div>

                {/* Product Images Section */}
                <div className="border-t border-sage/10 pt-6">
                  <label className="font-body text-sm font-semibold text-charcoal mb-2 block">
                    Product Images
                  </label>
                  <p className="font-body text-xs text-charcoal/50 mb-4">
                    Add up to 4 images. Use image URLs from /public folder (e.g., /food/image.jpg)
                  </p>
                  <div className="space-y-3">
                    {formData.images.map((image, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <span className="font-body text-sm text-charcoal/60 font-medium min-w-[80px]">
                          Image {index + 1}{index === 0 && " *"}:
                        </span>
                        <Input
                          value={image}
                          onChange={(e) => {
                            const newImages = [...formData.images];
                            newImages[index] = e.target.value;
                            setFormData({ ...formData, images: newImages });
                          }}
                          placeholder={`/food/product-${index + 1}.jpg`}
                          className="border-sage/20 focus:border-sage flex-1"
                        />
                        {image && (
                          <button
                            type="button"
                            onClick={() => {
                              const newImages = [...formData.images];
                              newImages[index] = "";
                              setFormData({ ...formData, images: newImages });
                            }}
                            className="p-2 rounded-lg hover:bg-[#a05e38]/10 text-[#a05e38] transition-colors"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-3 rounded-lg bg-sage/5 border border-sage/10">
                    <p className="font-body text-xs text-charcoal/60">
                      💡 <strong>Tip:</strong> First image will be used as the main product image on the shop page. You can use images from the /food/ directory.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="featured"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="w-4 h-4 rounded border-sage/20 text-sage focus:ring-sage"
                  />
                  <label htmlFor="featured" className="font-body text-sm text-charcoal/70">
                    Mark as Featured Product
                  </label>
                </div>
              </div>

              <div className="shrink-0 border-t border-sage/10 bg-white-warm p-6">
                <div className="flex gap-3">
                  <Button
                    onClick={resetForm}
                    variant="outline"
                    className="flex-1 border-sage/30 text-charcoal hover:bg-sage/10 hover:text-charcoal"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={editingProduct ? handleUpdateProduct : handleAddProduct}
                    variant="sage"
                    className="flex-1"
                  >
                    <Check size={18} className="mr-2" />
                    {editingProduct ? "Update Product" : "Add Product"}
                  </Button>
                </div>
              </div>
          </DrawerContent>
        </Drawer>

        {/* Add/Edit Category Drawer */}
        <Drawer
          direction="right"
          open={showCategoryForm}
          onOpenChange={(o) => { if (!o) resetCategoryForm(); }}
        >
          <DrawerContent direction="right" className="max-w-lg">
              <div className="shrink-0 border-b border-sage/10 bg-white-warm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <DrawerTitle className="font-display text-3xl text-charcoal">
                      {editingCategory ? "Edit Category" : "Add New Category"}
                    </DrawerTitle>
                    <DrawerDescription className="font-body text-sm text-charcoal/60">
                      {editingCategory ? "Update category details" : "Create a new product category"}
                    </DrawerDescription>
                  </div>
                  <button
                    onClick={resetCategoryForm}
                    className="w-10 h-10 rounded-full hover:bg-sage/10 flex items-center justify-center transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <label className="font-body text-sm text-charcoal/70 mb-2 block">Category Name *</label>
                  <Input
                    value={categoryFormData.name}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                    placeholder="e.g. Aromatherapy, Wellness, Personal Care"
                    className="border-sage/20 focus:border-sage"
                  />
                  <p className="font-body text-xs text-charcoal/50 mt-2">
                    Choose a clear, descriptive name for your product category
                  </p>
                </div>

                {editingCategory && (
                  <div className="p-4 rounded-lg bg-sage/5 border border-sage/10">
                    <p className="font-body text-xs text-charcoal/60">
                      <strong>Category ID:</strong> {editingCategory.id}
                    </p>
                    <p className="font-body text-xs text-charcoal/60 mt-1">
                      <strong>Products:</strong> {products.filter(p => p.category === editingCategory.id).length}
                    </p>
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-sage/10 bg-white-warm p-6">
                <div className="flex gap-3">
                  <Button
                    onClick={resetCategoryForm}
                    variant="outline"
                    className="flex-1 border-sage/30 text-charcoal hover:bg-sage/10 hover:text-charcoal"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={editingCategory ? handleUpdateCategory : handleAddCategory}
                    variant="sage"
                    className="flex-1"
                  >
                    <Check size={18} className="mr-2" />
                    {editingCategory ? "Update Category" : "Add Category"}
                  </Button>
                </div>
              </div>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
