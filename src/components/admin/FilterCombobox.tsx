import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
}: Readonly<{
  value: string;
  onValueChange: (v: string) => void;
  options: string[];
  allLabel: string;
  searchPlaceholder: string;
  emptyText: string;
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
          className="w-full justify-between border-sage/20 bg-white-warm font-body font-normal text-charcoal hover:bg-white-warm"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="font-body" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => {
                  onValueChange("all");
                  setOpen(false);
                }}
                className="font-body text-popover-foreground data-[selected=true]:bg-sage/10 data-[selected=true]:text-sage"
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
                  className="font-body text-popover-foreground data-[selected=true]:bg-sage/10 data-[selected=true]:text-sage"
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
