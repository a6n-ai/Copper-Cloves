import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Pill } from "@/components/ui/pill";
import { useSession } from "next-auth/react";
import { CrmTriggerType } from "@/lib/crmTriggerTypes";
import { CrmInsights, CrmAnalytics } from "@/components/crm/CrmInsights";
import { CrmMessageList } from "@/components/crm/CrmMessageList";
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
import {
  Plus,
  Edit,
  X,
  Save,
  Send,
  Mail,
  MessageCircle,
  Zap,
  Copy,
  Search,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { CloseButton } from "@/components/ui/quick-actions";

interface CRMTemplate {
  id: string;
  name: string;
  template_key: string | null;
  is_system: boolean;
  subject: string | null;
  message_body: string;
  template_type: string;
  channel_whatsapp: boolean;
  channel_email: boolean;
  variables: string[];
  created_at: string;
}

// Sample values used by the preview iframe for known system placeholders.
const PREVIEW_SAMPLES: Record<string, string> = {
  memberName: "Priya Kapoor",
  className: "Hatha Yoga",
  instructorName: "Vivek",
  dateStr: "Mon 20 May",
  startTime: "7:00 PM",
  endTime: "8:00 PM",
  portalUrl: "https://thestudiobycopperandcloves.in",
  transactionId: "pay_PRb1aXyZ123",
  paymentDate: "Sun 19 May",
  amountPaid: "₹800",
  email: "priya@example.com",
  password: "TempPass1234",
  loginUrl: "https://thestudiobycopperandcloves.in/portal/login",
  creditsCount: "1",
  // CRM commonVariables (legacy keys)
  Member_Name: "Priya Kapoor",
  Class_Name: "Hatha Yoga",
  Class_Time: "7:00 PM",
  Class_Date: "Mon 20 May",
  Instructor_Name: "Vivek",
  Portal_Link: "https://thestudiobycopperandcloves.in/portal",
  Studio_Link: "https://thestudiobycopperandcloves.in",
  Expiry_Date: "31 May 2026",
  Renewal_Link: "https://thestudiobycopperandcloves.in/portal/packages",
  Badge_Name: "Path to Mastery",
  Class_Count: "12",
  Last_Class_Attended: "Hatha Yoga",
  Credits_Remaining: "5",
};

function renderPreview(body: string, subject: string): string {
  const sub = (s: string) =>
    s.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, k) =>
      k in PREVIEW_SAMPLES ? PREVIEW_SAMPLES[k] : `{{${k}}}`
    );
  const renderedSubject = sub(subject);
  const renderedBody = sub(body);
  // If body already contains <html>, just return it. Else wrap.
  if (/<html|<!doctype/i.test(renderedBody)) return renderedBody;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${renderedSubject}</title></head><body style="font-family:Georgia,serif;margin:0;padding:16px;background:#F5F0E8">${renderedBody}</body></html>`;
}

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

// Tab definitions — same shape/management as the admin dashboard (value, label, icon).
const CRM_TABS = [
  { v: "hub", l: "Message Log", I: Send },
  { v: "templates", l: "Templates", I: Edit },
  { v: "triggers", l: "Triggers", I: Zap },
] as const;

// Static reference data — hoisted to module scope so they aren't rebuilt every
// CRMPage render. Used by both render JSX and the label-by-id Maps below.
const TEMPLATE_TYPES: Array<{ id: string; label: string }> = [
  { id: "class_booking", label: "Class booking" },
  { id: "expiry", label: "Membership Expiry" },
  { id: "badge", label: "Badge Achievement" },
  { id: "birthday", label: "Birthday Greeting" },
  { id: "custom", label: "Custom Message" },
];

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
          <h3 className="font-display text-2xl text-charcoal mb-2">No Triggers Set</h3>
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
            <CardTitle className="font-display text-2xl text-charcoal">Automation Triggers</CardTitle>
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
                  <h3 className="font-display text-lg text-charcoal truncate">{trigger.name}</h3>
                  {!trigger.is_active && (
                    <Pill tone="neutral">Paused</Pill>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  <Pill tone="success">{triggerLabelById.get(String(trigger.trigger_type)) ?? trigger.trigger_type}</Pill>
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
                  <input
                    type="checkbox"
                    checked={trigger.is_active}
                    onChange={() => onToggle(trigger.id, trigger.is_active)}
                    className="w-5 h-5 accent-sage"
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

interface TemplatesTabProps {
  templates: CRMTemplate[];
  templateLabelById: Map<string, string>;
  templateTypes: Array<{ id: string; label: string }>;
  onCreate: () => void;
  onSend: (t: CRMTemplate) => void;
  onEdit: (t: CRMTemplate) => void;
  onDuplicate: (t: CRMTemplate) => void;
  onDelete: (id: string) => void;
}

const TEMPLATE_SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "system", label: "System" },
  { value: "custom", label: "Custom" },
];

function TemplatesTab(props: TemplatesTabProps) {
  const { templates, templateLabelById, templateTypes, onCreate, onSend, onEdit, onDuplicate, onDelete } = props;
  const tplF = useFilterState(
    { search: "", type: "all", channel: "all", source: "all" },
  );
  const { search, type, channel, source } = tplF.values;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (q) {
        const hay = `${t.name} ${t.subject ?? ""} ${t.template_key ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (type !== "all" && t.template_type !== type) return false;
      if (channel === "email" && !t.channel_email) return false;
      if (channel === "whatsapp" && !t.channel_whatsapp) return false;
      if (source === "system" && !t.is_system) return false;
      if (source === "custom" && t.is_system) return false;
      return true;
    });
  }, [templates, search, type, channel, source]);

  const resetKey = `${search}|${type}|${channel}|${source}`;
  const { page, setPage, pageItems, total, pageSize } = usePagination(filtered, 6, resetKey);

  return (
    <Card className="border-sage/20 bg-white-warm">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="font-display text-2xl text-charcoal">Message Templates</CardTitle>
            <CardDescription className="font-body text-charcoal/60">
              {total} of {templates.length} {templates.length === 1 ? "template" : "templates"}
              {tplF.isActive ? " match your filters" : " — reusable email & WhatsApp content"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onCreate} variant="sage" className="shrink-0">
              <Plus size={18} className="mr-2" />
              Create
            </Button>
          </div>
        </div>
        <FilterBar reset={tplF.isActive ? tplF.reset : undefined} className="border-0 p-0 bg-transparent rounded-none border-b border-sage/10 pb-4">
          <FilterSearch
            value={search}
            onChange={(v) => tplF.set("search", v)}
            placeholder="Search name, subject, key…"
            aria-label="Search templates"
          />
          <FilterSelect
            value={type}
            onChange={(v) => tplF.set("type", v)}
            options={[{ value: "all", label: "All types" }, ...templateTypes.map((t) => ({ value: t.id, label: t.label }))]}
            placeholder="All types"
            className="w-full sm:w-52"
          />
          <FilterSelect value={channel} onChange={(v) => tplF.set("channel", v)} options={CHANNEL_OPTIONS} placeholder="All channels" className="w-full sm:w-40" />
          <FilterSelect value={source} onChange={(v) => tplF.set("source", v)} options={TEMPLATE_SOURCE_OPTIONS} placeholder="All sources" className="w-full sm:w-40" />
        </FilterBar>
      </CardHeader>

      <CardContent className="space-y-4">
        {pageItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="text-sage/30 mb-3" size={40} />
            <p className="font-body text-charcoal/60">
              {templates.length === 0 ? "No templates yet." : "No templates match your filters."}
            </p>
            {templates.length === 0 ? (
              <Button onClick={onCreate} variant="sage" className="mt-3">
                <Plus size={18} className="mr-2" />
                Create First Template
              </Button>
            ) : (
              <button type="button" onClick={tplF.reset} className="mt-2 font-body text-sm text-sage hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pageItems.map((template) => (
              <Card key={template.id} className="border-sage/20 bg-white-warm transition-shadow duration-300 hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
                <CardHeader className="border-b border-sage/10">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="font-display text-xl text-charcoal mb-1">
                        {template.name}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone="success">
                          {templateLabelById.get(template.template_type) || template.template_type}
                        </Pill>
                        {template.is_system && (
                          <Pill tone="warning">System</Pill>
                        )}
                        {template.template_key && (
                          <code className="font-mono text-[10px] bg-charcoal/5 text-charcoal/60 px-1.5 py-0.5 rounded">
                            {template.template_key}
                          </code>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => onSend(template)}
                        size="sm"
                        variant="ghost"
                        className="text-sage hover:bg-sage/10"
                        title="Send to member"
                        disabled={!template.channel_email}
                      >
                        <Send size={14} />
                      </Button>
                      <EditButton onClick={() => onEdit(template)} />
                      <Button
                        onClick={() => onDuplicate(template)}
                        size="sm"
                        variant="ghost"
                        className="text-terracotta hover:bg-terracotta/10"
                        title="Duplicate"
                      >
                        <Copy size={14} />
                      </Button>
                      {!template.is_system && (
                        <DeleteButton onClick={() => onDelete(template.id)} />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {template.subject && (
                    <div className="mb-3">
                      <p className="font-body text-xs text-charcoal/50 mb-1">Subject:</p>
                      <p className="font-body text-sm text-charcoal">{template.subject}</p>
                    </div>
                  )}

                  <div className="rounded-lg overflow-hidden border border-sage/10 mb-4 bg-white-warm" style={{ height: 180 }}>
                    <iframe
                      title={`preview-${template.id}`}
                      srcDoc={renderPreview(template.message_body, template.subject || "")}
                      sandbox=""
                      className="w-full h-full pointer-events-none"
                      style={{ transform: "scale(0.6)", transformOrigin: "top left", width: "166.66%", height: "300px" }}
                    />
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    {template.channel_email && (
                      <Pill brand="gmail" icon={<Mail size={12} />}>
                        Email
                      </Pill>
                    )}
                    {template.channel_whatsapp && (
                      <Pill brand="whatsapp" icon={<MessageCircle size={12} />}>
                        WhatsApp
                      </Pill>
                    )}
                  </div>

                  {template.variables && template.variables.length > 0 && (
                    <div>
                      <p className="font-body text-xs text-charcoal/50 mb-2">Variables:</p>
                      <div className="flex flex-wrap gap-1">
                        {template.variables.map((variable, idx) => (
                          <Pill key={idx} tone="success" size="sm" className="font-mono">
                            {`{{${variable}}}`}
                          </Pill>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} className="pt-2" />
      </CardContent>
    </Card>
  );
}

type CrmSendMember = { id: string; full_name: string | null; email: string };

interface CrmSendDialogProps {
  sendDialog: CRMTemplate;
  sendTarget: CrmSendMember | null;
  sendQuery: string;
  sendResults: CrmSendMember[];
  sendOverrides: Record<string, string>;
  sendResult: { ok: boolean; msg: string } | null;
  sending: boolean;
  setSendDialog: (v: CRMTemplate | null) => void;
  setSendTarget: (v: CrmSendMember | null) => void;
  setSendQuery: (v: string) => void;
  setSendOverrides: (v: Record<string, string>) => void;
  onSend: () => void;
}

function renderCrmSendDialog(props: CrmSendDialogProps) {
  const {
    sendDialog, sendTarget, sendQuery, sendResults, sendOverrides, sendResult, sending,
    setSendDialog, setSendTarget, setSendQuery, setSendOverrides, onSend,
  } = props;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-charcoal/70 backdrop-blur-xs" onClick={() => setSendDialog(null)} />
      <div className="relative bg-white-warm rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sage/10">
          <div>
            <h3 className="font-display text-2xl text-charcoal">Send template</h3>
            <p className="font-body text-xs text-charcoal/60 mt-0.5">{sendDialog.name}</p>
          </div>
          <CloseButton onClick={() => setSendDialog(null)} className="rounded-full" />
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          <div>
            <label className="font-body text-sm text-charcoal/70 mb-2 block">Recipient member</label>
            {sendTarget ? (
              <div className="flex items-center justify-between bg-sage/5 border border-sage/20 rounded-lg px-3 py-2">
                <div>
                  <p className="font-body text-sm text-charcoal">{sendTarget.full_name || "(no name)"}</p>
                  <p className="font-body text-xs text-charcoal/60">{sendTarget.email}</p>
                </div>
                <CloseButton
                  onClick={() => setSendTarget(null)}
                  label="Remove recipient"
                  className="h-8 w-8"
                />
              </div>
            ) : (
              <>
                <Input
                  autoFocus
                  placeholder="Search by name or email…"
                  value={sendQuery}
                  onChange={(e) => setSendQuery(e.target.value)}
                  className="font-body"
                />
                {sendResults.length > 0 && (
                  <div className="mt-2 border border-sage/20 rounded-lg max-h-48 overflow-y-auto bg-white-warm">
                    {sendResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSendTarget(m)}
                        className="w-full text-left px-3 py-2 hover:bg-sage/5 border-b border-sage/10 last:border-0"
                      >
                        <p className="font-body text-sm text-charcoal">{m.full_name || "(no name)"}</p>
                        <p className="font-body text-xs text-charcoal/60">{m.email}</p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {sendDialog.variables?.length > 0 && (
            <div>
              <label className="font-body text-sm text-charcoal/70 mb-2 block">
                Variables <span className="text-charcoal/40">(optional — leave blank to use defaults)</span>
              </label>
              <div className="space-y-2">
                {sendDialog.variables.map((v) => (
                  <div key={v} className="flex items-center gap-2">
                    <code className="font-mono text-xs bg-sage/10 text-sage px-2 py-1 rounded min-w-[140px]">{`{{${v}}}`}</code>
                    <Input
                      placeholder={`Override ${v}`}
                      value={sendOverrides[v] ?? ""}
                      onChange={(e) => setSendOverrides({ ...sendOverrides, [v]: e.target.value })}
                      className="font-body text-sm"
                    />
                  </div>
                ))}
              </div>
              <p className="font-body text-xs text-charcoal/50 mt-2">
                Defaults used when blank: <code>memberName</code>, <code>email</code>, <code>portalUrl</code>, <code>loginUrl</code> auto-filled from the member's profile and site config.
              </p>
            </div>
          )}

          {sendResult && (
            <div className={`rounded-lg p-3 ${sendResult.ok ? "bg-sage/10 border border-sage/20 text-sage" : "bg-[#a05e38]/10 border border-[#a05e38]/25 text-[#a05e38]"}`}>
              <p className="font-body text-sm">{sendResult.msg}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-sage/10 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setSendDialog(null)}
          >
            Close
          </Button>
          <Button
            onClick={onSend}
            disabled={sending || !sendTarget}
            variant="sage"
          >
            {sending ? (
              <><Spinner className="mr-2 size-4" />Sending…</>
            ) : (
              <><Send size={14} className="mr-2" />Send email</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CRMPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"hub" | "templates" | "triggers">("hub");
  // Bumped after a manual send so the message table + insights refetch.
  const [crmRefresh, setCrmRefresh] = useState(0);

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

  // Templates state
  const [templates, setTemplates] = useState<CRMTemplate[]>([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CRMTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    subject: "",
    message_body: "",
    template_type: "custom",
    channel_whatsapp: false,
    channel_email: true,
    template_key: null as string | null,
    is_system: false,
    variables: [] as string[],
  });
  const [showPreview, setShowPreview] = useState(false);
  const [editMode, setEditMode] = useState<"preview" | "html">("preview");
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Manual send dialog state
  const [sendDialog, setSendDialog] = useState<CRMTemplate | null>(null);
  const [sendQuery, setSendQuery] = useState("");
  const [sendResults, setSendResults] = useState<Array<{ id: string; full_name: string | null; email: string }>>([]);
  const [sendTarget, setSendTarget] = useState<{ id: string; full_name: string | null; email: string } | null>(null);
  const [sendOverrides, setSendOverrides] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Member search (debounced)
  useEffect(() => {
    if (!sendDialog) return;
    const q = sendQuery.trim();
    if (!q) { setSendResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/members-search?q=${encodeURIComponent(q)}`);
        if (r.ok) setSendResults(await r.json());
      } catch (e) { console.error(e); }
    }, 250);
    return () => clearTimeout(t);
  }, [sendQuery, sendDialog]);

  const openSendDialog = (template: CRMTemplate) => {
    setSendDialog(template);
    setSendQuery("");
    setSendResults([]);
    setSendTarget(null);
    setSendOverrides({});
    setSendResult(null);
  };

  const handleManualSend = async () => {
    if (!sendDialog || !sendTarget) return;
    setSending(true);
    setSendResult(null);
    try {
      const r = await fetch("/api/admin/crm/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: sendDialog.id,
          user_id: sendTarget.id,
          variables: sendOverrides,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setSendResult({ ok: true, msg: `Email sent to ${sendTarget.email}` });
        setCrmRefresh((n) => n + 1);
      } else {
        setSendResult({ ok: false, msg: data?.error || `Send failed (${r.status})` });
      }
    } catch (e: unknown) {
      setSendResult({ ok: false, msg: e instanceof Error ? e.message : "Network error" });
    } finally {
      setSending(false);
    }
  };

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
    if (status === "unauthenticated") { router.push("/admin/login"); return; }
    if (status === "authenticated" && userRole !== "admin") { router.push("/admin/login"); return; }
    if (status === "authenticated") {
      // Messages + insights are self-fetched by their components; the page only
      // needs templates (for cards + trigger picker) and triggers.
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

  const handleSaveTemplate = async () => {
    setIsSaving(true);
    try {
      const extracted = extractVariables(templateForm.message_body);
      const mergedVars = templateForm.is_system
        ? Array.from(new Set([...templateForm.variables, ...extracted]))
        : extracted;
      const templateData = { ...templateForm, variables: mergedVars };
      if (editingTemplate?.id) {
        await fetch("/api/admin/crm/templates", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingTemplate.id, ...templateData }),
        });
      } else {
        await fetch("/api/admin/crm/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(templateData),
        });
      }
      setShowTemplateForm(false);
      setEditingTemplate(null);
      resetTemplateForm();
      fetchTemplates();
    } catch (err) {
      console.error("Error saving template:", err);
    } finally {
      setIsSaving(false);
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

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await fetch(`/api/admin/crm/templates?id=${id}`, { method: "DELETE" });
      fetchTemplates();
    } catch (err) {
      console.error("Error deleting template:", err);
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

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    return matches.map(match => match.replace(/\{\{|\}\}/g, "").trim());
  };

  const insertVariable = (variable: string) => {
    setTemplateForm(prev => ({
      ...prev,
      message_body: prev.message_body + `{{${variable}}}`
    }));
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: "",
      subject: "",
      message_body: "",
      template_type: "custom",
      channel_whatsapp: false,
      channel_email: true,
      template_key: null,
      is_system: false,
      variables: [],
    });
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

  const handleEditTemplate = (template: CRMTemplate) => {
    setEditingTemplate(template);
    setEditMode("preview");
    setTemplateForm({
      name: template.name,
      subject: template.subject || "",
      message_body: template.message_body,
      template_type: template.template_type,
      channel_whatsapp: template.channel_whatsapp,
      channel_email: template.channel_email,
      template_key: template.template_key,
      is_system: template.is_system,
      variables: template.variables || [],
    });
    setShowTemplateForm(true);
  };

  const duplicateTemplate = async (template: CRMTemplate) => {
    try {
      await fetch("/api/admin/crm/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          subject: template.subject,
          message_body: template.message_body,
          template_type: template.template_type,
          channel_whatsapp: template.channel_whatsapp,
          channel_email: template.channel_email,
          variables: template.variables,
        }),
      });
      fetchTemplates();
    } catch (err) {
      console.error("Error duplicating template:", err);
    }
  };

  // Lookup id → label once per render. Avoids `.find()` per row in the
  // templates + triggers tables (was O(rows × types)).
  const templateLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of TEMPLATE_TYPES) m.set(t.id, t.label);
    return m;
  }, []);
  const triggerLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of TRIGGER_TYPES) m.set(String(t.id), t.label);
    return m;
  }, []);
  const templateTypes = TEMPLATE_TYPES;
  const triggerTypes = TRIGGER_TYPES;

  const commonVariables = [
    "Member_Name",
    "Class_Name",
    "Class_Time",
    "Class_Date",
    "Instructor_Name",
    "Portal_Link",
    "Studio_Link",
    "Expiry_Date",
    "Renewal_Link",
    "Badge_Name",
    "Class_Count",
    "Last_Class_Attended",
    "Credits_Remaining",
  ];

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
                    <CardTitle className="font-display text-2xl text-charcoal">Message Log</CardTitle>
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
              <h2 className="font-display text-xl text-charcoal">Message analytics</h2>
              <CrmAnalytics refreshKey={crmRefresh} />
            </div>
            </TabsContent>

            {/* TEMPLATES TAB */}
            <TabsContent value="templates" className="space-y-6">
              <TemplatesTab
                templates={templates}
                templateLabelById={templateLabelById}
                templateTypes={templateTypes}
                onCreate={() => {
                  resetTemplateForm();
                  setEditingTemplate(null);
                  setEditMode("preview");
                  setShowTemplateForm(true);
                }}
                onSend={openSendDialog}
                onEdit={handleEditTemplate}
                onDuplicate={duplicateTemplate}
                onDelete={handleDeleteTemplate}
              />
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

      {/* Template Form Modal */}
      <Drawer
        direction="right"
        open={showTemplateForm}
        onOpenChange={(o) => { if (!o) { setShowTemplateForm(false); setEditingTemplate(null); } }}
      >
        <DrawerContent direction="right" className="max-w-3xl overflow-y-auto">
            <div className="sticky top-0 bg-white-warm border-b border-sage/10 p-6 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <DrawerTitle className="font-display text-3xl text-charcoal">
                    {editingTemplate ? "Edit Template" : "Create New Template"}
                  </DrawerTitle>
                  <DrawerDescription className="sr-only">Email and WhatsApp message template editor</DrawerDescription>
                  {templateForm.is_system && templateForm.template_key && (
                    <div className="flex items-center gap-2 mt-1">
                      <Pill tone="warning">System</Pill>
                      <code className="font-mono text-xs bg-charcoal/5 text-charcoal/60 px-1.5 py-0.5 rounded">
                        {templateForm.template_key}
                      </code>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPreview(true)}
                    disabled={!templateForm.message_body}
                    className="font-body text-xs bg-sage/10 text-sage px-3 py-2 rounded hover:bg-sage/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Preview with sample data
                  </button>
                  <button
                    onClick={() => {
                      setShowTemplateForm(false);
                      setEditingTemplate(null);
                    }}
                    className="w-10 h-10 rounded-full hover:bg-sage/10 flex items-center justify-center transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="font-body text-sm text-charcoal/70 mb-2 block">Template Name</label>
                <Input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder="e.g., The Ritual Renewal"
                  className="font-body"
                />
              </div>

              <div>
                <label className="font-body text-sm text-charcoal/70 mb-2 block">Template Type</label>
                <select
                  value={templateForm.template_type}
                  onChange={(e) => setTemplateForm({ ...templateForm, template_type: e.target.value })}
                  className="w-full p-3 rounded-lg border border-sage/30 font-body"
                >
                  {templateTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-body text-sm text-charcoal/70 mb-2 block">
                  Email Subject <span className="text-charcoal/40">(for email channel)</span>
                </label>
                <Input
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                  placeholder="e.g., Your sanctuary awaits - Renew your journey"
                  className="font-body"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-body text-sm text-charcoal/70">Message Body</label>
                  <div className="flex gap-1 bg-sage/10 rounded-full p-1">
                    <button
                      type="button"
                      onClick={() => setEditMode("preview")}
                      className={`font-body text-xs px-3 py-1 rounded-full transition-colors ${
                        editMode === "preview" ? "bg-sage text-cream" : "text-sage hover:bg-sage/20"
                      }`}
                    >
                      Visual
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMode("html")}
                      className={`font-body text-xs px-3 py-1 rounded-full transition-colors ${
                        editMode === "html" ? "bg-sage text-cream" : "text-sage hover:bg-sage/20"
                      }`}
                    >
                      HTML
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <p className="font-body text-xs text-charcoal/50 mb-1">
                    {templateForm.is_system ? "System placeholders (click to insert):" : "Insert variables:"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(templateForm.is_system && templateForm.variables.length > 0
                      ? templateForm.variables
                      : commonVariables
                    ).map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        onClick={() => insertVariable(variable)}
                        className="font-mono text-xs bg-sage/10 text-sage px-2 py-1 rounded hover:bg-sage/20 transition-colors"
                      >
                        {`{{${variable}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                {editMode === "preview" ? (
                  <div className="border border-sage/20 rounded-lg overflow-hidden bg-white-warm" style={{ height: 600 }}>
                    <iframe
                      ref={previewIframeRef}
                      title="visual-editor"
                      key={editingTemplate?.id ?? "new"}
                      srcDoc={`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;padding:16px;background:#F5F0E8;font-family:Georgia,serif;min-height:100vh}body[contenteditable=true]{outline:2px dashed transparent}body[contenteditable=true]:focus{outline-color:#7C9070}[data-placeholder]{background:#FEF3C7;color:#92400E;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:0.85em}</style></head><body contenteditable="true">${templateForm.message_body
                        .replace(/<!DOCTYPE[^>]*>/i, "")
                        .replace(/<\/?html[^>]*>/gi, "")
                        .replace(/<head[\s\S]*?<\/head>/gi, "")
                        .replace(/<\/?body[^>]*>/gi, "")
                        .replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, '<span data-placeholder="$1">{{$1}}</span>')}</body><script>
                        document.body.addEventListener('blur', () => {
                          const html = document.body.innerHTML.replace(/<span data-placeholder="([^"]+)">[^<]*<\\/span>/g, '{{$1}}');
                          window.parent.postMessage({ type: 'visual-edit', html }, '*');
                        }, true);
                      </script></html>`}
                      className="w-full h-full"
                      onLoad={(e) => {
                        const win = (e.currentTarget as HTMLIFrameElement).contentWindow;
                        if (!win) return;
                        const handler = (ev: MessageEvent) => {
                          if (ev.source !== win) return;
                          if (ev.data?.type !== "visual-edit") return;
                          setTemplateForm((prev) => ({ ...prev, message_body: ev.data.html }));
                        };
                        window.addEventListener("message", handler);
                        // store cleanup on iframe element
                        (e.currentTarget as unknown as { __cleanup?: () => void }).__cleanup = () =>
                          window.removeEventListener("message", handler);
                      }}
                    />
                  </div>
                ) : (
                  <Textarea
                    value={templateForm.message_body}
                    onChange={(e) => setTemplateForm({ ...templateForm, message_body: e.target.value })}
                    placeholder="Hi {{memberName}},&#10;&#10;Your message here..."
                    rows={templateForm.is_system ? 22 : 14}
                    className="font-mono text-xs"
                  />
                )}
                <p className="font-body text-xs text-charcoal/50 mt-2">
                  {editMode === "preview"
                    ? "Visual mode: click anywhere to edit text inline. Yellow chips are dynamic placeholders — keep them as-is. Switch to HTML to edit markup directly."
                    : "Use double curly braces for variables: "}
                  {editMode === "html" && <code className="font-mono bg-sage/10 px-1">{`{{Variable_Name}}`}</code>}
                </p>
              </div>

              <div>
                <label className="font-body text-sm text-charcoal/70 mb-3 block">Channels</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={templateForm.channel_email}
                      onChange={(e) => setTemplateForm({ ...templateForm, channel_email: e.target.checked })}
                      className="w-5 h-5 accent-sage"
                    />
                    <Mail size={16} className="text-terracotta" />
                    <span className="font-body text-sm text-charcoal">Email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={templateForm.channel_whatsapp}
                      onChange={(e) => setTemplateForm({ ...templateForm, channel_whatsapp: e.target.checked })}
                      className="w-5 h-5 accent-sage"
                    />
                    <MessageCircle size={16} className="text-sage" />
                    <span className="font-body text-sm text-charcoal">WhatsApp</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => {
                    setShowTemplateForm(false);
                    setEditingTemplate(null);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTemplate}
                  disabled={isSaving || !templateForm.name || !templateForm.message_body}
                  variant="sage"
                  className="flex-1"
                >
                  {isSaving ? (
                    <>
                      <Spinner className="mr-2 size-4" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} className="mr-2" />
                      {editingTemplate ? "Update Template" : "Create Template"}
                    </>
                  )}
                </Button>
              </div>
            </div>
        </DrawerContent>
      </Drawer>

      {/* Manual Send Modal */}
      {sendDialog && renderCrmSendDialog({
        sendDialog,
        sendTarget,
        sendQuery,
        sendResults,
        sendOverrides,
        sendResult,
        sending,
        setSendDialog,
        setSendTarget,
        setSendQuery,
        setSendOverrides,
        onSend: handleManualSend,
      })}

      {/* Template Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/70 backdrop-blur-xs" onClick={() => setShowPreview(false)} />
          <div className="relative bg-white-warm rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-sage/10">
              <div>
                <h3 className="font-display text-2xl text-charcoal">Preview</h3>
                <p className="font-body text-xs text-charcoal/60 mt-0.5">
                  Sample values filled in for placeholders. Real send uses actual member data.
                </p>
              </div>
              <CloseButton onClick={() => setShowPreview(false)} className="rounded-full" />
            </div>
            <div className="px-6 py-3 border-b border-sage/10 bg-cream/30">
              <p className="font-body text-xs text-charcoal/50 mb-1">Subject</p>
              <p className="font-body text-sm text-charcoal">
                {templateForm.subject
                  ? templateForm.subject.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, k) =>
                      k in PREVIEW_SAMPLES ? PREVIEW_SAMPLES[k] : `{{${k}}}`
                    )
                  : <span className="text-charcoal/40 italic">(no subject)</span>}
              </p>
            </div>
            <iframe
              title="template-preview"
              srcDoc={renderPreview(templateForm.message_body, templateForm.subject)}
              sandbox=""
              className="flex-1 w-full min-h-[500px] bg-white-warm rounded-b-2xl"
            />
          </div>
        </div>
      )}

      {/* Trigger Form Modal */}
      <ResponsiveDialog
        open={showTriggerForm}
        onOpenChange={(o) => { if (!o) { setShowTriggerForm(false); setEditingTrigger(null); } }}
      >
        <ResponsiveDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-2xl text-charcoal">
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
              <select
                value={triggerForm.trigger_type}
                onChange={(e) => setTriggerForm({ ...triggerForm, trigger_type: e.target.value })}
                className="w-full p-3 rounded-lg border border-sage/30 font-body"
              >
                {triggerTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-body text-sm text-charcoal/70 mb-2 block">Template</label>
              <select
                value={triggerForm.template_id}
                onChange={(e) => setTriggerForm({ ...triggerForm, template_id: e.target.value })}
                className="w-full p-3 rounded-lg border border-sage/30 font-body"
              >
                <option value="">Select a template</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-body text-sm text-charcoal/70 mb-3 block">Channels</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={triggerForm.channel_email}
                    onChange={(e) => setTriggerForm({ ...triggerForm, channel_email: e.target.checked })}
                    className="w-5 h-5 accent-sage"
                  />
                  <Mail size={16} className="text-terracotta" />
                  <span className="font-body text-sm text-charcoal">Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={triggerForm.channel_whatsapp}
                    onChange={(e) => setTriggerForm({ ...triggerForm, channel_whatsapp: e.target.checked })}
                    className="w-5 h-5 accent-sage"
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