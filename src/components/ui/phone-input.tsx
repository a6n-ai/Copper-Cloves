import React, { useState } from "react";
import PhoneInputBase, {
  type Value,
  type Props as BaseProps,
  getCountryCallingCode,
  type Country,
} from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import { GlobeIcon, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";

import "react-phone-number-input/style.css";

type PhoneInputProps = Omit<React.ComponentProps<"input">, "onChange" | "value" | "ref"> &
  Omit<BaseProps<typeof PhoneInputBase>, "onChange"> & {
    onChange?: (value: Value) => void;
    className?: string;
  };

function PhoneInput({ className, onChange, value, ...props }: PhoneInputProps) {
  return (
    <PhoneInputBase
      className={cn("flex", className)}
      flagComponent={FlagComponent}
      countrySelectComponent={CountrySelect}
      inputComponent={InputComponent}
      smartCaret={false}
      international
      defaultCountry="IN"
      value={value || undefined}
      onChange={(v) => onChange?.(v || ("" as Value))}
      {...props}
    />
  );
}

const InputComponent = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => (
  <Input
    ref={ref}
    className={cn("rounded-l-none border-l-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:z-10", className)}
    {...props}
  />
));
InputComponent.displayName = "PhoneInputField";

type CountryEntry = { label: string; value: Country | undefined };

type CountrySelectProps = {
  disabled?: boolean;
  value: Country;
  options: CountryEntry[];
  onChange: (country: Country) => void;
};

function CountrySelect({ disabled, value: selected, options, onChange }: CountrySelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="flex h-10 items-center gap-1.5 rounded-r-none border-r-0 px-3 hover:bg-transparent focus:z-10"
        >
          <FlagComponent country={selected} countryName={selected} />
          <ChevronsUpDown className="h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 bg-white-warm shadow-md border border-sage/20" align="start">
        <Command className="bg-white-warm">
          <CommandInput placeholder="Search country..." className="h-9" />
          <CommandEmpty>No country found.</CommandEmpty>
          <CommandList>
            <ScrollArea className="h-64">
              {options
                .filter((o): o is { label: string; value: Country } => !!o.value)
                .map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <FlagComponent country={option.value} countryName={option.label} />
                    <span className="flex-1 text-sm">{option.label}</span>
                    <span className="text-sm text-muted-foreground">
                      +{getCountryCallingCode(option.value)}
                    </span>
                    {selected === option.value && (
                      <Check className="h-3.5 w-3.5 text-sage shrink-0" />
                    )}
                  </CommandItem>
                ))}
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function FlagComponent({ country, countryName }: { country: Country; countryName: string }) {
  const Flag = country ? flags[country] : null;
  return (
    <span className="flex h-4 w-5 items-center justify-center overflow-hidden rounded-sm">
      {Flag ? (
        <Flag title={countryName} />
      ) : (
        <GlobeIcon className="h-4 w-4 opacity-60" />
      )}
    </span>
  );
}

export { PhoneInput };
export type { Value as PhoneValue };
