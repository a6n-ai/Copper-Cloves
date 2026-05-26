import { useState } from "react";
import { QrCode } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/dashboard/AnimatedIcon";
import { ScanCheckInModal } from "@/components/checkin/ScanCheckInModal";

export interface CheckInScanButtonProps {
  label?: string;
  variant?: ButtonProps["variant"];
  className?: string;
  disabled?: boolean;
}

/**
 * Self-contained "scan to check in" trigger — owns its dialog state and renders
 * the shared camera modal. Drop into any portal (member, instructor, …).
 */
export function CheckInScanButton({
  label = "Scan to check in",
  variant = "default",
  className,
  disabled = false,
}: CheckInScanButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={className}
      >
        <AnimatedIcon icon={QrCode} size={16} />
        {label}
      </Button>
      {disabled ? null : <ScanCheckInModal open={open} onOpenChange={setOpen} />}
    </>
  );
}
