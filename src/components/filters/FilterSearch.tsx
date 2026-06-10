import { useEffect, useRef, useState } from "react";
import { Search, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function FilterSearch({
  value,
  onChange,
  placeholder = "Search…",
  debounceMs = 250,
  className,
  autoFocus,
  icon: Icon = Search,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  autoFocus?: boolean;
  icon?: LucideIcon;
  "aria-label"?: string;
}) {
  const [local, setLocal] = useState(value);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const mounted = useRef(false);

  // keep refs current every render
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  // mirror parent value into the box (e.g. external reset)
  useEffect(() => {
    setLocal(value);
  }, [value]);

  // debounce: emit only when local diverges from the latest parent value
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (local === valueRef.current) return;
    const id = setTimeout(() => onChangeRef.current(local), debounceMs);
    return () => clearTimeout(id);
  }, [local, debounceMs]);

  return (
    <div className={cn("group relative flex-1 min-w-[180px]", className)}>
      <Icon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-charcoal/40 transition-colors duration-200 group-hover:text-sage" aria-hidden />
      <input
        type="text"
        value={local}
        autoFocus={autoFocus}
        aria-label={ariaLabel ?? placeholder}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-9 w-full rounded-md border border-sage/20 bg-white-warm pl-9 pr-9 font-body text-sm text-charcoal",
          "placeholder:text-charcoal/40 transition-all duration-200 ease-out",
          "hover:border-sage/40 hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]",
          "focus:border-sage focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sage/30",
        )}
      />
      {local && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setLocal("");
            onChangeRef.current("");
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-sage/10 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sage/30"
        >
          <X className="h-3.5 w-3.5 text-charcoal/50" aria-hidden />
        </button>
      )}
    </div>
  );
}
