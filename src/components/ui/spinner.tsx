import { Loader2, type LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

/** Canonical loader. Size via className (default size-4); color inherits via currentColor. */
function Spinner({ className, ...props }: LucideProps) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

/** Centered full-height loader for route/auth gates where no layout shape is known. */
function PageLoader({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-[60vh] w-full items-center justify-center", className)}>
      <Spinner className="size-10 text-sage" />
    </div>
  );
}

export { Spinner, PageLoader };
