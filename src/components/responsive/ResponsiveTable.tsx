import { cn } from "@/lib/utils";

/**
 * Default: horizontal-scroll wrapper with a subtle both-edge fade on phones.
 * The fade is a `mask-image` on the scroll container (fades the content itself
 * to transparent) — NOT a coloured overlay. A colour overlay (the old
 * `from-card` gradient) picks up the theme's card token and reads as a dirty
 * black smear in dark mode / over coloured cells; a mask is theme-agnostic.
 * Disabled at md+ where tables fit without scrolling. `-webkit-mask-image` is
 * required for iOS Safari, the main place this shows.
 */
const EDGE_FADE =
  "[mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-16px),transparent)] " +
  "[-webkit-mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-16px),transparent)] " +
  "md:[mask-image:none] md:[-webkit-mask-image:none]";

export function ResponsiveTable({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("w-full overflow-x-auto [-webkit-overflow-scrolling:touch]", EDGE_FADE, className)}>
      {children}
    </div>
  );
}

/** Card-stack: render rows as cards under md, real table at md+. Use only where flagged. */
export function ResponsiveCards<T>({
  data,
  renderCard,
  renderTable,
}: {
  data: T[];
  renderCard: (row: T, i: number) => React.ReactNode;
  renderTable: () => React.ReactNode;
}) {
  return (
    <>
      <div className="space-y-3 md:hidden">{data.map(renderCard)}</div>
      <div className="hidden md:block">{renderTable()}</div>
    </>
  );
}
