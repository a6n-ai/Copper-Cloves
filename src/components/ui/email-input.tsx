import * as React from "react";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const EmailInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    return (
      <div className="flex h-10 w-full rounded-md border border-input bg-transparent shadow-xs transition-colors focus-within:ring-1 focus-within:ring-ring">
        <span className="flex items-center pl-3 pr-2 text-muted-foreground shrink-0">
          <Mail className="h-4 w-4" />
        </span>
        <input
          ref={ref}
          type="email"
          inputMode="email"
          autoComplete="email"
          className={cn(
            "flex-1 bg-transparent py-1 pr-3 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm font-body",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
EmailInput.displayName = "EmailInput";

export { EmailInput };
