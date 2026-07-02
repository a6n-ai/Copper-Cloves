import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { requireSessionSSP } from "@/lib/requireSessionSSP";
import { useTabQuery } from "@/hooks/useTabQuery";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });
import { Button } from "@/components/ui/button";
import { EditButton, DeleteButton } from "@/components/ui/quick-actions";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/responsive/ResponsiveDialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Pill } from "@/components/ui/pill";
import { useSession } from "next-auth/react";
import { CrmTriggerType } from "@/lib/crmTriggerTypes";
import { crmTriggerPill } from "@/lib/pillMaps";
import { CrmInsights, CrmAnalytics } from "@/components/crm/CrmInsights";
import { CrmMessageList } from "@/components/crm/CrmMessageList";
import { EmailSettings } from "@/components/admin/crm/EmailSettings";
import { Pagination, usePagination } from "@/components/Pagination";
import { startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  FilterBar,
  FilterSearch,
  FilterSelect,
  FilterDateRange,
  useFilterState,
  dateRangeCodec,
} from "@/components/filters";
import { Plus, Edit, Send, Mail, MessageCircle, Zap, Search } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";

interface CRMTrigger {
  id: string;
  name: string;
  template_id: string;
  trigger_type: string;
  is_active: boolean;
  channel_whatsapp: boolean;
  channel_email: boolean;
  created_at: string;
  template?: {
    name: string;
  } | null;
}

// Minimal template shape the trigger picker needs.
interface TriggerTemplateOption {
  id: string;
  name: string;
}

// Tab definitions — same shape/management as the admin dashboard (value, label, icon).
const CRM_TABS = [
  { v: "hub", l: "Message Log", I: Send },
  { v: "templates", l: "Email Settings", I: Edit },
  { v: "triggers", l: "Triggers", I: Zap },
] as const;

const TRIGGER_TYPES: Array<{ id: string; label: string }> = [
  { id: CrmTriggerType.ClassBookingConfirmed, label: "Class booked (member confirmed)" },
  { id: CrmTriggerType.ClassBookingCancelled, label: "Class booking cancelled (credit returned)" },
  { id: CrmTriggerType.LateCancellation, label: "Class booking cancelled (within 6h, no credit)" },
  { id: CrmTriggerType.AccountCreated, label: "Account created (welcome email)" },
  { id: CrmTriggerType.IndividualClassPaid, label: "Individual class purchase confirmed" },
  { id: "expiry_7_days", label: "7 Days Before Expiry" },
  { id: "expiry_24_hours", label: "24 Hours Before Expiry" },
  { id: "badge_earned", label: "Badge Earned" },
  { id: "birthday", label: "Birthday" },
  { id: "custom", label: "Custom (manual / future automation)" },
];

function CrmHubLoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Tab strip */}
      <div className="flex items-center gap-6 border-b border-sage/10 pb-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-36" />
        ))}
      </div>

      {/* Insights strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Message table */}
      <div className="rounded-xl border border-sage/15 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-4 border-b border-sage/10 last:border-0">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

const CHANNEL_OPTIONS = [
  { value: "all", label: "All channels" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
];

const TRIGGER_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Paused" },
];

interface TriggersTabProps {
  triggers: CRMTrigger[];
  triggerLabelById: Map<string, string>;
  triggerTypes: Array<{ id: string; label: string }>;
  onCreate: () => void;
  onEdit: (t: CRMTrigger) => void;
  onToggle: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
}

