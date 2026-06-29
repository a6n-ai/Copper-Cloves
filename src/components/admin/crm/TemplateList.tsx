import { memo, useMemo } from "react";
import { Mail, MessageCircle, Plus } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { CRM_GROUPS, groupForTemplate, type CrmTemplate, type CrmGroupKey } from "./crmPreview";

interface TemplateListProps {
  templates: CrmTemplate[];
  selectedId: string | null;
  onSelect: (t: CrmTemplate) => void;
  onCreate: () => void;
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function TemplateRow({
  t,
  selected,
  onSelect,
}: {
  t: CrmTemplate;
  selected: boolean;
  onSelect: (t: CrmTemplate) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(t)}
      aria-current={selected ? "true" : undefined}
      className={`w-full rounded-xl border p-4 text-left transition-[box-shadow,border-color,background-color,transform] duration-200 ease-out active:scale-[0.99] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1 ${
        selected
          ? "border-sage/40 bg-sage/[0.06] shadow-[0_4px_24px_rgba(51,51,51,0.08)]"
          : "border-sage/15 bg-white-warm hover:border-sage/25 hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h4 className="min-w-0 flex-1 truncate font-body font-semibold text-base text-charcoal" style={{ textWrap: "balance" }}>
          {t.name}
        </h4>
        <div className="flex shrink-0 items-center gap-1.5">
          {t.is_system && <Pill tone="warning" size="sm" noIcon>System</Pill>}
          <Pill tone={t.channel_email ? "success" : "neutral"} size="sm" noIcon>
            {t.channel_email ? "Email on" : "Email off"}
          </Pill>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {t.channel_email && (
          <span className="inline-flex items-center gap-1 font-body text-[11px] text-terracotta">
            <Mail size={11} aria-hidden />
            Email
          </span>
        )}
        {t.channel_whatsapp && (
          <span className="inline-flex items-center gap-1 font-body text-[11px] text-sage">
            <MessageCircle size={11} aria-hidden />
            WhatsApp
          </span>
        )}
        <span className="font-body text-[11px] tabular-nums text-charcoal/45">
          {dateFmt.format(new Date(t.created_at))}
        </span>
      </div>
    </button>
  );
}

function TemplateListBase({ templates, selectedId, onSelect, onCreate }: TemplateListProps) {
  const grouped = useMemo(() => {
    const map = new Map<CrmGroupKey, CrmTemplate[]>();
    for (const t of templates) {
      const g = groupForTemplate(t);
      const arr = map.get(g) ?? [];
      arr.push(t);
      map.set(g, arr);
    }
    return map;
  }, [templates]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="font-body font-semibold text-xl text-charcoal">Email templates</h3>
        <Button onClick={onCreate} variant="sage" size="sm" className="shrink-0">
          <Plus size={16} className="mr-1.5" aria-hidden />
          New
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-sage/25 bg-white-warm p-8 text-center">
          <p className="font-body text-sm text-charcoal/60">No templates yet.</p>
        </div>
      ) : (
        CRM_GROUPS.map((group) => {
          const rows = grouped.get(group.key);
          if (!rows || rows.length === 0) return null;
          return (
            <section key={group.key} className="space-y-2.5">
              <h4 className="font-body text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal/45">
                {group.label}
              </h4>
              <div className="space-y-2.5">
                {rows.map((t) => (
                  <TemplateRow key={t.id} t={t} selected={t.id === selectedId} onSelect={onSelect} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

export const TemplateList = memo(TemplateListBase);
