import { cn } from "@/lib/utils";

/** Default: horizontal-scroll wrapper with edge fade. */
export function ResponsiveTable({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className={cn("w-full overflow-x-auto [-webkit-overflow-scrolling:touch]", className)}>
        {children}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-card/90 to-transparent md:hidden" />
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