function TriggersTab(props: TriggersTabProps) {
  const { triggers, triggerLabelById, triggerTypes, onCreate, onEdit, onToggle, onDelete } = props;
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return triggers.filter((t) => {
      if (q) {
        const hay = `${t.name} ${t.template?.name ?? ""} ${triggerLabelById.get(String(t.trigger_type)) ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (type !== "all" && String(t.trigger_type) !== type) return false;
      if (status === "active" && !t.is_active) return false;
      if (status === "inactive" && t.is_active) return false;
      if (channel === "email" && !t.channel_email) return false;
      if (channel === "whatsapp" && !t.channel_whatsapp) return false;
      return true;
    });
  }, [triggers, search, type, status, channel, triggerLabelById]);

  const filtersDirty = !!search.trim() || type !== "all" || status !== "all" || channel !== "all";
  const resetFilters = () => { setSearch(""); setType("all"); setStatus("all"); setChannel("all"); };
  const resetKey = `${search}|${type}|${status}|${channel}`;
  const { page, setPage, pageItems, total, pageSize } = usePagination(filtered, 8, resetKey);

  // Cold-start empty state — no triggers exist at all.
  if (triggers.length === 0) {
    return (
      <Card className="border-sage/20 bg-white-warm">
        <CardContent className="flex flex-col items-center justify-center py-20">
          <Zap className="text-sage/40 mb-4" size={64} />
          <h3 className="font-body font-semibold text-2xl text-charcoal mb-2">No Triggers Set</h3>
          <p className="font-body text-charcoal/60 mb-6">Create automated triggers to engage members at the right moment</p>
          <Button onClick={onCreate} variant="sage">
            <Plus size={20} className="mr-2" />
            Create First Trigger
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-sage/20 bg-white-warm">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="font-body font-semibold text-2xl text-charcoal">Automation Triggers</CardTitle>
            <CardDescription className="font-body text-charcoal/60">
              {total} of {triggers.length} {triggers.length === 1 ? "trigger" : "triggers"}
              {filtersDirty ? " match your filters" : " — fired automatically on member events"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or template…"
                className="pl-9"
              />
            </div>
            <Button onClick={onCreate} variant="sage" className="shrink-0">
              <Plus size={18} className="mr-2" />
              Create
            </Button>
          </div>
        </div>
        <FilterBar reset={filtersDirty ? resetFilters : undefined} className="border-0 p-0 bg-transparent rounded-none border-b border-sage/10 pb-4">
          <FilterSelect
            value={type}
            onChange={setType}
            options={[{ value: "all", label: "All event types" }, ...triggerTypes.map((t) => ({ value: t.id, label: t.label }))]}
            placeholder="All event types"
            className="w-full sm:w-64"
          />
          <FilterSelect value={status} onChange={setStatus} options={TRIGGER_STATUS_OPTIONS} placeholder="All statuses" className="w-full sm:w-40" />
          <FilterSelect value={channel} onChange={setChannel} options={CHANNEL_OPTIONS} placeholder="All channels" className="w-full sm:w-40" />
        </FilterBar>
      </CardHeader>

      <CardContent className="space-y-3">
        {pageItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="text-sage/30 mb-3" size={40} />
            <p className="font-body text-charcoal/60">No triggers match your filters.</p>
            <button type="button" onClick={resetFilters} className="mt-2 font-body text-sm text-sage hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          pageItems.map((trigger) => (
            <div
              key={trigger.id}
              className="flex items-center gap-4 rounded-xl border border-sage/15 bg-white-warm p-4 transition-shadow duration-300 hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]"
            >
              <div className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center ${trigger.is_active ? "bg-sage/10" : "bg-charcoal/5"}`}>
                <Zap className={trigger.is_active ? "text-sage" : "text-charcoal/40"} size={20} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-body font-semibold text-lg text-charcoal truncate">{trigger.name}</h3>
                  {!trigger.is_active && (
                    <Pill tone="neutral">Paused</Pill>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  <Pill tone={crmTriggerPill(String(trigger.trigger_type)).tone}>{triggerLabelById.get(String(trigger.trigger_type)) ?? trigger.trigger_type}</Pill>
                  <span className="font-body text-sm text-charcoal/60 truncate">→ {trigger.template?.name ?? "(no template)"}</span>
                  {trigger.channel_email && (
                    <span className="inline-flex items-center gap-1 font-body text-xs text-terracotta"><Mail size={12} />Email</span>
                  )}
                  {trigger.channel_whatsapp && (
                    <span className="inline-flex items-center gap-1 font-body text-xs text-sage"><MessageCircle size={12} />WhatsApp</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch
                    checked={trigger.is_active}
                    onCheckedChange={() => onToggle(trigger.id, trigger.is_active)}
                  />
                  <span className="font-body text-sm text-charcoal hidden sm:inline">Active</span>
                </label>
                <EditButton onClick={() => onEdit(trigger)} />
                <DeleteButton onClick={() => onDelete(trigger.id)} />
              </div>
            </div>
          ))
        )}

        <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} className="pt-2" />
      </CardContent>
    </Card>
  );
}

