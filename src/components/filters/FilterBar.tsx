import { cn } from "@/lib/utils";
import { FilterReset } from "./FilterReset";

export function FilterBar({
  children,
  reset,
  sticky = false,
  className,
}: {
  children: React.ReactNode;
  reset?: () => void;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-sage/15 bg-white-warm p-3",
        sticky && "sticky top-0 z-20 md:static",
        className,
      )}
    >
      {children}
      {reset && (
        <div className="ml-auto">
          <FilterReset onReset={reset} />
        </div>
      )}
    </div>
  );
}
