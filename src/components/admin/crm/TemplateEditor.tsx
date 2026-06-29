import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Copy, Mail, MessageCircle, Save, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pill } from "@/components/ui/pill";
import { Spinner } from "@/components/ui/spinner";
import { VariablePalette } from "./VariablePalette";
import { EmailPreview } from "./EmailPreview";
import {
  camelCaseTokens,
  sampleVarsFor,
  validateBodyVariables,
  type CrmTemplate,
} from "./crmPreview";

// Variables offered when a custom (non-system) template declares none of its own.
const COMMON_VARS = [
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
] as const;

const TEMPLATE_TYPES: Array<{ id: string; label: string }> = [
  { id: "class_booking", label: "Class booking" },
  { id: "expiry", label: "Membership Expiry" },
  { id: "badge", label: "Badge Achievement" },
  { id: "birthday", label: "Birthday Greeting" },
  { id: "custom", label: "Custom Message" },
];

export interface EditorForm {
  name: string;
  subject: string;
  message_body: string;
  template_type: string;
  channel_email: boolean;
  channel_whatsapp: boolean;
}

interface TemplateEditorProps {
  template: CrmTemplate;
  saving: boolean;
  onSave: (form: EditorForm) => void;
  onDelete?: (t: CrmTemplate) => void;
  onDuplicate?: (t: CrmTemplate) => void;
}

const FIELD =
  "font-body border-sage/30 focus-visible:border-sage focus-visible:ring-2 focus-visible:ring-sage/30 focus-visible:ring-offset-0";

