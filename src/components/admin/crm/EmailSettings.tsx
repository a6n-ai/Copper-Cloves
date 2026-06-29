import { useCallback, useEffect, useMemo, useState } from "react";
import { mutate } from "swr";
import { Mail } from "lucide-react";
import { useStudioSWR } from "@/lib/swr";
import { Skeleton } from "@/components/ui/skeleton";
import { TemplateList } from "./TemplateList";
import { TemplateEditor, type EditorForm } from "./TemplateEditor";
import type { CrmTemplate } from "./crmPreview";

const TEMPLATES_KEY = "/api/admin/crm/templates";

// A blank draft for the "New template" flow (no id → create on save).
function blankTemplate(): CrmTemplate {
  return {
    id: "",
    name: "",
    template_key: null,
    is_system: false,
    subject: "",
    message_body: "",
    template_type: "custom",
    channel_whatsapp: false,
    channel_email: true,
    variables: [],
    created_at: new Date().toISOString(),
  };
}

interface EmailSettingsProps {
  /** Let the parent refresh its own copy of templates (e.g. the trigger picker). */
  onChanged?: () => void;
}

export function EmailSettings({ onChanged }: EmailSettingsProps) {
  const { data, isLoading } = useStudioSWR<CrmTemplate[]>(TEMPLATES_KEY);
  const templates = useMemo(() => data ?? [], [data]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CrmTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  // Auto-select the first template once data lands (desktop two-pane needs a right pane).
  useEffect(() => {
    if (!draft && !selectedId && templates.length > 0) setSelectedId(templates[0].id);
  }, [templates, selectedId, draft]);

  const selected = useMemo<CrmTemplate | null>(() => {
    if (draft) return draft;
    return templates.find((t) => t.id === selectedId) ?? null;
  }, [draft, templates, selectedId]);

  const refresh = useCallback(async () => {
    await mutate(TEMPLATES_KEY);
    onChanged?.();
  }, [onChanged]);

  const handleSelect = useCallback((t: CrmTemplate) => {
    setDraft(null);
    setSelectedId(t.id);
  }, []);

  const handleCreate = useCallback(() => {
    setDraft(blankTemplate());
    setSelectedId(null);
  }, []);

  const handleSave = useCallback(
    async (form: EditorForm) => {
      if (!selected) return;
      setSaving(true);
      try {
        const isEdit = !!selected.id;
        const res = await fetch(TEMPLATES_KEY, {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isEdit ? { id: selected.id, ...form } : form),
        });
        if (res.ok) {
          const saved = (await res.json().catch(() => null)) as CrmTemplate | null;
          setDraft(null);
          if (saved?.id) setSelectedId(saved.id);
          await refresh();
        }
      } catch (e) {
        console.error("Failed to save template", e);
      } finally {
        setSaving(false);
      }
    },
    [selected, refresh],
  );

  const handleDuplicate = useCallback(
    async (t: CrmTemplate) => {
      try {
        const res = await fetch(TEMPLATES_KEY, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${t.name} (Copy)`,
            subject: t.subject,
            message_body: t.message_body,
            template_type: t.template_type,
            channel_whatsapp: t.channel_whatsapp,
            channel_email: t.channel_email,
            variables: t.variables,
          }),
        });
        if (res.ok) {
          const saved = (await res.json().catch(() => null)) as CrmTemplate | null;
          setDraft(null);
          if (saved?.id) setSelectedId(saved.id);
          await refresh();
        }
      } catch (e) {
        console.error("Failed to duplicate template", e);
      }
    },
    [refresh],
  );

  const handleDelete = useCallback(
    async (t: CrmTemplate) => {
      if (!t.id || t.is_system) return;
      if (!confirm("Delete this template?")) return;
      try {
        await fetch(`${TEMPLATES_KEY}?id=${t.id}`, { method: "DELETE" });
        setSelectedId(null);
        setDraft(null);
        await refresh();
      } catch (e) {
        console.error("Failed to delete template", e);
      }
    },
    [refresh],
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[340px_1fr]">
      {/* Left pane — list (stacks above the editor under lg) */}
      <div className="rounded-2xl border border-sage/20 bg-cream/30 p-5">
        <TemplateList
          templates={templates}
          selectedId={draft ? null : selectedId}
          onSelect={handleSelect}
          onCreate={handleCreate}
        />
      </div>

      {/* Right pane — editor */}
      <div className="rounded-2xl border border-sage/20 bg-white-warm p-6">
        {selected ? (
          <TemplateEditor
            key={selected.id || "draft"}
            template={selected}
            saving={saving}
            onSave={handleSave}
            onDuplicate={selected.id ? handleDuplicate : undefined}
            onDelete={handleDelete}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Mail className="mb-4 text-sage/40" size={56} aria-hidden />
            <h3 className="mb-1 font-body font-semibold text-2xl text-charcoal">Pick a template to edit</h3>
            <p className="font-body text-sm text-charcoal/60">
              Choose a template on the left, or create a new one.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
