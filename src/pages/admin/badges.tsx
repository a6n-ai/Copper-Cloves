import { useEffect, useState, useCallback, useRef, useMemo, Fragment } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Pagination, usePagination } from "@/components/Pagination";
import { MetricCard } from "@/components/admin/MetricCard";
import {
  Award,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Search,
  UserCheck,
  Star,
  Layers,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react";

const COLOR_PRESETS = [
  { label: "Sage", hex: "#7C9070" },
  { label: "Terracotta", hex: "#C17A5A" },
  { label: "Gold", hex: "#D4A017" },
  { label: "Navy", hex: "#2D4B8E" },
  { label: "Crimson", hex: "#B22222" },
  { label: "Violet", hex: "#7B2D8B" },
];

interface BadgeTemplate {
  id: string;
  name: string;
  description: string | null;
  badge_type: string;
  icon: string;
  color: string;
  threshold_classes: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface UserBadgeAllocation {
  id: string;
  user_id: string;
  badge_name: string;
  earned_at: string;
  profile: { id: string; full_name: string | null; email: string };
}

interface MemberSearchResult {
  id: string;
  full_name: string | null;
  email: string;
}

interface EditFormState {
  name: string;
  description: string;
  icon: string;
  color: string;
  threshold_classes: string;
  sort_order: string;
}

type Tab = "ptm" | "custom";
type PtmSortKey = "name" | "threshold" | "status";

const emptyForm = (): EditFormState => ({
  name: "",
  description: "",
  icon: "🏆",
  color: "#7C9070",
  threshold_classes: "",
  sort_order: "0",
});

export default function AdminBadgesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<Tab>("ptm");
  const [ptmTemplates, setPtmTemplates] = useState<BadgeTemplate[]>([]);
  const [customTemplates, setCustomTemplates] = useState<BadgeTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // PTM table search + sort
  const [ptmSearch, setPtmSearch] = useState("");
  const [ptmSortKey, setPtmSortKey] = useState<PtmSortKey | null>(null);
  const [ptmSortDir, setPtmSortDir] = useState<"asc" | "desc">("asc");

  // PTM editing
  const [editingPtmId, setEditingPtmId] = useState<string | null>(null);
  const [ptmForm, setPtmForm] = useState<EditFormState>(emptyForm());
  const [showAddPtm, setShowAddPtm] = useState(false);

  // Custom badge forms
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [customForm, setCustomForm] = useState<EditFormState>(emptyForm());
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [customEditForm, setCustomEditForm] = useState<EditFormState>(emptyForm());

  // Allocation panel
  const [selectedCustomTemplate, setSelectedCustomTemplate] = useState<BadgeTemplate | null>(null);
  const [allocations, setAllocations] = useState<UserBadgeAllocation[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState<MemberSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Member of the Month
  const [momName, setMomName] = useState<string | null>(null);
  const [momUserId, setMomUserId] = useState<string | null>(null);
  const [momAwarding, setMomAwarding] = useState(false);
  const [momMsg, setMomMsg] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/admin/login");
    } else if (status === "authenticated") {
      const role = (session?.user as { role?: string })?.role;
      if (role !== "admin") router.replace("/admin/login");
    }
  }, [status, session, router]);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/badges");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPtmTemplates(data.path_to_mastery ?? []);
      setCustomTemplates(data.custom ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDashboardExtras = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard/member-stats");
      if (!res.ok) return;
      const data = await res.json();
      const mom = data.memberStats?.memberOfMonth;
      if (mom?.name && mom.name !== "—") {
        setMomName(mom.name);
        // Try to find the user id via search
        const sq = await fetch(
          `/api/admin/members-search?q=${encodeURIComponent(mom.name)}`
        );
        if (sq.ok) {
          const sdata: MemberSearchResult[] = await sq.json();
          if (sdata.length > 0) setMomUserId(sdata[0].id);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchTemplates();
      fetchDashboardExtras();
    }
  }, [status, fetchTemplates, fetchDashboardExtras]);

  const fetchAllocations = useCallback(async (templateId: string) => {
    const res = await fetch(`/api/admin/badge-allocations?template_id=${templateId}`);
    if (res.ok) setAllocations(await res.json());
  }, []);

  useEffect(() => {
    if (selectedCustomTemplate) {
      fetchAllocations(selectedCustomTemplate.id);
    }
  }, [selectedCustomTemplate, fetchAllocations]);

  // Debounced member search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!memberSearch.trim()) {
      setMemberResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/admin/members-search?q=${encodeURIComponent(memberSearch)}`);
        if (res.ok) setMemberResults(await res.json());
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [memberSearch]);

  // ---- Stats + PTM table derivation ----
  const activeCount = [...ptmTemplates, ...customTemplates].filter((t) => t.is_active).length;
  const totalBadges = ptmTemplates.length + customTemplates.length;

  const filteredPtm = useMemo(() => {
    let list = [...ptmTemplates];
    if (ptmSearch.trim()) {
      const q = ptmSearch.toLowerCase();
      list = list.filter(
        (t) => t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q),
      );
    }
    if (ptmSortKey) {
      const dir = ptmSortDir === "asc" ? 1 : -1;
      list.sort((a, b) => {
        switch (ptmSortKey) {
          case "name":
            return a.name.localeCompare(b.name) * dir;
          case "threshold":
            return ((a.threshold_classes ?? 0) - (b.threshold_classes ?? 0)) * dir;
          case "status":
            return (Number(a.is_active) - Number(b.is_active)) * dir;
          default:
            return 0;
        }
      });
    } else {
      list.sort((a, b) => a.sort_order - b.sort_order);
    }
    return list;
  }, [ptmTemplates, ptmSearch, ptmSortKey, ptmSortDir]);

  const ptmPg = usePagination(filteredPtm, 10, `${ptmSearch}|${ptmSortKey}|${ptmSortDir}`);

  const togglePtmSort = (key: PtmSortKey) => {
    if (ptmSortKey === key) {
      setPtmSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setPtmSortKey(key);
      setPtmSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const ptmSortIcon = (key: PtmSortKey) =>
    ptmSortKey === key ? (
      ptmSortDir === "asc" ? (
        <ChevronUp className="h-3 w-3" />
      ) : (
        <ChevronDown className="h-3 w-3" />
      )
    ) : (
      <ArrowUpDown className="h-3 w-3 opacity-40" />
    );

  // ---- PTM CRUD ----
  const startEditPtm = (t: BadgeTemplate) => {
    setEditingPtmId(t.id);
    setPtmForm({
      name: t.name,
      description: t.description ?? "",
      icon: t.icon,
      color: t.color,
      threshold_classes: t.threshold_classes?.toString() ?? "",
      sort_order: t.sort_order.toString(),
    });
  };

  const savePtm = async (id: string) => {
    await fetch("/api/admin/badges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name: ptmForm.name,
        description: ptmForm.description || null,
        icon: ptmForm.icon,
        color: ptmForm.color,
        threshold_classes: ptmForm.threshold_classes ? parseInt(ptmForm.threshold_classes) : null,
        sort_order: parseInt(ptmForm.sort_order) || 0,
      }),
    });
    setEditingPtmId(null);
    fetchTemplates();
  };

  const deletePtm = async (id: string) => {
    if (!confirm("Delete this milestone? All earned badges for it will also be removed.")) return;
    await fetch(`/api/admin/badges?id=${id}`, { method: "DELETE" });
    fetchTemplates();
  };

  const addPtm = async () => {
    await fetch("/api/admin/badges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...ptmForm,
        badge_type: "path_to_mastery",
        threshold_classes: ptmForm.threshold_classes ? parseInt(ptmForm.threshold_classes) : null,
        sort_order: parseInt(ptmForm.sort_order) || 0,
      }),
    });
    setShowAddPtm(false);
    setPtmForm(emptyForm());
    fetchTemplates();
  };

  // ---- Custom Badge CRUD ----
  const saveCustomEdit = async (id: string) => {
    await fetch("/api/admin/badges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name: customEditForm.name,
        description: customEditForm.description || null,
        icon: customEditForm.icon,
        color: customEditForm.color,
        sort_order: parseInt(customEditForm.sort_order) || 0,
      }),
    });
    setEditingCustomId(null);
    fetchTemplates();
    if (selectedCustomTemplate?.id === id) {
      setSelectedCustomTemplate((prev) =>
        prev
          ? { ...prev, name: customEditForm.name, icon: customEditForm.icon, color: customEditForm.color }
          : prev
      );
    }
  };

  const deleteCustom = async (id: string) => {
    if (!confirm("Delete this badge? All allocations will be removed.")) return;
    await fetch(`/api/admin/badges?id=${id}`, { method: "DELETE" });
    if (selectedCustomTemplate?.id === id) setSelectedCustomTemplate(null);
    fetchTemplates();
  };

  const createCustom = async () => {
    await fetch("/api/admin/badges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...customForm,
        badge_type: "custom",
        threshold_classes: null,
        sort_order: parseInt(customForm.sort_order) || 0,
      }),
    });
    setShowCreateCustom(false);
    setCustomForm(emptyForm());
    fetchTemplates();
  };

  // ---- Allocations ----
  const allocateBadge = async (member: MemberSearchResult) => {
    if (!selectedCustomTemplate) return;
    const res = await fetch("/api/admin/badge-allocations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: member.id,
        badge_template_id: selectedCustomTemplate.id,
      }),
    });
    if (res.status === 409) {
      alert(`${member.full_name || member.email} already has this badge.`);
      return;
    }
    setMemberSearch("");
    setMemberResults([]);
    fetchAllocations(selectedCustomTemplate.id);
  };

  const revokeBadge = async (badgeId: string) => {
    if (!confirm("Revoke this badge?")) return;
    await fetch("/api/admin/badge-allocations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badge_id: badgeId }),
    });
    if (selectedCustomTemplate) fetchAllocations(selectedCustomTemplate.id);
  };

  // ---- Member of Month ----
  const awardMoM = async () => {
    if (!momUserId) return alert("Could not find the member's profile.");
    const momTemplate = customTemplates.find((t) => t.name === "Member of the Month");
    if (!momTemplate) {
      return alert(
        'No "Member of the Month" custom badge template found. Create one in Custom Badges first.'
      );
    }
    setMomAwarding(true);
    setMomMsg(null);
    const res = await fetch("/api/admin/badge-allocations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: momUserId, badge_template_id: momTemplate.id }),
    });
    setMomAwarding(false);
    if (res.status === 409) {
      setMomMsg("This member already has the badge for this period.");
    } else if (res.ok) {
      setMomMsg("Badge awarded successfully!");
    } else {
      setMomMsg("Failed to award badge.");
    }
  };

  // ---- Inline form component ----
  const renderBadgeForm = (
    form: EditFormState,
    setForm: React.Dispatch<React.SetStateAction<EditFormState>>,
    onSave: () => void,
    onCancel: () => void,
    showThreshold = false
  ) => (
    <div className="mt-3 p-4 bg-cream/60 rounded-xl border border-sage/20 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="font-body text-xs text-charcoal/60 mb-1 block">Name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Badge name"
            className="font-body text-sm"
          />
        </div>
        <div>
          <Label className="font-body text-xs text-charcoal/60 mb-1 block">Icon (emoji)</Label>
          <Input
            value={form.icon}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            placeholder="🏆"
            className="font-body text-sm"
          />
        </div>
      </div>
      <div>
        <Label className="font-body text-xs text-charcoal/60 mb-1 block">Description</Label>
        <Input
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Short description"
          className="font-body text-sm"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="font-body text-xs text-charcoal/60 mb-1 block">Color (hex)</Label>
          <Input
            value={form.color}
            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            placeholder="#7C9070"
            className="font-body text-sm"
          />
          <div className="flex gap-1 mt-2 flex-wrap">
            {COLOR_PRESETS.map((p) => (
              <button
                key={p.hex}
                title={p.label}
                onClick={() => setForm((f) => ({ ...f, color: p.hex }))}
                className="w-6 h-6 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-110"
                style={{ backgroundColor: p.hex, outline: form.color === p.hex ? `2px solid ${p.hex}` : "none" }}
              />
            ))}
          </div>
        </div>
        {showThreshold && (
          <div>
            <Label className="font-body text-xs text-charcoal/60 mb-1 block">
              Threshold (classes)
            </Label>
            <Input
              type="number"
              value={form.threshold_classes}
              onChange={(e) => setForm((f) => ({ ...f, threshold_classes: e.target.value }))}
              placeholder="e.g. 30"
              className="font-body text-sm"
            />
          </div>
        )}
        <div>
          <Label className="font-body text-xs text-charcoal/60 mb-1 block">Sort Order</Label>
          <Input
            type="number"
            value={form.sort_order}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
            className="font-body text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onSave} className="bg-sage hover:bg-sage/90 text-white font-body">
          <Save size={14} className="mr-1" /> Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          className="font-body border-charcoal/20"
        >
          <X size={14} className="mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-cream via-cream to-sage/5">
        <div className="text-sage font-display text-2xl animate-pulse">Loading badges...</div>
      </div>
    );
  }

  const adminUser = session?.user as { name?: string; email?: string } | undefined;

  return (
    <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/5">

      <main className="min-h-screen">
        <div className="max-w-6xl mx-auto p-6 lg:p-8 space-y-6">
          <AdminPageHeader
            title="Badge Management"
            subtitle="Configure milestone tiers and custom recognition badges"
          />

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Milestones" value={ptmTemplates.length} icon={Award} tone="sage" hint="Path-to-mastery tiers" />
            <MetricCard label="Custom Badges" value={customTemplates.length} icon={Star} tone="terracotta" hint="Recognition badges" />
            <MetricCard label="Active" value={activeCount} icon={CheckCircle2} tone="sage" hint="Currently enabled" />
            <MetricCard label="Total Badges" value={totalBadges} icon={Layers} tone="charcoal" hint="All templates" />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-white/60 p-1 rounded-xl shadow-xs border border-sage/10 w-fit mb-8">
            {(["ptm", "custom"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-lg font-body text-sm transition-all duration-300 ${
                  tab === t
                    ? "bg-sage text-white shadow-md"
                    : "text-charcoal/60 hover:text-charcoal hover:bg-sage/10"
                }`}
              >
                {t === "ptm" ? "Path to Mastery" : "Custom Badges"}
              </button>
            ))}
          </div>

          {/* ============ PATH TO MASTERY TAB ============ */}
          {tab === "ptm" && (
            <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-display text-2xl text-charcoal">
                      Path to Mastery <span className="font-body text-base text-charcoal/40">({filteredPtm.length})</span>
                    </CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Milestone tiers auto-awarded by class count
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40" />
                      <Input
                        value={ptmSearch}
                        onChange={(e) => setPtmSearch(e.target.value)}
                        placeholder="Search milestones…"
                        className="h-9 pl-9 border-sage/20 focus:border-sage font-body"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        setPtmForm(emptyForm());
                        setShowAddPtm(true);
                      }}
                      className="bg-sage hover:bg-sage/90 text-white font-body h-9 shrink-0"
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Milestone
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* New milestone form */}
                {showAddPtm && (
                  <div className="mb-4">
                    <h3 className="font-display text-lg text-charcoal mb-1">New Milestone</h3>
                    {renderBadgeForm(
                      ptmForm,
                      setPtmForm,
                      addPtm,
                      () => {
                        setShowAddPtm(false);
                        setPtmForm(emptyForm());
                      },
                      true,
                    )}
                  </div>
                )}

                {filteredPtm.length === 0 ? (
                  <div className="text-center py-12">
                    <Award className="h-12 w-12 text-charcoal/20 mx-auto mb-3" />
                    <p className="font-body text-charcoal/40">
                      {ptmSearch ? "No milestones match your search" : "No milestones yet"}
                    </p>
                    {ptmSearch && (
                      <Button
                        onClick={() => setPtmSearch("")}
                        variant="outline"
                        className="mt-4 border-sage/20 text-sage hover:bg-sage/10 font-body"
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <ResponsiveTable>
                      <div className="rounded-xl border border-sage/15 bg-white overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">
                                <button type="button" onClick={() => togglePtmSort("name")} className="inline-flex items-center gap-1 uppercase hover:text-charcoal transition-colors">
                                  Badge {ptmSortIcon("name")}
                                </button>
                              </TableHead>
                              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[150px]">
                                <button type="button" onClick={() => togglePtmSort("threshold")} className="inline-flex items-center gap-1 uppercase hover:text-charcoal transition-colors">
                                  Threshold {ptmSortIcon("threshold")}
                                </button>
                              </TableHead>
                              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[130px]">Color</TableHead>
                              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[110px]">
                                <button type="button" onClick={() => togglePtmSort("status")} className="inline-flex items-center gap-1 uppercase hover:text-charcoal transition-colors">
                                  Status {ptmSortIcon("status")}
                                </button>
                              </TableHead>
                              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[110px] text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ptmPg.pageItems.map((template) => (
                              <Fragment key={template.id}>
                                <TableRow className="border-sage/10 hover:bg-sage/5">
                                  <TableCell className="px-5 py-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div
                                        className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-xs shrink-0"
                                        style={{ backgroundColor: template.color + "22" }}
                                      >
                                        {template.icon}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="font-body font-medium text-charcoal truncate">{template.name}</div>
                                        {template.description && (
                                          <div className="font-body text-xs text-charcoal/50 truncate">{template.description}</div>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-5 py-4">
                                    {template.threshold_classes !== null ? (
                                      <Badge variant="outline" className="text-xs border-charcoal/20 font-body">
                                        At {template.threshold_classes} classes
                                      </Badge>
                                    ) : (
                                      <span className="font-body text-sm text-charcoal/40">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="px-5 py-4">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="w-4 h-4 rounded-full border border-white shadow-xs shrink-0"
                                        style={{ backgroundColor: template.color }}
                                      />
                                      <span className="font-body text-xs text-charcoal/60 tabular-nums">{template.color}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-5 py-4">
                                    {template.is_active ? (
                                      <Badge className="bg-sage/10 text-sage border-sage/20 font-body">Active</Badge>
                                    ) : (
                                      <Badge variant="outline" className="border-charcoal/15 text-charcoal/40 font-body">Inactive</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="px-5 py-4">
                                    <div className="flex gap-2 justify-end">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 w-8 p-0 font-body border-sage/30 text-sage hover:bg-sage/10"
                                        onClick={() => startEditPtm(template)}
                                        aria-label="Edit milestone"
                                      >
                                        <Edit2 size={14} />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 w-8 p-0 font-body border-terracotta/30 text-terracotta hover:bg-terracotta/10"
                                        onClick={() => deletePtm(template.id)}
                                        aria-label="Delete milestone"
                                      >
                                        <Trash2 size={14} />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                                {editingPtmId === template.id && (
                                  <TableRow className="border-sage/10 hover:bg-transparent">
                                    <TableCell colSpan={5} className="px-5 pb-5 pt-0">
                                      {renderBadgeForm(
                                        ptmForm,
                                        setPtmForm,
                                        () => savePtm(template.id),
                                        () => setEditingPtmId(null),
                                        true,
                                      )}
                                    </TableCell>
                                  </TableRow>
                                )}
                              </Fragment>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </ResponsiveTable>
                    <Pagination
                      page={ptmPg.page}
                      total={ptmPg.total}
                      onChange={ptmPg.setPage}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* ============ CUSTOM BADGES TAB ============ */}
          {tab === "custom" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: template list + create form */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl text-charcoal">Custom Badges</h2>
                  <Button
                    size="sm"
                    onClick={() => setShowCreateCustom(!showCreateCustom)}
                    className="bg-sage hover:bg-sage/90 text-white font-body"
                  >
                    <Plus size={14} className="mr-1" />
                    {showCreateCustom ? "Cancel" : "Create Badge"}
                  </Button>
                </div>

                {showCreateCustom && (
                  <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-xs">
                    <CardContent className="p-5">
                      <h3 className="font-display text-lg text-charcoal mb-2">New Custom Badge</h3>
                      {renderBadgeForm(customForm, setCustomForm, createCustom, () => {
                        setShowCreateCustom(false);
                        setCustomForm(emptyForm());
                      })}
                    </CardContent>
                  </Card>
                )}

                {customTemplates.length === 0 && !showCreateCustom && (
                  <p className="font-body text-sm text-charcoal/50 text-center py-6">
                    No custom badges yet. Create one to get started.
                  </p>
                )}

                {customTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className={`border-0 bg-white/80 backdrop-blur-xl shadow-xs cursor-pointer transition-all duration-200 ${
                      selectedCustomTemplate?.id === template.id
                        ? "ring-2 ring-sage/50 shadow-md"
                        : "hover:shadow-md"
                    }`}
                    onClick={() => {
                      setSelectedCustomTemplate(template);
                      setMemberSearch("");
                      setMemberResults([]);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-xs shrink-0"
                          style={{ backgroundColor: template.color + "22" }}
                        >
                          {template.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-base text-charcoal truncate">
                            {template.name}
                          </p>
                          {template.description && (
                            <p className="font-body text-xs text-charcoal/50 truncate">
                              {template.description}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 border-sage/30 text-sage hover:bg-sage/10"
                            onClick={() => {
                              setEditingCustomId(template.id);
                              setCustomEditForm({
                                name: template.name,
                                description: template.description ?? "",
                                icon: template.icon,
                                color: template.color,
                                threshold_classes: "",
                                sort_order: template.sort_order.toString(),
                              });
                            }}
                          >
                            <Edit2 size={13} />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 border-terracotta/30 text-terracotta hover:bg-terracotta/10"
                            onClick={() => deleteCustom(template.id)}
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>
                      {editingCustomId === template.id && (
                        <div onClick={(e) => e.stopPropagation()}>
                          {renderBadgeForm(
                            customEditForm,
                            setCustomEditForm,
                            () => saveCustomEdit(template.id),
                            () => setEditingCustomId(null)
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {/* Member of the Month */}
                <Card className="border-0 bg-linear-to-br from-terracotta/5 to-sage/5 shadow-xs mt-6">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-display text-lg text-charcoal flex items-center gap-2">
                      <Star size={18} className="text-terracotta" />
                      Member of the Month
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    {momName ? (
                      <div className="space-y-3">
                        <p className="font-body text-sm text-charcoal/70">
                          Current top performer:{" "}
                          <span className="font-semibold text-charcoal">{momName}</span>
                        </p>
                        <Button
                          size="sm"
                          disabled={momAwarding}
                          onClick={awardMoM}
                          className="bg-terracotta hover:bg-terracotta/90 text-white font-body"
                        >
                          <Award size={14} className="mr-1.5" />
                          {momAwarding ? "Awarding…" : "Award Member of the Month Badge"}
                        </Button>
                        {momMsg && (
                          <p className="font-body text-xs text-charcoal/70">{momMsg}</p>
                        )}
                      </div>
                    ) : (
                      <p className="font-body text-sm text-charcoal/50">
                        No data available for this month yet.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right: Allocation panel */}
              <div>
                {selectedCustomTemplate ? (
                  <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-xs sticky top-24">
                    <CardHeader className="pb-2">
                      <CardTitle className="font-display text-lg text-charcoal flex items-center gap-3">
                        <span className="text-2xl">{selectedCustomTemplate.icon}</span>
                        Allocate: {selectedCustomTemplate.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Member search */}
                      <div>
                        <Label className="font-body text-xs text-charcoal/60 mb-1 block">
                          Search members
                        </Label>
                        <div className="relative">
                          <Search
                            size={15}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40"
                          />
                          <Input
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            placeholder="Name or email…"
                            className="pl-9 font-body text-sm"
                          />
                        </div>
                        {searchLoading && (
                          <p className="font-body text-xs text-charcoal/50 mt-1">Searching…</p>
                        )}
                        {memberResults.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {memberResults.map((m) => {
                              const alreadyHas = allocations.some((a) => a.user_id === m.id);
                              return (
                                <li
                                  key={m.id}
                                  className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                                    alreadyHas
                                      ? "border-sage/20 bg-sage/5 opacity-60"
                                      : "border-charcoal/10 hover:bg-sage/5 cursor-pointer"
                                  } transition-colors`}
                                  onClick={() => !alreadyHas && allocateBadge(m)}
                                >
                                  <div>
                                    <p className="font-body text-sm text-charcoal">
                                      {m.full_name || m.email}
                                    </p>
                                    <p className="font-body text-xs text-charcoal/50">{m.email}</p>
                                  </div>
                                  {alreadyHas ? (
                                    <Badge className="bg-sage/10 text-sage border-0 font-body text-xs">
                                      Earned
                                    </Badge>
                                  ) : (
                                    <UserCheck size={16} className="text-sage" />
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>

                      {/* Current holders */}
                      <div>
                        <p className="font-body text-xs text-charcoal/60 mb-2 uppercase tracking-wider">
                          Current holders ({allocations.length})
                        </p>
                        {allocations.length === 0 ? (
                          <p className="font-body text-sm text-charcoal/40">
                            No one has this badge yet.
                          </p>
                        ) : (
                          <ul className="space-y-1.5">
                            {allocations.map((a) => (
                              <li
                                key={a.id}
                                className="flex items-center justify-between px-3 py-2 rounded-lg bg-sage/5 border border-sage/10"
                              >
                                <div>
                                  <p className="font-body text-sm text-charcoal">
                                    {a.profile.full_name || a.profile.email}
                                  </p>
                                  <p className="font-body text-xs text-charcoal/50">
                                    {new Date(a.earned_at).toLocaleDateString("en-IN", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs font-body border-terracotta/30 text-terracotta hover:bg-terracotta/10"
                                  onClick={() => revokeBadge(a.id)}
                                >
                                  Revoke
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="h-48 flex items-center justify-center rounded-2xl border-2 border-dashed border-sage/20">
                    <p className="font-body text-sm text-charcoal/40 text-center">
                      Select a badge template on the left
                      <br />
                      to manage allocations
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
