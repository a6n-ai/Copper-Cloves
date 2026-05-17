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

const styles: Record<FormAlertVariant, string> = {
  error: "border-red-300 bg-red-50 text-red-800 [&>svg]:text-red-600",
  warning: "border-amber-300 bg-amber-50 text-amber-800 [&>svg]:text-amber-600",
  info: "border-sage/40 bg-sage/5 text-charcoal [&>svg]:text-sage",
  success: "border-green-300 bg-green-50 text-green-800 [&>svg]:text-green-600",
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
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-body animate-in slide-in-from-top duration-300",
        styles[variant],
        className
      )}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