export default function CRMPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useTabQuery(["hub", "templates", "triggers"], "hub");
  // CrmInsights/CrmAnalytics/CrmMessageList key — message-creating flows live
  // elsewhere now, so this stays a stable 0 (their own focus revalidation refreshes).
  const [crmRefresh] = useState(0);

  // Message-log filters (URL-synced — owns "from"/"to"/"q"/"channel"/"status" keys).
  const logF = useFilterState(
    { search: "", channel: "all", status: "all", range: undefined as DateRange | undefined },
    { urlSync: true, codecs: { range: dateRangeCodec("from", "to") } },
  );
  const msgQuery = useMemo(() => {
    const { search, channel, status, range } = logF.values;
    const p = new URLSearchParams();
    if (search.trim()) p.set("q", search.trim());
    if (channel && channel !== "all") p.set("channel", channel);
    if (status && status !== "all") p.set("status", status);
    if (range?.from) p.set("from", startOfDay(range.from).toISOString());
    if (range?.to) p.set("to", endOfDay(range.to).toISOString());
    return p.toString();
  }, [logF.values]);

  // Template options for the trigger picker only (the editor lives in EmailSettings).
  const [templates, setTemplates] = useState<TriggerTemplateOption[]>([]);

  // Triggers state
  const [triggers, setTriggers] = useState<CRMTrigger[]>([]);
  const [showTriggerForm, setShowTriggerForm] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<CRMTrigger | null>(null);
  const [triggerForm, setTriggerForm] = useState({
    name: "",
    template_id: "",
    trigger_type: "custom",
    channel_whatsapp: false,
    channel_email: true
  });

  const [isSaving, setIsSaving] = useState(false);

  const { data: session, status } = useSession();

  const userRole = (session?.user as { role?: string })?.role;
  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated" && userRole !== "admin") { router.push("/login"); return; }
    if (status === "authenticated") {
      // Messages + insights self-fetch; the page needs templates (trigger picker) + triggers.
      void Promise.all([fetchTemplates(), fetchTriggers()]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/admin/crm/templates");
      setTemplates(res.ok ? await res.json() : []);
    } catch (err) {
      console.error("Error fetching templates:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTriggers = async () => {
    try {
      const res = await fetch("/api/admin/crm/triggers");
      setTriggers(res.ok ? await res.json() : []);
    } catch (err) {
      console.error("Error fetching triggers:", err);
    }
  };

  const handleSaveTrigger = async () => {
    setIsSaving(true);
    try {
      if (editingTrigger?.id) {
        await fetch("/api/admin/crm/triggers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingTrigger.id, ...triggerForm }),
        });
      } else {
        await fetch("/api/admin/crm/triggers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...triggerForm, is_active: true }),
        });
      }
      setShowTriggerForm(false);
      setEditingTrigger(null);
      resetTriggerForm();
      fetchTriggers();
    } catch (err) {
      console.error("Error saving trigger:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTrigger = (trigger: CRMTrigger) => {
    setEditingTrigger(trigger);
    setTriggerForm({
      name: trigger.name,
      template_id: trigger.template_id,
      trigger_type: String(trigger.trigger_type),
      channel_whatsapp: trigger.channel_whatsapp,
      channel_email: trigger.channel_email,
    });
    setShowTriggerForm(true);
  };

  const handleToggleTrigger = async (triggerId: string, currentStatus: boolean) => {
    try {
      await fetch("/api/admin/crm/triggers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: triggerId, is_active: !currentStatus }),
      });
      fetchTriggers();
    } catch (err) {
      console.error("Error toggling trigger:", err);
    }
  };

  const handleDeleteTrigger = async (id: string) => {
    if (!confirm("Are you sure you want to delete this trigger?")) return;
    try {
      await fetch(`/api/admin/crm/triggers?id=${id}`, { method: "DELETE" });
      fetchTriggers();
    } catch (err) {
      console.error("Error deleting trigger:", err);
    }
  };

  const resetTriggerForm = () => {
    setTriggerForm({
      name: "",
      template_id: "",
      trigger_type: "custom",
      channel_whatsapp: false,
      channel_email: true
    });
  };

  const triggerLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of TRIGGER_TYPES) m.set(String(t.id), t.label);
    return m;
  }, []);
  const triggerTypes = TRIGGER_TYPES;

  if (loading) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen overflow-x-hidden">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8 min-w-0">
            <CrmHubLoadingSkeleton />
          </div>
        </main>
      </div>
    );
  }

  const activeTriggerCount = triggers.filter((t) => t.is_active).length;

  return (
    <div className="min-h-screen overflow-x-hidden bg-linear-to-br from-cream via-cream to-sage/10">
      <main className="min-h-screen overflow-x-hidden">
        <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8 min-w-0">
            <AdminPageHeader
              title="CRM"
              subtitle="Member communications, templates & automation"
            />

            <CrmInsights refreshKey={crmRefresh} />

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-6">
            {/* Mobile: dropdown picker (no horizontal scroll) */}
            <Select value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <SelectTrigger className="md:hidden w-full border-sage/20 font-body">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRM_TABS.map((t) => (
                  <SelectItem key={t.v} value={t.v} className="font-body">{t.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Desktop: tab row */}
            <TabsList className="hidden md:flex bg-cream/50 border border-sage/15 p-1 flex-wrap gap-1 h-auto justify-start w-auto">
              {CRM_TABS.map((t) => (
                <TabsTrigger
                  key={t.v}
                  value={t.v}
                  className="font-body gap-2 px-3 text-charcoal/60 data-[state=active]:bg-sage data-[state=active]:text-cream data-[state=active]:shadow-xs"
                >
                  <t.I className="h-4 w-4" />
                  {t.l}
                  {t.v === "triggers" && activeTriggerCount > 0 && (
                    <Pill tone="success" className="data-[state=active]:bg-cream/20 data-[state=active]:text-cream">
                      {activeTriggerCount}
                    </Pill>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* MESSAGE LOG TAB (includes its own analytics) */}
            <TabsContent value="hub" className="space-y-6">
            <Card className="border-sage/20 bg-white-warm">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="font-body font-semibold text-2xl text-charcoal">Message Log</CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Every message sent or scheduled to members
                    </CardDescription>
                  </div>
                </div>
                <FilterBar reset={logF.isActive ? logF.reset : undefined} className="border-0 p-0 bg-transparent rounded-none border-b border-sage/10 pb-4">
                  <FilterSearch
                    value={logF.values.search}
                    onChange={(v) => logF.set("search", v)}
                    placeholder="Search recipient, email, subject…"
                    aria-label="Search messages"
                  />
                  <FilterSelect
                    value={logF.values.channel}
                    onChange={(v) => logF.set("channel", v)}
                    options={CHANNEL_OPTIONS}
                    placeholder="All channels"
                    className="w-full sm:w-44"
                  />
                  <FilterSelect
                    value={logF.values.status}
                    onChange={(v) => logF.set("status", v)}
                    options={[
                      { value: "all", label: "All statuses" },
                      { value: "sent", label: "Sent" },
                      { value: "failed", label: "Failed" },
                      { value: "scheduled", label: "Scheduled" },
                      { value: "pending", label: "Pending" },
                    ]}
                    placeholder="All statuses"
                    className="w-full sm:w-44"
                  />
                  <FilterDateRange
                    value={logF.values.range}
                    onChange={(v) => logF.set("range", v)}
                    className="w-full sm:w-56"
                  />
                </FilterBar>
              </CardHeader>
              <CardContent>
                <CrmMessageList
                  query={msgQuery}
                  refreshKey={crmRefresh}
                  emptyLabel="No matching messages."
                />
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h2 className="font-body font-semibold text-xl text-charcoal">Message analytics</h2>
              <CrmAnalytics refreshKey={crmRefresh} />
            </div>
            </TabsContent>

            {/* EMAIL SETTINGS TAB — two-pane template editor */}
            <TabsContent value="templates" className="space-y-6">
              <EmailSettings onChanged={fetchTemplates} />
            </TabsContent>

            {/* TRIGGERS TAB */}
            <TabsContent value="triggers" className="space-y-6">
              <TriggersTab
                triggers={triggers}
                triggerLabelById={triggerLabelById}
                triggerTypes={triggerTypes}
                onCreate={() => { resetTriggerForm(); setEditingTrigger(null); setShowTriggerForm(true); }}
                onEdit={handleEditTrigger}
                onToggle={handleToggleTrigger}
                onDelete={handleDeleteTrigger}
              />
            </TabsContent>
          </Tabs>

        </div>
      </main>

      {/* Trigger Form Modal */}
      <ResponsiveDialog
        open={showTriggerForm}
        onOpenChange={(o) => { if (!o) { setShowTriggerForm(false); setEditingTrigger(null); } }}
      >
        <ResponsiveDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-body font-semibold text-2xl text-charcoal">
              {editingTrigger ? "Edit Automation Trigger" : "Create Automation Trigger"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Fire a template automatically when a member event occurs.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="space-y-5 py-2">
            <div>
              <label className="font-body text-sm text-charcoal/70 mb-2 block">Trigger Name</label>
              <Input
                value={triggerForm.name}
                onChange={(e) => setTriggerForm({ ...triggerForm, name: e.target.value })}
                placeholder="e.g., Expiry Warning - Week Before"
                className="font-body"
              />
            </div>

            <div>
              <label className="font-body text-sm text-charcoal/70 mb-2 block">Trigger Type</label>
              <Select
                value={triggerForm.trigger_type}
                onValueChange={(v) => setTriggerForm({ ...triggerForm, trigger_type: v })}
              >
                <SelectTrigger className="w-full border-sage/30 font-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {triggerTypes.map(type => (
                    <SelectItem key={type.id} value={type.id} className="font-body">{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="font-body text-sm text-charcoal/70 mb-2 block">Template</label>
              <Select
                value={triggerForm.template_id || undefined}
                onValueChange={(v) => setTriggerForm({ ...triggerForm, template_id: v })}
              >
                <SelectTrigger className="w-full border-sage/30 font-body">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(template => (
                    <SelectItem key={template.id} value={template.id} className="font-body">{template.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="font-body text-sm text-charcoal/70 mb-3 block">Channels</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={triggerForm.channel_email}
                    onCheckedChange={(c) => setTriggerForm({ ...triggerForm, channel_email: c === true })}
                  />
                  <Mail size={16} className="text-terracotta" />
                  <span className="font-body text-sm text-charcoal">Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={triggerForm.channel_whatsapp}
                    onCheckedChange={(c) => setTriggerForm({ ...triggerForm, channel_whatsapp: c === true })}
                  />
                  <MessageCircle size={16} className="text-sage" />
                  <span className="font-body text-sm text-charcoal">WhatsApp</span>
                </label>
              </div>
            </div>
          </div>

          <ResponsiveDialogFooter>
            <Button
              onClick={() => { setShowTriggerForm(false); setEditingTrigger(null); }}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTrigger}
              disabled={isSaving || !triggerForm.name || !triggerForm.template_id}
              variant="sage"
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  {editingTrigger ? "Saving..." : "Creating..."}
                </>
              ) : (
                <>
                  <Zap size={16} className="mr-2" />
                  {editingTrigger ? "Save Changes" : "Create Trigger"}
                </>
              )}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
