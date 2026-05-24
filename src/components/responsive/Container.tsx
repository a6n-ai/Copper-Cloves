import { cn } from "@/lib/utils";

const SIZES = {
  narrow: "max-w-3xl",
  default: "max-w-5xl",
  wide: "max-w-7xl",
} as const;

export function Container({
  size = "default",
  className,
  children,
}: {
  size?: keyof typeof SIZES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", SIZES[size], className)}>
      {children}
    </div>
  );
}
