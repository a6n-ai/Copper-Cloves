import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function FilterSearch({
  value,
  onChange,
  placeholder = "Search…",
  debounceMs = 250,
  className,
  autoFocus,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  autoFocus?: boolean;
  "aria-label"?: string;
}) {
  const [local, setLocal] = useState(value);
  const first = useRef(true);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (local === value) return;
    const id = setTimeout(() => onChange(local), debounceMs);
    return () => clearTimeout(id);
  }, [local]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn("relative flex-1 min-w-[180px]", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal/40" aria-hidden />
      <input
        type="text"
        value={local}
        autoFocus={autoFocus}
        aria-label={ariaLabel ?? placeholder}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-9 w-full rounded-md border border-sage/20 bg-white-warm pl-9 pr-9 font-body text-sm text-charcoal",
          "placeholder:text-charcoal/40 transition-colors",
          "focus:border-sage focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sage/30",
        )}
      />
      {local && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setLocal("");
            onChange("");
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-sage/10 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sage/30"
        >
          <X className="h-3.5 w-3.5 text-charcoal/50" aria-hidden />
        </button>
      )}
    </div>
  );
}
