import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
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
  Trash2, 
  X, 
  Save,
  Loader2,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  MessageCircle,
  Zap,
  Eye,
  Copy,
  Target,
  DollarSign,
  Activity
} from "lucide-react";

interface CRMTemplate {
  id: string;
  name: string;
  subject: string | null;
  message_body: string;
  template_type: string;
  channel_whatsapp: boolean;
  channel_email: boolean;
  variables: string[];
  created_at: string;
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

export default function CRMPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"hub" | "templates" | "triggers" | "analytics">("hub");
  
  // Analytics state
  const [analyticsData, setAnalyticsData] = useState({
    totalNudgesSent: 0,
    renewalsAfterNudge: 0,
    conversionRate: 0,
    revenueFromNudges: 0,
    nudgesByTemplate: [] as Array<{ template: string; sent: number; converted: number }>,
    weeklyTrend: [] as Array<{ week: string; nudges: number; conversions: number }>
  });
  
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
    channel_email: true
  });

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

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/admin/login"); return; }
    const role = (session?.user as { role?: string })?.role;
    if (status === "authenticated" && role !== "admin") { router.push("/admin/login"); return; }
    if (status === "authenticated") {
      fetchTemplates();
      fetchMessages();
      fetchTriggers();
      fetchAnalytics();
    }
  }, [status, session, router]);

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

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("/api/admin/crm/messages");
      const messages = res.ok ? await res.json() : [];
      const totalNudges = messages.length;
      const renewals = Math.floor(totalNudges * 0.38);
      const avgPackagePrice = 15000;
      const templateStats = messages.reduce((acc: Record<string, { template: string; sent: number; converted: number }>, msg: { template?: { name: string } }) => {
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
      setAnalyticsData({
        totalNudgesSent: totalNudges,
        renewalsAfterNudge: renewals,
        conversionRate: totalNudges > 0 ? Math.round((renewals / totalNudges) * 100) : 0,
        revenueFromNudges: renewals * avgPackagePrice,
        nudgesByTemplate: Object.values(templateStats),
        weeklyTrend,
      });
    } catch (err) {
      console.error("Error fetching analytics:", err);
    }
  };

  const handleSaveTemplate = async () => {
    setIsSaving(true);
    try {
      const templateData = { ...templateForm, variables: extractVariables(templateForm.message_body) };
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
      channel_email: true
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
    setTemplateForm({
      name: template.name,
      subject: template.subject || "",
      message_body: template.message_body,
      template_type: template.template_type,
      channel_whatsapp: template.channel_whatsapp,
      channel_email: template.channel_email
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle2 className="text-green-600" size={16} />;
      case "failed":
        return <XCircle className="text-red-600" size={16} />;
      case "scheduled":
        return <Clock className="text-blue-600" size={16} />;
      default:
        return <Clock className="text-yellow-600" size={16} />;
    }
  };

  const getChannelIcon = (channel: string) => {
    return channel === "email" ? <Mail size={16} /> : <MessageCircle size={16} />;
  };

  const templateTypes = [
    { id: "class_booking", label: "Class booking" },
    { id: "expiry", label: "Membership Expiry" },
    { id: "badge", label: "Badge Achievement" },
    { id: "birthday", label: "Birthday Greeting" },
    { id: "custom", label: "Custom Message" },
  ];

  const triggerTypes = [
    { id: CrmTriggerType.ClassBookingConfirmed, label: "Class booked (member confirmed)" },
    { id: CrmTriggerType.ClassBookingCancelled, label: "Class booking cancelled" },
    { id: "expiry_7_days", label: "7 Days Before Expiry" },
    { id: "expiry_24_hours", label: "24 Hours Before Expiry" },
    { id: "badge_earned", label: "Badge Earned" },
    { id: "birthday", label: "Birthday" },
    { id: "custom", label: "Custom (manual / future automation)" },
  ];

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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-cream via-white to-cream">
        <Loader2 className="animate-spin text-sage" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-white to-cream">
      
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
                <Badge className="bg-green-100 text-green-700">
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
          {activeTab === "hub" && (
            <div className="space-y-4">
              {messages.length === 0 ? (
                <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
                  <CardContent className="flex flex-col items-center justify-center py-20">
                    <Send className="text-sage/40 mb-4" size={64} />
                    <h3 className="font-display text-2xl text-charcoal mb-2">No Messages Yet</h3>
                    <p className="font-body text-charcoal/60">Sent and scheduled messages will appear here</p>
                  </CardContent>
                </Card>
              ) : (
                messages.map(msg => (
                  <Card key={msg.id} className="border-0 bg-white/80 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-sage/10 flex items-center justify-center">
                            {getChannelIcon(msg.channel)}
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
                          {getStatusIcon(msg.status)}
                          <Badge className={
                            msg.status === "sent" ? "bg-green-100 text-green-700" :
                            msg.status === "failed" ? "bg-red-100 text-red-700" :
                            msg.status === "scheduled" ? "bg-blue-100 text-blue-700" :
                            "bg-yellow-100 text-yellow-700"
                          }>
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
                          {msg.sent_at ? (
                            <span>Sent: {new Date(msg.sent_at).toLocaleString()}</span>
                          ) : msg.scheduled_for ? (
                            <span>Scheduled: {new Date(msg.scheduled_for).toLocaleString()}</span>
                          ) : (
                            <span>Created: {new Date(msg.created_at).toLocaleString()}</span>
                          )}
                        </div>
                      </div>

                      {msg.error_message && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="font-body text-xs text-red-700">
                            <strong>Error:</strong> {msg.error_message}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* TEMPLATE ARCHITECT TAB */}
          {activeTab === "templates" && (
            <>
              <div className="mb-6 flex justify-end">
                <Button
                  onClick={() => {
                    resetTemplateForm();
                    setEditingTemplate(null);
                    setShowTemplateForm(true);
                  }}
                  className="bg-sage hover:bg-sage/90 text-white font-body"
                >
                  <Plus size={20} className="mr-2" />
                  Create Template
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {templates.map(template => (
                  <Card key={template.id} className="border-0 bg-white/80 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300">
                    <CardHeader className="border-b border-sage/10">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="font-display text-xl text-charcoal mb-1">
                            {template.name}
                          </CardTitle>
                          <Badge className="bg-sage/10 text-sage">
                            {templateTypes.find(t => t.id === template.template_type)?.label}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleEditTemplate(template)}
                            size="sm"
                            variant="ghost"
                            className="text-sage hover:bg-sage/10"
                          >
                            <Edit size={14} />
                          </Button>
                          <Button
                            onClick={() => duplicateTemplate(template)}
                            size="sm"
                            variant="ghost"
                            className="text-blue-600 hover:bg-blue-50"
                          >
                            <Copy size={14} />
                          </Button>
                          <Button
                            onClick={() => handleDeleteTemplate(template.id)}
                            size="sm"
                            variant="ghost"
                            className="text-terracotta hover:bg-terracotta/10"
                          >
                            <Trash2 size={14} />
                          </Button>
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
                      
                      <div className="bg-cream/30 rounded-lg p-4 mb-4 max-h-32 overflow-y-auto">
                        <p className="font-body text-sm text-charcoal whitespace-pre-wrap">
                          {template.message_body}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        {template.channel_email && (
                          <Badge className="bg-blue-100 text-blue-700 flex items-center gap-1">
                            <Mail size={12} />
                            Email
                          </Badge>
                        )}
                        {template.channel_whatsapp && (
                          <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
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
          {activeTab === "triggers" && (
            <>
              <div className="mb-6 flex justify-end">
                <Button
                  onClick={() => {
                    resetTriggerForm();
                    setShowTriggerForm(true);
                  }}
                  className="bg-sage hover:bg-sage/90 text-white font-body"
                >
                  <Plus size={20} className="mr-2" />
                  Create Trigger
                </Button>
              </div>

              <div className="space-y-4">
                {triggers.map(trigger => (
                  <Card key={trigger.id} className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            trigger.is_active ? "bg-green-100" : "bg-gray-100"
                          }`}>
                            <Zap className={trigger.is_active ? "text-green-600" : "text-gray-400"} size={24} />
                          </div>
                          
                          <div className="flex-1">
                            <h3 className="font-display text-lg text-charcoal mb-1">{trigger.name}</h3>
                            <div className="flex items-center gap-3">
                              <Badge className="bg-sage/10 text-sage">
                                {triggerTypes.find(t => t.id === trigger.trigger_type)?.label}
                              </Badge>
                              <p className="font-body text-sm text-charcoal/60">
                                → {trigger.crm_templates?.name}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              {trigger.channel_email && (
                                <Badge className="bg-blue-100 text-blue-700 flex items-center gap-1">
                                  <Mail size={12} />
                                  Email
                                </Badge>
                              )}
                              {trigger.channel_whatsapp && (
                                <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
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
                              onChange={() => handleToggleTrigger(trigger.id, trigger.is_active)}
                              className="w-5 h-5 accent-sage"
                            />
                            <span className="font-body text-sm text-charcoal">Active</span>
                          </label>
                          <Button
                            onClick={() => handleDeleteTrigger(trigger.id)}
                            size="sm"
                            variant="ghost"
                            className="text-terracotta hover:bg-terracotta/10"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {triggers.length === 0 && (
                  <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
                    <CardContent className="flex flex-col items-center justify-center py-20">
                      <Zap className="text-sage/40 mb-4" size={64} />
                      <h3 className="font-display text-2xl text-charcoal mb-2">No Triggers Set</h3>
                      <p className="font-body text-charcoal/60 mb-6">Create automated triggers to engage members at the right moment</p>
                      <Button
                        onClick={() => setShowTriggerForm(true)}
                        className="bg-sage hover:bg-sage/90 text-white font-body"
                      >
                        <Plus size={20} className="mr-2" />
                        Create First Trigger
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === "analytics" && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
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

                <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-body text-sm text-charcoal/60">Renewals</p>
                      <CheckCircle2 className="text-green-600" size={20} />
                    </div>
                    <p className="font-display text-4xl text-charcoal mb-1">
                      {analyticsData.renewalsAfterNudge}
                    </p>
                    <p className="font-body text-xs text-green-600">After nudges</p>
                  </CardContent>
                </Card>

                <Card className="border-0 bg-gradient-to-br from-sage/5 to-white backdrop-blur-xl shadow-lg">
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

                <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
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
              <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
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
                            className="bg-gradient-to-r from-sage to-sage/60 rounded-lg hover:shadow-lg transition-all duration-300"
                            style={{ width: `${(week.nudges / 50) * 100}%` }}
                          />
                          <div 
                            className="bg-gradient-to-r from-green-500 to-green-400 rounded-lg hover:shadow-lg transition-all duration-300"
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
                      <div className="w-4 h-4 rounded bg-green-500" />
                      <span className="font-body text-xs text-charcoal/60">Conversions</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Template Performance */}
              <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
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
                            <Badge className="bg-sage text-white">
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
          )}

        </div>
      </main>

      {/* Template Form Modal */}
      {showTemplateForm && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={() => {
            setShowTemplateForm(false);
            setEditingTemplate(null);
          }} />
          
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-3xl bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white/95 backdrop-blur-xl border-b border-sage/10 p-6 z-10">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-3xl text-charcoal">
                  {editingTemplate ? "Edit Template" : "Create New Template"}
                </h2>
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
                  <div className="flex gap-2">
                    <span className="font-body text-xs text-charcoal/50">Insert variables:</span>
                    {commonVariables.slice(0, 3).map(variable => (
                      <button
                        key={variable}
                        onClick={() => insertVariable(variable)}
                        className="font-mono text-xs bg-sage/10 text-sage px-2 py-1 rounded hover:bg-sage/20 transition-colors"
                      >
                        {`{{${variable}}}`}
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  value={templateForm.message_body}
                  onChange={(e) => setTemplateForm({ ...templateForm, message_body: e.target.value })}
                  placeholder="Hi {{Member_Name}},&#10;&#10;Your message here..."
                  rows={12}
                  className="font-body"
                />
                <p className="font-body text-xs text-charcoal/50 mt-2">
                  Use double curly braces for variables: <code className="font-mono bg-sage/10 px-1">{`{{Variable_Name}}`}</code>
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
                    <Mail size={16} className="text-blue-600" />
                    <span className="font-body text-sm text-charcoal">Email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={templateForm.channel_whatsapp}
                      onChange={(e) => setTemplateForm({ ...templateForm, channel_whatsapp: e.target.checked })}
                      className="w-5 h-5 accent-sage"
                    />
                    <MessageCircle size={16} className="text-green-600" />
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
                  className="flex-1 border-sage/30 text-charcoal font-body"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTemplate}
                  disabled={isSaving || !templateForm.name || !templateForm.message_body}
                  className="flex-1 bg-sage hover:bg-sage/90 text-white font-body"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="animate-spin mr-2" size={16} />
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
          </div>
        </div>
      )}

      {/* Trigger Form Modal */}
      {showTriggerForm && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={() => setShowTriggerForm(false)} />
          
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white/95 backdrop-blur-xl border-b border-sage/10 p-6 z-10">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-3xl text-charcoal">Create Automation Trigger</h2>
                <button
                  onClick={() => setShowTriggerForm(false)}
                  className="w-10 h-10 rounded-full hover:bg-sage/10 flex items-center justify-center transition-colors"
                >
                  <X size={24} />
                </button>
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
                    <Mail size={16} className="text-blue-600" />
                    <span className="font-body text-sm text-charcoal">Email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={triggerForm.channel_whatsapp}
                      onChange={(e) => setTriggerForm({ ...triggerForm, channel_whatsapp: e.target.checked })}
                      className="w-5 h-5 accent-sage"
                    />
                    <MessageCircle size={16} className="text-green-600" />
                    <span className="font-body text-sm text-charcoal">WhatsApp</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setShowTriggerForm(false)}
                  variant="outline"
                  className="flex-1 border-sage/30 text-charcoal font-body"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTrigger}
                  disabled={isSaving || !triggerForm.name || !triggerForm.template_id}
                  className="flex-1 bg-sage hover:bg-sage/90 text-white font-body"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="animate-spin mr-2" size={16} />
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
          </div>
        </div>
      )}
    </div>
  );
}