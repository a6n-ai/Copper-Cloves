import { useState } from "react";
import { Check, ChevronsUpDown, ListFilter, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { FILTER_TRIGGER, FILTER_ICON } from "@/components/filters";

// Searchable single-select for long, dynamic filters (member, method). shadcn
// Select has no search, so this pairs Popover + cmdk Command. Shared across the
// finance Transactions tab and the Ledger tab so both filter the same way.
export function FilterCombobox({
  value,
  onValueChange,
  options,
  allLabel,
  searchPlaceholder,
  emptyText,
  icon: Icon = ListFilter,
}: Readonly<{
  value: string;
  onValueChange: (v: string) => void;
  options: string[];
  allLabel: string;
  searchPlaceholder: string;
  emptyText: string;
  icon?: LucideIcon;
}>) {
  const [open, setOpen] = useState(false);
  const label = value === "all" ? allLabel : value;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(FILTER_TRIGGER, "justify-between")}
        >
          <span className="flex min-w-0 items-center">
            {Icon && <Icon className={FILTER_ICON} aria-hidden />}
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="font-body text-popover-foreground" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => {
                  onValueChange("all");
                  setOpen(false);
                }}
                className="font-body text-popover-foreground data-[selected=true]:bg-sage/10 data-[selected=true]:text-sage!"
              >
                <Check className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
                {allLabel}
              </CommandItem>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onValueChange(opt);
                    setOpen(false);
                  }}
                  className="font-body text-popover-foreground data-[selected=true]:bg-sage/10 data-[selected=true]:text-sage!"
                >
                  <Check className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{opt}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
