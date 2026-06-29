import { memo, useEffect, useMemo, useState } from "react";
import { renderPreviewDoc, interpolate } from "./crmPreview";

interface EmailPreviewProps {
  body: string;
  subject: string;
  vars: Record<string, string>;
}

/** ~250ms debounce so typing in the editor doesn't re-render the iframe per keystroke. */
function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Live email preview inside a phone-width, design.md-styled frame. The rendered
 * document cross-fades on change (reduced-motion guarded). Pure presentational.
 */
function EmailPreviewBase({ body, subject, vars }: EmailPreviewProps) {
  const debouncedBody = useDebounced(body);
  const debouncedSubject = useDebounced(subject);

  const renderedSubject = useMemo(
    () => interpolate(debouncedSubject, vars) || "(no subject)",
    [debouncedSubject, vars],
  );
  const srcDoc = useMemo(
    () => renderPreviewDoc(debouncedBody, debouncedSubject, vars),
    [debouncedBody, debouncedSubject, vars],
  );
  // Key bumps on content change → React remounts the iframe → CSS cross-fade plays.
  const fadeKey = useMemo(() => `${renderedSubject}::${srcDoc.length}`, [renderedSubject, srcDoc]);

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1">
        <p className="font-body text-xs text-charcoal/50">Subject</p>
        <p className="font-body text-sm text-charcoal tabular-nums" style={{ textWrap: "pretty" }}>
          {renderedSubject}
        </p>
      </div>

      <div className="mx-auto w-full max-w-[400px]">
        <div className="overflow-hidden rounded-2xl border border-sage/15 bg-white-warm shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
          <div className="flex items-center gap-1.5 border-b border-sage/10 bg-cream/40 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-terracotta/50" />
            <span className="h-2.5 w-2.5 rounded-full bg-sage/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-charcoal/20" />
            <span className="ml-2 font-body text-[10px] uppercase tracking-[0.08em] text-charcoal/40">
              Email preview
            </span>
          </div>
          <iframe
            key={fadeKey}
            title="email-live-preview"
            srcDoc={srcDoc}
            sandbox=""
            className="h-[440px] w-full bg-white-warm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
          />
        </div>
      </div>
    </div>
  );
}

export const EmailPreview = memo(EmailPreviewBase);
