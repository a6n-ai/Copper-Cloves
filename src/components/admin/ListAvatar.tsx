import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ListAvatarProps {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  ringClassName?: string;
  fallbackClassName?: string;
  overlay?: React.ReactNode;
  className?: string;
}

const sizeMap = {
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-14 w-14 text-lg",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ListAvatar({
  name,
  src,
  size = "md",
  ringClassName,
  fallbackClassName,
  overlay,
  className,
}: ListAvatarProps) {
  const usableSrc = src && !src.includes("placeholder") ? src : undefined;
  return (
    <div className={cn("relative w-fit", className)}>
      <Avatar
        className={cn(
          sizeMap[size],
          "ring-offset-background ring-2 ring-offset-2",
          ringClassName ?? "ring-sage/40",
        )}
      >
        {usableSrc ? <AvatarImage src={usableSrc} alt={name} /> : null}
        <AvatarFallback
          className={cn(
            "font-display font-medium",
            fallbackClassName ?? "bg-sage/10 text-sage",
          )}
        >
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      {overlay}
    </div>
  );
}

export default ListAvatar;
