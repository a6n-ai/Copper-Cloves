import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useSession } from "@/lib/auth/client";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });
import { SEO } from "@/components/SEO";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/admin/MetricCard";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/responsive/ResponsiveDialog";
import { EditButton, DeleteButton, NavPrevButton, NavNextButton } from "@/components/ui/quick-actions";
import { Pill } from "@/components/ui/pill";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "lucide-react";

import { cdnUrl } from "@/lib/cdnUrl";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { toast } from "sonner";
import { hasRole } from "@/lib/auth/roles";
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
    image: r.image_url ?? "",
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

const ORDER_STATUS_OPTIONS: { value: Order["status"]; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export default function AdminProducts() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [activeTab, setActiveTab] = useState<"products" | "orders" | "categories">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>(DEFAULT_CATEGORY_PRESETS);
  const [loading, setLoading] = useState(true);
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
    try {
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
    } finally {
      setLoading(false);
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
    if (isPending) return;
    if (!session?.user) {
      router.push("/admin/login");
      return;
    }
    const role = (session?.user as { role?: string })?.role;
    if (!hasRole(role, "admin")) {
      router.push("/admin/login");
      return;
    }
    void loadRetail();
  }, [isPending, session, router, loadRetail]);

  return (
    <>
      <SEO title="Boutique Management - Admin" />

      <div className="min-h-screen bg-linear-to-br from-cream via-card to-sage/5">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-8">
            <AdminPageHeader
              title="Boutique Management"
              subtitle="Manage products and track orders"
              actions={
                <Button onClick={() => setShowProductForm(true)} variant="sage">
                  <Plus className="mr-2" />
                  Add Product
                </Button>
              }
            />

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <MetricCard
                label="Total Products"
                value={totalProducts}
                icon={Package}
                tone="sage"
                loading={loading}
              />
              <MetricCard
                label="Total Revenue"
                value={totalRevenue}
                prefix="₹"
                icon={DollarSign}
                tone="sage"
                loading={loading}
              />
              <MetricCard
                label="Pending Orders"
                value={pendingOrders}
                icon={ShoppingCart}
                tone="terracotta"
                loading={loading}
              />
              <MetricCard
                label="Avg Order Value"
                value={avgOrderValue}
                prefix="₹"
                decimals={0}
                icon={TrendingUp}
                tone="sage"
                loading={loading}
              />
            </div>

            {/* Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as typeof activeTab)}
              className="space-y-6"
            >
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="products" className="tabular-nums">
                  Products ({totalProducts})
                </TabsTrigger>
                <TabsTrigger value="orders" className="tabular-nums">
                  Orders ({orders.length})
                </TabsTrigger>
                <TabsTrigger value="categories" className="tabular-nums">
                  Categories ({categoryRows.length})
                </TabsTrigger>
              </TabsList>

              {/* Products Tab */}
              <TabsContent value="products" className="space-y-6">
                {/* Search + filters */}
                <FilterBar reset={f.isActive ? f.reset : undefined}>
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
                <Card className="overflow-hidden">
                  {loading ? (
                    <div className="space-y-3 p-6">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full bg-sage/10" />
                      ))}
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <EmptyState
                      icon={Package}
                      title="No products found"
                      description={
                        f.isActive
                          ? "No products match your current filters. Try adjusting your search."
                          : "Add your first boutique product to get started."
                      }
                      action={
                        f.isActive ? (
                          <Button variant="sage-outline" onClick={f.reset}>
                            Clear filters
                          </Button>
                        ) : (
                          <Button variant="sage" onClick={() => setShowProductForm(true)}>
                            <Plus className="mr-2" />
                            Add Product
                          </Button>
                        )
                      }
                    />
                  ) : (
                    <ResponsiveTable stack>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-sage/5">
                            <TableHead>Product</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            <TableHead className="text-right">Sales</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedProducts.map((product) => (
                            <TableRow key={product.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {product.image ? (
                                    <Image
                                      src={product.image}
                                      alt={product.name}
                                      width={80}
                                      height={80}
                                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                                      unoptimized
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-linear-to-br from-sage/20 via-cream/50 to-terracotta/20 shrink-0" />
                                  )}
                                  <div>
                                    <p className="font-body text-sm font-medium text-charcoal">{product.name}</p>
                                    {product.featured && (
                                      <Pill tone="success" size="sm" className="mt-1">Featured</Pill>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-body text-sm text-muted-foreground capitalize">
                                  {categoryById.get(product.category) ?? prettifyCatId(product.category)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-body text-sm font-medium text-charcoal tabular-nums">
                                ₹{product.price.toLocaleString()}
                              </TableCell>
                              <TableCell
                                className={`text-right font-body text-sm tabular-nums ${product.stock < 10 ? "text-terracotta font-semibold" : "text-muted-foreground"}`}
                              >
                                {product.stock}
                              </TableCell>
                              <TableCell className="text-right font-body text-sm text-muted-foreground tabular-nums">
                                {product.sales}
                              </TableCell>
                              <TableCell>
                                {product.inStock ? (
                                  <Pill tone="success">In Stock</Pill>
                                ) : (
                                  <Pill tone="neutral">Out of Stock</Pill>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-2">
                                  <EditButton onClick={() => handleEditProduct(product)} />
                                  <DeleteButton onClick={() => handleDeleteProduct(product.id)} />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ResponsiveTable>
                  )}

                  {/* Pagination */}
                  {!loading && totalProductPages > 1 && (
                    <div className="flex items-center justify-center gap-3 p-4 border-t border-border">
                      <NavPrevButton
                        onClick={() => setProductPage(Math.max(1, productPage - 1))}
                        disabled={productPage === 1}
                      />
                      <span className="font-body text-sm text-muted-foreground tabular-nums px-2">
                        Page {productPage} of {totalProductPages}
                      </span>
                      <NavNextButton
                        onClick={() => setProductPage(Math.min(totalProductPages, productPage + 1))}
                        disabled={productPage === totalProductPages}
                      />
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Categories Tab */}
              <TabsContent value="categories" className="space-y-6">
                {/* Add Category Button */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="font-body text-sm text-muted-foreground">
                    Manage product categories used across your boutique
                  </p>
                  <Button onClick={() => setShowCategoryForm(true)} variant="sage">
                    <Plus className="mr-2" />
                    Add Category
                  </Button>
                </div>

                {categoryRows.length === 0 ? (
                  <Card>
                    <EmptyState
                      icon={Package}
                      title="No categories yet"
                      description="Create your first product category to organize your boutique."
                      action={
                        <Button variant="sage" onClick={() => setShowCategoryForm(true)}>
                          <Plus className="mr-2" />
                          Add Category
                        </Button>
                      }
                    />
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {categoryRows.map((category) => {
                      const productCount = products.filter((p) => p.category === category.id).length;

                      return (
                        <Card key={category.id} className="transition-shadow hover:shadow-md">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-body font-semibold text-lg text-charcoal truncate">
                                  {category.name}
                                </h3>
                                <p className="font-body text-sm text-muted-foreground tabular-nums">
                                  {productCount} product{productCount !== 1 ? "s" : ""}
                                </p>
                              </div>
                              <div className="w-10 h-10 rounded-lg bg-sage/10 flex items-center justify-center shrink-0">
                                <Package className="size-5 text-sage" aria-hidden="true" />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-4 border-t border-border">
                              <Button
                                type="button"
                                variant="sage-outline"
                                size="sm"
                                onClick={() => handleEditCategory(category)}
                                className="flex-1"
                              >
                                <Edit />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteCategory(category.id)}
                                disabled={productCount > 0}
                                className="flex-1"
                              >
                                <Trash2 />
                                Delete
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Orders Tab */}
              <TabsContent value="orders" className="space-y-6">
                {loading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-40 w-full rounded-xl bg-sage/10" />
                    ))}
                  </div>
                ) : orders.length === 0 ? (
                  <Card>
                    <EmptyState
                      icon={ShoppingCart}
                      title="No orders yet"
                      description="Boutique orders placed by members will appear here."
                    />
                  </Card>
                ) : (
                  <>
                    {paginatedOrders.map((order) => (
                      <Card key={order.id} className="transition-shadow hover:shadow-md">
                        <CardContent className="p-6">
                          {/* Order Header */}
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 pb-4 border-b border-border">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-body font-semibold text-base text-charcoal">{order.id}</h3>
                                <Pill tone={getStatusPillTone(order.status)}>
                                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                </Pill>
                              </div>
                              <p className="font-body text-sm text-muted-foreground mb-1">
                                {order.customerName} • {order.customerEmail}
                              </p>
                              <p className="font-body text-xs text-muted-foreground">
                                {new Date(order.orderDate).toLocaleDateString("en-US", {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </p>
                            </div>
                            <div className="sm:text-right">
                              <p className="font-body font-semibold tabular-nums text-2xl text-sage mb-1">
                                ₹{order.total.toLocaleString()}
                              </p>
                              <p className="font-body text-xs text-muted-foreground">
                                {order.paymentMethod === "online" ? "Paid Online" : "Pay at Studio"}
                              </p>
                            </div>
                          </div>

                          {/* Order Items */}
                          <div className="space-y-2 mb-4">
                            {order.items.map((item, index) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <span className="font-body text-muted-foreground">
                                  {item.productName} × {item.quantity}
                                </span>
                                <span className="font-body text-charcoal tabular-nums">
                                  ₹{(item.price * item.quantity).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Shipping Address */}
                          <div className="p-3 rounded-lg bg-sage/5 mb-4">
                            <p className="font-body text-xs text-muted-foreground mb-1">Shipping Address</p>
                            <p className="font-body text-sm text-charcoal">{order.shippingAddress}</p>
                          </div>

                          {/* Status Update */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <Label className="font-body text-sm text-muted-foreground shrink-0">
                              Update status
                            </Label>
                            <Select
                              value={order.status}
                              activityLabel="Order status"
                              onValueChange={(v) => handleUpdateOrderStatus(order.id, v as Order["status"])}
                            >
                              <SelectTrigger className="w-full sm:w-44" aria-label="Update order status">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ORDER_STATUS_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {/* Pagination */}
                    {totalOrderPages > 1 && (
                      <div className="flex items-center justify-center gap-3 p-4">
                        <NavPrevButton
                          onClick={() => setOrderPage(Math.max(1, orderPage - 1))}
                          disabled={orderPage === 1}
                        />
                        <span className="font-body text-sm text-muted-foreground tabular-nums px-2">
                          Page {orderPage} of {totalOrderPages}
                        </span>
                        <NavNextButton
                          onClick={() => setOrderPage(Math.min(totalOrderPages, orderPage + 1))}
                          disabled={orderPage === totalOrderPages}
                        />
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>

        {/* Add/Edit Product Modal */}
        <ResponsiveDialog
          open={showProductForm}
          onOpenChange={(o) => { if (!o) resetForm(); }}
        >
          <ResponsiveDialogContent className="max-w-2xl">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle className="font-body font-semibold text-charcoal">
                {editingProduct ? "Edit Product" : "Add New Product"}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {editingProduct ? "Update product details" : "Create a new boutique product"}
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="product-name">Product Name *</Label>
                <Input
                  id="product-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Sanctuary Candle"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-category">Category *</Label>
                <Select
                  value={formData.category}
                  activityLabel="Product category"
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger id="product-category" className="w-full" aria-label="Category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryRows.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-price">Price (₹) *</Label>
                  <Input
                    id="product-price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="850"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-stock">Stock *</Label>
                  <Input
                    id="product-stock"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="45"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-description">Description *</Label>
                <Textarea
                  id="product-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Hand-poured soy candle with calming lavender & eucalyptus"
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Product Images Section */}
              <div className="border-t border-border pt-6">
                <Label className="font-semibold text-charcoal">Product Images</Label>
                <p className="font-body text-xs text-muted-foreground mt-1 mb-4">
                  Add up to 4 images. Use image URLs from /public folder (e.g., /food/image.jpg)
                </p>
                <div className="space-y-3">
                  {formData.images.map((image, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="font-body text-sm text-muted-foreground font-medium min-w-20">
                        Image {index + 1}{index === 0 && " *"}
                      </span>
                      <Input
                        value={image}
                        onChange={(e) => {
                          const newImages = [...formData.images];
                          newImages[index] = e.target.value;
                          setFormData({ ...formData, images: newImages });
                        }}
                        placeholder={`/food/product-${index + 1}.jpg`}
                        className="flex-1"
                      />
                      {image && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove image"
                          onClick={() => {
                            const newImages = [...formData.images];
                            newImages[index] = "";
                            setFormData({ ...formData, images: newImages });
                          }}
                        >
                          <X />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-3 rounded-lg bg-sage/5 border border-sage/10">
                  <p className="font-body text-xs text-muted-foreground">
                    <strong className="text-charcoal">Tip:</strong> The first image is used as the main product
                    image on the shop page. You can use images from the /food/ directory.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  id="featured"
                  checked={formData.featured}
                  onCheckedChange={(c) => setFormData({ ...formData, featured: c === true })}
                />
                <Label htmlFor="featured" className="font-body text-sm text-muted-foreground">
                  Mark as Featured Product
                </Label>
              </div>
            </div>

            <ResponsiveDialogFooter>
              <Button onClick={resetForm} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={editingProduct ? handleUpdateProduct : handleAddProduct}
                variant="sage"
                className="flex-1"
              >
                <Check className="mr-2" />
                {editingProduct ? "Update Product" : "Add Product"}
              </Button>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        </ResponsiveDialog>

        {/* Add/Edit Category Modal */}
        <ResponsiveDialog
          open={showCategoryForm}
          onOpenChange={(o) => { if (!o) resetCategoryForm(); }}
        >
          <ResponsiveDialogContent className="max-w-lg">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle className="font-body font-semibold text-charcoal">
                {editingCategory ? "Edit Category" : "Add New Category"}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {editingCategory ? "Update category details" : "Create a new product category"}
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="category-name">Category Name *</Label>
                <Input
                  id="category-name"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  placeholder="e.g. Aromatherapy, Wellness, Personal Care"
                />
                <p className="font-body text-xs text-muted-foreground">
                  Choose a clear, descriptive name for your product category
                </p>
              </div>

              {editingCategory && (
                <div className="p-4 rounded-lg bg-sage/5 border border-sage/10 space-y-1">
                  <p className="font-body text-xs text-muted-foreground">
                    <strong className="text-charcoal">Category ID:</strong> {editingCategory.id}
                  </p>
                  <p className="font-body text-xs text-muted-foreground tabular-nums">
                    <strong className="text-charcoal">Products:</strong>{" "}
                    {products.filter((p) => p.category === editingCategory.id).length}
                  </p>
                </div>
              )}
            </div>

            <ResponsiveDialogFooter>
              <Button onClick={resetCategoryForm} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={editingCategory ? handleUpdateCategory : handleAddCategory}
                variant="sage"
                className="flex-1"
              >
                <Check className="mr-2" />
                {editingCategory ? "Update Category" : "Add Category"}
              </Button>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </div>
    </>
  );
}
