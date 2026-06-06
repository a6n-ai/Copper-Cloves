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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { CrmTriggerType } from "@/lib/crmTriggerTypes";
import {
  Plus,
  Edit,
  X,
  Save,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  MessageCircle,
  Zap,
  Copy,
  Target,
  DollarSign,
  Activity
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

interface CRMMessage {
  id: string;
  template_id: string | null;
  user_id: string;
  channel: string;
  status: string;
  subject: string | null;
  message_body: string;
  scheduled_for: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
  crm_templates?: {
    name: string;
  };
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
  crm_templates?: {
    name: string;
  };
}

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

      {/* Communication hub message cards */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="border-0 bg-white-warm shadow-lg">
            <CardContent className="p-6">
              {/* Header: channel avatar + name/email, status icon + badge */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </div>

              {/* Message body box */}
              <div className="bg-cream/30 rounded-lg p-4 mb-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-2/3" />
              </div>

              {/* Footer: template name + timestamp */}
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Analytics derived from `messages`. `Math.random()` calls preserved for
// visual parity — these are demo numbers. Pure: depends only on `messages`.
function computeCrmAnalyticsData(messages: CRMMessage[]) {
  const totalNudges = messages.length;
  const renewals = Math.floor(totalNudges * 0.38);
  const avgPackagePrice = 15000;
  type Stats = Record<string, { template: string; sent: number; converted: number }>;
  const templateStats = (messages as Array<{ template?: { name: string } }>).reduce<Stats>((acc, msg) => {
    const templateName = msg.template?.name || "Unknown";
    if (!acc[templateName]) acc[templateName] = { template: templateName, sent: 0, converted: 0 };
    acc[templateName].sent++;
    if (Math.random() < 0.38) acc[templateName].converted++;
    return acc;
  }, {});
  const weeklyTrend = [];
  for (let i = 3; i >= 0; i--) {
    const nudgesThisWeek = Math.floor(totalNudges / 4) + Math.floor(Math.random() * 10);
    weeklyTrend.push({ week: `Week ${4 - i}`, nudges: nudgesThisWeek, conversions: Math.floor(nudgesThisWeek * 0.38) });
  }
  return {
    totalNudgesSent: totalNudges,
    renewalsAfterNudge: renewals,
    conversionRate: totalNudges > 0 ? Math.round((renewals / totalNudges) * 100) : 0,
    revenueFromNudges: renewals * avgPackagePrice,
    nudgesByTemplate: Object.values(templateStats),
    weeklyTrend,
  };
}

type CrmAnalyticsData = ReturnType<typeof computeCrmAnalyticsData>;

function renderCrmAnalyticsTab(analyticsData: CrmAnalyticsData) {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 bg-white-warm shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="font-body text-sm text-charcoal/60">Total Nudges Sent</p>
              <Send className="text-sage" size={20} />
            </div>
            <p className="font-display text-4xl text-charcoal mb-1">
              {analyticsData.totalNudgesSent}
            </p>
            <p className="font-body text-xs text-charcoal/50">Last 30 days</p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white-warm shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="font-body text-sm text-charcoal/60">Renewals</p>
              <CheckCircle2 className="text-sage" size={20} />
            </div>
            <p className="font-display text-4xl text-charcoal mb-1">
              {analyticsData.renewalsAfterNudge}
            </p>
            <p className="font-body text-xs text-sage">After nudges</p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white-warm shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="font-body text-sm text-charcoal/60">Conversion Rate</p>
              <Target className="text-sage" size={20} />
            </div>
            <p className="font-display text-4xl text-sage mb-1">
              {analyticsData.conversionRate}%
            </p>
            <p className="font-body text-xs text-charcoal/50">Nudge to renewal</p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white-warm shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="font-body text-sm text-charcoal/60">Revenue Impact</p>
              <DollarSign className="text-sage" size={20} />
            </div>
            <p className="font-display text-4xl text-charcoal mb-1">
              ₹{(analyticsData.revenueFromNudges / 1000).toFixed(0)}k
            </p>
            <p className="font-body text-xs text-charcoal/50">From nudges</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Trend Chart */}
      <Card className="border-0 bg-white-warm shadow-lg">
        <CardHeader>
          <CardTitle className="font-display text-2xl text-charcoal">Weekly Performance</CardTitle>
          <CardDescription className="font-body text-charcoal/60">
            Nudges sent vs conversions over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyticsData.weeklyTrend.map((week, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm text-charcoal/60">{week.week}</span>
                  <div className="flex items-center gap-4">
                    <span className="font-body text-xs text-charcoal/50">
                      {week.nudges} nudges → {week.conversions} renewals
                    </span>
                    <span className="font-body text-xs font-semibold text-sage">
                      {Math.round((week.conversions / week.nudges) * 100)}%
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 h-8">
                  <div
                    className="bg-linear-to-r from-sage to-sage/60 rounded-lg hover:shadow-lg transition-all duration-300"
                    style={{ width: `${(week.nudges / 50) * 100}%` }}
                  />
                  <div
                    className="bg-sage hover:bg-[#7A8B7C] rounded-lg transition-colors duration-300"
                    style={{ width: `${(week.conversions / 50) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-sage/20">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-sage" />
              <span className="font-body text-xs text-charcoal/60">Nudges Sent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-sage" />
              <span className="font-body text-xs text-charcoal/60">Conversions</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Performance */}
      <Card className="border-0 bg-white-warm shadow-lg">
        <CardHeader>
          <CardTitle className="font-display text-2xl text-charcoal">Template Performance</CardTitle>
          <CardDescription className="font-body text-charcoal/60">
            Conversion rates by message template
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyticsData.nudgesByTemplate.length === 0 ? (
              <div className="text-center py-8">
                <p className="font-body text-charcoal/60">No template data yet</p>
              </div>
            ) : (
              analyticsData.nudgesByTemplate.map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-cream/30 border border-sage/10">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-body font-medium text-charcoal">{item.template}</p>
                      <p className="font-body text-xs text-charcoal/50">
                        {item.sent} sent · {item.converted} converted
                      </p>
                    </div>
                    <Badge className="bg-sage text-cream">
                      {item.sent > 0 ? Math.round((item.converted / item.sent) * 100) : 0}% conversion
                    </Badge>
                  </div>
                  <div className="h-2 bg-charcoal/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sage rounded-full transition-all duration-500"
                      style={{ width: `${item.sent > 0 ? (item.converted / item.sent) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getCrmStatusIcon(status: string) {
  switch (status) {
    case "sent":
      return <CheckCircle2 className="text-sage" size={16} />;
    case "failed":
      return <XCircle className="text-[#a05e38]" size={16} />;
    case "scheduled":
      return <Clock className="text-terracotta" size={16} />;
    default:
      return <Clock className="text-charcoal/50" size={16} />;
  }
}

function getCrmChannelIcon(channel: string) {
  return channel === "email" ? <Mail size={16} /> : <MessageCircle size={16} />;
}

function renderCrmMessageTimestamp(msg: CRMMessage) {
  if (msg.sent_at) return <span>Sent: {new Date(msg.sent_at).toLocaleString()}</span>;
  if (msg.scheduled_for) return <span>Scheduled: {new Date(msg.scheduled_for).toLocaleString()}</span>;
  return <span>Created: {new Date(msg.created_at).toLocaleString()}</span>;
}

function crmStatusBadgeClass(status: string) {
  if (status === "sent") return "bg-sage/10 text-sage";
  if (status === "failed") return "bg-[#a05e38]/10 text-[#a05e38]";
  if (status === "scheduled") return "bg-terracotta/10 text-terracotta";
  return "bg-charcoal/10 text-charcoal/60";
}

function renderCrmHubTab(messages: CRMMessage[]) {
  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <Card className="border-0 bg-white-warm shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Send className="text-sage/40 mb-4" size={64} />
            <h3 className="font-display text-2xl text-charcoal mb-2">No Messages Yet</h3>
            <p className="font-body text-charcoal/60">Sent and scheduled messages will appear here</p>
          </CardContent>
        </Card>
      ) : (
        messages.map(msg => (
          <Card key={msg.id} className="border-0 bg-white-warm shadow-lg hover:shadow-xl transition-all duration-300 [content-visibility:auto] [contain-intrinsic-size:0_180px]">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sage/10 flex items-center justify-center">
                    {getCrmChannelIcon(msg.channel)}
                  </div>
                  <div>
                    <h3 className="font-display text-lg text-charcoal">
                      {msg.profiles?.full_name || "Unknown User"}
                    </h3>
                    <p className="font-body text-xs text-charcoal/50">
                      {msg.profiles?.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getCrmStatusIcon(msg.status)}
                  <Badge className={crmStatusBadgeClass(msg.status)}>
                    {msg.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {msg.subject && (
                <p className="font-display text-sm text-charcoal mb-2">
                  <strong>Subject:</strong> {msg.subject}
                </p>
              )}

              <div className="bg-cream/30 rounded-lg p-4 mb-4">
                <p className="font-body text-sm text-charcoal whitespace-pre-wrap">
                  {msg.message_body}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs text-charcoal/50 font-body">
                <div>
                  {msg.crm_templates?.name && (
                    <span>Template: {msg.crm_templates.name}</span>
                  )}
                </div>
                <div>
                  {renderCrmMessageTimestamp(msg)}
                </div>
              </div>

              {msg.error_message && (
                <div className="mt-3 p-3 bg-[#a05e38]/10 border border-[#a05e38]/25 rounded-lg">
                  <p className="font-body text-xs text-[#a05e38]">
                    <strong>Error:</strong> {msg.error_message}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

interface CrmTriggersTabProps {
  triggers: CRMTrigger[];
  triggerLabelById: Map<string, string>;
  onCreate: () => void;
  onCreateEmpty: () => void;
  onToggle: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
}

function renderCrmTriggersTab(props: CrmTriggersTabProps) {
  const { triggers, triggerLabelById, onCreate, onCreateEmpty, onToggle, onDelete } = props;
  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button onClick={onCreate} variant="sage">
          <Plus size={20} className="mr-2" />
          Create Trigger
        </Button>
      </div>

      <div className="space-y-4">
        {triggers.map(trigger => (
          <Card key={trigger.id} className="border-0 bg-white-warm shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    trigger.is_active ? "bg-sage/10" : "bg-charcoal/10"
                  }`}>
                    <Zap className={trigger.is_active ? "text-sage" : "text-charcoal/40"} size={24} />
                  </div>

                  <div className="flex-1">
                    <h3 className="font-display text-lg text-charcoal mb-1">{trigger.name}</h3>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-sage/10 text-sage">
                        {triggerLabelById.get(String(trigger.trigger_type))}
                      </Badge>
                      <p className="font-body text-sm text-charcoal/60">
                        → {trigger.crm_templates?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {trigger.channel_email && (
                        <Badge className="bg-terracotta/10 text-terracotta flex items-center gap-1">
                          <Mail size={12} />
                          Email
                        </Badge>
                      )}
                      {trigger.channel_whatsapp && (
                        <Badge className="bg-sage/10 text-sage flex items-center gap-1">
                          <MessageCircle size={12} />
                          WhatsApp
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trigger.is_active}
                      onChange={() => onToggle(trigger.id, trigger.is_active)}
                      className="w-5 h-5 accent-sage"
                    />
                    <span className="font-body text-sm text-charcoal">Active</span>
                  </label>
                  <DeleteButton onClick={() => onDelete(trigger.id)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {triggers.length === 0 && (
          <Card className="border-0 bg-white-warm shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <Zap className="text-sage/40 mb-4" size={64} />
              <h3 className="font-display text-2xl text-charcoal mb-2">No Triggers Set</h3>
              <p className="font-body text-charcoal/60 mb-6">Create automated triggers to engage members at the right moment</p>
              <Button onClick={onCreateEmpty} variant="sage">
                <Plus size={20} className="mr-2" />
                Create First Trigger
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
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
  const [activeTab, setActiveTab] = useState<"hub" | "templates" | "triggers" | "analytics">("hub");
  
  // Analytics state
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
        fetchMessages();
      } else {
        setSendResult({ ok: false, msg: data?.error || `Send failed (${r.status})` });
      }
    } catch (e: unknown) {
      setSendResult({ ok: false, msg: e instanceof Error ? e.message : "Network error" });
    } finally {
      setSending(false);
    }
  };

  // Messages state
  const [messages, setMessages] = useState<CRMMessage[]>([]);
  
  // Triggers state
  const [triggers, setTriggers] = useState<CRMTrigger[]>([]);
  const [showTriggerForm, setShowTriggerForm] = useState(false);
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
      // Fire all three independent fetches concurrently. Analytics is derived
      // from `messages` via useMemo below — no second /messages fetch needed.
      void Promise.all([fetchTemplates(), fetchMessages(), fetchTriggers()]);
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

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/admin/crm/messages");
      setMessages(res.ok ? await res.json() : []);
    } catch (err) {
      console.error("Error fetching messages:", err);
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

  // Analytics derived from `messages` (was duplicating /api/admin/crm/messages fetch).
  const analyticsData = useMemo(() => computeCrmAnalyticsData(messages), [messages]);

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
      await fetch("/api/admin/crm/triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...triggerForm, is_active: true }),
      });
      setShowTriggerForm(false);
      resetTriggerForm();
      fetchTriggers();
    } catch (err) {
      console.error("Error saving trigger:", err);
    } finally {
      setIsSaving(false);
    }
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
      <div className="min-h-screen bg-linear-to-br from-cream via-[#fafaf8] to-cream">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <CrmHubLoadingSkeleton />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-cream via-[#fafaf8] to-cream">
      
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <AdminPageHeader
              title="CRM Studio"
              subtitle={
                activeTab === "hub"
                  ? "Track all member communications"
                  : activeTab === "templates"
                  ? "Design premium message templates"
                  : "Automate member engagement"
              }
            />

          {/* Tab Navigation */}
          <div className="flex gap-3 mb-8 border-b border-sage/10">
            <button
              onClick={() => setActiveTab("hub")}
              className={`px-6 py-3 font-body text-sm transition-all duration-300 border-b-2 flex items-center gap-2 ${
                activeTab === "hub"
                  ? "border-sage text-sage"
                  : "border-transparent text-charcoal/60 hover:text-charcoal"
              }`}
            >
              <Send size={16} />
              Communication Hub
            </button>
            <button
              onClick={() => setActiveTab("templates")}
              className={`px-6 py-3 font-body text-sm transition-all duration-300 border-b-2 flex items-center gap-2 ${
                activeTab === "templates"
                  ? "border-sage text-sage"
                  : "border-transparent text-charcoal/60 hover:text-charcoal"
              }`}
            >
              <Edit size={16} />
              Template Architect
            </button>
            <button
              onClick={() => setActiveTab("triggers")}
              className={`px-6 py-3 font-body text-sm transition-all duration-300 border-b-2 flex items-center gap-2 ${
                activeTab === "triggers"
                  ? "border-sage text-sage"
                  : "border-transparent text-charcoal/60 hover:text-charcoal"
              }`}
            >
              <Zap size={16} />
              Automated Triggers
              {triggers.filter(t => t.is_active).length > 0 && (
                <Badge className="bg-sage/10 text-sage">
                  {triggers.filter(t => t.is_active).length} Active
                </Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-6 py-3 font-body text-sm transition-all duration-300 border-b-2 flex items-center gap-2 ${
                activeTab === "analytics"
                  ? "border-sage text-sage"
                  : "border-transparent text-charcoal/60 hover:text-charcoal"
              }`}
            >
              <Activity size={16} />
              Analytics
            </button>
          </div>

          {/* COMMUNICATION HUB TAB */}
          {activeTab === "hub" && renderCrmHubTab(messages)}

          {/* TEMPLATE ARCHITECT TAB */}
          {activeTab === "templates" && (
            <>
              <div className="mb-6 flex justify-end">
                <Button
                  onClick={() => {
                    resetTemplateForm();
                    setEditingTemplate(null);
                    setEditMode("preview");
                    setShowTemplateForm(true);
                  }}
                  variant="sage"
                >
                  <Plus size={20} className="mr-2" />
                  Create Template
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {templates.map(template => (
                  <Card key={template.id} className="border-0 bg-white-warm shadow-lg hover:shadow-xl transition-all duration-300">
                    <CardHeader className="border-b border-sage/10">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="font-display text-xl text-charcoal mb-1">
                            {template.name}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-sage/10 text-sage">
                              {templateLabelById.get(template.template_type) || template.template_type}
                            </Badge>
                            {template.is_system && (
                              <Badge className="bg-terracotta/15 text-terracotta">System</Badge>
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
                            onClick={() => openSendDialog(template)}
                            size="sm"
                            variant="ghost"
                            className="text-sage hover:bg-sage/10"
                            title="Send to member"
                            disabled={!template.channel_email}
                          >
                            <Send size={14} />
                          </Button>
                          <EditButton onClick={() => handleEditTemplate(template)} />
                          <Button
                            onClick={() => duplicateTemplate(template)}
                            size="sm"
                            variant="ghost"
                            className="text-terracotta hover:bg-terracotta/10"
                            title="Duplicate"
                          >
                            <Copy size={14} />
                          </Button>
                          {!template.is_system && (
                            <DeleteButton onClick={() => handleDeleteTemplate(template.id)} />
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
                          <Badge className="bg-terracotta/10 text-terracotta flex items-center gap-1">
                            <Mail size={12} />
                            Email
                          </Badge>
                        )}
                        {template.channel_whatsapp && (
                          <Badge className="bg-sage/10 text-sage flex items-center gap-1">
                            <MessageCircle size={12} />
                            WhatsApp
                          </Badge>
                        )}
                      </div>

                      {template.variables && template.variables.length > 0 && (
                        <div>
                          <p className="font-body text-xs text-charcoal/50 mb-2">Variables:</p>
                          <div className="flex flex-wrap gap-1">
                            {template.variables.map((variable, idx) => (
                              <Badge key={idx} className="bg-sage/10 text-sage font-mono text-xs">
                                {`{{${variable}}}`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* AUTOMATED TRIGGERS TAB */}
          {activeTab === "triggers" && renderCrmTriggersTab({
            triggers,
            triggerLabelById,
            onCreate: () => { resetTriggerForm(); setShowTriggerForm(true); },
            onCreateEmpty: () => setShowTriggerForm(true),
            onToggle: handleToggleTrigger,
            onDelete: handleDeleteTrigger,
          })}

          {/* ANALYTICS TAB */}
          {activeTab === "analytics" && renderCrmAnalyticsTab(analyticsData)}

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
                      <Badge className="bg-terracotta/15 text-terracotta">System</Badge>
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
      <Drawer
        direction="right"
        open={showTriggerForm}
        onOpenChange={(o) => { if (!o) setShowTriggerForm(false); }}
      >
        <DrawerContent direction="right" className="max-w-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white-warm border-b border-sage/10 p-6 z-10">
              <div className="flex items-center justify-between">
                <DrawerTitle className="font-display text-3xl text-charcoal">Create Automation Trigger</DrawerTitle>
                <DrawerDescription className="sr-only">Automation trigger editor</DrawerDescription>
                <CloseButton onClick={() => setShowTriggerForm(false)} className="rounded-full" />
              </div>
            </div>

            <div className="p-6 space-y-6">
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

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setShowTriggerForm(false)}
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
                      Creating...
                    </>
                  ) : (
                    <>
                      <Zap size={16} className="mr-2" />
                      Create Trigger
                    </>
                  )}
                </Button>
              </div>
            </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}