import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type FormAlertVariant = "error" | "warning" | "info" | "success";

const icons: Record<FormAlertVariant, React.ElementType> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

// Warm pill tokens (terracotta/sage/warm-red), never Tailwind amber/green/red —
// keeps alerts in sync with <Pill> and the design system, dark mode included.
const styles: Record<FormAlertVariant, string> = {
  error: "border-pill-danger-dot/40 bg-pill-danger-bg text-pill-danger-fg [&>svg]:text-pill-danger-dot",
  warning: "border-pill-warning-dot/40 bg-pill-warning-bg text-pill-warning-fg [&>svg]:text-pill-warning-dot",
  info: "border-pill-info-dot/40 bg-pill-info-bg text-pill-info-fg [&>svg]:text-pill-info-dot",
  success: "border-pill-success-dot/40 bg-pill-success-bg text-pill-success-fg [&>svg]:text-pill-success-dot",
};

type FormAlertProps = {
  message?: string | null;
  variant?: FormAlertVariant;
  className?: string;
};

export function FormAlert({ message, variant = "error", className }: FormAlertProps) {
  if (!message) return null;

  const Icon = icons[variant];

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-body animate-in fade-in-0 zoom-in-95 duration-200",
        styles[variant],
        className
      )}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