export function TemplateEditor({ template, saving, onSave, onDelete, onDuplicate }: TemplateEditorProps) {
  const [form, setForm] = useState<EditorForm>(() => toForm(template));
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  // Test-send state
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [config, setConfig] = useState<Record<string, string> | null>(null);

  // Reset the form whenever a different template is selected.
  useEffect(() => {
    setForm(toForm(template));
    setTestResult(null);
  }, [template]);

  // Code-owned palette: system → fixed declared vars; custom → its vars or the common set.
  const palette = useMemo<string[]>(() => {
    if (template.variables && template.variables.length > 0) return template.variables;
    return [...COMMON_VARS];
  }, [template]);

  const previewVars = useMemo(() => sampleVarsFor(palette), [palette]);

  // Non-blocking guard: tokens in the body outside the declared palette (+ camelCase legacy).
  const unknownTokens = useMemo(() => {
    const unknown = validateBodyVariables(form.message_body, palette);
    const camel = camelCaseTokens(form.message_body);
    return [...new Set([...unknown, ...camel])];
  }, [form.message_body, palette]);

  const insertAtCursor = useCallback((variable: string) => {
    const token = `{{${variable}}}`;
    const el = bodyRef.current;
    setForm((prev) => {
      if (!el) return { ...prev, message_body: prev.message_body + token };
      const start = el.selectionStart ?? prev.message_body.length;
      const end = el.selectionEnd ?? start;
      const next = prev.message_body.slice(0, start) + token + prev.message_body.slice(end);
      // Restore caret just after the inserted token on the next frame.
      requestAnimationFrame(() => {
        el.focus();
        const caret = start + token.length;
        el.setSelectionRange(caret, caret);
      });
      return { ...prev, message_body: next };
    });
  }, []);

  const handleSendTest = useCallback(async () => {
    const to = testTo.trim();
    if (!to) return;
    setTesting(true);
    setTestResult(null);
    try {
      const previewHtml = renderForTest(form.message_body, previewVars);
      const previewSubject = interpolateSubject(form.subject, previewVars);
      const r = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject: previewSubject, html: previewHtml }),
      });
      const data = await r.json().catch(() => ({}));
      if (data?.config) setConfig(data.config as Record<string, string>);
      const sent = r.ok && data?.result?.ok !== false && data?.result?.skipped !== true;
      setTestResult(
        sent
          ? { ok: true, msg: `Test email sent to ${to}` }
          : { ok: false, msg: data?.result?.reason || data?.error || `Send failed (${r.status})` },
      );
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : "Network error" });
    } finally {
      setTesting(false);
    }
  }, [testTo, form.message_body, form.subject, previewVars]);

  const canSave = !!form.name.trim() && !!form.message_body.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="font-body font-semibold text-2xl text-charcoal" style={{ textWrap: "balance" }}>
            {template.id ? "Edit template" : "New template"}
          </h3>
          {template.is_system && template.template_key ? (
            <div className="flex items-center gap-2">
              <Pill tone="warning" size="sm" noIcon>System</Pill>
              <code className="rounded bg-charcoal/5 px-1.5 py-0.5 font-mono text-[11px] text-charcoal/60">
                {template.template_key}
              </code>
            </div>
          ) : (
            <p className="font-body text-xs text-charcoal/55">
              Body copy is editable; the variable palette is fixed by the system.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onDuplicate && (
            <Button
              onClick={() => onDuplicate(template)}
              variant="ghost"
              size="sm"
              className="text-terracotta hover:bg-terracotta/10 hover:text-terracotta!"
            >
              <Copy size={15} className="mr-1.5" aria-hidden />
              Duplicate
            </Button>
          )}
          {onDelete && !template.is_system && template.id && (
            <Button
              onClick={() => onDelete(template)}
              variant="ghost"
              size="sm"
              className="text-pill-danger-fg hover:bg-pill-danger-bg"
            >
              <Trash2 size={15} className="mr-1.5" aria-hidden />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Left: edit fields ─────────────────────────────────────────── */}
        <div className="space-y-5">
          {!template.is_system && (
            <>
              <div>
                <label className="mb-2 block font-body text-sm text-charcoal/70">Template name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., The Ritual Renewal"
                  className={FIELD}
                />
              </div>
              <div>
                <label className="mb-2 block font-body text-sm text-charcoal/70">Template type</label>
                <select
                  value={form.template_type}
                  onChange={(e) => setForm({ ...form, template_type: e.target.value })}
                  className="w-full rounded-lg border border-sage/30 p-3 font-body focus-visible:border-sage focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sage/30"
                >
                  {TEMPLATE_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="mb-2 block font-body text-sm text-charcoal/70">
              Email subject <span className="text-charcoal/40">(for the email channel)</span>
            </label>
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="e.g., Your booking is confirmed — {{Class_Name}}"
              className={FIELD}
            />
          </div>

          <VariablePalette variables={palette} onInsert={insertAtCursor} />

          <div>
            <label className="mb-2 block font-body text-sm text-charcoal/70">Message body</label>
            <Textarea
              ref={bodyRef}
              value={form.message_body}
              onChange={(e) => setForm({ ...form, message_body: e.target.value })}
              placeholder="Hi {{Member_Name}}, …"
              rows={template.is_system ? 18 : 12}
              className="font-mono text-xs border-sage/30 focus-visible:border-sage focus-visible:ring-2 focus-visible:ring-sage/30 focus-visible:ring-offset-0"
            />
            <p className="mt-2 font-body text-xs text-charcoal/50">
              Use double curly braces for variables:{" "}
              <code className="bg-sage/10 px-1 font-mono">{`{{Variable_Name}}`}</code>
            </p>
          </div>

          {unknownTokens.length > 0 && (
            <div className="rounded-lg border border-pill-warning-fg/25 bg-pill-warning-bg/60 p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-pill-warning-fg" aria-hidden />
                <p className="font-body text-xs font-semibold text-pill-warning-fg">
                  These tokens aren&apos;t in the palette — they will render empty:
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {unknownTokens.map((tok) => (
                  <Pill key={tok} tone="warning" size="sm" noIcon className="font-mono">
                    {`{{${tok}}}`}
                  </Pill>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block font-body text-sm text-charcoal/70">Channels</label>
            <div className="flex gap-5">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.channel_email}
                  onChange={(e) => setForm({ ...form, channel_email: e.target.checked })}
                  className="h-5 w-5 accent-sage"
                />
                <Mail size={16} className="text-terracotta" aria-hidden />
                <span className="font-body text-sm text-charcoal">Email</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.channel_whatsapp}
                  onChange={(e) => setForm({ ...form, channel_whatsapp: e.target.checked })}
                  className="h-5 w-5 accent-sage"
                />
                <MessageCircle size={16} className="text-sage" aria-hidden />
                <span className="font-body text-sm text-charcoal">WhatsApp</span>
              </label>
            </div>
          </div>

          <Button
            onClick={() => onSave(form)}
            disabled={saving || !canSave}
            variant="sage"
            className="w-full active:scale-[0.99]"
          >
            {saving ? (
              <><Spinner className="mr-2 size-4" />Saving…</>
            ) : (
              <><Save size={16} className="mr-2" aria-hidden />{template.id ? "Save changes" : "Create template"}</>
            )}
          </Button>
        </div>

        {/* ── Right: live preview + test send ───────────────────────────── */}
        <div className="space-y-5">
          <EmailPreview body={form.message_body} subject={form.subject} vars={previewVars} />

          <div className="rounded-xl border border-sage/15 bg-white-warm p-4">
            <p className="mb-2 font-body text-sm font-semibold text-charcoal">Send a test</p>
            <p className="mb-3 font-body text-xs text-charcoal/55">
              Delivers this rendered preview (sample data) to an address you choose.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="you@studio.in"
                className={`${FIELD} flex-1`}
              />
              <Button
                onClick={handleSendTest}
                disabled={testing || !testTo.trim() || !form.channel_email}
                variant="sage"
                className="shrink-0 active:scale-[0.97]"
              >
                {testing ? (
                  <><Spinner className="mr-2 size-4" />Sending…</>
                ) : (
                  <><Send size={14} className="mr-2" aria-hidden />Send test</>
                )}
              </Button>
            </div>
            {!form.channel_email && (
              <p className="mt-2 font-body text-xs text-charcoal/45">Enable the Email channel to send a test.</p>
            )}
            {testResult && (
              <div
                className={`mt-3 rounded-lg p-2.5 font-body text-xs ${
                  testResult.ok
                    ? "border border-sage/20 bg-sage/10 text-sage"
                    : "border border-pill-danger-fg/25 bg-pill-danger-bg text-pill-danger-fg"
                }`}
              >
                {testResult.msg}
              </div>
            )}
            {config && (
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-sage/10 pt-3">
                {Object.entries(config).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <dt className="truncate font-mono text-[10px] text-charcoal/45">{k}</dt>
                    <dd>
                      <Pill tone={v === "MISSING" ? "danger" : "success"} size="sm" noIcon>
                        {v === "MISSING" ? "missing" : v === "set" ? "set" : v}
                      </Pill>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function toForm(t: CrmTemplate): EditorForm {
  return {
    name: t.name ?? "",
    subject: t.subject ?? "",
    message_body: t.message_body ?? "",
    template_type: t.template_type ?? "custom",
    channel_email: t.channel_email ?? true,
    channel_whatsapp: t.channel_whatsapp ?? false,
  };
}

function interpolateSubject(subject: string, vars: Record<string, string>): string {
  return (subject || "Test email — The Studio").replace(
    /\{\{\s*([^}]+?)\s*\}\}/g,
    (_m, k: string) => vars[k.trim()] ?? "",
  );
}

function renderForTest(body: string, vars: Record<string, string>): string {
  const rendered = body.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, k: string) => vars[k.trim()] ?? "");
  if (/<html|<!doctype/i.test(rendered)) return rendered;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Georgia,serif;margin:0;padding:16px;background:#F5F0E8;color:#2C2C2C">${rendered}</body></html>`;
}
